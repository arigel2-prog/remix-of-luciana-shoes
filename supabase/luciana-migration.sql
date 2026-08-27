-- ============================================================================
-- Luciana Shoes back-office — complete schema for a fresh Supabase project
-- ============================================================================
-- Run this ONCE, top to bottom, in the Supabase SQL Editor of the NEW project.
-- Run it as the SQL Editor's default role: it creates policies on
-- storage.objects and a trigger on auth.users, which needs elevated rights.
--
-- Provenance: this is the nine Lovable migrations that built the live database,
-- replayed in their original order. They were recovered from this repo's git
-- history (commit f8a00f0^, path supabase/migrations/) — this is the schema the
-- app actually runs against, not a reconstruction from the TypeScript types.
--
-- Sections 1-9 map 1:1 to those migrations. Order matters: section 6 deliberately
-- drops the permissive policies created in sections 1 and 4 and replaces them
-- with role-gated ones. Do not reorder or run sections individually.
--
-- Re-running is safe: every statement is guarded (IF NOT EXISTS / DROP ... IF
-- EXISTS / ON CONFLICT DO NOTHING).
-- ============================================================================


-- ============================================================================
-- 1. Core catalogue, clients, orders, payments  (20260326055821)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.styles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  style_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  factory_name TEXT,
  factory_description TEXT,
  category TEXT,
  wholesale_price DECIMAL(10,2),
  retail_price DECIMAL(10,2),
  image_url TEXT,
  sizes TEXT[],
  colors TEXT[],
  materials TEXT,
  season TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  season TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_confirmation', 'confirmed', 'submitted_to_factory', 'in_production', 'shipped', 'delivered', 'cancelled')),
  notes TEXT,
  total_amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  style_id UUID NOT NULL REFERENCES public.styles(id) ON DELETE RESTRICT,
  size TEXT,
  color TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.styles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments    ENABLE ROW LEVEL SECURITY;

