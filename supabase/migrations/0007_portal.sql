-- ═══════════════════════════════════════════════════════════════════════════
-- Nordan · migração 0007 · portal do cliente (v1)
-- Correr no SQL Editor DEPOIS da 0006. Pode ser corrida mais de uma vez.
--
-- Regra de segurança: o cliente NÃO tem acesso direto a nenhuma tabela.
-- Todas as políticas RLS são só para a equipa (public.autorizado()).
-- O cliente lê e escreve apenas pelas funções portal_*(), que verificam se o
-- projeto é dele e devolvem só campos seguros. A equipa usa as mesmas funções
-- de leitura para a pré-visualização ("Vista do cliente").
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────── 1) tabelas ─────────────────────────

create table if not exists public.clientes_utilizadores (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes(id) on delete cascade,
  email          text not null check (email = lower(email) and position('@' in email) > 1),
  utilizador_id  uuid references auth.users(id) on delete set null,   -- preenchido no primeiro login
  convidado_por  uuid default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (cliente_id, email)
);
create index if not exists clientes_utilizadores_email_idx on public.clientes_utilizadores (email);

create table if not exists public.conteudos (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references public.projetos(id) on delete cascade,
  titulo         text not null check (length(trim(titulo)) > 0),
  tipo           text not null default 'Vídeo' check (tipo in ('Vídeo','Foto','Texto','Design')),
  estado         text not null default 'para_aprovacao'
                 check (estado in ('para_aprovacao','alteracoes_pedidas','aprovado')),
  responsavel    text,
  link_drive     text,
  ordem          double precision not null default 0,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists conteudos_projeto_idx on public.conteudos (projeto_id, ordem);

-- conversa de cada conteúdo + registo das mudanças de estado (não se editam nem apagam)
create table if not exists public.comentarios (
  id             uuid primary key default gen_random_uuid(),
  conteudo_id    uuid not null references public.conteudos(id) on delete cascade,
  tipo           text not null default 'comentario' check (tipo in ('comentario','mudanca_estado')),
  texto          text,
  estado_de      text,
  estado_para    text,
  autor_id       uuid,
  autor_nome     text,
  autor_tipo     text check (autor_tipo in ('equipa','cliente','sistema')),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  check (tipo <> 'comentario' or length(trim(coalesce(texto, ''))) > 0)
);
create index if not exists comentarios_conteudo_idx on public.comentarios (conteudo_id, criado_em);

create table if not exists public.workflow_modelo (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null check (length(trim(titulo)) > 0),
  frase          text,
  lado           text not null default 'nordan' check (lado in ('nordan','cliente')),
  ordem          double precision not null default 0,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.projeto_passos (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references public.projetos(id) on delete cascade,
  titulo         text not null check (length(trim(titulo)) > 0),
  frase          text,
  lado           text not null default 'nordan' check (lado in ('nordan','cliente')),
  data_prevista  date,
  data_real      date,
  ordem          double precision not null default 0,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists projeto_passos_projeto_idx on public.projeto_passos (projeto_id, ordem);

create table if not exists public.formularios_modelo (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('briefing','feedback')),
  pergunta       text not null check (length(trim(pergunta)) > 0),
  ajuda          text,
  tipo_campo     text not null default 'texto_longo' check (tipo_campo in ('texto','texto_longo','escala')),
  obrigatoria    boolean not null default false,
  ordem          double precision not null default 0,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.formularios_respostas (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references public.projetos(id) on delete cascade,
  tipo           text not null check (tipo in ('briefing','feedback')),
  pergunta_id    uuid references public.formularios_modelo(id) on delete set null,
  pergunta_texto text not null,     -- cópia: o histórico não muda se a pergunta for editada
  resposta       text,
  autor_id       uuid,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (projeto_id, pergunta_id)
);

-- páginas Ferramentas e Comunicação do portal (a página Workflow lê workflow_modelo)
create table if not exists public.conteudo_portal (
  id             uuid primary key default gen_random_uuid(),
  pagina         text not null check (pagina in ('workflow','ferramentas','comunicacao')),
  titulo         text not null check (length(trim(titulo)) > 0),
  texto          text,
  ordem          double precision not null default 0,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create table if not exists public.conteudo_portal_blocos (
  id                  uuid primary key default gen_random_uuid(),
  conteudo_portal_id  uuid not null references public.conteudo_portal(id) on delete cascade,
  tipo                text not null default 'link' check (tipo in ('video','ficheiro','link')),
  titulo              text not null check (length(trim(titulo)) > 0),
  descricao           text,
  url_drive           text,
  ordem               double precision not null default 0,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

-- atualizado_em automático
do $$
declare t text;
begin
  foreach t in array array['clientes_utilizadores','conteudos','comentarios','workflow_modelo','projeto_passos',
                           'formularios_modelo','formularios_respostas','conteudo_portal','conteudo_portal_blocos'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_atualizado', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.tocar_atualizado_em()', t || '_atualizado', t);
  end loop;
end $$;

-- ───────────────────────── 2) RLS: só a equipa toca nas tabelas ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['clientes_utilizadores','conteudos','workflow_modelo','projeto_passos',
                           'formularios_modelo','conteudo_portal','conteudo_portal_blocos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "equipa tudo" on public.%I', t);
    execute format('create policy "equipa tudo" on public.%I for all to authenticated using (public.autorizado()) with check (public.autorizado())', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- comentários: a equipa lê e acrescenta; ninguém edita nem apaga
alter table public.comentarios enable row level security;
drop policy if exists "equipa le" on public.comentarios;
create policy "equipa le" on public.comentarios for select to authenticated using (public.autorizado());
drop policy if exists "equipa comenta" on public.comentarios;
create policy "equipa comenta" on public.comentarios for insert to authenticated with check (public.autorizado());
revoke all on public.comentarios from anon;

-- respostas dos formulários: a equipa lê e pode apagar; quem responde é o cliente (pela função)
alter table public.formularios_respostas enable row level security;
drop policy if exists "equipa le" on public.formularios_respostas;
create policy "equipa le" on public.formularios_respostas for select to authenticated using (public.autorizado());
drop policy if exists "equipa apaga" on public.formularios_respostas;
create policy "equipa apaga" on public.formularios_respostas for delete to authenticated using (public.autorizado());
revoke all on public.formularios_respostas from anon;

-- ───────────────────────── 3) login: equipa OU cliente convidado ─────────────────────────
create or replace function public.bloquear_nao_autorizados()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.utilizadores_autorizados where email = lower(new.email))
     and not exists (select 1 from public.clientes_utilizadores where email = lower(new.email)) then
    raise exception 'Email não autorizado' using errcode = '28000';
  end if;
  return new;
end;
$$;

-- ───────────────────────── 4) automatismos ─────────────────────────

-- autor de cada comentário: preenchido pela base de dados, não pela aplicação
create or replace function public.comentario_autor()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  new.autor_id := auth.uid();
  if auth.uid() is null then
    new.autor_tipo := 'sistema'; new.autor_nome := 'Sistema';
  elsif public.autorizado() then
    new.autor_tipo := 'equipa';
    select coalesce(a.nome, 'Nordan') into new.autor_nome from public.utilizadores_autorizados a where a.email = v_email;
  else
    new.autor_tipo := 'cliente';
    select c.nome into new.autor_nome
      from public.conteudos k join public.projetos p on p.id = k.projeto_id join public.clientes c on c.id = p.cliente_id
     where k.id = new.conteudo_id;
  end if;
  return new;
end;
$$;
drop trigger if exists comentarios_autor on public.comentarios;
create trigger comentarios_autor before insert on public.comentarios
  for each row execute function public.comentario_autor();

-- cada mudança de estado de um conteúdo fica registada com autor e data
create or replace function public.conteudo_regista_estado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado is distinct from old.estado then
    insert into public.comentarios (conteudo_id, tipo, estado_de, estado_para)
    values (new.id, 'mudanca_estado', old.estado, new.estado);
  end if;
  return new;
end;
$$;
drop trigger if exists conteudos_estado on public.conteudos;
create trigger conteudos_estado after update of estado on public.conteudos
  for each row execute function public.conteudo_regista_estado();

-- projeto novo: copia o modelo de workflow para os passos do projeto
create or replace function public.copiar_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.projeto_passos (projeto_id, titulo, frase, lado, ordem)
  select new.id, m.titulo, m.frase, m.lado, m.ordem from public.workflow_modelo m order by m.ordem;
  return new;
end;
$$;
drop trigger if exists projetos_copiar_workflow on public.projetos;
create trigger projetos_copiar_workflow after insert on public.projetos
  for each row execute function public.copiar_workflow();

-- projetos que já existiam: aplicar o modelo à mão (só se o projeto ainda não tiver passos)
create or replace function public.aplicar_workflow(p_projeto uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.autorizado() then raise exception 'Não autorizado' using errcode = '42501'; end if;
  if exists (select 1 from public.projeto_passos where projeto_id = p_projeto) then return 0; end if;
  insert into public.projeto_passos (projeto_id, titulo, frase, lado, ordem)
  select p_projeto, m.titulo, m.frase, m.lado, m.ordem from public.workflow_modelo m order by m.ordem;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ───────────────────────── 5) funções do portal (a única porta do cliente) ─────────────────────────

-- 'equipa' (pré-visualização, só leitura), 'cliente' (é mesmo dele) ou null (sem acesso)
create or replace function public.portal_acesso(p_cliente uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_cliente is null then null
    when public.autorizado() then 'equipa'
    when exists (select 1 from public.clientes_utilizadores cu
                  where cu.cliente_id = p_cliente
                    and cu.email = lower(coalesce(auth.jwt() ->> 'email', ''))) then 'cliente'
  end;
$$;

-- acesso a um projeto: só projetos marcados como visíveis ao cliente
create or replace function public.portal_acesso_projeto(p_projeto uuid)
returns text language sql stable security definer set search_path = public as $$
  select public.portal_acesso(p.cliente_id)
    from public.projetos p where p.id = p_projeto and p.visivel_ao_cliente;
$$;

-- os clientes a que este login pertence (e regista o primeiro login)
create or replace function public.portal_meus_clientes()
returns table (cliente_id uuid, nome text)
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  update public.clientes_utilizadores cu set utilizador_id = auth.uid()
   where cu.email = v_email and cu.utilizador_id is null and auth.uid() is not null;
  return query
    select c.id, c.nome from public.clientes_utilizadores cu join public.clientes c on c.id = cu.cliente_id
     where cu.email = v_email order by c.nome;
end;
$$;

-- lista de projetos de um cliente, com a fase (passo atual) e o que há para aprovar
create or replace function public.portal_projetos(p_cliente uuid)
returns table (id uuid, nome text, tipo text, prazo_estimado date, passo_atual text, passo_lado text,
               passos_total integer, passos_feitos integer, por_aprovar integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.tipo, p.prazo_estimado,
         (select s.titulo from public.projeto_passos s where s.projeto_id = p.id and s.data_real is null order by s.ordem limit 1),
         (select s.lado   from public.projeto_passos s where s.projeto_id = p.id and s.data_real is null order by s.ordem limit 1),
         (select count(*)::int from public.projeto_passos s where s.projeto_id = p.id),
         (select count(*)::int from public.projeto_passos s where s.projeto_id = p.id and s.data_real is not null),
         (select count(*)::int from public.conteudos k where k.projeto_id = p.id and k.estado = 'para_aprovacao')
    from public.projetos p
   where p.cliente_id = p_cliente and p.visivel_ao_cliente and public.portal_acesso(p_cliente) is not null
   order by p.prazo_estimado nulls last, p.criado_em;
$$;

-- detalhe de um projeto: só campos seguros. Sem notas, prioridade, estado interno, finanças.
create or replace function public.portal_projeto(p_projeto uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'acesso', public.portal_acesso(p.cliente_id),
    'projeto', jsonb_build_object('id', p.id, 'nome', p.nome, 'tipo', p.tipo, 'cliente_id', p.cliente_id,
                                  'prazo_estimado', p.prazo_estimado, 'link_entrega', p.link_entrega),
    'passos', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', s.id, 'titulo', s.titulo, 'frase', s.frase, 'lado', s.lado,
                  'data_prevista', s.data_prevista, 'data_real', s.data_real) order by s.ordem)
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

-- conversa de um conteúdo
create or replace function public.portal_comentarios(p_conteudo uuid)
returns table (id uuid, tipo text, texto text, estado_de text, estado_para text,
               autor_nome text, autor_tipo text, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.tipo, m.texto, m.estado_de, m.estado_para, m.autor_nome, m.autor_tipo, m.criado_em
    from public.comentarios m join public.conteudos k on k.id = m.conteudo_id
   where m.conteudo_id = p_conteudo and public.portal_acesso_projeto(k.projeto_id) is not null
   order by m.criado_em;
$$;

-- o cliente comenta um conteúdo seu
create or replace function public.portal_comentar(p_conteudo uuid, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select public.portal_acesso_projeto(k.projeto_id) from public.conteudos k where k.id = p_conteudo)
     is distinct from 'cliente' then
    raise exception 'Sem acesso a este conteúdo' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_texto, ''))) = 0 then
    raise exception 'O comentário não pode estar vazio' using errcode = '22023';
  end if;
  insert into public.comentarios (conteudo_id, texto) values (p_conteudo, trim(p_texto));
end;
$$;

-- o cliente aprova ou pede alterações (pedir alterações exige comentário)
create or replace function public.portal_responder_conteudo(p_conteudo uuid, p_acao text, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select public.portal_acesso_projeto(k.projeto_id) from public.conteudos k where k.id = p_conteudo)
     is distinct from 'cliente' then
    raise exception 'Sem acesso a este conteúdo' using errcode = '42501';
  end if;
  if p_acao not in ('aprovar', 'pedir_alteracoes') then
    raise exception 'Ação inválida' using errcode = '22023';
  end if;
  if p_acao = 'pedir_alteracoes' and length(trim(coalesce(p_comentario, ''))) = 0 then
    raise exception 'Para pedir alterações é preciso um comentário' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_comentario, ''))) > 0 then
    insert into public.comentarios (conteudo_id, texto) values (p_conteudo, trim(p_comentario));
  end if;
  update public.conteudos
     set estado = case p_acao when 'aprovar' then 'aprovado' else 'alteracoes_pedidas' end
   where id = p_conteudo;
