# Atividades e Bíblia

O que a turma faz **entre** um encontro e outro. O módulo de Ensino já cobria o
encontro — a aula, a chamada, o material —; a tarefa do livro, o desafio de
leitura e a prova viviam no grupo do WhatsApp, e o professor não tinha como
saber quem estava conseguindo cumprir.

Vive em `/ensino/atividade/[id]`, com a lista do aluno em `/ensino/atividades` e
a da turma em `/ensino/turma/[id]/atividades`.

## Três tipos, uma tabela

`tarefa`, `leitura` e `quiz` compartilham quase tudo: pertencem a uma turma,
têm prazo, aparecem na lista do aluno, geram uma entrega por inscrito e um
painel de acompanhamento. O que muda é o miolo — e o miolo mora em tabelas
filhas, que só o tipo que precisa delas preenche.

| tipo | o que o aluno faz | onde fica o miolo |
|---|---|---|
| `tarefa` | marca feito, comenta | `ensino_atividade_entregas` |
| `leitura` | risca o cronograma | `ensino_leitura_itens` |
| `quiz` | responde e entrega | `ensino_atividade_perguntas` / `_respostas` |

Três tabelas irmãs duplicariam prazo, publicação, aparência e o painel inteiro.

## Por que a entrega aponta para a inscrição

Metade dos alunos do Ensino não tem conta no app — são os que o professor
cadastrou à mão (`ensino_inscricoes.user_id is null`). Amarrar a entrega ao
`user_id` deixaria essa metade fora do painel. A inscrição existe para os dois
casos, e é ela que já governa chamada e frequência.

## O gabarito e a RLS

`ensino_atividade_perguntas.opcoes` traz o campo `correta`, e
`resposta_esperada` é o que o professor espera ler — os dois no **mesmo
registro** que o aluno precisa ler para responder.

Nenhuma policy de linha resolve isso, porque o problema é de coluna: a linha
inteira é legítima, uma parte dela não. Então:

- a policy de `select` fica restrita a `ensino_atividade_leciona()`;
- a tela do aluno **nunca** consulta a tabela direto — ela passa por
  `semGabarito()` (`lib/ensino/atividades.ts`), que monta a pergunta sem
  `correta` e sem `resposta_esperada`;
- a policy é o que garante que uma consulta esperta do cliente não contorne a
  função.

## O cronograma de leitura

`lib/ensino/leitura.ts` transforma "a carta de Tiago, 30 vezes, até 20 de
dezembro" em linhas que o aluno risca. É a peça que faz a meta caber num dia:
ninguém lê Tiago trinta vezes olhando para o total, mas lê cinco capítulos por
dia.

Dois modos:

- **percurso** — atravessar os trechos uma vez (Mateus a Apocalipse até o dia X);
- **repetições** — ler o mesmo trecho N vezes (30× Tiago).

A distribuição **não** é "N capítulos por dia" fixo. Com 108 capítulos em 30
dias daria 3,6, e arredondar para 4 termina a leitura três dias antes do prazo —
o aluno acha que se enganou. Em vez disso os capítulos são repartidos pelos dias
com o resto espalhado nos primeiros, de modo que a última linha caia exatamente
no prazo.

Dentro de um dia, capítulos seguidos do mesmo livro viram uma linha só
("Tiago 1–3"); a virada de livro abre outra.

### Por que é por aluno, e não por atividade

`ensino_leitura_itens` tem `inscricao_id`. Quem entra na turma no meio do
desafio recebe o cronograma recalculado a partir do dia em que entrou — o prazo
é o mesmo, os dias restantes não. Um cronograma que já nasce metade vencido não
ajuda ninguém.

`garantirCronogramaAction` é o que cobre esse caso: a página da atividade a
chama antes de listar, e ela só faz algo se o aluno ainda não tiver linhas.

### Regerar

