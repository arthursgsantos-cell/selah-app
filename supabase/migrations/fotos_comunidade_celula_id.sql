-- Allow fotos_comunidade to be scoped to a specific cell
ALTER TABLE public.fotos_comunidade
  ADD COLUMN IF NOT EXISTS celula_id uuid REFERENCES public.celulas(id) ON DELETE CASCADE;
