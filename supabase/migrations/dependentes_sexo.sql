-- Sexo do dependente, usado para exibir "Filho" ou "Filha" nos aniversários
-- em vez do genérico "Filho(a)". Só faz sentido para tipo='filho'.
alter table public.dependentes
  add column if not exists sexo text;

alter table public.dependentes
  drop constraint if exists dependentes_sexo_check;

alter table public.dependentes
  add constraint dependentes_sexo_check
  check (sexo is null or sexo in ('M', 'F'));
