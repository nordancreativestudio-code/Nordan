-- ═══════════════════════════════════════════════════════════════════════════
-- Nordan · migração 0014 · sessões e reuniões com clientes
-- Correr no SQL Editor DEPOIS da 0013. Pode ser corrida mais de uma vez.
--
-- As sessões são criadas no painel e seguem por Google Calendar (convite + lembretes).
-- Segurança: só a equipa lê e escreve a tabela (RLS); anon sem acesso. O cliente só vê
-- as suas sessões MARCADAS e FUTURAS, pela função portal_sessoes(), que exige portal_acesso(cliente).
-- A função devolve só campos seguros: nunca o projeto (pode não ser visível), nem o id do Google.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) tabela
create table if not exists public.sessoes (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references public.clientes(id) on delete cascade,
  projeto_id       uuid references public.projetos(id) on delete set null,
  titulo           text not null check (length(trim(titulo)) > 0),
  tipo             text,
  inicio           timestamptz not null,
  fim              timestamptz check (fim is null or fim > inicio),
  local_ou_link    text,
  nota_cliente     text,
  estado           text not null default 'marcada' check (estado in ('marcada','cancelada','realizada')),
  google_event_id  text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index if not exists sessoes_cliente_idx on public.sessoes (cliente_id, inicio);
create index if not exists sessoes_projeto_idx on public.sessoes (projeto_id);
create index if not exists sessoes_inicio_idx  on public.sessoes (inicio desc);

drop trigger if exists sessoes_atualizado on public.sessoes;
create trigger sessoes_atualizado before update on public.sessoes
  for each row execute function public.tocar_atualizado_em();

-- 2) RLS: equipa total; anon sem acesso. O cliente nunca lê a tabela diretamente.
alter table public.sessoes enable row level security;
drop policy if exists "equipa tudo" on public.sessoes;
create policy "equipa tudo" on public.sessoes for all to authenticated
  using (public.autorizado()) with check (public.autorizado());
revoke all on public.sessoes from anon;

-- 3) portal: sessões marcadas e futuras (ou a decorrer) só do cliente com acesso
create or replace function public.portal_sessoes(p_cliente uuid)
returns table (id uuid, titulo text, tipo text, inicio timestamptz, fim timestamptz,
               local_ou_link text, nota_cliente text)
language sql stable security definer set search_path = public as $$
  select s.id, s.titulo, s.tipo, s.inicio, s.fim, s.local_ou_link, s.nota_cliente
    from public.sessoes s
   where s.cliente_id = p_cliente
     and public.portal_acesso(p_cliente) is not null
     and s.estado = 'marcada'
     and coalesce(s.fim, s.inicio) >= now()
   order by s.inicio;
$$;
revoke all on function public.portal_sessoes(uuid) from public, anon;
grant execute on function public.portal_sessoes(uuid) to authenticated;

-- 4) lista do tipo de sessão (a equipa acrescenta mais na própria gaveta)
insert into public.opcoes (lista, valor, ordem) values
  ('link_sessao_tipo', 'Reunião', 1),
  ('link_sessao_tipo', 'Onboarding', 2),
  ('link_sessao_tipo', 'Planeamento', 3),
  ('link_sessao_tipo', 'Gravação', 4),
  ('link_sessao_tipo', 'Ponto de situação', 5),
  ('link_sessao_tipo', 'Entrega', 6)
on conflict (lista, valor) do nothing;