end;
$$;

-- formulário (briefing ou feedback) de um projeto: perguntas + respostas já dadas
create or replace function public.portal_formulario(p_projeto uuid, p_tipo text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'pergunta_id', m.id, 'pergunta', m.pergunta, 'ajuda', m.ajuda, 'tipo_campo', m.tipo_campo,
           'obrigatoria', m.obrigatoria, 'resposta', r.resposta, 'respondido_em', r.atualizado_em) order by m.ordem), '[]'::jsonb)
    from public.formularios_modelo m
    left join public.formularios_respostas r on r.pergunta_id = m.id and r.projeto_id = p_projeto
   where m.tipo = p_tipo and public.portal_acesso_projeto(p_projeto) is not null;
$$;

-- o cliente guarda (ou altera) uma resposta
create or replace function public.portal_guardar_resposta(p_projeto uuid, p_pergunta uuid, p_resposta text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.formularios_modelo;
begin
  if public.portal_acesso_projeto(p_projeto) is distinct from 'cliente' then
    raise exception 'Sem acesso a este projeto' using errcode = '42501';
  end if;
  select * into m from public.formularios_modelo where id = p_pergunta;
  if not found then raise exception 'Pergunta inexistente' using errcode = '22023'; end if;
  insert into public.formularios_respostas (projeto_id, tipo, pergunta_id, pergunta_texto, resposta, autor_id)
  values (p_projeto, m.tipo, m.id, m.pergunta, nullif(trim(coalesce(p_resposta, '')), ''), auth.uid())
  on conflict (projeto_id, pergunta_id)
  do update set resposta = excluded.resposta, pergunta_texto = excluded.pergunta_texto, autor_id = excluded.autor_id;
end;
$$;

-- páginas Workflow, Ferramentas e Comunicação (iguais para todos os clientes)
create or replace function public.portal_paginas()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'workflow', coalesce((select jsonb_agg(jsonb_build_object('titulo', w.titulo, 'frase', w.frase, 'lado', w.lado) order by w.ordem)
                            from public.workflow_modelo w), '[]'::jsonb),
    'paginas', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', c.id, 'pagina', c.pagina, 'titulo', c.titulo, 'texto', c.texto,
                  'blocos', coalesce((select jsonb_agg(jsonb_build_object(
                                'tipo', b.tipo, 'titulo', b.titulo, 'descricao', b.descricao, 'url_drive', b.url_drive) order by b.ordem)
                              from public.conteudo_portal_blocos b where b.conteudo_portal_id = c.id), '[]'::jsonb))
                  order by c.pagina, c.ordem)
                from public.conteudo_portal c), '[]'::jsonb))
   where public.autorizado()
      or exists (select 1 from public.clientes_utilizadores cu
                  where cu.email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- permissões das funções
do $$
declare f text;
begin
  foreach f in array array[
    'portal_acesso(uuid)', 'portal_acesso_projeto(uuid)', 'portal_meus_clientes()', 'portal_projetos(uuid)',
    'portal_projeto(uuid)', 'portal_comentarios(uuid)', 'portal_comentar(uuid, text)',
    'portal_responder_conteudo(uuid, text, text)', 'portal_formulario(uuid, text)',
    'portal_guardar_resposta(uuid, uuid, text)', 'portal_paginas()', 'aplicar_workflow(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['comentario_autor()', 'conteudo_regista_estado()', 'copiar_workflow()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ───────────────────────── 6) conteúdo de base (só se as tabelas estiverem vazias) ─────────────────────────
insert into public.workflow_modelo (titulo, frase, lado, ordem)
select v.titulo, v.frase, v.lado, v.ordem from (values
  ('Primeiro contacto', 'Conhecemo-nos e percebemos o que procuras.', 'nordan', 1),
  ('Briefing inicial',  'Contas-nos o essencial sobre a marca e o objetivo.', 'cliente', 2),
  ('Proposta base',     'Enviamos uma primeira proposta de trabalho.', 'nordan', 3),
  ('Adjudicação',       'Confirmas que avançamos.', 'cliente', 4),
  ('Briefing completo', 'Respondes ao briefing detalhado no portal.', 'cliente', 5),
  ('Proposta final',    'Fechamos o âmbito, os prazos e as entregas.', 'nordan', 6),
  ('Planeamento',       'Definimos datas, equipa e locais.', 'nordan', 7),
  ('Pré-produção',      'Preparamos guiões, referências e logística.', 'nordan', 8),
  ('Produção',          'Gravamos ou fotografamos.', 'nordan', 9),
  ('Pós-produção',      'Editamos e finalizamos os conteúdos.', 'nordan', 10),
  ('Aprovação',         'Vês os conteúdos no portal e aprovas ou pedes alterações.', 'cliente', 11),
  ('Entrega',           'Entregamos os ficheiros finais.', 'nordan', 12),
  ('Feedback',          'Dizes-nos como correu, para melhorarmos.', 'cliente', 13)
) as v(titulo, frase, lado, ordem)
where not exists (select 1 from public.workflow_modelo);

insert into public.conteudo_portal (pagina, titulo, texto, ordem)
select v.pagina, v.titulo, v.texto, v.ordem from (values
  ('ferramentas', 'Portal Nordan', null, 1),
  ('ferramentas', 'Google Drive', null, 2),
  ('ferramentas', 'Email', null, 3),
  ('ferramentas', 'WhatsApp', null, 4),
  ('ferramentas', 'Marcação de reuniões', null, 5),
  ('comunicacao', 'Portal', 'Aprovações e estado dos projetos.', 1),
  ('comunicacao', 'Email', 'Assuntos formais.', 2),
  ('comunicacao', 'WhatsApp', 'Assuntos rápidos.', 3),
  ('comunicacao', 'Reuniões', 'Início do projeto e pontos de situação.', 4)
) as v(pagina, titulo, texto, ordem)
where not exists (select 1 from public.conteudo_portal);
