# Módulo de Ensino

Área da Escola Bíblica dentro do app: cursos, turmas, inscrições, chamada e
materiais. Vive em `/ensino`, dentro do grupo de rotas `(app)`, e por isso
herda header, navegação, login e identidade visual do resto do site.

## Por que não existe um cargo "professor" em `Role`

`ROLE_ORDER` (`lib/nav-items.ts`) compara cargos por hierarquia — membro <
líder < supervisor < pastor — e toda a navegação e várias policies antigas
dependem dessa escada. Dar aula não é um degrau dela: um membro comum pode ser
professor, e um supervisor pode não ser.

Então o papel vive em `ensino_equipe` (`professor` | `coordenador`), à parte.
Pastor e admin da igreja entram como coordenadores sem precisar de cadastro.

As três perguntas de permissão existem duas vezes, de propósito:

| pergunta | SQL (governa a RLS) | TypeScript (decide o que renderizar) |
|---|---|---|
| é coordenação? | `ensino_e_coordenador()` | `acesso.coordenador` |
| é da equipe? | `ensino_e_professor()` | `acesso.professor` |
| administra esta turma? | `ensino_leciona(turma)` | `podeLecionar(acesso, id)` |
| está inscrito? | `ensino_inscrito(turma)` | — |

O TypeScript nunca é a barreira: serve para não desenhar botões inúteis. Quem
recusa acesso é o banco.

## Tabelas

Todas com prefixo `ensino_` e RLS ligada desde a criação
(`supabase/migrations/ensino.sql`).

- `ensino_cursos` — catálogo ("Fundamentos da Fé", "Toda Escritura")
- `ensino_turmas` — a oferta de um curso num período; `formulario_id` aponta
  para `formularios`, reaproveitando o construtor de campos dos eventos
- `ensino_equipe` / `ensino_turma_professores` — quem é professor, e de quê
- `ensino_inscricoes` — `unique (turma_id, user_id)`
- `ensino_aulas` — `unique (turma_id, numero)`; `data` é `date`, não instante
- `ensino_presencas` — `unique (aula_id, inscricao_id)`
- `ensino_materiais` — arquivo no bucket privado ou link externo

### Datas

`ensino_aulas.data` e `ensino_turmas.data_inicio/data_fim` são `date`. A aula
acontece num dia do calendário de Natal; guardar instante UTC faria a aula das
19h30 aparecer no dia seguinte. Por isso o código nunca faz
`new Date('2026-03-10')` com essas colunas — quebra a string em números
(`lib/ensino/turma.ts`).

O fuso do servidor já vem de `instrumentation.ts` (`America/Sao_Paulo`).

## Chamada

`/ensino/chamada/[aulaId]` é **página, não modal**. Um diálogo que fecha ao
clicar fora perde a chamada pela metade.

Cada toque grava sozinho, um aluno por vez (`marcarPresencaAction`), com upsert
na chave `(aula_id, inscricao_id)`:

- não existe botão "salvar" nem rascunho em memória;
- tocar duas vezes corrige em vez de duplicar — é também o que faz a correção
  posterior funcionar sem código extra;
- a interface é otimista, e o que falhar volta ao estado anterior com o ícone de
  nuvem cortada, entrando na contagem de "não salvos" do rodapé;
- a aula vira `realizada` na primeira marcação, o que a faz entrar no cálculo de
  frequência.

O percentual de presença considera só aulas `realizada`. Contar as futuras faria
todo aluno começar o curso com 0%.

## Materiais

Bucket `ensino-materiais` é **privado** e não tem policy para `authenticated`:
a URL do objeto não abre sozinha. O download passa por
`/api/ensino/material/[id]`, que consulta a tabela **com o cliente do usuário** —
ou seja, a policy `ensino_materiais_select` é quem autoriza — e só então assina
uma URL de 60 segundos com o cliente admin.

Links externos passam pela mesma rota, para que o endereço do Drive não fique no
HTML de quem não deveria vê-lo.

`ensino-capas` é público, como as demais capas do app.

## Vagas

Vaga é ocupada por inscrição **aprovada**, não por pendente — senão um pedido
esquecido travaria a turma. A contagem é refeita na aprovação, porque entre o
pedido e a decisão a turma pode ter lotado.

`contarAprovados` usa o cliente admin: a RLS esconde do aluno as inscrições dos
colegas, e sem isso a página mostraria "0 inscritos" para quem ainda não entrou.
Só a contagem sai por ali; nome e telefone, não.

## Rotas

| rota | quem |
|---|---|
| `/ensino` | qualquer autenticado da igreja |
| `/ensino/turma/[id]` | idem (a vitrine é aberta; aulas e materiais, não) |
| `/ensino/inscricao/[turmaId]` | idem |
| `/ensino/aluno` | qualquer autenticado — mostra só os dados dele |
| `/ensino/professor` | equipe do Ensino |
| `/ensino/admin` | coordenação |
| `/ensino/turma/[id]/{alunos,aulas,materiais,presencas}` | quem leciona a turma |
| `/ensino/chamada/[aulaId]` | quem leciona a turma |
| `/api/ensino/material/[id]` | conforme a policy do material |

## Não implementado (deixado preparado)

Localização na presença, validação por horário/geocerca, certificados, CREICER
infantil, exportação para Excel e notificações. Nada disso tem coluna reservada
— quando entrarem, entram como migração nova.
