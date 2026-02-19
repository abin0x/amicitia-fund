
-- Add payment_method column to payments table
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'bank' CHECK (payment_method IN ('bank', 'mobile_banking'));

-- Update existing payments to have payment_method = 'bank'
UPDATE public.payments SET payment_method = 'bank' WHERE payment_method IS NULL;
