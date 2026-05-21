-- Título pastoral escolhido pelo próprio pastor ao acessar o perfil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS titulo text;
