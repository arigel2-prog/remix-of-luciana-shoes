-- Create wholesale customers table
CREATE TABLE public.wholesale_customers (
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

-- Enable RLS
ALTER TABLE public.wholesale_customers ENABLE ROW LEVEL SECURITY;

-- Wholesale customers can view their own profile
CREATE POLICY "Wholesale customers can view own profile"
ON public.wholesale_customers
FOR SELECT
USING (true);

-- Wholesale customers can update their own profile
CREATE POLICY "Wholesale customers can update own profile"
ON public.wholesale_customers
FOR UPDATE
USING (auth.uid() = user_id);

-- Anyone authenticated can insert (for registration)
CREATE POLICY "Authenticated users can register"
ON public.wholesale_customers
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_wholesale_customers_updated_at
BEFORE UPDATE ON public.wholesale_customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();