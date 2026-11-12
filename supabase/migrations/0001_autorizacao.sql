-- ═══════════════════════════════════════════════════════════════════════════
-- Nordan · Painel interno · migração 0001 · autorização de contas
-- Correr no SQL Editor do Supabase (ou com `supabase db push`).
-- Depois: inserir os dois emails autorizados (ver fim do ficheiro).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Lista de emails que podem entrar no painel
create table if not exists public.utilizadores_autorizados (
  email      text primary key check (email = lower(email)),
  nome       text,
  criado_em  timestamptz not null default now()
);
comment on table public.utilizadores_autorizados is
  'Só estes emails conseguem criar sessão. Gerido à mão (duas contas).';

alter table public.utilizadores_autorizados enable row level security;

-- 2) Função usada em TODAS as políticas RLS das tabelas seguintes:
--    "a pessoa com sessão está na lista?"
create or replace function public.autorizado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.utilizadores_autorizados
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.autorizado() from public;
grant execute on function public.autorizado() to authenticated, anon;

-- Os autorizados podem ler a lista (para mostrar nomes); ninguém a altera pela API.
drop policy if exists "autorizados leem a lista" on public.utilizadores_autorizados;
create policy "autorizados leem a lista"
  on public.utilizadores_autorizados
  for select
  to authenticated
  using (public.autorizado());

-- 3) Bloqueio na origem: um email fora da lista não chega a ter conta em auth.users,
--    logo o link mágico nunca cria sessão.
create or replace function public.bloquear_nao_autorizados()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.utilizadores_autorizados
    where email = lower(new.email)
  ) then
    raise exception 'Email não autorizado' using errcode = '28000';
  end if;
  return new;
end;
$$;
revoke all on function public.bloquear_nao_autorizados() from public;

drop trigger if exists utilizadores_so_autorizados on auth.users;
create trigger utilizadores_so_autorizados
  before insert on auth.users
  for each row execute function public.bloquear_nao_autorizados();

-- 4) Os dois emails autorizados.
insert into public.utilizadores_autorizados (email, nome) values
  ('nordancreativestudio@gmail.com', 'Nordan Creative Studio'),
  ('nunograva@gmail.com', 'Nuno')
on conflict (email) do nothing;
