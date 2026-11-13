-- ═══════════════════════════════════════════════════════════════════════════
-- Nordan · migração 0008 · portal: contactos, Ferramentas e Comunicação, Planeamento mensal, novo Workflow
-- Correr no SQL Editor DEPOIS da 0007. Pode ser corrida mais de uma vez.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) clientes com avença (têm o formulário mensal)
alter table public.clientes add column if not exists avenca boolean not null default false;

-- 2) contactos "Fala connosco" (editáveis em Definições → Contactos)
create table if not exists public.equipa_contactos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (length(trim(nome)) > 0),
  telemovel      text,   -- como se escreve, ex.: 936 309 455 (o link do WhatsApp é calculado)
  email          text,
  ordem          double precision not null default 0,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
drop trigger if exists equipa_contactos_atualizado on public.equipa_contactos;
create trigger equipa_contactos_atualizado before update on public.equipa_contactos
  for each row execute function public.tocar_atualizado_em();
alter table public.equipa_contactos enable row level security;
drop policy if exists "equipa tudo" on public.equipa_contactos;
create policy "equipa tudo" on public.equipa_contactos for all to authenticated
  using (public.autorizado()) with check (public.autorizado());
revoke all on public.equipa_contactos from anon;

insert into public.equipa_contactos (nome, telemovel, email, ordem)
select v.nome, v.telemovel, v.email, v.ordem from (values
  ('Nuno', '937 112 512', null, 1),
  ('André', '936 309 455', null, 2),
  ('Email geral', null, 'info@nordancreativestudio.com', 3)
) as v(nome, telemovel, email, ordem)
where not exists (select 1 from public.equipa_contactos);

-- 3) Ferramentas e Comunicação passam a uma só página
alter table public.conteudo_portal drop constraint if exists conteudo_portal_pagina_check;
alter table public.conteudo_portal add constraint conteudo_portal_pagina_check
  check (pagina in ('workflow', 'ferramentas', 'comunicacao', 'ferramentas_comunicacao'));

-- apaga só as secções de base que nunca foram editadas (e sem blocos); as tuas ficam
delete from public.conteudo_portal c
 where c.pagina in ('ferramentas', 'comunicacao') and c.criado_em = c.atualizado_em
   and not exists (select 1 from public.conteudo_portal_blocos b where b.conteudo_portal_id = c.id);
update public.conteudo_portal set pagina = 'ferramentas_comunicacao', ordem = ordem + 10
 where pagina in ('ferramentas', 'comunicacao');

insert into public.conteudo_portal (pagina, titulo, texto, ordem)
select 'ferramentas_comunicacao', v.titulo, v.texto, v.ordem from (values
  ('Canais', 'Email para o histórico dos assuntos formais. WhatsApp para urgências. Meet para reuniões.', 1),
  ('Onde ficam os materiais', 'Os conteúdos ficam no Drive. As propostas ficam em link. A informação do projeto fica no portal.', 2),
  ('Acesso ao portal', 'Entras no portal com um link enviado por email. Não precisas de palavra-passe.', 3)
) as v(titulo, texto, ordem)
where not exists (select 1 from public.conteudo_portal c
                   where c.pagina = 'ferramentas_comunicacao' and c.titulo = v.titulo);

-- 4) workflow: tipos (Nordan, cliente, juntos, marco, decisão), fases e ligações
alter table public.workflow_modelo
  add column if not exists fase text, add column if not exists tipo text, add column if not exists numero text,
  add column if not exists ligacao_nao uuid references public.workflow_modelo(id) on delete set null,
  add column if not exists legenda_nao text;
alter table public.projeto_passos
  add column if not exists tipo text, add column if not exists fase text, add column if not exists numero text,
  add column if not exists modelo_id uuid references public.workflow_modelo(id) on delete set null;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'workflow_modelo' and column_name = 'lado') then
    execute 'update public.workflow_modelo set tipo = lado where tipo is null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projeto_passos' and column_name = 'lado') then
    execute 'update public.projeto_passos set tipo = lado where tipo is null';
  end if;
