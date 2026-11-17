-- ═══════════════════════════════════════════════════════════════════════════
-- Nordan · Painel interno · migração 0009 · migração do Dashboard antigo
-- Listas extensíveis (opcoes), finanças, leads, emails de prospeção, equipamento.
-- Idempotente. Correr no SQL Editor do Supabase DEPOIS da 0008.
-- Só estrutura e vocabulário de listas. Os dados vão na 0010 (local, fora do Git).
-- ═══════════════════════════════════════════════════════════════════════════

-- 0) ligação aos ids do dashboard antigo (para a importação não duplicar) ----
alter table public.clientes add column if not exists id_antigo text;
create unique index if not exists clientes_id_antigo_uq on public.clientes (id_antigo) where id_antigo is not null;

-- 1) opcoes: todas as listas de escolha, com "acrescentar novo" gravado -------
create table if not exists public.opcoes (
  id         uuid primary key default gen_random_uuid(),
  lista      text not null check (length(trim(lista)) > 0),
  valor      text not null check (length(trim(valor)) > 0),
  ordem      int  not null default 0,
  criado_em  timestamptz not null default now(),
  unique (lista, valor)
);

-- 2) financas ------------------------------------------------------------------
create table if not exists public.financas (
  id             uuid primary key default gen_random_uuid(),
  id_antigo      text unique,
  data           date not null,
  movimento      text not null check (length(trim(movimento)) > 0),
  tipo           text not null check (tipo in ('Entrada','Saída')),
  valor          numeric(12,2) not null,
  categoria      text,
  pago           boolean not null default true,
  recebido       date,
  cliente_id     uuid references public.clientes(id) on delete set null,
  notas          text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists financas_data_idx on public.financas (data desc);
create index if not exists financas_cliente_idx on public.financas (cliente_id);

create table if not exists public.config_financas (
  id             int primary key default 1 check (id = 1),
  saldo          numeric(12,2) not null default 0,
  saldo_data     date,
  saldo_confirmado boolean not null default false,
  atualizado_em  timestamptz not null default now()
);

-- 3) leads (CRM) ---------------------------------------------------------------
create table if not exists public.leads (
  id             uuid primary key default gen_random_uuid(),
  id_antigo      text unique,
  nome           text not null check (length(trim(nome)) > 0),
  setor          text,
  subsetor       text,
  setor_original text,
  fase           text,
  estado         text not null default 'Novo',
  canal          text,
  contacto       text,
  telefone       text,
  email          text,
  web            text,
  primeiro_contacto date,
  contacto_1     date,
  contacto_2     date,
  contacto_email date,
  reuniao        date,
  ultimo_contacto date,
  proximo_contacto date,
  proximo_acao   text,
  decisor        text,
  cargo          text,
  resultado      text,
  motivo         text,
  formato        text,
  notas          text,
  cliente_id     uuid references public.clientes(id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists leads_setor_idx on public.leads (setor);
create index if not exists leads_proximo_idx on public.leads (proximo_contacto);

-- 4) emails de prospeção -------------------------------------------------------
create table if not exists public.emails_prospecao (
  id             uuid primary key default gen_random_uuid(),
  id_antigo      text unique,
  empresa        text not null,
  tipo           text,
  estado         text,
  email          text,
  enviado        date,
  hora           text,
  assunto        text,
  modelo         text,
  thread_url     text,
  thread_id      text,
  respondeu      text,
  lead_id        uuid references public.leads(id) on delete set null,
  notas          text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists emails_lead_idx on public.emails_prospecao (lead_id);

-- 5) equipamento ---------------------------------------------------------------
create table if not exists public.equipamento (
  id             uuid primary key default gen_random_uuid(),
  id_antigo      text unique,
  item           text not null check (length(trim(item)) > 0),
  tipo           text,
  estado         text,
  marca          text,
  serie          text,
  compra         date,
  valor          numeric(12,2),
  notas          text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 6) triggers de atualizado_em -------------------------------------------------
drop trigger if exists financas_atualizado on public.financas;
create trigger financas_atualizado before update on public.financas for each row execute function public.tocar_atualizado_em();
drop trigger if exists config_financas_atualizado on public.config_financas;
create trigger config_financas_atualizado before update on public.config_financas for each row execute function public.tocar_atualizado_em();
drop trigger if exists leads_atualizado on public.leads;
create trigger leads_atualizado before update on public.leads for each row execute function public.tocar_atualizado_em();
drop trigger if exists emails_prospecao_atualizado on public.emails_prospecao;
create trigger emails_prospecao_atualizado before update on public.emails_prospecao for each row execute function public.tocar_atualizado_em();
drop trigger if exists equipamento_atualizado on public.equipamento;
create trigger equipamento_atualizado before update on public.equipamento for each row execute function public.tocar_atualizado_em();

-- 7) RLS: só utilizadores autorizados; nada para anon nem para o portal --------
do $$
declare t text;
begin
  foreach t in array array['opcoes','financas','config_financas','leads','emails_prospecao','equipamento']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_autorizados" on public.%I', t, t);
    execute format('create policy "%s_autorizados" on public.%I for all to authenticated using (public.autorizado()) with check (public.autorizado())', t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- 8) vocabulário inicial das listas (acrescentar outros na própria app) --------
