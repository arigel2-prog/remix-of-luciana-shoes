
-- 1. Role enum + table
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
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. Security-definer role check
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

-- 3. Drop wide-open policies
DROP POLICY IF EXISTS "Allow all access to clients" ON public.clients;
DROP POLICY IF EXISTS "Allow all access to orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all access to order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow all access to payments" ON public.payments;
DROP POLICY IF EXISTS "Allow all access to expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow all access to styles" ON public.styles;

-- 4. Admin-only policies for internal tables
CREATE POLICY "Admins manage clients" ON public.clients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage order_items" ON public.order_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Styles: admin write, public read kept off (was public ALL). Approved wholesale + admins can read.
CREATE POLICY "Admins manage styles" ON public.styles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved wholesale can read styles" ON public.styles
  FOR SELECT TO authenticated
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.wholesale_customers w
      WHERE w.user_id = auth.uid() AND w.is_approved = true
    )
  );

-- 5. Tighten wholesale_customers SELECT (was USING true)
DROP POLICY IF EXISTS "Wholesale customers can view own profile" ON public.wholesale_customers;
CREATE POLICY "Wholesale customers can view own profile" ON public.wholesale_customers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage wholesale customers" ON public.wholesale_customers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Storage: style-images writes admin-only, reads stay public (bucket is public)
DROP POLICY IF EXISTS "Anyone can upload style images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update style images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete style images" ON storage.objects;

CREATE POLICY "Admins upload style images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'style-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update style images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'style-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete style images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'style-images' AND public.has_role(auth.uid(), 'admin'));