end $$;
update public.workflow_modelo set tipo = 'nordan' where tipo is null;
update public.projeto_passos set tipo = 'nordan' where tipo is null;
alter table public.workflow_modelo alter column tipo set default 'nordan', alter column tipo set not null;
alter table public.projeto_passos alter column tipo set default 'nordan', alter column tipo set not null;
alter table public.workflow_modelo drop constraint if exists workflow_modelo_tipo_check;
alter table public.workflow_modelo add constraint workflow_modelo_tipo_check
  check (tipo in ('nordan', 'cliente', 'juntos', 'marco', 'decisao'));
alter table public.projeto_passos drop constraint if exists projeto_passos_tipo_check;
alter table public.projeto_passos add constraint projeto_passos_tipo_check
  check (tipo in ('nordan', 'cliente', 'juntos', 'marco', 'decisao'));

-- o novo fluxo (só na primeira vez; substitui os 13 passos provisórios)
do $$
declare prep uuid;
begin
  if exists (select 1 from public.workflow_modelo where fase is not null) then return; end if;
  delete from public.workflow_modelo;

  insert into public.workflow_modelo (fase, numero, titulo, frase, tipo, ordem) values
    ('Antes de avançar', '01', 'Primeiro contacto', 'Falamos pela primeira vez e percebemos o pedido.', 'juntos', 1),
    ('Antes de avançar', '02', 'Briefing', 'O briefing básico é preenchido no portal.', 'cliente', 2),
    ('Antes de avançar', '03', 'Proposta', 'Proposta e orçamento ajustados ao pedido.', 'nordan', 3),
    ('Antes de avançar', null, 'Cliente adjudica', 'Aprovada a proposta, o projeto arranca.', 'marco', 4),
    ('Onboarding', '04', 'Boas-vindas', 'Acolhemos o cliente e damos acesso ao portal.', 'nordan', 5),
    ('Onboarding', '05', 'Formalização', 'Confirmamos o trabalho contratado e o orçamento.', 'cliente', 6),
    ('Onboarding', '06', 'Reunião inicial', 'Equipa, etapas, responsabilidades e prazos.', 'juntos', 7),
    ('Onboarding', '07', 'Registo', 'Decisões, prazos e próximos passos ficam no portal.', 'nordan', 8);
  insert into public.workflow_modelo (fase, numero, titulo, frase, tipo, ordem)
    values ('Projeto', '08', 'Preparação', 'Planeamento e direção criativa do projeto.', 'nordan', 9) returning id into prep;
  insert into public.workflow_modelo (fase, numero, titulo, frase, tipo, ordem, ligacao_nao, legenda_nao)
    values ('Projeto', '09', 'Cliente aprova?', 'Sim: segue para a produção.', 'decisao', 10, prep, 'Não: ajustamos e voltamos à preparação');
  insert into public.workflow_modelo (fase, numero, titulo, frase, tipo, ordem) values
    ('Projeto', '10', 'Produção e edição', 'Gravamos, editamos e partilhamos o andamento.', 'nordan', 11),
    ('Projeto', '11', 'Validação e entrega', 'Aprovação de conteúdos no portal, ajustes e entrega.', 'cliente', 12),
    ('Projeto', '12', 'Reunião final', 'Balanço, feedback e continuidade.', 'juntos', 13);

  -- projetos sem nenhuma data nos passos recebem o novo fluxo; os que já têm datas ficam como estão
  delete from public.projeto_passos p
   where not exists (select 1 from public.projeto_passos q where q.projeto_id = p.projeto_id and q.data_real is not null);
  insert into public.projeto_passos (projeto_id, titulo, frase, tipo, fase, numero, modelo_id, ordem)
  select pr.id, m.titulo, m.frase, m.tipo, m.fase, m.numero, m.id, m.ordem
    from public.projetos pr cross join public.workflow_modelo m
   where not exists (select 1 from public.projeto_passos q where q.projeto_id = pr.id);
end $$;

