-- Telefone do membro no perfil — permite pré-preencher formulários e sincronizar dados
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone text;
