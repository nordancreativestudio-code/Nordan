-- Tipo de trabalho: só as tarefas originais. Os passos do workflow vivem na aba Workflow.
-- Idempotente. Remove apenas as opções acrescentadas pela 0009 (as acrescentadas à mão ficam).
delete from public.opcoes
 where lista = 'tipo_trabalho'
   and valor in ('Primeiro contacto','Briefing','Proposta','Reunião inicial','Preparação','Produção e edição','Validação e entrega','Reunião final');