-- 5) formulários: Planeamento mensal e respostas por projeto, formulário e mês
create table if not exists public.formularios (
  tipo           text primary key check (tipo in ('briefing', 'feedback', 'planeamento_mensal')),
  titulo         text not null,
  frase_abertura text,
  mensal         boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
drop trigger if exists formularios_atualizado on public.formularios;
create trigger formularios_atualizado before update on public.formularios
  for each row execute function public.tocar_atualizado_em();
alter table public.formularios enable row level security;
drop policy if exists "equipa tudo" on public.formularios;
create policy "equipa tudo" on public.formularios for all to authenticated
  using (public.autorizado()) with check (public.autorizado());
revoke all on public.formularios from anon;

insert into public.formularios (tipo, titulo, frase_abertura, mensal) values
  ('briefing', 'Briefing', null, false),
  ('feedback', 'Feedback final', null, false),
  ('planeamento_mensal', 'Antes de produzir, perguntamos.',
   'Para preparar os conteúdos do próximo mês, precisamos de perceber as vossas prioridades.', true)
on conflict (tipo) do nothing;

alter table public.formularios_modelo drop constraint if exists formularios_modelo_tipo_check;
alter table public.formularios_modelo add constraint formularios_modelo_tipo_check
  check (tipo in ('briefing', 'feedback', 'planeamento_mensal'));

insert into public.formularios_modelo (tipo, pergunta, ajuda, tipo_campo, ordem)
select 'planeamento_mensal', v.pergunta, v.ajuda, 'texto_longo', v.ordem from (values
  ('Qual é o resultado mais importante que querem alcançar no próximo mês?', 'Pedidos de orçamento, reservas, um serviço específico, candidatos. Se houver meta, qual.', 1),
  ('Que produto, serviço ou área do negócio devemos priorizar? Porquê?', 'Margem, capacidade disponível, stock, sazonalidade ou oportunidade de crescimento.', 2),
  ('Quem precisamos de levar a agir?', 'Que cliente querem atrair e o que deve fazer depois de ver o conteúdo.', 3),
  ('O que está a dificultar a venda neste momento?', 'Dúvidas, objeções e comparações. O que leva as pessoas a adiar.', 4),
  ('Que acontecimentos do próximo mês podem criar uma oportunidade?', 'Lançamentos, campanhas, eventos, contratações. Datas e o que está confirmado.', 5),
  ('Que provas podemos mostrar para dar confiança?', 'Resultados, casos, testemunhos, processos, bastidores. O que há para captar.', 6),
  ('O que aprenderam com o último mês?', 'Conteúdos que trouxeram contactos. O que disseram os clientes. Perguntas repetidas.', 7),
  ('Há alguma limitação que devamos considerar?', 'Equipa, produtos, locais, autorizações, prazos de aprovação, capacidade de resposta.', 8)
) as v(pergunta, ajuda, ordem)
where not exists (select 1 from public.formularios_modelo where tipo = 'planeamento_mensal');

-- respostas: uma linha por projeto + formulário (+ mês, nos mensais). As respostas guardam o texto da
-- pergunta no momento, para o histórico não mudar se a pergunta for editada.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public'
              and table_name = 'formularios_respostas' and column_name = 'pergunta_id') then
    alter table public.formularios_respostas rename to formularios_respostas_v1;
    alter index if exists public.formularios_respostas_pkey rename to formularios_respostas_v1_pkey;
    alter index if exists public.formularios_respostas_projeto_id_pergunta_id_key rename to formularios_respostas_v1_ppk;
  end if;
end $$;