insert into public.opcoes (lista, valor, ordem) values
  ('setor','Restauração',1),('setor','Retalho',2),('setor','Estética & Beleza',3),('setor','Saúde & Bem-estar',4),
  ('setor','Imobiliário',5),('setor','Indústria & B2B',6),('setor','Eventos',7),('setor','Institucional',8),('setor','Outro',9),
  ('marca','Nordan Creative',1),('marca','Nordan Family',2),
  ('tipo_trabalho','Fotografia',1),('tipo_trabalho','Vídeo',2),('tipo_trabalho','Edição',3),('tipo_trabalho','Marketing',4),
  ('tipo_trabalho','Social',5),('tipo_trabalho','Impressão',6),('tipo_trabalho','Reunião',7),
  
  ('tipo_trabalho','Outro',8),
  ('lead_setor','Indústria',1),('lead_setor','Saúde',2),('lead_setor','Restauração',3),('lead_setor','Desporto e fitness',4),
  ('lead_setor','Moda e retalho',5),('lead_setor','Turismo e eventos',6),('lead_setor','Estética e bem-estar',7),
  ('lead_setor','Serviços e imobiliário',8),('lead_setor','Automóvel e mecânica',9),('lead_setor','Outro',10),
  ('lead_fase','Leads',1),('lead_fase','Contacto / Qualificação',2),('lead_fase','Reunião',3),('lead_fase','Onboarding',4),
  ('lead_estado','Novo',1),('lead_estado','Follow-up',2),('lead_estado','Conversa',3),('lead_estado','Perdido',4),
  ('lead_canal','Telefone',1),('lead_canal','Email',2),('lead_canal','Facebook',3),('lead_canal','Instagram',4),
  ('lead_canal','Site',5),('lead_canal','Referência',6),('lead_canal','Outro',7),
  ('lead_resultado','Sem resposta',1),
  ('fin_categoria_entrada','Avença mensal',1),('fin_categoria_entrada','Serviço Pontual',2),('fin_categoria_entrada','Venda',3),('fin_categoria_entrada','Outras',4),
  ('fin_categoria_saida','Segurança Social',1),('fin_categoria_saida','Aluguer',2),('fin_categoria_saida','Compras estúdio',3),
  ('fin_categoria_saida','Serviços (net, luz, etc.)',4),('fin_categoria_saida','Combustível',5),('fin_categoria_saida','Ordenados',6),('fin_categoria_saida','Outras',7),
  ('email_estado','À espera',1),('email_estado','Respondeu',2),('email_estado','Não entregue',3),
  ('email_tipo','Restaurante',1),('email_tipo','Café / pastelaria',2),('email_tipo','Hotel',3),('email_tipo','Imobiliária',4),('email_tipo','Outro',5),
  ('equip_tipo','Câmara',1),('equip_tipo','Lente',2),('equip_tipo','Luz',3),('equip_tipo','Tripé',4),('equip_tipo','Áudio',5),('equip_tipo','Acessório',6),
  ('equip_estado','Ativo',1),('equip_estado','Em reparação',2),('equip_estado','Vendido',3)
on conflict (lista, valor) do nothing;
