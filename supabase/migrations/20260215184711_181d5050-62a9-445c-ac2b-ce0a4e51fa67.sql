
-- Add share-related columns to payments table
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS share_quantity integer,
  ADD COLUMN IF NOT EXISTS share_price integer DEFAULT 4000,
  ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'share' CHECK (payment_type IN ('share', 'custom')),
  ADD COLUMN IF NOT EXISTS admin_note text;

-- Rename 'amount' to 'total_amount' for clarity (keep old column name, add alias)
-- Actually, let's just use the existing 'amount' column as 'total_amount' equivalent
-- No rename needed since it already stores the amount

-- Create admin_settings table for configurable settings
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read settings"
  ON public.admin_settings FOR SELECT
  USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can manage settings"
  ON public.admin_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings
INSERT INTO public.admin_settings (key, value) VALUES
  ('share_price', '4000'),
  ('custom_payment_enabled', 'true'),
  ('min_custom_amount', '1000')
ON CONFLICT (key) DO NOTHING;

-- Update existing payments to have payment_type = 'share' and set share_price
UPDATE public.payments SET payment_type = 'share', share_price = 4000 WHERE payment_type IS NULL;
