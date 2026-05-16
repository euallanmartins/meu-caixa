-- Add instagram column to barbearias
ALTER TABLE public.barbearias
ADD COLUMN IF NOT EXISTS instagram text;
