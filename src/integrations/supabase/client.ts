// Drop-in replacement for the supabase-js client, backed by Turso.
//
// The name and path are kept deliberately: 21 files import `supabase` from
// here and use the PostgREST-style builder (`from(...).select(...).eq(...)`).
// Reproducing that surface was far less risky than rewriting 91 call sites,
// so this module speaks the same dialect and forwards to the Netlify
// functions in netlify/functions/.
//
// It implements only what the app actually uses. Anything else throws rather
// than silently returning nothing — a loud failure in the console beats a page
// that renders empty and looks like a data problem.
//
// The `any`s below are deliberate and load-bearing. Query results were already
// effectively untyped at all 91 call sites, and narrowing them here would turn
// a data-layer swap into a typing project across 21 files. Row types belong in
// a follow-up that types the tables properly, not in this shim.
/* eslint-disable @typescript-eslint/no-explicit-any */

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;

const TOKEN_KEY = 'luciana.session';

type Json = Record<string, unknown>;

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

export interface Session {
  access_token: string;
  user: AuthUser;
}

interface Result<T> {
  data: T;
  error: { message: string; code?: string } | null;
  /** Populated only when .select() was called with { count: ... }. */
  count?: number | null;
}

// ---------------------------------------------------------------------------
// Session storage
// ---------------------------------------------------------------------------

let currentSession: Session | null = null;

// Subscribers registered through auth.onAuthStateChange.
type AuthListener = (event: string, session: Session | null) => void;
const listeners = new Set<AuthListener>();

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private browsing, or storage blocked. The user just has to sign in again.
    return null;
  }
}

function writeStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* not fatal — the session simply won't survive a reload */
  }
}

function setSession(session: Session | null, event: string) {
  currentSession = session;
  writeStoredToken(session?.access_token ?? null);
  for (const listener of listeners) listener(event, session);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }

  const token = currentSession?.access_token ?? readStoredToken();
  if (token) headers.set('authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body?.error?.message || `Request failed (${response.status})`);
    (error as Error & { status?: number; code?: string }).status = response.status;
    (error as Error & { status?: number; code?: string }).code = body?.error?.code;

    // A dead session should log the user out rather than leaving the UI in a
    // half-authenticated state where every query 401s.
    if (response.status === 401) setSession(null, 'SIGNED_OUT');

    throw error;
  }

  return body as T;
}