create table if not exists public.formularios_respostas (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references public.projetos(id) on delete cascade,
  tipo           text not null check (tipo in ('briefing', 'feedback', 'planeamento_mensal')),
  mes            date check (mes is null or extract(day from mes) = 1),
  respostas      jsonb not null default '[]'::jsonb,   -- [{pergunta_id, pergunta, resposta}]
  estado         text not null default 'rascunho' check (estado in ('rascunho', 'enviado')),
  enviado_em     timestamptz,
  lido_em        timestamptz,
  lido_por       uuid,
  autor_id       uuid,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create unique index if not exists formularios_respostas_unica
  on public.formularios_respostas (projeto_id, tipo, (coalesce(mes, date '1900-01-01')));

do $$
begin
  if to_regclass('public.formularios_respostas_v1') is not null then
    insert into public.formularios_respostas (projeto_id, tipo, respostas, estado, enviado_em, autor_id)
    select r.projeto_id, r.tipo,
           jsonb_agg(jsonb_build_object('pergunta_id', r.pergunta_id, 'pergunta', r.pergunta_texto, 'resposta', r.resposta)),
           'enviado', max(r.atualizado_em), (array_agg(r.autor_id))[1]
      from public.formularios_respostas_v1 r where r.resposta is not null
     group by r.projeto_id, r.tipo
    on conflict do nothing;
    drop table public.formularios_respostas_v1;
  end if;
end $$;

drop trigger if exists formularios_respostas_atualizado on public.formularios_respostas;
create trigger formularios_respostas_atualizado before update on public.formularios_respostas
  for each row execute function public.tocar_atualizado_em();
alter table public.formularios_respostas enable row level security;
drop policy if exists "equipa le" on public.formularios_respostas;
create policy "equipa le" on public.formularios_respostas for select to authenticated using (public.autorizado());
drop policy if exists "equipa marca lido" on public.formularios_respostas;
create policy "equipa marca lido" on public.formularios_respostas for update to authenticated
  using (public.autorizado()) with check (public.autorizado());
drop policy if exists "equipa apaga" on public.formularios_respostas;
create policy "equipa apaga" on public.formularios_respostas for delete to authenticated using (public.autorizado());
revoke all on public.formularios_respostas from anon;

-- 6) funções: workflow por tipo
create or replace function public.copiar_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.projeto_passos (projeto_id, titulo, frase, tipo, fase, numero, modelo_id, ordem)
  select new.id, m.titulo, m.frase, m.tipo, m.fase, m.numero, m.id, m.ordem from public.workflow_modelo m order by m.ordem;
  return new;
end;
$$;

create or replace function public.aplicar_workflow(p_projeto uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.autorizado() then raise exception 'Não autorizado' using errcode = '42501'; end if;
  if exists (select 1 from public.projeto_passos where projeto_id = p_projeto) then return 0; end if;
  insert into public.projeto_passos (projeto_id, titulo, frase, tipo, fase, numero, modelo_id, ordem)
  select p_projeto, m.titulo, m.frase, m.tipo, m.fase, m.numero, m.id, m.ordem from public.workflow_modelo m order by m.ordem;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 7) funções do portal (alteradas)
