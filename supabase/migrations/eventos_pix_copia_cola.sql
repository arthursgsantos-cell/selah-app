-- Código PIX "copia e cola" (BR Code completo da cobrança, ex: gerado pelo Nubank).
-- Quando preenchido, o QR Code é renderizado a partir dele — fica idêntico ao do
-- banco, com o valor já embutido, e dispensa chave/tipo/nome do beneficiário.

alter table public.eventos
  add column if not exists pix_copia_cola text;