-- Interim wide-open policies. Section 6 drops all five and replaces them with
-- admin-gated policies — they exist here only so the replay matches history.
DROP POLICY IF EXISTS "Allow all access to styles"      ON public.styles;
DROP POLICY IF EXISTS "Allow all access to clients"     ON public.clients;
DROP POLICY IF EXISTS "Allow all access to orders"      ON public.orders;
DROP POLICY IF EXISTS "Allow all access to order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow all access to payments"    ON public.payments;
CREATE POLICY "Allow all access to styles"      ON public.styles      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to clients"     ON public.clients     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to orders"      ON public.orders      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to payments"    ON public.payments    FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_styles_updated_at  ON public.styles;
DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
DROP TRIGGER IF EXISTS update_orders_updated_at  ON public.orders;
CREATE TRIGGER update_styles_updated_at  BEFORE UPDATE ON public.styles  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at  BEFORE UPDATE ON public.orders  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for style photography. The app writes style.image_url pointing
-- into this bucket; without it every image upload fails at runtime.
INSERT INTO storage.buckets (id, name, public)
VALUES ('style-images', 'style-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Style images are publicly accessible" ON storage.objects;
CREATE POLICY "Style images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'style-images');

-- Interim open write policies; section 6 replaces them with admin-only ones.
DROP POLICY IF EXISTS "Anyone can upload style images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update style images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete style images" ON storage.objects;
CREATE POLICY "Anyone can upload style images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'style-images');
CREATE POLICY "Anyone can update style images" ON storage.objects FOR UPDATE USING (bucket_id = 'style-images');
CREATE POLICY "Anyone can delete style images" ON storage.objects FOR DELETE USING (bucket_id = 'style-images');


-- ============================================================================
-- 2. Style detail columns  (20260329144049)
-- ============================================================================

ALTER TABLE public.styles ADD COLUMN IF NOT EXISTS last_number text;
ALTER TABLE public.styles ADD COLUMN IF NOT EXISTS leather_description text;
ALTER TABLE public.styles ADD COLUMN IF NOT EXISTS sole_type text;

UPDATE public.styles SET last_number = factory_name
WHERE factory_name IS NOT NULL AND last_number IS NULL;


-- ============================================================================
-- 3. Client customer number  (20260331015847)
-- ============================================================================

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS customer_number text;

DO $$ BEGIN
  ALTER TABLE public.clients ADD CONSTRAINT clients_customer_number_key UNIQUE (customer_number);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;


-- ============================================================================
-- 4. Expenses  (20260331051942)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  season text,
  vendor text,
  reference_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to expenses" ON public.expenses;
CREATE POLICY "Allow all access to expenses" ON public.expenses
  FOR ALL TO public USING (true) WITH CHECK (true);


-- ============================================================================
-- 5. Wholesale customer accounts  (20260407024503)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wholesale_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  client_id UUID REFERENCES public.clients(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wholesale_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Wholesale customers can view own profile"   ON public.wholesale_customers;
DROP POLICY IF EXISTS "Wholesale customers can update own profile" ON public.wholesale_customers;
DROP POLICY IF EXISTS "Authenticated users can register"           ON public.wholesale_customers;
CREATE POLICY "Wholesale customers can view own profile"   ON public.wholesale_customers FOR SELECT USING (true);
CREATE POLICY "Wholesale customers can update own profile" ON public.wholesale_customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can register"           ON public.wholesale_customers FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_wholesale_customers_updated_at ON public.wholesale_customers;
CREATE TRIGGER update_wholesale_customers_updated_at
BEFORE UPDATE ON public.wholesale_customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- 6. Roles, has_role(), and the real RLS lockdown  (20260608125717)
--    This is the section that replaces every permissive policy above.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'wholesale');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL    ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- SECURITY DEFINER so policies can check roles without recursing into RLS.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

DROP POLICY IF EXISTS "Allow all access to clients"     ON public.clients;
DROP POLICY IF EXISTS "Allow all access to orders"      ON public.orders;
DROP POLICY IF EXISTS "Allow all access to order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow all access to payments"    ON public.payments;
DROP POLICY IF EXISTS "Allow all access to expenses"    ON public.expenses;
DROP POLICY IF EXISTS "Allow all access to styles"      ON public.styles;

DROP POLICY IF EXISTS "Admins manage clients"     ON public.clients;
DROP POLICY IF EXISTS "Admins manage orders"      ON public.orders;
DROP POLICY IF EXISTS "Admins manage order_items" ON public.order_items;
DROP POLICY IF EXISTS "Admins manage payments"    ON public.payments;
DROP POLICY IF EXISTS "Admins manage expenses"    ON public.expenses;
DROP POLICY IF EXISTS "Admins manage styles"      ON public.styles;

CREATE POLICY "Admins manage clients" ON public.clients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage order_items" ON public.order_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage styles" ON public.styles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Approved wholesale can read styles" ON public.styles;
CREATE POLICY "Approved wholesale can read styles" ON public.styles
  FOR SELECT TO authenticated
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.wholesale_customers w
      WHERE w.user_id = auth.uid() AND w.is_approved = true
    )
  );

DROP POLICY IF EXISTS "Wholesale customers can view own profile" ON public.wholesale_customers;
CREATE POLICY "Wholesale customers can view own profile" ON public.wholesale_customers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage wholesale customers" ON public.wholesale_customers;
CREATE POLICY "Admins manage wholesale customers" ON public.wholesale_customers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- style-images: reads stay public (the bucket is public), writes become admin-only.
DROP POLICY IF EXISTS "Anyone can upload style images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update style images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete style images" ON storage.objects;

DROP POLICY IF EXISTS "Admins upload style images" ON storage.objects;
DROP POLICY IF EXISTS "Admins update style images" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete style images" ON storage.objects;

CREATE POLICY "Admins upload style images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'style-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update style images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'style-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete style images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'style-images' AND public.has_role(auth.uid(), 'admin'));


