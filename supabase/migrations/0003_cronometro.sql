-- ═══════════════════════════════════════════════════════════════════════════
-- Nordan · Painel interno · migração 0003 · cronómetro por tarefa
-- Correr no SQL Editor do Supabase DEPOIS da 0002. A paragem automática às 20:00
-- (agendamento) está na 0004.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) tarefas: o cliente só verá o tempo se a tarefa for visível E este campo estiver ativo
alter table public.tarefas
  add column if not exists mostrar_tempo_ao_cliente boolean not null default false;

-- 2) registos de tempo (um por período de trabalho)
create table if not exists public.registos_tempo (
  id             uuid primary key default gen_random_uuid(),
  tarefa_id      uuid not null references public.tarefas(id) on delete cascade,
  utilizador_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  inicio         timestamptz not null default now(),
  fim            timestamptz,               -- vazio enquanto o cronómetro corre
  confirmado_em  timestamptz,               -- última vez que a pessoa confirmou "continuo a trabalhar" (verificação das 20:00)
  criado_em      timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
create index if not exists registos_tarefa_idx on public.registos_tempo (tarefa_id);
-- cada pessoa só pode ter UM cronómetro a correr
create unique index if not exists registos_um_aberto_por_pessoa
  on public.registos_tempo (utilizador_id) where fim is null;

-- 3) RLS: autorizados leem tudo; escrevem só nos seus próprios registos
alter table public.registos_tempo enable row level security;
drop policy if exists "autorizados leem registos" on public.registos_tempo;
create policy "autorizados leem registos" on public.registos_tempo
  for select to authenticated using (public.autorizado());
drop policy if exists "autorizados criam os seus registos" on public.registos_tempo;
create policy "autorizados criam os seus registos" on public.registos_tempo
  for insert to authenticated with check (public.autorizado() and utilizador_id = auth.uid());
drop policy if exists "autorizados alteram os seus registos" on public.registos_tempo;
create policy "autorizados alteram os seus registos" on public.registos_tempo
  for update to authenticated using (public.autorizado() and utilizador_id = auth.uid())
  with check (public.autorizado() and utilizador_id = auth.uid());
drop policy if exists "autorizados apagam os seus registos" on public.registos_tempo;
create policy "autorizados apagam os seus registos" on public.registos_tempo
  for delete to authenticated using (public.autorizado() and utilizador_id = auth.uid());
revoke all on public.registos_tempo from anon;

-- 4) funções (correm com os direitos de quem chama, logo a RLS aplica-se)

-- iniciar: pára o cronómetro que estava a correr e abre o novo, numa só operação
create or replace function public.iniciar_cronometro(p_tarefa uuid)
returns void language plpgsql as $$
begin
  update public.registos_tempo set fim = now()
   where utilizador_id = auth.uid() and fim is null;
  insert into public.registos_tempo (tarefa_id) values (p_tarefa);
end;
$$;

-- parar: fecha o registo aberto. p_fim permite corrigir ("parei às 18:30"); fica entre o início e agora.
create or replace function public.parar_cronometro(p_fim timestamptz default null)
returns void language sql as $$
  update public.registos_tempo
     set fim = least(now(), greatest(coalesce(p_fim, now()), inicio))
   where utilizador_id = auth.uid() and fim is null;
$$;

-- confirmar: "continuo a trabalhar"
create or replace function public.confirmar_cronometro()
returns void language sql as $$
  update public.registos_tempo set confirmado_em = now()
   where utilizador_id = auth.uid() and fim is null;
$$;

-- Quando é que a pessoa tem de responder?
--  · a partir das 20:00 (hora de Lisboa) se o cronómetro vem de antes das 20:00;
--  · depois de uma confirmação ou de um início à noite, passada 1 hora (até às 06:00);
--  · de dia, nunca (devolve null).
create or replace function public.cronometro_devido(p_inicio timestamptz, p_confirmado timestamptz, p_agora timestamptz)
returns timestamptz language sql stable as $$
  with t as (
    select
      coalesce(p_confirmado, p_inicio) as ref,
      (case when (p_agora at time zone 'Europe/Lisbon')::time >= time '20:00'
            then date_trunc('day', p_agora at time zone 'Europe/Lisbon') + interval '20 hours'
            else date_trunc('day', p_agora at time zone 'Europe/Lisbon') - interval '4 hours'
       end) at time zone 'Europe/Lisbon' as t20
  )
  select case
    when ref < t20 then t20
    when ref < t20 + interval '10 hours' then ref + interval '1 hour'
  end from t;
$$;

-- o cronómetro aberto de quem chama, com a hora a que tem de responder e a hora do servidor
create or replace function public.cronometro_atual()
returns table (id uuid, tarefa_id uuid, inicio timestamptz, confirmado_em timestamptz, devido_em timestamptz, agora timestamptz)
language sql stable as $$
  select r.id, r.tarefa_id, r.inicio, r.confirmado_em,
         public.cronometro_devido(r.inicio, r.confirmado_em, now()), now()
    from public.registos_tempo r
   where r.utilizador_id = auth.uid() and r.fim is null;
$$;

-- paragem automática: 30 min depois da hora de resposta, sem resposta, fecha o registo
-- à hora em que a pergunta era devida (ex.: 20:00). Chamada pelo agendamento da 0004.
create or replace function public.parar_esquecidos()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with d as (
    select r.id, public.cronometro_devido(r.inicio, r.confirmado_em, now()) as devido
      from public.registos_tempo r where r.fim is null
  )
  update public.registos_tempo r
     set fim = greatest(d.devido, r.inicio)
    from d
   where r.id = d.id and d.devido is not null and d.devido + interval '30 minutes' <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.iniciar_cronometro(uuid), public.parar_cronometro(timestamptz),
  public.confirmar_cronometro(), public.cronometro_devido(timestamptz, timestamptz, timestamptz),
  public.cronometro_atual(), public.parar_esquecidos() from public, anon;
grant execute on function public.iniciar_cronometro(uuid), public.parar_cronometro(timestamptz),
  public.confirmar_cronometro(), public.cronometro_devido(timestamptz, timestamptz, timestamptz),
  public.cronometro_atual() to authenticated;
-- parar_esquecidos() só corre pelo agendamento (sem grant a ninguém)
