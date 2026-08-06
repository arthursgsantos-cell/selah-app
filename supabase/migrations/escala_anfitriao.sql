-- Anfitriões: o casal que recebe o encontro na casa deles.
--
-- Entra como mais uma posição da escala (e não como coluna do encontro) porque
-- é a mesma pergunta das outras: quem faz o quê naquela data. Assim ganha de
-- graça a escala antecipada do calendário, o "com cônjuge" e o resumo da rede.

alter type public.funcao_escala add value if not exists 'anfitriao';