create or replace function public.portal_cliente(p_cliente uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', c.id, 'nome', c.nome, 'avenca', c.avenca)
    from public.clientes c where c.id = p_cliente and public.portal_acesso(c.id) is not null;
$$;

drop function if exists public.portal_projetos(uuid);
create function public.portal_projetos(p_cliente uuid)
returns table (id uuid, nome text, tipo text, prazo_estimado date, passo_atual text, passo_tipo text,
               passos_total integer, passos_feitos integer, por_aprovar integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.tipo, p.prazo_estimado,
         (select s.titulo from public.projeto_passos s where s.projeto_id = p.id and s.data_real is null order by s.ordem limit 1),
         (select s.tipo   from public.projeto_passos s where s.projeto_id = p.id and s.data_real is null order by s.ordem limit 1),
         (select count(*)::int from public.projeto_passos s where s.projeto_id = p.id),
         (select count(*)::int from public.projeto_passos s where s.projeto_id = p.id and s.data_real is not null),
         (select count(*)::int from public.conteudos k where k.projeto_id = p.id and k.estado = 'para_aprovacao')
    from public.projetos p
   where p.cliente_id = p_cliente and p.visivel_ao_cliente and public.portal_acesso(p_cliente) is not null
   order by p.prazo_estimado nulls last, p.criado_em;
$$;

create or replace function public.portal_projeto(p_projeto uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'acesso', public.portal_acesso(p.cliente_id),
    'projeto', jsonb_build_object('id', p.id, 'nome', p.nome, 'tipo', p.tipo, 'cliente_id', p.cliente_id,
                                  'prazo_estimado', p.prazo_estimado, 'link_entrega', p.link_entrega),
    'passos', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', s.id, 'titulo', s.titulo, 'frase', s.frase, 'tipo', s.tipo, 'fase', s.fase, 'numero', s.numero,
                  'modelo_id', s.modelo_id, 'data_prevista', s.data_prevista, 'data_real', s.data_real) order by s.ordem)
                from public.projeto_passos s where s.projeto_id = p.id), '[]'::jsonb),
    'tarefas', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', t.id, 'titulo', t.titulo, 'concluida', t.concluida, 'prazo', t.prazo,
                  'segundos', case when t.mostrar_tempo_ao_cliente
                                   then (select tt.segundos from public.tempos_tarefa tt where tt.tarefa_id = t.id) end)
                  order by t.ordem)
                from public.tarefas t where t.projeto_id = p.id and t.visivel_ao_cliente), '[]'::jsonb),
    'conteudos', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', k.id, 'titulo', k.titulo, 'tipo', k.tipo, 'estado', k.estado,
                  'responsavel', k.responsavel, 'link_drive', k.link_drive,
                  'comentarios', (select count(*) from public.comentarios m where m.conteudo_id = k.id and m.tipo = 'comentario'))
                  order by k.ordem, k.criado_em)
                from public.conteudos k where k.projeto_id = p.id), '[]'::jsonb))
    from public.projetos p
   where p.id = p_projeto and p.visivel_ao_cliente and public.portal_acesso(p.cliente_id) is not null;
$$;