Mexer nos trechos ou no prazo regenera o cronograma de todo mundo
(`regerarCronogramas`). O que já foi marcado sobrevive quando o **rótulo** e a
**rodada** continuam existindo — ou seja, um ajuste só de prazo preserva o
progresso; trocar os livros não, e é o correto: um desafio diferente é outro
desafio.

As linhas entram em lotes de 500. Uma turma de 30 com 90 dias de leitura passa
de 2.700 linhas, e um `insert` único desse tamanho estoura o limite do
PostgREST.

## A correção do quiz

O que é de marcar o app corrige na entrega, comparando com o gabarito que nunca
saiu do banco (`corrigir()`). Se a prova só tinha perguntas automáticas, ela já
volta `corrigida` e com nota — não há o que o professor acrescentar.

Na múltipla escolha a correção exige o **conjunto exato**: marcar duas certas de
três não é meio ponto. A pergunta é "quais destas", e deixar uma de fora
responde outra coisa; meia pontuação também tornaria vantajoso marcar tudo.

`correta = null` é o que diz ao painel que a prova espera o professor. Não
existe campo de nota final: ela é sempre a soma das questões, senão divergiria
no primeiro ajuste.

## A página configurável

`ensino_atividade_secoes` é a mesma ideia de `evento_secoes`: a ordem da página
é dado, não JSX, porque quem monta a atividade quer arrastar um bloco
explicativo para antes da pergunta 3 sem pedir nada a ninguém.

Capa, fundo, opacidade e vídeo de abertura ficam na própria atividade. É a única
tela que o aluno abre sozinho, longe da aula, então precisa se sustentar
visualmente.

No editor, **cada bloco salva por conta própria**. Um formulário único com botão
de salvar no fim perderia o trabalho de quem fecha a aba no meio, e aqui o meio
é longo — capa, prazo, texto, blocos e dez perguntas.

## A Bíblia

`supabase/migrations/biblia.sql`. Três tabelas: `biblia_livros` (os 66, com a
contagem de capítulos), `biblia_versoes` e `biblia_versiculos`.

### Só domínio público

NVI, ARA, NAA, NTLH e ACF são obras protegidas — SBB, Biblica e BV Books
licenciam cada uma. Guardar o texto integral delas exigiria contrato. As que
entram são as livres:

| id | versão | ano |
|---|---|---|
| `acf` | Almeida Corrigida | 1911 |
| `aa` | Almeida Revisada Imprensa Bíblica | 1914 |
| `blivre` | Bíblia Livre | 2018 |

O esquema não impede que uma licenciada seja somada depois: é só mais uma linha
em `biblia_versoes`, com `dominio_publico = false` e `fonte` documentando o
direito.

### Por que o texto no nosso banco

O plano de leitura conta capítulos e marca progresso a cada abertura de tela.
Numa API externa isso vira uma chamada de rede por leitura, com chave, cota e
uma tela em branco toda vez que a rede do salão cai. Aqui é um `select` com
índice.

### Os livros vêm antes do texto

`biblia_livros` já está populada com os 66 livros e a contagem de capítulos.
**Isso basta para o cronograma funcionar por inteiro** — ele só precisa saber
que Tiago tem 5 capítulos. O texto é o que falta, e a tela de leitura avisa
enquanto ele não chega.

### Importar o texto

`POST /api/biblia/importar`, só para pastor ou admin. O corpo é o formato que os
repositórios de Bíblia em domínio público publicam:

```json
{
  "versao": "acf",
  "livros": [
    { "abbrev": "gn", "chapters": [["No princípio...", "E a terra..."]] }
  ]
}
```

`abbrev` casa com `biblia_livros.sigla`; a posição no array é o número do
capítulo e do versículo. Livro que não bater com nenhuma sigla é ignorado e
volta no relatório, em vez de derrubar a importação inteira.

Entram em lotes de 2.000 com `upsert` — uma Bíblia tem cerca de 31 mil
versículos, e reimportar corrige o texto em vez de duplicar.

`biblia_versiculos` **não tem policy de escrita**: nada no app pode alterar o
texto. Esta rota é a única porta.
