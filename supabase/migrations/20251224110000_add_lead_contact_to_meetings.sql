-- Add lead_email and lead_phone to meetings table
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS lead_email TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS lead_phone TEXT;
