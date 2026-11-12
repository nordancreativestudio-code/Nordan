-- ═══════════════════════════════════════════════════════════════════════════
-- Nordan · Painel interno · migração 0002 · clientes, projetos e tarefas
-- Correr no SQL Editor do Supabase DEPOIS da 0001 (usa public.autorizado()).
-- ═══════════════════════════════════════════════════════════════════════════

-- atualiza atualizado_em em cada alteração
create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- 1) clientes ---------------------------------------------------------------
create table if not exists public.clientes (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (length(trim(nome)) > 0),
  setor          text,
  estado         text not null default 'Ativo' check (estado in ('Ativo','Pontual','Inativo')),
  contacto       text,
  telefone       text,
  email          text,
  web            text,
  nif            text,
  localidade     text,
  notas          text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create trigger clientes_atualizado before update on public.clientes
  for each row execute function public.tocar_atualizado_em();

-- 2) projetos (cartões do kanban) -------------------------------------------
create table if not exists public.projetos (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid references public.clientes(id) on delete set null,
  nome                text not null check (length(trim(nome)) > 0),
  estado              text not null default 'Para fazer'
                      check (estado in ('Para fazer','Em andamento','Standby','Em aprovação','Concluído')),
  prioridade          text not null default 'Média' check (prioridade in ('Baixa','Média','Alta','Urgente')),
  responsavel         text not null default 'André' check (responsavel in ('André','Nuno','Ambos','Outro')),
  marca               text,
  tipo                text,
  inicio              date,
  prazo               date,
  prazo_estimado      date,
  link_entrega        text,
  notas               text,
  ordem               double precision not null default 0,
  visivel_ao_cliente  boolean not null default false,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index if not exists projetos_cliente_idx on public.projetos (cliente_id);
create index if not exists projetos_estado_idx on public.projetos (estado, ordem);
create trigger projetos_atualizado before update on public.projetos
  for each row execute function public.tocar_atualizado_em();

-- 3) tarefas (checklist de cada projeto) ------------------------------------
create table if not exists public.tarefas (
  id                  uuid primary key default gen_random_uuid(),
  projeto_id          uuid not null references public.projetos(id) on delete cascade,
  titulo              text not null check (length(trim(titulo)) > 0),
  concluida           boolean not null default false,
  prazo               date,
  prazo_estimado      date,
  ordem               double precision not null default 0,
  visivel_ao_cliente  boolean not null default false,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index if not exists tarefas_projeto_idx on public.tarefas (projeto_id, ordem);
create trigger tarefas_atualizado before update on public.tarefas
  for each row execute function public.tocar_atualizado_em();

-- 4) Row Level Security: só quem está em utilizadores_autorizados lê e escreve --
alter table public.clientes enable row level security;
alter table public.projetos enable row level security;
alter table public.tarefas  enable row level security;

create policy "autorizados tudo em clientes" on public.clientes
  for all to authenticated using (public.autorizado()) with check (public.autorizado());
create policy "autorizados tudo em projetos" on public.projetos
  for all to authenticated using (public.autorizado()) with check (public.autorizado());
create policy "autorizados tudo em tarefas" on public.tarefas
  for all to authenticated using (public.autorizado()) with check (public.autorizado());

-- sem sessão (anon) não há acesso nenhum
revoke all on public.clientes, public.projetos, public.tarefas from anon;
