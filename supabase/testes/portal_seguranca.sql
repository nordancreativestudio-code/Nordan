-- ═══════════════════════════════════════════════════════════════════════════
-- Teste de segurança do portal. Correr no SQL Editor DEPOIS da migração 0007.
-- Cria dois clientes de teste, entra "como" o cliente A e tenta chegar aos
-- dados do cliente B. NADA fica gravado: o teste termina sempre com uma
-- mensagem em forma de erro (é assim que tudo é desfeito). Lê a mensagem:
--   "TESTE OK: 13/13 ..."      → está seguro
--   "TESTE FALHOU: ..."        → diz-me o que aparece
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  a uuid; b uuid; pa uuid; pa_oculto uuid; pb uuid; ka uuid; kb uuid; ta_vis uuid; ta_int uuid; qa uuid;
  ok int := 0; falhas text := ''; n int; j jsonb; total int := 13;
begin
  insert into public.clientes (nome) values ('TESTE cliente A') returning id into a;
  insert into public.clientes (nome) values ('TESTE cliente B') returning id into b;
  insert into public.projetos (nome, cliente_id, visivel_ao_cliente, notas) values ('TESTE A visível', a, true, 'nota interna secreta') returning id into pa;
  insert into public.projetos (nome, cliente_id, visivel_ao_cliente) values ('TESTE A oculto', a, false) returning id into pa_oculto;
  insert into public.projetos (nome, cliente_id, visivel_ao_cliente) values ('TESTE B visível', b, true) returning id into pb;
  insert into public.conteudos (projeto_id, titulo) values (pa, 'TESTE conteúdo A') returning id into ka;
  insert into public.conteudos (projeto_id, titulo) values (pb, 'TESTE conteúdo B') returning id into kb;
  insert into public.tarefas (projeto_id, titulo, visivel_ao_cliente) values (pa, 'TESTE tarefa visível', true) returning id into ta_vis;
  insert into public.tarefas (projeto_id, titulo, visivel_ao_cliente) values (pa, 'TESTE tarefa interna', false) returning id into ta_int;
  insert into public.formularios_modelo (tipo, pergunta) values ('briefing', 'TESTE pergunta') returning id into qa;
  insert into public.clientes_utilizadores (cliente_id, email) values (a, 'cliente-a@teste.invalid');

  -- a partir daqui: sessão do cliente A (sem privilégios de administrador)
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated","email":"cliente-a@teste.invalid"}', true);
  set local role authenticated;

  -- 1-4: acesso direto às tabelas devolve zero linhas
  select count(*) into n from public.projetos;  if n = 0 then ok := ok + 1; else falhas := falhas || ' [1 lê projetos diretamente]'; end if;
  select count(*) into n from public.tarefas;   if n = 0 then ok := ok + 1; else falhas := falhas || ' [2 lê tarefas diretamente]'; end if;
  select count(*) into n from public.conteudos; if n = 0 then ok := ok + 1; else falhas := falhas || ' [3 lê conteúdos diretamente]'; end if;
  select count(*) into n from public.clientes;  if n = 0 then ok := ok + 1; else falhas := falhas || ' [4 lê clientes diretamente]'; end if;

  -- 5: vê só o projeto visível do cliente A
  select count(*) into n from public.portal_projetos(a);
  if n = 1 then ok := ok + 1; else falhas := falhas || format(' [5 esperava 1 projeto de A, viu %s]', n); end if;
  -- 6: não vê projetos do cliente B
  select count(*) into n from public.portal_projetos(b);
  if n = 0 then ok := ok + 1; else falhas := falhas || ' [6 vê projetos de B]'; end if;
  -- 7: não abre o projeto de B nem o projeto oculto de A
  if public.portal_projeto(pb) is null and public.portal_projeto(pa_oculto) is null then ok := ok + 1;
  else falhas := falhas || ' [7 abre projeto de B ou projeto oculto]'; end if;
  -- 8: no seu projeto não vêm notas internas nem a tarefa interna
  j := public.portal_projeto(pa);
  if j is not null and j::text not like '%nota interna secreta%' and j::text not like '%TESTE tarefa interna%'
     and j::text like '%TESTE tarefa visível%' then ok := ok + 1;
  else falhas := falhas || ' [8 detalhe do projeto expõe dados internos]'; end if;

  -- 9: não consegue aprovar nem comentar conteúdo de B
  begin
    perform public.portal_responder_conteudo(kb, 'aprovar');
    falhas := falhas || ' [9 aprovou conteúdo de B]';
  exception when others then
    begin
      perform public.portal_comentar(kb, 'intruso');
      falhas := falhas || ' [9 comentou conteúdo de B]';
    exception when others then ok := ok + 1; end;
  end;
  -- 10: pedir alterações sem comentário é recusado
  begin
    perform public.portal_responder_conteudo(ka, 'pedir_alteracoes', '  ');
    falhas := falhas || ' [10 pediu alterações sem comentário]';
  exception when others then ok := ok + 1; end;
  -- 11: não consegue responder ao formulário do projeto de B, nem mexer diretamente num conteúdo
  begin
    perform public.portal_guardar_formulario(pb, 'briefing', null, jsonb_build_object(qa::text, 'intruso'), false);
    falhas := falhas || ' [11 respondeu ao formulário de B]';
  exception when others then
    update public.conteudos set estado = 'aprovado' where id = ka;
    get diagnostics n = row_count;
    if n = 0 then ok := ok + 1; else falhas := falhas || ' [11 alterou conteúdo diretamente]'; end if;
  end;
  -- 12: o que é dele funciona: aprova, e a mudança fica registada com autor
  perform public.portal_responder_conteudo(ka, 'aprovar', 'Está ótimo');
  perform public.portal_guardar_formulario(pa, 'briefing', null, jsonb_build_object(qa::text, 'A minha resposta'), true);
  -- 13 (feito antes de repor os privilégios): não lê respostas de formulários diretamente
  select count(*) into n from public.formularios_respostas;
  if n = 0 then ok := ok + 1; else falhas := falhas || ' [13 lê respostas de formulários diretamente]'; end if;
  reset role;
  select count(*) into n from public.comentarios
   where conteudo_id = ka and tipo = 'mudanca_estado' and estado_para = 'aprovado' and autor_tipo = 'cliente';
  if n = 1 and (select estado from public.conteudos where id = ka) = 'aprovado'
     and (select r.respostas -> 0 ->> 'resposta' from public.formularios_respostas r where r.projeto_id = pa and r.tipo = 'briefing') = 'A minha resposta'
  then ok := ok + 1; else falhas := falhas || ' [12 a aprovação ou a resposta do próprio cliente não ficou registada]'; end if;

  if ok = total then
    raise exception 'TESTE OK: %/% verificações passaram. Nada foi gravado (os dados de teste foram desfeitos).', ok, total;
  else
    raise exception 'TESTE FALHOU: %/% passaram. Falhas:%', ok, total, falhas;
  end if;
end $$;
