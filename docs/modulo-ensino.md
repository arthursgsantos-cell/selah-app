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
- `ensino_inscricoes` — `unique (turma_id, user_id)`; `user_id` é **nulo** no
  aluno cadastrado pelo professor (ver abaixo), e nesse caso a pessoa é
  identificada por `pre_cadastro_id`
- `ensino_aulas` — `unique (turma_id, numero)`; `data` é `date`, não instante
- `ensino_presencas` — `unique (aula_id, inscricao_id)`
- `ensino_materiais` — arquivo no bucket privado ou link externo
- `ensino_progresso` — o "assisti" do aluno em turma gravada;
  `primary key (aula_id, user_id)`

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

## A página da aula

`/ensino/turma/[id]/aula/[numero]` é a aula vista por quem vai assistir: vídeo
no topo, descrição, materiais, e o índice do curso no fim.

O endereço usa o **número**, não o UUID da aula. `unique (turma_id, numero)` já
garante unicidade dentro da turma, o caminho diz de que turma se trata, e o
link sobrevive a um recadastro da aula.

O vídeo sai de um material de `tipo = 'video'` vinculado àquela aula, resolvido
por `lib/video-embed.ts`. É a única tela do módulo onde a URL do material
aparece no HTML — é o preço de tocar dentro da página, e só chega ali quem a
policy já deixou ver o material. Vídeo que não vira embed (Drive, por exemplo)
cai na lista de materiais como link.

## Materiais

Bucket `ensino-materiais` é **privado** e não tem policy para `authenticated`:
a URL do objeto não abre sozinha. O download passa por
`/api/ensino/material/[id]`, que consulta a tabela **com o cliente do usuário** —
ou seja, a policy `ensino_materiais_select` é quem autoriza — e só então assina
uma URL de 60 segundos com o cliente admin.

Links externos passam pela mesma rota, para que o endereço do Drive não fique no
HTML de quem não deveria vê-lo.

A mesma rota tem dois modos:

- padrão — redireciona para a URL assinada com `download`, e o navegador salva;
- `?modo=ver` — devolve o **conteúdo** com `Content-Disposition: inline`. O
  arquivo passa pelo servidor de propósito: assim o `<iframe>` do visualizador
  continua na mesma origem e o PDF abre dentro do app, em diálogo, sem
  sequestrar a aba de quem está acompanhando a aula.

Só formatos que o navegador desenha sozinho ganham o botão "Ver"
(`components/ensino/materiais-aula.tsx`). `.docx` e `.pptx` abririam um quadro
em branco — para eles fica só o download. Link externo abre em guia nova: ele
leva para fora de qualquer jeito, e site de terceiro dentro de iframe costuma
dar tela branca por `X-Frame-Options`.

## A ficha do aluno

`/ensino/alunos` e `/ensino/alunos/[slug]` respondem a pergunta que as telas de
turma não respondem: **por onde esta pessoa já passou?** Todas as outras olham
de dentro de uma turma.

`lib/ensino/alunos.ts` monta as duas com o cliente admin — a RLS de
`ensino_inscricoes` mostra ao professor só as turmas dele, e a coordenação
precisa do panorama. Por isso as duas páginas exigem `acesso.coordenador`, e não
`professor`: a barreira que o banco daria foi trocada pela da página.

O slug (`/ensino/alunos/ary-barros`) é derivado do nome nas duas pontas, sem
coluna no banco: criar `profiles.slug` — com gatilho e backfill — sairia caro
para um endereço que só existe aqui, e a lista de alunos do Ensino cabe numa
consulta. Homônimo ganha sufixo (`-2`), desempatado pelo `id`, que não muda.
Trocar o nome no perfil troca a URL, e tudo bem: é ficha interna, não link
divulgado.

`ensino-capas` é público, como as demais capas do app.

## Aluno cadastrado pelo professor

A igreja é mais analógica que o app: boa parte da turma não vai se inscrever
pelo celular, e o professor chega com a lista no papel. Por isso
`ensino_inscricoes.user_id` deixou de ser obrigatório
(`supabase/migrations/ensino_aluno_manual.sql`), e a inscrição passou a ter
`origem` (`app` | `manual`).

A pessoa sem conta **não** ganhou tabela própria no Ensino: ela é gravada em
`membros_pre_cadastro`, a mesma fila que a igreja já usa. Assim ela existe para
o app inteiro — aparece em `/pendencias`, é reconhecida pelo e-mail no
onboarding e pode entrar em outra turma sem ser digitada de novo. A inscrição
aponta para ela por `pre_cadastro_id`.

