CREATE OR REPLACE FUNCTION public.notify_admins_on_payment_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_name text;
BEGIN
  SELECT COALESCE(NULLIF(name, ''), 'A member')
  INTO member_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, message, kind, data)
  SELECT
    ur.user_id,
    'New Payment Submitted',
    member_name || ' submitted a payment for ' ||
      to_char(make_date(NEW.year, NEW.month, 1), 'FMMonth YYYY') ||
      '. Amount: ৳' || NEW.amount::text || '. Review it from the admin panel.',
    'payment_submitted',
    jsonb_build_object(
      'paymentId', NEW.id,
      'status', COALESCE(NEW.status, 'pending'),
      'route', '/admin/payments?paymentId=' || NEW.id::text
    )
  FROM public.user_roles ur
  WHERE ur.role = 'admin';

  RETURN NEW;
END;
$$;
