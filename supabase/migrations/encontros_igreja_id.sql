-- Add igreja_id to encontros so we can query cover photos by church without complex joins
ALTER TABLE public.encontros ADD COLUMN IF NOT EXISTS igreja_id uuid REFERENCES public.igrejas(id);

-- Backfill existing rows
UPDATE public.encontros e
SET igreja_id = r.igreja_id
FROM public.celulas c
JOIN public.redes r ON r.id = c.rede_id
WHERE c.id = e.celula_id
AND e.igreja_id IS NULL;

-- Auto-populate on insert
CREATE OR REPLACE FUNCTION public.set_encontro_igreja_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  SELECT r.igreja_id INTO NEW.igreja_id
  FROM public.celulas c
  JOIN public.redes r ON r.id = c.rede_id
  WHERE c.id = NEW.celula_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_encontro_igreja_id ON public.encontros;
CREATE TRIGGER trg_set_encontro_igreja_id
  BEFORE INSERT ON public.encontros
  FOR EACH ROW EXECUTE FUNCTION public.set_encontro_igreja_id();
