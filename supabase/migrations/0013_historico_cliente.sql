-- ═══════════════════════════════════════════════════════════════════════════
-- Nordan · migração 0013 · cliente "regular" vê todo o histórico
-- Correr no SQL Editor DEPOIS da 0012. Pode ser corrida mais de uma vez.
--
-- Nova opção por cliente: clientes.historico_visivel (falso por omissão).
-- Com ela ligada, TODOS os projetos desse cliente e as suas tarefas ficam visíveis no portal
-- (os conteúdos já apareciam todos nos projetos visíveis; os links do Drive mantêm a sua
-- própria opção "visível ao cliente"; o tempo continua a depender de "mostrar tempo").
-- Com a opção desligada nada muda: o cliente só vê os projetos/tarefas marcados.
--
-- Segurança: todas as funções continuam a exigir portal_acesso(cliente), por isso um login
-- só chega aos dados do SEU cliente (ou a equipa, em pré-visualização). A opção é por cliente:
-- nunca abre dados de outro.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) a opção (só a equipa a altera: a RLS de clientes já é só para a equipa)
alter table public.clientes add column if not exists historico_visivel boolean not null default false;

-- 2) acesso a um projeto: visível por marcação OU porque o dono tem o histórico ligado
create or replace function public.portal_acesso_projeto(p_projeto uuid)
returns text language sql stable security definer set search_path = public as $$
  select public.portal_acesso(p.cliente_id)
    from public.projetos p
   where p.id = p_projeto
     and (p.visivel_ao_cliente
          or coalesce((select c.historico_visivel from public.clientes c where c.id = p.cliente_id), false));
$$;

-- 3) lista de projetos: igual à 0008, com a chave nova 'estado' (para o portal separar Em curso / Concluídos)
drop function if exists public.portal_projetos(uuid);
create function public.portal_projetos(p_cliente uuid)
returns table (id uuid, nome text, tipo text, prazo_estimado date, passo_atual text, passo_tipo text,
               passos_total integer, passos_feitos integer, por_aprovar integer, estado text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.tipo, p.prazo_estimado,
         (select s.titulo from public.projeto_passos s where s.projeto_id = p.id and s.data_real is null order by s.ordem limit 1),
         (select s.tipo   from public.projeto_passos s where s.projeto_id = p.id and s.data_real is null order by s.ordem limit 1),
         (select count(*)::int from public.projeto_passos s where s.projeto_id = p.id),
         (select count(*)::int from public.projeto_passos s where s.projeto_id = p.id and s.data_real is not null),
         (select count(*)::int from public.conteudos k where k.projeto_id = p.id and k.estado = 'para_aprovacao'),
         p.estado
    from public.projetos p
   where p.cliente_id = p_cliente
     and public.portal_acesso(p_cliente) is not null
     and (p.visivel_ao_cliente
          or coalesce((select c.historico_visivel from public.clientes c where c.id = p.cliente_id), false))
   order by p.prazo_estimado nulls last, p.criado_em;
$$;

-- 4) detalhe do projeto: igual à 0012; muda só quem é visível (projeto e tarefas)
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
                from public.tarefas t
               where t.projeto_id = p.id
                 and (t.visivel_ao_cliente
                      or coalesce((select c.historico_visivel from public.clientes c where c.id = p.cliente_id), false))), '[]'::jsonb),
    'conteudos', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', k.id, 'titulo', k.titulo, 'tipo', k.tipo, 'estado', k.estado,
                  'responsavel', k.responsavel, 'link_drive', k.link_drive,
                  'comentarios', (select count(*) from public.comentarios m where m.conteudo_id = k.id and m.tipo = 'comentario'))
                  order by k.ordem, k.criado_em)
                from public.conteudos k where k.projeto_id = p.id), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', l.id, 'titulo', l.titulo, 'url', l.url, 'tipo', l.tipo)
                  order by l.ordem, l.criado_em)
                from public.projeto_links l
               where l.projeto_id = p.id and l.visivel_ao_cliente and l.url <> ''), '[]'::jsonb))
    from public.projetos p
   where p.id = p_projeto
     and public.portal_acesso(p.cliente_id) is not null
     and (p.visivel_ao_cliente
          or coalesce((select c.historico_visivel from public.clientes c where c.id = p.cliente_id), false));
$$;