O diálogo (`components/ensino/adicionar-aluno.tsx`) tem **um campo só de nome**,
que busca e cadastra ao mesmo tempo:

1. achou perfil no app → inscrição normal, com `user_id`;
2. achou pré-cadastro da igreja → reaproveita, e a pessoa não vira duas;
3. não achou nada → cria o pré-cadastro e inscreve.

Telefone e e-mail ficam opcionais de propósito: exigir contato de cada um faria
a digitação parar na primeira pessoa cujo número o professor não sabe. E-mail
informado que já pertence a alguém desvia para o caminho 1 — e-mail é
identidade.

O diálogo não fecha a cada aluno: limpa o campo, devolve o foco e lista quem já
entrou. É uma tela para copiar quinze nomes, não para preencher uma ficha.

Quem entra por aqui nasce `aprovada`: quem cadastrou foi o professor, e um
pendente criado por ele mesmo só geraria o trabalho de aprovar o próprio ato.

### O reencontro

Quando a pessoa cria a conta, `vincularInscricoesEnsino`
(`lib/ensino/vinculo-aluno.ts`) transfere inscrições e presenças para o perfil
novo — a chamada que o professor lançou antes do cadastro não se perde. É
chamada dos três pontos onde um pré-cadastro ganha `profile_id`: o onboarding
por e-mail, a confirmação da própria pessoa e o vínculo manual da coordenação
(`app/actions/onboarding.ts`, `app/actions/pre-cadastro.ts`).

Se houver **duas** linhas para a mesma turma — a pessoa se inscreveu pelo app e
o professor também a digitou —, sobrevive a do app, que é a que a chave
`(turma_id, user_id)` reserva, mas com as presenças da linha manual: é lá que a
chamada foi de fato registrada.

### O que muda nas telas por pessoa

`lib/ensino/alunos.ts` agrupava por `user_id`. Agora agrupa por `chave`
(`chaveDaPessoa`): o perfil quando existe, `pre:<id>` quando não. Sem isso o
aluno manual apareceria uma vez por turma — ou sumiria da lista inteira. A ficha
dele traz curso, frequência e contato; endereço, aniversário e família só
aparecem depois que ele tiver perfil.

## Como o aluno se inscreve

`ensino_turmas.tipo_inscricao` tem quatro valores, e **três deles registram**:

| valor | o que acontece | entra na chamada? |
|---|---|---|
| `app` | confirma os dados do perfil | sim |
| `formulario` | idem, mais os campos de `formulario_id` | sim |
| `whatsapp` | grava a inscrição **e** leva ao grupo da turma | sim |
| `link` | manda para fora (Google Forms, etc.) | não |

`whatsapp` já foi como o `link`: só abria uma conversa, e a turma inteira ficava
fora do sistema — sem chamada, sem frequência, sem saber quem tinha pedido. Hoje
`inscreverPeloWhatsappAction` chama o mesmo núcleo do botão do app
(`gravarInscricao`) e só então devolve o link do grupo. **Entrar no grupo virou
a confirmação do cadastro, não o cadastro.**

O destino é `whatsapp_url`, o mesmo campo que já guardava o grupo da turma — não
há número à parte nem mensagem pré-digitada. Era isso que a inscrição pelo
WhatsApp sempre quis dizer: a turma abre um grupo, e entrar nele é confirmar. Por
isso o link do grupo é **obrigatório** quando o tipo é `whatsapp`, validado no
formulário e de novo em `criarTurmaAction`/`editarTurmaAction`; nos outros três
tipos ele continua opcional e aparece só para quem já está na turma.

Quem já está inscrito continua com o botão — é por ele que volta ao grupo —, mas
não vira segunda linha: `gravarInscricao` devolve `jaInscrito` em vez de erro, e
cada chamador decide o que fazer com isso (para o botão do app é impedimento;
para o do WhatsApp, só motivo de não regravar).

No cliente, a aba do WhatsApp é aberta **antes** do `await`, ainda dentro do
clique (`components/ensino/inscricao-turma.tsx`): aberta depois da resposta do
servidor, o navegador a trataria como pop-up e bloquearia.

Sobra `link` como único caminho sem rastro — e o aviso amarelo no formulário do
professor diz isso com todas as letras.

## Videochamada

