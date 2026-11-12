# Brief do Painel Nordan (para o Claude Code)

> Lê este ficheiro inteiro antes de mexer em código. É a fonte de verdade do projeto.
> Sempre que eu disser "segue o brief", volta a este ficheiro.
> Responde-me sempre em português de Portugal, de forma curta.

---

## 1. Contexto

A **Nordan Creative Studio** é um estúdio de produção audiovisual (fotografia, vídeo, edição, gestão de redes, eventos e estúdio) gerido por dois sócios: **Nuno** e **André**. Setores-alvo dos clientes: saúde e estética, hotelaria, restauração e B2B.

Estamos a construir **um único painel** com duas vistas sobre os mesmos dados:

1. **Vista interna** — só o Nuno e o André. Tudo: projetos, tarefas, clientes, leads, finanças, tempo gasto.
2. **Portal do cliente** (fase seguinte) — cada cliente vê **apenas** os seus projetos: fase atual, prazo estimado, tempo por tarefa (se autorizado), conteúdos para aprovar, onboarding, workflow, ferramentas e comunicação.

Prioridade atual: **terminar a vista interna**. O portal vem depois, mas o modelo de dados tem de estar preparado para ele desde já.

---

## 2. Stack e estado atual

- **Next.js** (App Router) + **Supabase** (Postgres, Auth, RLS, região UE) + **Vercel** (deploy) + **GitHub** (código).
- Repositório local: `GIT/Nordan` no Mac mini do Nuno.
- Login por **link no email (magic link)**. O envio de email usa **SMTP próprio via Resend** (subdomínio `contact.nordancreativestudio.com`). Não alterar esta configuração.
- Lista de acesso interna: tabela `utilizadores_autorizados` (migração `supabase/migrations/0001_autorizacao.sql`). Quem tem sessão mas não está na lista é enviado para `src/app/auth/recusar/route.ts`, que termina a sessão e mostra "Esta conta não está autorizada".
- O ciclo de redirecionamentos (`ERR_TOO_MANY_REDIRECTS`) já foi corrigido em `proxy.ts`. **Não reintroduzir**: a página de login nunca redireciona para uma rota que volte ao login.

**Já feito e a funcionar:**
- Passo 1: projeto, login, sessão, RLS base, tokens de design, barra lateral, página Início com KPIs.
- Kanban de **Projetos** com 5 colunas, filtros Todos / André / Nuno, a gravar no Supabase.
- A aba "Cronómetro" da barra lateral foi removida.

**Por resolver (prioridade 1):** o cronómetro **não funciona dentro das tarefas**. Ver secção 6.

---

## 3. Regras de trabalho (obrigatórias)

1. **Uma secção de cada vez.** No fim de cada uma, pára e diz-me exatamente onde e como testar.
2. **Antes de criar ou alterar tabelas**, mostra-me o esquema (tabelas, campos, tipos, relações, políticas RLS) e **espera pela minha aprovação**.
3. **Migrações**: entrega sempre um ficheiro `.sql` numerado em `supabase/migrations/` (ex.: `0003_tarefas_cronometro.sql`) e diz-me para o correr no SQL Editor do Supabase. **Não peças a password da base de dados.** As migrações devem ser idempotentes quando possível (`if not exists`, `create or replace`).
4. **Segredos**: nunca no código nem no chat. Só em `.env.local` (excluído pelo `.gitignore`) e nas variáveis de ambiente do Vercel. Não me peças tokens do GitHub ou Vercel; o push e o deploy faço-os eu.
5. **Não descarregues browsers (Chromium/Playwright) nem tires capturas de ecrã.** Eu testo no meu browser e envio-te o que vir.
6. **Não uses dados de exemplo falsos** na base de dados.
7. **Commits pequenos e com mensagem clara** no fim de cada secção (eu faço o push).
8. Se algo não estiver claro neste brief, **pergunta antes** de inventar.
9. Ao terminares uma secção, responde neste formato:
   - **O que fiz** (3–5 linhas)
   - **Ficheiros alterados**
   - **Migração a correr** (caminho do `.sql`, ou "nenhuma")
   - **Como testar** (passos numerados)

---

## 4. Identidade visual

Referência visual e funcional: `referencia/dashboard-nordan.html` (o dashboard antigo). O painel tem de **parecer igual**.

