-- ═══════════════════════════════════════════════════════════════════════════
-- Nordan · migração 0005 · tarefas (responsável, descrição) e totais de tempo
-- Correr no SQL Editor DEPOIS da 0003. Pode ser corrida mais de uma vez.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) tarefas: responsável e descrição
alter table public.tarefas add column if not exists responsavel text;
alter table public.tarefas add column if not exists descricao text;
alter table public.tarefas drop constraint if exists tarefas_responsavel_check;
alter table public.tarefas add constraint tarefas_responsavel_check
  check (responsavel is null or responsavel in ('André','Nuno','Ambos','Outro'));

-- 2) total de tempo por tarefa, calculado na base de dados (hora do servidor).
--    segundos = soma de (fim, ou agora se ainda corre) − início
--    abertos  = quantos cronómetros estão a correr nessa tarefa
--    security_invoker: a view respeita a RLS de tarefas e registos_tempo.
create or replace view public.tempos_tarefa
with (security_invoker = true) as
select t.id as tarefa_id,
       t.projeto_id,
       coalesce(sum(extract(epoch from (coalesce(r.fim, now()) - r.inicio))), 0)::bigint as segundos,
       count(r.id) filter (where r.fim is null)::int as abertos
  from public.tarefas t
  left join public.registos_tempo r on r.tarefa_id = t.id
 group by t.id, t.projeto_id;

revoke all on public.tempos_tarefa from anon;
grant select on public.tempos_tarefa to authenticated;
