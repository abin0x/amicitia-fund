-- Drop the unique constraint that prevents re-submission after rejection
ALTER TABLE public.payments DROP CONSTRAINT payments_user_id_month_year_key;

-- Add mobile_number column to profiles
ALTER TABLE public.profiles ADD COLUMN mobile_number text DEFAULT '' NOT NULL;