- Fundo `#02130F` com luzes de cor desfocadas fixas por trás.
- Cartões de **vidro escuro**: fundo `rgba(8,48,38,.46)`, borda `rgba(190,255,225,.16)`, raio 16px (cartões) e 10px (botões, campos).
- Barra lateral de 230px em gradiente verde (`#0D4B3A → #00402F → #00322A`), item ativo com fundo lima suave e indicador lima à esquerda.
- Destaque: lima `#E7FF25`. Texto: `#EAF7F0`; secundário `#A0C6B6`; fraco `#76998A`.
- Estados: âmbar `#FFC93C`, coral `#FF6F55`, azul `#55D3FF`.
- Paleta da marca para acentos: Sherwood `#003D30`, Aqua Deep `#00513F`, Dartmouth `#00644F`, Dark Forest `#152022`, Mist `#EFEFEF`.
- **Tipografia: Creato Display** em todo o painel (títulos, texto e números, variando só o peso; números em Bold), tracking -50. Ficheiros em `public/fonts/`. Não usar Montserrat nem Roboto.
- Logótipos e ícone em `public/brand/` (ícone "n" em laço na barra lateral e favicon; logótipo completo no login).
- Todos os valores vêm de um único ficheiro de **tokens** de design. Não espalhar cores soltas pelo código.
- Interface em **português de Portugal**. Datas `dd/mm/aaaa`, moeda `€` com vírgula decimal, fuso `Europe/Lisbon`.

---

## 5. Modelo de dados (alvo)

Todas as tabelas com RLS ativo. Campos `id uuid`, `criado_em`, `atualizado_em` em todas.

| Tabela | Campos-chave |
| --- | --- |
| `utilizadores_autorizados` | email, nome, papel (`equipa`) — **já existe** |
| `clientes` | nome, setor, contacto principal, email, telefone, NIF, notas_internas |
| `projetos` | cliente_id, titulo, descricao, coluna_kanban, fase_cliente, prioridade (Urgente/Alta/Média), responsavel (Nuno/André), prazo_estimado, visivel_ao_cliente (falso por omissão) |
| `tarefas` | projeto_id, titulo, descricao, estado (por fazer / em curso / concluída), responsavel, prazo, ordem, visivel_ao_cliente (falso), mostrar_tempo_ao_cliente (falso) |
| `registos_tempo` | tarefa_id, utilizador_id, inicio, fim (nulo enquanto corre) |
| `leads` | nome, empresa, setor, origem, estado, proxima_acao, data_proxima_acao, data_follow_up (+1 ano) |
| `transacoes` | tipo (entrada/saída), valor, cliente_id, projeto_id, data, estado (pago/pendente), descricao |
| `conteudo_portal` | pagina (`workflow` / `ferramentas` / `comunicacao`), titulo, texto, ordem |
| `conteudo_portal_blocos` | conteudo_portal_id, tipo (vídeo / ficheiro / link), titulo, descricao, url_drive, ordem |

Tabelas do portal (fase seguinte, **não criar ainda**): `clientes_utilizadores`, `conteudos` (para aprovação), `comentarios`, `onboarding_passos`, `notificacoes`.

**Colunas do kanban interno:** Para fazer / Em andamento / Standby / Em aprovação / Concluído.
**Fases que o cliente verá (`fase_cliente`):** Onboarding / Pré-produção / Gravação / Edição / Revisão / Entregue.

---

## 6. PRIORIDADE 1 — Tarefas com cronómetro (vista interna)

O cronómetro tem de funcionar **no painel interno**, dentro de cada tarefa. Não existe aba separada.

### 6.1 Diagnóstico primeiro
Antes de escreveres código, verifica e diz-me:
- Se as tabelas `tarefas` e `registos_tempo` existem no Supabase (ou se a migração ainda não foi corrida).
- Se as políticas RLS permitem ler e escrever a utilizadores autorizados.
- Onde, na interface, as tarefas aparecem hoje (se aparecem).
- Qualquer erro na consola do browser ou no terminal relacionado com tempo/tarefas.

Depois propõe a correção e só avança com a minha aprovação se mexer no esquema.

