-- ═══════════════════════════════════════════════════════════════════════════
-- Nordan · migração 0012 · links do projeto (Google Drive, por link, sem API)
-- Correr no SQL Editor DEPOIS da 0011. Pode ser corrida mais de uma vez.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) tabela de links por projeto
create table if not exists public.projeto_links (
  id                  uuid primary key default gen_random_uuid(),
  projeto_id          uuid not null references public.projetos(id) on delete cascade,
  titulo              text not null check (length(trim(titulo)) > 0),
  -- '' só existe enquanto a linha é criada na gaveta e o link ainda não foi colado; nunca chega ao cliente
  url                 text not null default '' check (url = '' or url ~* '^https?://'),
  tipo                text not null default 'Outro',
  visivel_ao_cliente  boolean not null default true,
  ordem               double precision not null default 0,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index if not exists projeto_links_projeto_idx on public.projeto_links (projeto_id, ordem);

drop trigger if exists projeto_links_atualizado on public.projeto_links;
create trigger projeto_links_atualizado before update on public.projeto_links
  for each row execute function public.tocar_atualizado_em();

-- 2) RLS: só a equipa lê e escreve; anon sem acesso. O cliente só vê através de portal_projeto().
alter table public.projeto_links enable row level security;
drop policy if exists "equipa tudo" on public.projeto_links;
create policy "equipa tudo" on public.projeto_links for all to authenticated
  using (public.autorizado()) with check (public.autorizado());
revoke all on public.projeto_links from anon;

-- 3) listas da gaveta (opcoes)
insert into public.opcoes (lista, valor, ordem) values
  ('link_tipo', 'Planeamento', 1),
  ('link_tipo', 'Entrega', 2),
  ('link_tipo', 'Pasta', 3),
  ('link_tipo', 'Outro', 4)
on conflict (lista, valor) do nothing;

-- 4) portal_projeto: igual à 0008, com UMA chave nova ('links': só os visíveis e com link preenchido).
--    O acesso continua a depender de portal_acesso(), ou seja, só o cliente dono (ou a equipa em pré-visualização).
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
                from public.conteudos k where k.projeto_id = p.id), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', l.id, 'titulo', l.titulo, 'url', l.url, 'tipo', l.tipo)
                  order by l.ordem, l.criado_em)
                from public.projeto_links l
               where l.projeto_id = p.id and l.visivel_ao_cliente and l.url <> ''), '[]'::jsonb))
    from public.projetos p
   where p.id = p_projeto and p.visivel_ao_cliente and public.portal_acesso(p.cliente_id) is not null;
$$;
