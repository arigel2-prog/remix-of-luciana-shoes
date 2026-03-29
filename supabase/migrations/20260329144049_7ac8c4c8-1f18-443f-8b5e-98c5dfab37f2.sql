
ALTER TABLE public.styles ADD COLUMN IF NOT EXISTS last_number text;
ALTER TABLE public.styles ADD COLUMN IF NOT EXISTS leather_description text;
ALTER TABLE public.styles ADD COLUMN IF NOT EXISTS sole_type text;

-- Migrate existing factory_name data to last_number
UPDATE public.styles SET last_number = factory_name WHERE factory_name IS NOT NULL AND last_number IS NULL;
