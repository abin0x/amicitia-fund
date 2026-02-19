-- Allow all authenticated users to view all payments (for transparency)
CREATE POLICY "Authenticated users can view all payments"
ON public.payments
FOR SELECT
USING (auth.uid() IS NOT NULL);