-- ============================================================================
-- 7. Admin invitations  (20260608131644)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'admin',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_invitations TO authenticated;
GRANT ALL ON public.admin_invitations TO service_role;

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage invitations" ON public.admin_invitations;
CREATE POLICY "Admins manage invitations" ON public.admin_invitations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_admin_invitations_updated_at ON public.admin_invitations;
CREATE TRIGGER update_admin_invitations_updated_at
BEFORE UPDATE ON public.admin_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.accept_admin_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.admin_invitations%ROWTYPE;
  _user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO _inv FROM public.admin_invitations WHERE token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF _inv.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_accepted');
  END IF;

  IF _inv.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  IF lower(_inv.email) <> lower(_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'email_mismatch');
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), _inv.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.admin_invitations
  SET accepted_at = now(), accepted_by = auth.uid()
  WHERE id = _inv.id;

  RETURN jsonb_build_object('success', true, 'role', _inv.role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_admin_invitation(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_invitation_info(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.admin_invitations%ROWTYPE;
BEGIN
  SELECT * INTO _inv FROM public.admin_invitations WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid_token');
  END IF;
  IF _inv.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'already_accepted');
  END IF;
  IF _inv.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'expired');
  END IF;
  RETURN jsonb_build_object('valid', true, 'email', _inv.email, 'role', _inv.role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_info(text) TO anon, authenticated;


-- ============================================================================
-- 8. First-admin bootstrap  (20260630134422)
-- ============================================================================
-- The very first account to sign up on a fresh project becomes admin. Without
-- the FOR EACH ROW below the trigger is statement-level, NEW is unbound, and
-- the trigger errors — which blocks signup entirely, so nobody can ever get in.

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_bootstrap_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.bootstrap_first_admin();

-- Covers the case where an account already exists before this ran.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
ORDER BY u.created_at ASC
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;


-- ============================================================================
-- 9. Delivery cross-check and issues  (20260717033539)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.delivery_issue_type AS ENUM ('missing','wrong','damaged','extra');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_issue_status AS ENUM ('open','resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.order_item_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE UNIQUE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  verified boolean NOT NULL DEFAULT false,
  checked_at timestamptz,
  checked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_checks TO authenticated;
GRANT ALL ON public.order_item_checks TO service_role;
ALTER TABLE public.order_item_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage order_item_checks" ON public.order_item_checks;
CREATE POLICY "Admins manage order_item_checks" ON public.order_item_checks
  FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_order_item_checks_updated ON public.order_item_checks;
CREATE TRIGGER trg_order_item_checks_updated
  BEFORE UPDATE ON public.order_item_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.delivery_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  issue_type public.delivery_issue_type NOT NULL,
  notes text,
  status public.delivery_issue_status NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  resolved_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_issues TO authenticated;
GRANT ALL ON public.delivery_issues TO service_role;
ALTER TABLE public.delivery_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage delivery_issues" ON public.delivery_issues;
CREATE POLICY "Admins manage delivery_issues" ON public.delivery_issues
  FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_delivery_issues_updated ON public.delivery_issues;
CREATE TRIGGER trg_delivery_issues_updated
  BEFORE UPDATE ON public.delivery_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_delivery_issues_status  ON public.delivery_issues(status);
CREATE INDEX IF NOT EXISTS idx_delivery_issues_order   ON public.delivery_issues(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_checks_order ON public.order_item_checks(order_id);


-- ============================================================================
-- 10. Table grants
-- ============================================================================
-- Migrations 6, 7 and 9 granted explicitly on the tables they created; the
-- earlier tables relied on Supabase's ALTER DEFAULT PRIVILEGES for the public
-- schema. Restating them for every table makes this file self-contained, so it
-- behaves the same on a project whose default privileges differ. This is not a
-- loosening: RLS is enabled on all 11 tables and every policy above still
-- decides which rows a grant can actually reach.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.styles              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wholesale_customers TO authenticated;

GRANT ALL ON public.styles              TO service_role;
GRANT ALL ON public.clients             TO service_role;
GRANT ALL ON public.orders              TO service_role;
GRANT ALL ON public.order_items         TO service_role;
GRANT ALL ON public.payments            TO service_role;
GRANT ALL ON public.expenses            TO service_role;
GRANT ALL ON public.wholesale_customers TO service_role;


-- ============================================================================
-- Done. Verify with:
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
--     -> expect 11: admin_invitations, clients, delivery_issues, expenses,
--        order_item_checks, order_items, orders, payments, styles, user_roles,
--        wholesale_customers
--   SELECT id, public FROM storage.buckets WHERE id = 'style-images';
--     -> expect one row, public = true
--   SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created_bootstrap_admin';
--     -> expect one row
-- ============================================================================
