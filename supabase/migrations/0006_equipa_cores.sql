-- ═══════════════════════════════════════════════════════════════════════════
-- Nordan · migração 0006 · cor e iniciais por pessoa, cronómetros ativos, tempo real
-- Correr no SQL Editor DEPOIS da 0005. Pode ser corrida mais de uma vez.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) cor e iniciais
alter table public.utilizadores_autorizados add column if not exists cor text;
alter table public.utilizadores_autorizados add column if not exists iniciais text;

alter table public.utilizadores_autorizados drop constraint if exists utilizadores_cor_check;
alter table public.utilizadores_autorizados add constraint utilizadores_cor_check
  check (cor is null or (cor ~ '^#[0-9A-F]{6}$' and cor not in ('#E7FF25', '#FF6F55')));  -- nem lima (marca) nem coral (alertas)
alter table public.utilizadores_autorizados drop constraint if exists utilizadores_iniciais_check;
alter table public.utilizadores_autorizados add constraint utilizadores_iniciais_check
  check (iniciais is null or char_length(iniciais) between 1 and 3);

-- 2) pessoas novas: iniciais a partir do nome e a primeira cor livre da lista
create or replace function public.preencher_pessoa()
returns trigger language plpgsql set search_path = public as $$
declare
  paleta text[] := array['#B48CFF', '#FF8FC7', '#5CE0B0', '#FF9F5A'];
  c text;
  n integer;
begin
  if new.iniciais is null then
    new.iniciais := upper(
      left(coalesce(nullif(trim(new.nome), ''), new.email), 1)
      || coalesce(left(split_part(trim(new.nome), ' ', 2), 1), ''));
  end if;
  if new.cor is null then
    select u.p into c
      from unnest(paleta) with ordinality as u(p, o)
     where not exists (select 1 from public.utilizadores_autorizados a where a.cor = u.p)
     order by u.o limit 1;
    if c is null then
      select count(*) into n from public.utilizadores_autorizados;
      c := paleta[1 + (n % 4)];
    end if;
    new.cor := c;
  else
    new.cor := upper(new.cor);
  end if;
  return new;
end;
$$;
drop trigger if exists utilizadores_preencher on public.utilizadores_autorizados;
create trigger utilizadores_preencher before insert on public.utilizadores_autorizados
  for each row execute function public.preencher_pessoa();

-- 3) as duas contas atuais: a conta da Nordan é a do André (âmbar); o Nuno fica a azul
update public.utilizadores_autorizados
   set nome = 'André', cor = '#FFC93C', iniciais = 'A'
 where email = 'nordancreativestudio@gmail.com';
update public.utilizadores_autorizados
   set nome = 'Nuno', cor = '#55D3FF', iniciais = 'N'
 where email = 'nunograva@gmail.com';

-- 4) funções (só respondem a quem está na lista de autorizados)

-- a equipa, com o identificador da conta de login de cada pessoa
create or replace function public.equipa()
returns table (email text, nome text, cor text, iniciais text, utilizador_id uuid)
language sql stable security definer set search_path = public as $$
  select a.email, a.nome, a.cor, a.iniciais, u.id
    from public.utilizadores_autorizados a
    left join auth.users u on lower(u.email) = a.email
   where public.autorizado()
   order by a.criado_em, a.email;
$$;

-- mudar a cor de uma pessoa (ecrã Equipa)
create or replace function public.definir_cor(p_email text, p_cor text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.autorizado() then
    raise exception 'Não autorizado' using errcode = '42501';
  end if;
  update public.utilizadores_autorizados set cor = upper(p_cor) where email = lower(p_email);
end;
$$;

-- cronómetros a correr neste momento, com pessoa, tarefa e projeto
create or replace function public.cronometros_ativos()
returns table (registo_id uuid, utilizador_id uuid, nome text, cor text, iniciais text,
               tarefa_id uuid, tarefa text, projeto_id uuid, projeto text,
               inicio timestamptz, agora timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.utilizador_id, a.nome, a.cor, a.iniciais,
         t.id, t.titulo, p.id, p.nome, r.inicio, now()
    from public.registos_tempo r
    join public.tarefas t on t.id = r.tarefa_id
    join public.projetos p on p.id = t.projeto_id
    left join auth.users u on u.id = r.utilizador_id
    left join public.utilizadores_autorizados a on a.email = lower(u.email)
   where r.fim is null and public.autorizado()
   order by r.inicio;
$$;

revoke all on function public.equipa(), public.definir_cor(text, text), public.cronometros_ativos() from public, anon;
grant execute on function public.equipa(), public.definir_cor(text, text), public.cronometros_ativos() to authenticated;
revoke all on function public.preencher_pessoa() from public, anon, authenticated;

-- 5) tempo real entre contas (o Realtime respeita a RLS: só autorizados recebem)
do $$
declare t text;
begin
  foreach t in array array['registos_tempo', 'utilizadores_autorizados'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