Turma que se reúne online precisa de um "entrar na chamada" do mesmo jeito que a
presencial precisa de sala. `ensino_turmas.video_chamada_modo` guarda a escolha
do professor ao criar a turma:

| modo | de onde sai o link |
|---|---|
| `nenhum` | não há videochamada (padrão) |
| `turma` | `ensino_turmas.video_chamada_url` — a mesma sala em todas as aulas |
| `aula` | `ensino_aulas.video_chamada_url` — um link por encontro |

O modo é escolha explícita, e não dedução a partir dos links preenchidos: sem
ele, aula sem link ficaria ambígua entre "usa o da turma" e "o professor ainda
não colou o dela". `linkDaVideoChamada` (`lib/ensino/videochamada.ts`) resolve os
dois casos num lugar só, e respeita o modo nos dois sentidos — turma com sala
fixa ignora link sobrando numa aula, e turma com link por aula não cai no da
turma quando falta o do encontro. Ali a ausência é o que a tela precisa mostrar:
"o link desta videochamada ainda não foi publicado".

O botão só aparece para inscrito ou professor — link de sala é endereço de porta
aberta. Aparece na página da aula, no cartão da próxima aula da turma e na área
do aluno. `plataformaDaChamada` lê o domínio para escrever "Google Meet", "Zoom"
ou "Microsoft Teams" no botão, sem chamada externa.

A escolha só existe em turma com encontro: em `modo = 'gravado'` a seção nem
aparece, e o servidor força `nenhum` — mesma razão de `sequencial`, para não
deixar um botão adormecido esperando a próxima troca de modo.

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
| `/ensino/alunos` e `/ensino/alunos/[slug]` | coordenação |
| `/ensino/turma/[id]/aula/[numero]` | inscrito na turma ou quem leciona |
| `/ensino/turma/[id]/{alunos,aulas,materiais,presencas}` | quem leciona a turma |
| `/ensino/chamada/[aulaId]` | quem leciona a turma |
| `/api/ensino/material/[id]` | conforme a policy do material |

## Curso gravado

`ensino_turmas.modo` decide se a turma é encontro ou catálogo
(`supabase/migrations/ensino_curso_gravado.sql`):

- **`presencial`** (default) — o que sempre existiu: calendário, chamada,
  frequência;
- **`gravado`** — a pessoa assiste no ritmo dela. Somem da tela a data da aula,
  os dias da semana, a chamada e a "próxima aula" do calendário; entram a barra
  de progresso, o botão "Marcar como assistida" e o "continue de onde parou",
  que é a primeira aula ainda não concluída.

O vídeo continua sendo um link do YouTube num material da aula — nada de upload
de vídeo, nada de player próprio.

### Progresso não é presença

`ensino_progresso` (`aula_id`, `user_id`, `turma_id`, `concluida_em`) existe
justamente para **não** se confundir com `ensino_presencas`. Em presença, quem
escreve é o professor — não há policy de insert para o aluno, de propósito.
Progresso é a pessoa dizendo que viu o vídeo. Misturar os dois faria a
frequência de uma turma presencial subir sozinha.

Por isso a action `marcarAulaConcluidaAction` usa o **cliente do usuário**, e
não o admin: quem autoriza é a policy (`user_id = auth.uid() and
ensino_inscrito(turma_id)`).

### Liberação sequencial

`ensino_turmas.sequencial` tranca a aula N até a N-1 ser concluída. É chave por
turma, e não regra do módulo: serve a discipulado, atrapalha em curso de
consulta.

O progresso de uma turma sequencial é sempre um **prefixo** da lista — só fecha
a aula N quem fechou as anteriores. Então "está liberada?" é comparar a posição
com a quantidade de concluídas, e não varrer aula por aula. A conta aparece em
dois lugares (na página, para trancar; na action, antes de gravar) e as duas
precisam concordar — a da action é a que vale, porque só ela impede alguém de
pular a fila digitando o endereço da aula seguinte.

Uma costura que ficou: `ensino_aulas.data` continua `not null`. Numa turma
gravada a data não significa nada e a interface não a mostra, mas ela precisa
ser preenchida no cadastro. Só vira problema no dia em que incomodar.

## Não implementado (deixado preparado)

Localização na presença, validação por horário/geocerca, emissão de certificado,
CREICER infantil, exportação para Excel e notificações. Nada disso tem coluna
reservada — quando entrarem, entram como migração nova.
