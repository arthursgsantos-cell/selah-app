-- ============================================================
-- UNIFICAR OS FILHOS DOS CASAIS JÁ VINCULADOS
-- ============================================================
-- `dependentes_compartilhados.sql` deu à tabela como representar um filho do
-- casal. Só que os casais que já estão vinculados nunca vão passar de novo
-- pela tela de vínculo — e é lá que a mesclagem acontece. Sem esta passagem,
-- a aba de aniversários continuaria mostrando a mesma criança duas vezes para
-- quem já era casado no app.
--
-- O critério aqui é o subconjunto seguro do que `lib/familia-dependentes.ts`
-- chama de "automático": mesmo nome depois de tirar acento e pontuação, sem
-- data conflitante e sem sexo conflitante. Grafia diferente ou data diferente
-- não entra — esses casos precisam de gente confirmando, e a tela de vínculo
-- pergunta.

do $$
declare
  r record;
begin
  for r in
    with norm as (
      select
        d.id,
        d.profile_id,
        d.co_profile_id,
        d.data_nascimento,
        d.sexo,
        btrim(regexp_replace(
          lower(translate(
            d.nome,
            'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
            'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
          )),
          '[^a-z0-9]+', ' ', 'g'
        )) as chave
      from public.dependentes d
      where d.tipo = 'filho'
    )
    select
      a.id as id_fica,
      b.id as id_sai,
      p.conjuge_id as co,
      coalesce(a.data_nascimento, b.data_nascimento) as data_final,
      coalesce(a.sexo, b.sexo) as sexo_final
    from norm a
    join public.profiles p on p.id = a.profile_id
    join norm b on b.profile_id = p.conjuge_id
    where p.conjuge_id is not null
      -- Um casal, um lado: sem isto cada par seria processado duas vezes.
      and a.profile_id < p.conjuge_id
      and a.chave <> ''
      and a.chave = b.chave
      and (a.data_nascimento is null or b.data_nascimento is null
           or a.data_nascimento = b.data_nascimento)
      and (a.sexo is null or b.sexo is null or a.sexo = b.sexo)
    order by a.id, b.id
  loop
    -- Gêmeos de nome parecido podem gerar mais de um par para a mesma linha;
    -- quem já foi mesclado numa volta anterior simplesmente não existe mais.
    if not exists (select 1 from public.dependentes where id = r.id_fica)
       or not exists (select 1 from public.dependentes where id = r.id_sai) then
      continue;
    end if;

    update public.dependentes
       set co_profile_id = r.co,
           data_nascimento = r.data_final,
           sexo = r.sexo_final
     where id = r.id_fica;

    delete from public.dependentes where id = r.id_sai;
  end loop;
end $$;

-- O que sobrou sem par continua sendo filho dos dois: quem cadastrou não é o
-- mesmo que quem é responsável.
update public.dependentes d
   set co_profile_id = p.conjuge_id
  from public.profiles p
 where p.id = d.profile_id
   and d.tipo = 'filho'
   and d.co_profile_id is null
   and p.conjuge_id is not null
   and p.conjuge_id <> d.profile_id;