/** Wraps a promise into supabase-js's `{ data, error }` shape. */
async function settle<T>(promise: Promise<T>, fallback: T): Promise<Result<T>> {
  try {
    return { data: await promise, error: null };
  } catch (error) {
    const err = error as Error & { code?: string };
    return { data: fallback, error: { message: err.message, code: err.code } };
  }
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

type Filter =
  | { op: string; column: string; value: unknown }
  | { op: 'or'; value: string }
  | { op: 'match'; value: Json }
  | { op: 'not'; column: string; operator: string; value: unknown };

class QueryBuilder implements PromiseLike<Result<any>> {
  private table: string;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private columns = '*';
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean }[] = [];
  private rowLimit: number | null = null;
  private singleMode: 'one' | 'maybe' | null = null;
  private values: unknown = null;
  // supabase-js returns `data: null` from a write unless .select() is chained.
  private returning = false;
  private wantCount = false;
  private headOnly = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = '*', options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    if (this.action === 'select') this.columns = columns;
    else this.returning = true;

    if (options?.count) this.wantCount = true;
    // head: true means "count only, don't fetch the rows".
    if (options?.head) this.headOnly = true;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ op: 'neq', column, value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ op: 'gt', column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ op: 'gte', column, value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ op: 'lt', column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ op: 'lte', column, value });
    return this;
  }

  like(column: string, value: unknown) {
    this.filters.push({ op: 'like', column, value });
    return this;
  }

  ilike(column: string, value: unknown) {
    this.filters.push({ op: 'ilike', column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ op: 'is', column, value });
    return this;
  }

  insert(values: unknown) {
    this.action = 'insert';
    this.values = values;
    return this;
  }

  update(values: unknown) {
    this.action = 'update';
    this.values = values;
    return this;
  }

  upsert(values: unknown) {
    // Not used by the app today. Fail loudly rather than quietly inserting a
    // duplicate row that violates a unique constraint at some later point.
    throw new Error('upsert() is not implemented — use insert() or update()');
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number) {
    this.rowLimit = count;
    return this;
  }

  single() {
    this.singleMode = 'one';
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybe';
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ op: 'in', column, value: values });
    return this;
  }

  or(expression: string) {
    this.filters.push({ op: 'or', value: expression });
    return this;
  }

  match(query: Json) {
    this.filters.push({ op: 'match', value: query });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.filters.push({ op: 'not', column, operator, value });
    return this;
  }

  filter(column: string, operator: string, value: unknown) {
    this.filters.push({ op: operator, column, value });
    return this;
  }

  private describe() {
    return {
      action: this.action,
      table: this.table,
      select: this.columns,
      filters: this.filters,
      order: this.orderBy,
      limit: this.rowLimit,
      single: this.singleMode,
      values: this.values,
      count: this.wantCount,
      head: this.headOnly,
    };
  }

  // Makes the builder awaitable, the way the supabase-js one was.
  then<TResult1 = Result<any>, TResult2 = never>(
    onfulfilled?: ((value: Result<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const run = async (): Promise<Result<any>> => {
      const isWrite = this.action !== 'select';
      const fallback = this.singleMode ? null : [];

      let count: number | null = null;

      const result = await settle(
        request<{ data: unknown; count?: number | null }>('/db', {
          method: 'POST',
          body: JSON.stringify(this.describe()),
        }).then((body) => {
          count = body.count ?? null;
          return body.data;
        }),
        fallback as any,
      );

      // A write without .select() reports success but no rows, matching
      // supabase-js — some call sites destructure only `error`.
      if (isWrite && !this.returning && !result.error) return { data: null, error: null, count };
      return { ...result, count };
    };

    return run().then(onfulfilled, onrejected);
  }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function storageBucket(bucket: string) {
  return {
    async upload(path: string, file: File | Blob, _options?: { upsert?: boolean }) {
      // Uploads always overwrite — the key is derived from the style id, and
      // the old bucket was called with upsert: true everywhere.
      return settle(
        request<{ data: { path: string } }>(
          `/storage/${bucket}/${encodeURIComponent(path)}`,
          {
            method: 'POST',
            body: file,
            headers: { 'content-type': file.type || 'application/octet-stream' },
          },
        ).then((body) => body.data),
        null as any,
      );
    },

    getPublicUrl(path: string) {
      const publicUrl = `${API_BASE}/storage/${bucket}/${encodeURIComponent(path)}`;
      return { data: { publicUrl } };
    },

    async remove(paths: string[]) {
      return settle(
        Promise.all(
          paths.map((path) =>
            request(`/storage/${bucket}/${encodeURIComponent(path)}`, { method: 'DELETE' }),
          ),
        ),
        null as any,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const auth = {
  async getSession(): Promise<{ data: { session: Session | null }; error: null }> {
    if (currentSession) return { data: { session: currentSession }, error: null };

    const token = readStoredToken();
    if (!token) return { data: { session: null }, error: null };

    try {
      const body = await request<{ user: AuthUser | null }>('/auth/session');
      if (!body.user) {
        setSession(null, 'SIGNED_OUT');
        return { data: { session: null }, error: null };
      }

      currentSession = { access_token: token, user: body.user };
      return { data: { session: currentSession }, error: null };
    } catch {
      setSession(null, 'SIGNED_OUT');
      return { data: { session: null }, error: null };
    }
  },

  async getUser(): Promise<{ data: { user: AuthUser | null }; error: null }> {
    const { data } = await auth.getSession();
    return { data: { user: data.session?.user ?? null }, error: null };
  },

  async signInWithPassword(credentials: { email: string; password: string }) {
    const result = await settle(
      request<{ user: AuthUser; session: { access_token: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
      null as any,
    );

    if (result.error) return { data: { user: null, session: null }, error: result.error };

    const session = { access_token: result.data.session.access_token, user: result.data.user };
    setSession(session, 'SIGNED_IN');
    return { data: { user: session.user, session }, error: null };
  },

  async signUp(credentials: { email: string; password: string; options?: unknown }) {
    const result = await settle(
      request<{ user: AuthUser; session: { access_token: string } }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      }),
      null as any,
    );

    if (result.error) return { data: { user: null, session: null }, error: result.error };

    const session = { access_token: result.data.session.access_token, user: result.data.user };
    setSession(session, 'SIGNED_IN');
    return { data: { user: session.user, session }, error: null };
  },

  async signOut() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // Even if the server call fails, drop the local session.
    }
    setSession(null, 'SIGNED_OUT');
    return { error: null };
  },

  onAuthStateChange(callback: AuthListener) {
    listeners.add(callback);

    // supabase-js fires once with the current state shortly after subscribing;
    // ProtectedRoute relies on that to make its first decision.
    void auth.getSession().then(({ data }) => {
      callback(data.session ? 'INITIAL_SESSION' : 'SIGNED_OUT', data.session);
    });

    return {
      data: {
        subscription: {
          // Returns void, not the Set's boolean — callers use this directly as
          // a useEffect cleanup, which must not return a value.
          unsubscribe: () => {
            listeners.delete(callback);
          },
        },
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Public client
// ---------------------------------------------------------------------------

export const supabase = {
  from: (table: string) => new QueryBuilder(table),

  rpc: async (name: string, args?: Json) =>
    settle(
      request<{ data: unknown }>(`/rpc/${name}`, {
        method: 'POST',
        body: JSON.stringify(args ?? {}),
      }).then((body) => body.data),
      null as any,
    ),

  storage: { from: storageBucket },

  auth,

  /** Absolute URL for a Netlify function, for callers that stream (Analytics). */
  functionUrl: (name: string) => `${API_BASE}/${name}`,
};

export type { Result };
