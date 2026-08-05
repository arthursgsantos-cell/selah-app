-- Community photos table (publicly readable, uploaded by pastor/admin)
CREATE TABLE IF NOT EXISTS public.fotos_comunidade (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id  uuid NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  url        text NOT NULL,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.fotos_comunidade ENABLE ROW LEVEL SECURITY;

-- Publicly readable (guest home page needs this)
CREATE POLICY "fotos_comunidade_select" ON public.fotos_comunidade
  FOR SELECT USING (true);

-- Only pastor/admin can insert for their own church
CREATE POLICY "fotos_comunidade_insert" ON public.fotos_comunidade
  FOR INSERT TO authenticated
  WITH CHECK (
    igreja_id = public.user_igreja_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('pastor', 'admin')
    )
  );

-- Pastor/admin can delete any photo from their church
CREATE POLICY "fotos_comunidade_delete" ON public.fotos_comunidade
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('pastor', 'admin')
      AND p.igreja_id = fotos_comunidade.igreja_id
    )
  );

-- Storage bucket for community photos
INSERT INTO storage.buckets (id, name, public)
  VALUES ('fotos-comunidade', 'fotos-comunidade', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fotos_comunidade_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'fotos-comunidade');

CREATE POLICY "fotos_comunidade_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fotos-comunidade'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('pastor', 'admin')
    )
  );

CREATE POLICY "fotos_comunidade_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fotos-comunidade'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('pastor', 'admin')
    )
  );
