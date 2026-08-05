-- Pré-cadastro por e-mail: o líder/pastor cadastra a pessoa antes dela entrar,
-- já definindo o cargo. Quando esse e-mail fizer login, o perfil é criado
-- diretamente com o cargo pré-definido (em vez de "convidado").

alter table public.membros_pre_cadastro
  add column if not exists email text,
  add column if not exists cargo text;

alter table public.membros_pre_cadastro
  drop constraint if exists membros_pre_cadastro_cargo_check;

alter table public.membros_pre_cadastro
  add constraint membros_pre_cadastro_cargo_check
  check (cargo is null or cargo in (
    'admin', 'pastor', 'supervisor', 'supervisor_treinamento',
    'lider', 'lider_treinamento', 'membro'
  ));

-- Busca por e-mail no login precisa ser rápida e case-insensitive
create index if not exists membros_pre_cadastro_email_idx
  on public.membros_pre_cadastro (lower(email));
