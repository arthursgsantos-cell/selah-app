-- Nome livre para eventos do tipo "outro": o rótulo que aparece no lugar de
-- "Outro" nas listagens (ex.: "Vigília", "Batismo").
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS tipo_outro TEXT;
