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

CREATE OR REPLACE FUNCTION public.notify_member_on_payment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_label text;
  amount_label text;
  notification_title text;
  notification_message text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  period_label := to_char(make_date(NEW.year, NEW.month, 1), 'FMMonth YYYY');
  amount_label := '৳' || NEW.amount::text;

  IF NEW.status = 'approved' THEN
    notification_title := 'Payment Approved';
    notification_message := 'Your payment for ' || period_label || ' has been approved. Amount: ' || amount_label || '.';
  ELSIF NEW.status = 'rejected' THEN
    notification_title := 'Payment Rejected';
    notification_message := 'Your payment for ' || period_label || ' has been rejected. Amount: ' || amount_label || '.';
  ELSE
    notification_title := 'Payment Marked Pending';
    notification_message := 'Your payment for ' || period_label || ' is now pending review again. Amount: ' || amount_label || '.';
  END IF;

  IF NEW.admin_note IS NOT NULL AND length(trim(NEW.admin_note)) > 0 THEN
    notification_message := notification_message || ' Note: ' || trim(NEW.admin_note);
  END IF;

  INSERT INTO public.notifications (user_id, title, message, kind, data)
  VALUES (
    NEW.user_id,
    notification_title,
    notification_message,
    'payment_status',
    jsonb_build_object(
      'paymentId', NEW.id,
      'status', NEW.status,
      'route', '/notifications'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_payment_submission ON public.payments;
CREATE TRIGGER trg_notify_admins_on_payment_submission
AFTER INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_on_payment_submission();

DROP TRIGGER IF EXISTS trg_notify_member_on_payment_status_change ON public.payments;
CREATE TRIGGER trg_notify_member_on_payment_status_change
AFTER UPDATE OF status ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.notify_member_on_payment_status_change();
