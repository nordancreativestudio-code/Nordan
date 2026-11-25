-- Bloco de notas do Início: uma única nota partilhada pelo Nuno e pelo André.
create table if not exists public.notas_painel (
  id             int primary key default 1 check (id = 1),
  texto          text not null default '',
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);

alter table public.notas_painel enable row level security;
drop policy if exists "equipa tudo" on public.notas_painel;
create policy "equipa tudo" on public.notas_painel
  for all to authenticated using (public.autorizado()) with check (public.autorizado());
revoke all on public.notas_painel from anon;

insert into public.notas_painel (id) values (1) on conflict (id) do nothing;
