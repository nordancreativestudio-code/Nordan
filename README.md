# Nordan · Painel interno

Painel de gestão da Nordan Creative Studio (projetos, clientes, leads, finanças, calendário, cronómetro, pedidos de design, novidades).

- **Next.js** (App Router, TypeScript, CSS vanilla com os tokens do dashboard)
- **Supabase** (login por link no email, Row Level Security em todas as tabelas, só duas contas autorizadas)
- **Vercel** para o deploy

## Arrancar

```bash
cp .env.example .env.local   # preencher com as chaves do projeto Supabase
npm install
npm run dev                  # http://localhost:3000
```

## Supabase

1. Correr `supabase/migrations/0001_autorizacao.sql` no SQL Editor.
2. Inserir os dois emails autorizados na tabela `utilizadores_autorizados`.
3. Em **Authentication → URL Configuration**: Site URL = URL da Vercel; Redirect URLs = `http://localhost:3000/auth/callback` e `https://<dominio>/auth/callback`.

As chaves vivem só em `.env.local` e nas variáveis de ambiente da Vercel. Nunca no código.

## Estrutura

- `src/app/login` — ecrã de login (link mágico)
- `src/app/auth/callback` — troca o link por sessão
- `src/app/(app)` — o painel (barra lateral + secções), protegido por `exigirAutorizado()`
- `src/proxy.ts` — renova a sessão e redireciona quem não tem login
- `src/lib/supabase` — clientes browser / servidor
- `public/fonts` — Creato Display (woff2) · `public/brand` — logótipos e ícone
- `supabase/migrations` — esquema da base de dados
