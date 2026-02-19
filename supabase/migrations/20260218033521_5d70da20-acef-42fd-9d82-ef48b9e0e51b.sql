
-- Add email_verified column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

-- Add verification_token and expiry to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_token_expires_at timestamp with time zone;

-- Insert sender_email admin setting if not exists
INSERT INTO public.admin_settings (key, value)
VALUES ('sender_email', 'noreply@example.com')
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_settings (key, value)
VALUES ('sender_name', 'Amicitia')
ON CONFLICT DO NOTHING;