### 6.2 Comportamento pretendido
1. Ao clicar num cartão do kanban abre a **gaveta do projeto** com: dados do projeto e a **lista de tarefas**.
2. Na lista: criar, editar (título, responsável, prazo), concluir, reordenar e apagar tarefas.
3. **Cada tarefa** tem um botão play/pausa e mostra o **tempo total acumulado** (`0m`, `25m`, `1h 25m`).
4. Play cria um registo em `registos_tempo` com `inicio = now()` e `fim = null`. Pausa preenche `fim`.
5. **Um só cronómetro ativo por pessoa.** Iniciar outro fecha automaticamente o anterior.
6. A contagem **sobrevive a refresh e a fechar o browser**: o tempo em curso é calculado a partir de `inicio` (nunca guardado só no estado do React).
7. Enquanto corre: botão a lima e tempo a atualizar ao segundo.
8. No **cartão do projeto** no kanban: tempo total somado das tarefas e um ponto lima se houver cronómetro ativo.
9. Na **barra lateral / topo**: indicador do cronómetro ativo (tarefa e tempo), com botão para pausar.
10. Possibilidade de **editar ou apagar um registo de tempo** (para corrigir esquecimentos).
11. Cálculos de total feitos de forma fiável (de preferência uma *view* ou função SQL que soma `coalesce(fim, now()) - inicio`).

### 6.3 Para o portal (preparar, não mostrar ainda)
- `mostrar_tempo_ao_cliente` em cada tarefa, com interruptor na gaveta.
- O cliente verá só o **total** de tarefas visíveis com esse campo ativo, nunca os registos individuais.

### 6.4 Teste de aceitação
1. Criar uma tarefa no projeto de teste e carregar em play.
2. Esperar 1 minuto, recarregar a página: o tempo continua a contar.
3. Pausar: o total fica gravado.
4. Iniciar outra tarefa: a primeira pára sozinha.
5. O cartão do kanban mostra o total certo.

---

## 7. Secções seguintes da vista interna (por esta ordem)

1. **Clientes** — lista e **ficha de cliente** (gaveta ao centro como no dashboard de referência): contactos, setor, projetos associados, faturação e pendentes, notas internas. No kanban, escolher o cliente de uma lista.
2. **Conteúdo do portal** — editor interno de 3 páginas: **Workflow**, **Ferramentas**, **Comunicação**. Cada uma com título, texto e blocos com links do Google Drive (vídeo ou ficheiro), reordenáveis. Conteúdo inicial (a ajustar por nós):
   - **Workflow:** 1. Reunião e proposta · 2. Onboarding · 3. Planeamento · 4. Gravação · 5. Edição · 6. Aprovação · 7. Entrega — cada etapa com "o que acontece" e "o que o cliente faz".
   - **Ferramentas:** Portal Nordan, Google Drive, Email, WhatsApp, marcação de reuniões.
   - **Comunicação:** Portal (aprovações e estado), Email (assuntos formais), WhatsApp (assuntos rápidos), Reuniões (início e pontos de situação).
3. **Leads** — quadro por estado, com setor, próxima ação e **follow-up automático a 1 ano** (o envio será feito pelo Make; aqui só o campo e a lista do que vence).
4. **Finanças** — entradas e saídas, pago/pendente, gráficos mensais, pendentes por cliente.
5. **Calendário** — ligação ao Google Calendar (leitura e escrita).
6. **Pedidos de design** e **Novidades**, como no dashboard de referência.
7. **Início** — os KPIs e o resumo do dia passam a ler dados reais de todas as secções.

---

## 8. Portal do cliente (fase seguinte — só depois da vista interna)

Não construir ainda. Apenas garantir que nada na vista interna o impede.

- Login por magic link com contas de cliente ligadas ao seu `cliente_id` (`clientes_utilizadores`).
- Páginas: Início · Onboarding · Projetos · Projeto (detalhe) · Aprovação de conteúdos · Workflow · Ferramentas · Comunicação · Sobre a Nordan · Novidades.
- Aprovação: um cartão por conteúdo com link do Drive, estado (Em revisão / Alterações pedidas / Aprovado), comentários e botões **Aprovar** e **Pedir alterações**.
- Avisos por email (Resend) ao cliente quando há conteúdo para aprovar, e à equipa quando o cliente comenta ou aprova.
- **Regra de segurança absoluta:** o cliente nunca vê preços, finanças, notas internas, leads, nem tarefas/projetos com `visivel_ao_cliente = false`. Garantir isto com **RLS**, não só na interface, e testar com uma conta de cliente real antes de dar acesso a alguém.

---

## 9. O que NÃO fazer

- Não mudar a stack nem acrescentar serviços pagos sem perguntar.
- Não alterar a configuração de autenticação/SMTP já a funcionar.
- Não desativar RLS "para testar".
- Não usar a chave `service_role` no lado do cliente.
- Não fazer várias secções numa só resposta.
- Não descarregar browsers nem tirar capturas.

---

## 10. Primeira tarefa agora

Começa pela **secção 6.1 (diagnóstico do cronómetro)** e responde no formato da regra 9. Não avances para Clientes até eu confirmar que o cronómetro passa o teste da secção 6.4.
