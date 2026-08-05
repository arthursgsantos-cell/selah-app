-- Importação automática de roteiros a partir da planilha de controle.
-- `arquivo_nome` é a chave de deduplicação: o nome do PDF na pasta do Drive.
-- `publicado_por` guarda o nome escrito na planilha (ex: "Pastor Pedro"),
-- diferente de `created_by`, que é o uuid de quem operou o app.

alter table public.resumos_culto
  add column if not exists arquivo_nome  text,
  add column if not exists publicado_por text;

-- Evita importar o mesmo roteiro duas vezes na mesma igreja
create unique index if not exists resumos_culto_arquivo_unico
  on public.resumos_culto (igreja_id, arquivo_nome)
  where arquivo_nome is not null;
