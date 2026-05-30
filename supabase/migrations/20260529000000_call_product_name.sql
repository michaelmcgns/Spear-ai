-- Store the product/lead type entered by the agent for each analyzed call.
ALTER TABLE public.call_sessions
  ADD COLUMN IF NOT EXISTS product_name TEXT;