create or replace function public.portal_paginas()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'workflow', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', w.id, 'fase', w.fase, 'numero', w.numero, 'titulo', w.titulo, 'frase', w.frase, 'tipo', w.tipo,
                  'ligacao_nao', w.ligacao_nao, 'legenda_nao', w.legenda_nao) order by w.ordem)
                from public.workflow_modelo w), '[]'::jsonb),
    'paginas', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', c.id, 'pagina', c.pagina, 'titulo', c.titulo, 'texto', c.texto,
                  'blocos', coalesce((select jsonb_agg(jsonb_build_object(
                                'tipo', b.tipo, 'titulo', b.titulo, 'descricao', b.descricao, 'url_drive', b.url_drive) order by b.ordem)
                              from public.conteudo_portal_blocos b where b.conteudo_portal_id = c.id), '[]'::jsonb))
                  order by c.pagina, c.ordem)
                from public.conteudo_portal c), '[]'::jsonb),
    'contactos', coalesce((select jsonb_agg(jsonb_build_object('nome', e.nome, 'telemovel', e.telemovel, 'email', e.email) order by e.ordem)
                from public.equipa_contactos e), '[]'::jsonb))
   where public.autorizado()
      or exists (select 1 from public.clientes_utilizadores cu
                  where cu.email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- formulário de um projeto (e mês, nos mensais): perguntas + respostas + estado
drop function if exists public.portal_formulario(uuid, text);
create function public.portal_formulario(p_projeto uuid, p_tipo text, p_mes date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f public.formularios%rowtype; r public.formularios_respostas%rowtype; v_mes date;
begin
  if public.portal_acesso_projeto(p_projeto) is null then return null; end if;
  select * into f from public.formularios where tipo = p_tipo;
  if not found then return null; end if;
  v_mes := case when f.mensal then date_trunc('month', coalesce(p_mes, current_date))::date end;
  select * into r from public.formularios_respostas
   where projeto_id = p_projeto and tipo = p_tipo and mes is not distinct from v_mes;
  return jsonb_build_object(
    'formulario', jsonb_build_object('tipo', f.tipo, 'titulo', f.titulo, 'frase_abertura', f.frase_abertura, 'mensal', f.mensal),
    'mes', v_mes,
    'estado', coalesce(r.estado, 'novo'),
    'enviado_em', r.enviado_em,
    'perguntas', coalesce((select jsonb_agg(jsonb_build_object(
        'pergunta_id', m.id, 'pergunta', m.pergunta, 'ajuda', m.ajuda, 'tipo_campo', m.tipo_campo, 'obrigatoria', m.obrigatoria,
        'resposta', (select e ->> 'resposta' from jsonb_array_elements(coalesce(r.respostas, '[]'::jsonb)) e
                      where e ->> 'pergunta_id' = m.id::text limit 1)) order by m.ordem)
      from public.formularios_modelo m where m.tipo = p_tipo), '[]'::jsonb));
end;
$$;

-- o cliente guarda rascunho ou envia. p_respostas = {"<id da pergunta>": "texto", ...}
-- Depois de enviado pode alterar; cada gravação atualiza a data de envio e volta a "não lido".
drop function if exists public.portal_guardar_resposta(uuid, uuid, text);
create function public.portal_guardar_formulario(p_projeto uuid, p_tipo text, p_mes date, p_respostas jsonb, p_enviar boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare f public.formularios%rowtype; r public.formularios_respostas%rowtype; v_mes date; arr jsonb; faltam integer; v_estado text;
begin
  if public.portal_acesso_projeto(p_projeto) is distinct from 'cliente' then
    raise exception 'Sem acesso a este projeto' using errcode = '42501';
  end if;
  select * into f from public.formularios where tipo = p_tipo;
  if not found then raise exception 'Formulário inexistente' using errcode = '22023'; end if;
  v_mes := case when f.mensal then date_trunc('month', coalesce(p_mes, current_date))::date end;

  select coalesce(jsonb_agg(jsonb_build_object('pergunta_id', m.id, 'pergunta', m.pergunta,
           'resposta', nullif(trim(coalesce(p_respostas ->> m.id::text, '')), '')) order by m.ordem), '[]'::jsonb)
    into arr from public.formularios_modelo m where m.tipo = p_tipo;

  select * into r from public.formularios_respostas
   where projeto_id = p_projeto and tipo = p_tipo and mes is not distinct from v_mes;
  v_estado := case when p_enviar or r.estado = 'enviado' then 'enviado' else 'rascunho' end;

  if v_estado = 'enviado' then
    select count(*) into faltam from public.formularios_modelo m
     where m.tipo = p_tipo and m.obrigatoria and nullif(trim(coalesce(p_respostas ->> m.id::text, '')), '') is null;
    if faltam > 0 then raise exception 'Faltam respostas obrigatórias' using errcode = '22023'; end if;
    if not exists (select 1 from jsonb_array_elements(arr) e where e ->> 'resposta' is not null) then
      raise exception 'Responde a pelo menos uma pergunta' using errcode = '22023';
    end if;
  end if;

  insert into public.formularios_respostas (projeto_id, tipo, mes, respostas, estado, enviado_em, autor_id)
  values (p_projeto, p_tipo, v_mes, arr, v_estado, case when v_estado = 'enviado' then now() end, auth.uid())
  on conflict (projeto_id, tipo, (coalesce(mes, date '1900-01-01')))
  do update set respostas = excluded.respostas, estado = excluded.estado, enviado_em = excluded.enviado_em,
                lido_em = null, lido_por = null, autor_id = excluded.autor_id;
end;
$$;

-- permissões
do $$
declare f text;
begin
  foreach f in array array['portal_cliente(uuid)', 'portal_projetos(uuid)', 'portal_projeto(uuid)', 'portal_paginas()',
                           'portal_formulario(uuid, text, date)', 'portal_guardar_formulario(uuid, text, date, jsonb, boolean)',
                           'aplicar_workflow(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  revoke all on function public.copiar_workflow() from public, anon, authenticated;
end $$;

-- 8) o campo antigo "lado" já não é usado: o tipo substitui-o
alter table public.workflow_modelo drop column if exists lado;
alter table public.projeto_passos drop column if exists lado;
