
-- Enum for issue type
DO $$ BEGIN
  CREATE TYPE public.delivery_issue_type AS ENUM ('missing','wrong','damaged','extra');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_issue_status AS ENUM ('open','resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Per-line verification
CREATE TABLE public.order_item_checks (
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
CREATE POLICY "Admins manage order_item_checks" ON public.order_item_checks
  FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_order_item_checks_updated
  BEFORE UPDATE ON public.order_item_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Delivery issues
CREATE TABLE public.delivery_issues (
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
CREATE POLICY "Admins manage delivery_issues" ON public.delivery_issues
  FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_delivery_issues_updated
  BEFORE UPDATE ON public.delivery_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_delivery_issues_status ON public.delivery_issues(status);
CREATE INDEX idx_delivery_issues_order ON public.delivery_issues(order_id);
CREATE INDEX idx_order_item_checks_order ON public.order_item_checks(order_id);
