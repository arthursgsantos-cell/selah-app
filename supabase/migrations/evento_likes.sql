-- Likes/hearts on events
CREATE TABLE IF NOT EXISTS public.evento_likes (
  evento_id  uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  criado_em  timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (evento_id, user_id)
);

ALTER TABLE public.evento_likes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read likes (for counts)
CREATE POLICY "evento_likes_select" ON public.evento_likes
  FOR SELECT USING (true);

-- Users can only insert their own like
CREATE POLICY "evento_likes_insert" ON public.evento_likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own like
CREATE POLICY "evento_likes_delete" ON public.evento_likes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
