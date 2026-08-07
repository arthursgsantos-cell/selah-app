# Gestão de inscrições e pagamentos de evento

Painel em `/inscricoes/[eventoId]` — o mesmo endereço do antigo acompanhamento.
Substitui a planilha que o organizador mantinha por fora: cadastrar quem se
inscreveu no WhatsApp, registrar quem pagou, quando pagou, com qual comprovante,
e ver quem ainda deve.

## Quem pode o quê

`acessoAoEvento` (`lib/eventos-permissoes.ts`) responde três perguntas:

| campo | significado | quem tem |
|---|---|---|
| `podeVer` | abrir a página, conferir números | liderança em geral (líder para cima) |
| `pode` | cadastrar inscrito, lançar e apagar pagamento | pastor/admin, quem criou o evento, supervisor da rede do evento, líder da célula do evento, e quem recebeu delegação |
| `podeDelegar` | escolher quem mais gerencia | pastor/admin, criador, supervisor da rede |

A delegação vive em `evento_organizadores` e existe porque quem organiza nem
sempre é quem cuida do dinheiro: o tesoureiro pode ser um membro sem cargo
nenhum no app, e promovê-lo a líder só para lançar pagamento seria pior.

Quem só tem `podeVer` recebe o painel em modo leitura — mesmos números, sem os
controles.

## Origem da ficha

`inscricoes_evento.origem` separa três caminhos:

- `app` — a pessoa preencheu o formulário do evento;
- `manual` — o organizador digitou a ficha no painel;
- `planilha` — reservado para importação.

A ficha manual não tem respostas de formulário; o painel a marca com um selo
discreto para ninguém confundir com quem se inscreveu sozinho.

## Comprovantes

Vão para o bucket **privado** `evento-comprovantes`; a linha do pagamento guarda
só `comprovante_path`. Quem entrega o arquivo é
`/api/evento/comprovante/[id]`, que confere `acessoAoEvento` antes de assinar a
URL — comprovante é documento financeiro de terceiro e não pode abrir para quem
descobrir o endereço.

Sem `?modo=baixar`, o conteúdo passa pelo servidor com `Content-Disposition:
inline`. É o que permite ao visualizador do app desenhar a imagem e, por ser a
mesma origem, ler o arquivo para mandá-lo à folha de compartilhamento do
celular no botão "Salvar".

## Cobrança automática (o que já existia)

`evento_valores` e `evento_parcelas` continuam valendo para evento com
inscrição por formulário ou PIX: o valor da pessoa é congelado em
`inscricoes_evento.valor_total` no momento da inscrição, e as parcelas são
derivadas dele (`lib/evento-cobranca.ts`). No cadastro manual, o preço único do
evento entra como sugestão e pode ser trocado ficha a ficha.
