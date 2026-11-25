import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dataCurta, ESTADOS, fmtTempo, tabelaEmFalta } from "@/lib/tipos";
import { OlhoSaldo, ValorSaldo } from "@/components/SaldoOculto";
import { BlocoNotas, GraficoLucro, QuemEmQue } from "@/components/inicio/InicioBlocos";
import { dataLisboa, hojeLisboa, somaDias } from "@/lib/calendario";

type Linha = {
  id: string; nome: string; estado: string; prioridade: string; responsavel: string;
  prazo: string | null; prazo_estimado: string | null; inicio: string | null; cliente_id: string | null;
  clientes: { nome: string } | { nome: string }[] | null;
};

const nomeCliente = (c: Linha["clientes"]) => (Array.isArray(c) ? c[0]?.nome : c?.nome) ?? "Sem cliente";
const PILL: Record<string, string> = { Urgente: "coral", Alta: "amber" };

export default async function Inicio() {
  const sb = await createClient();
  const mes = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" }).slice(0, 7);
  const hoje = hojeLisboa();
  const fim14 = somaDias(hoje, 14);
  const [pj, tf, fin, cfg, ld, br, tempos, sess, notas] = await Promise.all([
    sb.from("projetos")
      .select("id,nome,estado,prioridade,responsavel,prazo,prazo_estimado,inicio,cliente_id,clientes(nome)")
      .order("ordem"),
    sb.from("tarefas").select("id,titulo,projeto_id,concluida,prazo"),
    sb.from("financas").select("id,data,movimento,tipo,valor,pago,recebido,clientes(nome)"),
    sb.from("config_financas").select("saldo,saldo_data").eq("id", 1).maybeSingle(),
    sb.from("leads").select("nome,estado,proximo_contacto").limit(5000),
    sb.from("formularios_respostas").select("id", { count: "exact", head: true }).eq("estado", "enviado").is("lido_em", null),
    sb.from("tempos_tarefa").select("tarefa_id,segundos"),
    sb.from("sessoes").select("id,titulo,inicio,clientes(nome)").eq("estado", "marcada")
      .gte("inicio", hoje + "T00:00:00").lte("inicio", fim14 + "T23:59:59").order("inicio"),
    sb.from("notas_painel").select("texto").eq("id", 1).maybeSingle(),
  ]);
  const briefingsPorLer = br.error ? 0 : br.count ?? 0;
  if (pj.error && !tabelaEmFalta(pj.error)) throw new Error(pj.error.message);

  const todos = (pj.data ?? []) as unknown as Linha[];
  const projetos = todos.filter((p) => p.estado !== "Concluído");
  const porEstado = (e: string) => projetos.filter((p) => p.estado === e);
  const emTrabalho = porEstado("Em andamento");

  // progresso (tarefas concluídas / total) por projeto
  const prog = new Map<string, { t: number; c: number }>();
  for (const t of tf.data ?? []) {
    const x = prog.get(t.projeto_id) ?? { t: 0, c: 0 };
    x.t += 1; if (t.concluida) x.c += 1;
    prog.set(t.projeto_id, x);
  }

  // finanças (só mostra se a tabela existir e responder)
  const temFin = !fin.error && !cfg.error;
  let entMes = 0, saiMes = 0, aReceber = 0;
  for (const m of fin.data ?? []) {
    const v = Number(m.valor) || 0;
    if (String(m.data).slice(0, 7) === mes) { if (m.tipo === "Entrada") entMes += v; else saiMes += v; }
    if (!m.pago && m.tipo === "Entrada") aReceber += v;
  }
  const temLeads = !ld.error;
  const hojeIso = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });
  const leadsAtivas = (ld.data ?? []).filter((l) => l.estado !== "Perdido");
  const leadsPorContactar = leadsAtivas.filter((l) => l.proximo_contacto && l.proximo_contacto <= hojeIso).length;
  const leadsConversa = leadsAtivas.filter((l) => l.estado === "Conversa").length;

  // «Quem está em quê»: resumo dos tempos registados
  const titulos = new Map((tf.data ?? []).map((t) => [t.id, t.titulo]));
  const comTempo = (tempos.error ? [] : tempos.data ?? []).filter((t) => Number(t.segundos) > 0);
  const totalSeg = comTempo.reduce((a, t) => a + Number(t.segundos), 0);
  const maior = comTempo.reduce<(typeof comTempo)[number] | null>((m, t) => (!m || Number(t.segundos) > Number(m.segundos) ? t : m), null);
  const resumoTempo = comTempo.length
    ? `${fmtTempo(totalSeg)} registados em ${comTempo.length} ${comTempo.length === 1 ? "tarefa" : "tarefas"}.` +
      (maior ? ` A que mais tempo levou até agora é «${titulos.get(maior.tarefa_id) ?? "?"}», com ${fmtTempo(Number(maior.segundos))}.` : "")
    : null;

  // Tarefas por estado (todas, incluindo concluídas)
  const COR_ESTADO: Record<string, string> = { "Em andamento": "var(--lime)", "Em aprovação": "var(--amber)", "Concluído": "#8FB8A8" };
  const totalPj = todos.length || 1;

  // Próximos 14 dias
  type Prox = { k: string; data: string; hora: string | null; titulo: string; cor: string; href: string };
  const prox: Prox[] = [];
  for (const x of sess.error ? [] : sess.data ?? []) {
    const c = x.clientes as unknown as { nome: string } | { nome: string }[] | null;
    prox.push({ k: "s" + x.id, data: dataLisboa(x.inicio), hora: new Date(x.inicio).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" }),
      titulo: `Sessão · ${x.titulo}${nomeCliente(c as Linha["clientes"]) !== "Sem cliente" ? " · " + nomeCliente(c as Linha["clientes"]) : ""}`, cor: "var(--sky)", href: "/calendario" });
  }
  for (const p of projetos) if (p.prazo && p.prazo >= hoje && p.prazo <= fim14)
    prox.push({ k: "p" + p.id, data: p.prazo, hora: null, titulo: `Projeto · ${p.nome}`, cor: "var(--lime)", href: "/projetos" });
  const nomeProj = new Map(todos.map((p) => [p.id, p.nome]));
  for (const t of tf.data ?? []) if (!t.concluida && t.prazo && t.prazo >= hoje && t.prazo <= fim14)
    prox.push({ k: "t" + t.id, data: t.prazo, hora: null, titulo: `Tarefa · ${t.titulo}${nomeProj.get(t.projeto_id) ? " · " + nomeProj.get(t.projeto_id) : ""}`, cor: "var(--coral)", href: "/projetos" });
  for (const l of ld.error ? [] : ld.data ?? []) if (l.estado !== "Perdido" && l.proximo_contacto && l.proximo_contacto >= hoje && l.proximo_contacto <= fim14)
    prox.push({ k: "l" + l.nome + l.proximo_contacto, data: l.proximo_contacto, hora: null, titulo: `Contactar · ${l.nome}`, cor: "var(--violet)", href: "/leads" });
  prox.sort((a, b) => a.data.localeCompare(b.data) || (a.hora ?? "99").localeCompare(b.hora ?? "99"));

  // Alertas: leads por recontactar e prazos em atraso
  type Alerta = { k: string; titulo: string; nota: string; href: string };
  const alertas: Alerta[] = [];
  for (const l of ld.error ? [] : ld.data ?? []) if (l.estado !== "Perdido" && l.proximo_contacto && l.proximo_contacto <= hoje)
    alertas.push({ k: "l" + l.nome, titulo: l.nome, nota: "lead por recontactar", href: "/leads" });
  for (const p of projetos) if (p.prazo && p.prazo < hoje)
    alertas.push({ k: "p" + p.id, titulo: p.nome, nota: `prazo passou a ${dataCurta(p.prazo)}`, href: "/projetos" });
  for (const t of tf.data ?? []) if (!t.concluida && t.prazo && t.prazo < hoje)
    alertas.push({ k: "t" + t.id, titulo: t.titulo, nota: `tarefa em atraso desde ${dataCurta(t.prazo)}`, href: "/projetos" });

  // Valores em falta (entradas por receber)
  const falta = (fin.error ? [] : fin.data ?? []).filter((m) => m.tipo === "Entrada" && !m.pago).sort((a, b) => String(a.data).localeCompare(String(b.data)));

  // Trabalhos por cliente neste mês
  const porCliente = new Map<string, number>();
  for (const p of todos) {
    const d = p.prazo ?? p.inicio;
    if (d && p.cliente_id && d.slice(0, 7) === mes) { const n = nomeCliente(p.clientes); porCliente.set(n, (porCliente.get(n) ?? 0) + 1); }
  }
  const trabalhos = [...porCliente.entries()].sort((a, b) => b[1] - a[1]);
  const maxTrab = Math.max(1, ...trabalhos.map(([, n]) => n));
  const nomeMes = new Date(hoje + "T12:00:00").toLocaleDateString("pt-PT", { month: "long" });

  // Lucro dos últimos 12 meses (só movimentos liquidados, no mês em que o dinheiro entrou/saiu)
  const serie: { chave: string; rotulo: string; v: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1 - i, 1, 12);
    serie.push({ chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      rotulo: d.toLocaleDateString("pt-PT", { month: "short" }).replace(".", ""), v: 0 });
  }
  for (const m of fin.error ? [] : fin.data ?? []) {
    if (!m.pago) continue;
    const s = serie.find((x) => x.chave === String(m.recebido ?? m.data).slice(0, 7));
    if (s) s.v += (m.tipo === "Saída" ? -1 : 1) * (Number(m.valor) || 0);
  }

  const bloco = (titulo: string, lista: Linha[], vazio: string) => (
    <div className="card">
      <h3>{titulo}<span className="tot">{lista.length}</span></h3>
      {lista.length === 0 ? (
        <div className="empty" style={{ padding: "18px 0" }}>{vazio}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {lista.map((p) => {
            const g = prog.get(p.id);
            const pct = g && g.t ? Math.round((g.c / g.t) * 100) : 0;
            const prazo = p.prazo ?? p.prazo_estimado;
            return (
              <Link
                key={p.id}
                href="/projetos"
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 2px",
                  borderBottom: "1px solid var(--line-soft)", fontSize: 13, color: "inherit", textDecoration: "none",
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontWeight: 500 }}>{p.nome}</b>
                  <span className="faint" style={{ display: "block", fontSize: 11 }}>{nomeCliente(p.clientes)}</span>
                </span>
                {g && g.t > 0 && <span className="faint" style={{ fontSize: 11 }}>{g.c}/{g.t} · {pct}%</span>}
                {PILL[p.prioridade] && <span className={`pill ${PILL[p.prioridade]}`}>{p.prioridade}</span>}
                <span className="pill">{p.responsavel}</span>
                {prazo && <span className="faint" style={{ fontSize: 11, minWidth: 48, textAlign: "right" }}>{dataCurta(prazo)}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      {briefingsPorLer > 0 && (
        <Link href="/briefings" className="card" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit", borderColor: "var(--lime-line)" }}>
          <span className="pill lime">{briefingsPorLer}</span>
          <b style={{ fontWeight: 500 }}>{briefingsPorLer === 1 ? "1 briefing por ler" : `${briefingsPorLer} briefings por ler`}</b>
          <span className="faint" style={{ marginLeft: "auto", fontSize: 12 }}>Abrir →</span>
        </Link>
      )}
      <QuemEmQue resumo={resumoTempo} />
      <div className="card">
        <h3>Tarefas por estado</h3>
        <div className="grid kpis">
          {ESTADOS.map((e) => {
            const n = todos.filter((p) => p.estado === e).length;
            return (
              <Link key={e} href="/projetos" className="kpi clic" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="n" style={{ textTransform: "uppercase", letterSpacing: ".08em" }}>{e}</div>
                <div className="v num" style={{ color: e === "Em andamento" ? "var(--lime)" : undefined }}>{n}</div>
                <div style={{ height: 4, borderRadius: 4, background: "var(--line-soft)", overflow: "hidden" }}>
                  <i style={{ display: "block", height: "100%", width: `${(n / totalPj) * 100}%`, background: COR_ESTADO[e] ?? "var(--moss)" }} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      {temFin && (<>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><OlhoSaldo /></div>
        <div className="grid kpis">
          <Link href="/financas" className="kpi hi clic" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="v num"><ValorSaldo valor={Number(cfg.data?.saldo) || 0} /></div><div className="n">Conta bancária</div>
          </Link>
          <Link href="/financas" className="kpi clic" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="v num"><ValorSaldo valor={entMes} /></div><div className="n">Entradas do mês</div>
          </Link>
          <Link href="/financas" className="kpi clic" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="v num"><ValorSaldo valor={saiMes} /></div><div className="n">Saídas do mês</div>
          </Link>
          <Link href="/financas" className="kpi clic" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="v num"><ValorSaldo valor={aReceber} /></div><div className="n">A receber</div>
          </Link>
        </div>
      </>)}
      {temLeads && (
        <div className="grid kpis">
          <Link href="/leads" className="kpi clic" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="v num">{leadsAtivas.length}</div><div className="n">Leads ativas</div>
          </Link>
          <Link href="/leads" className="kpi clic" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="v num" style={{ color: leadsPorContactar ? "var(--coral)" : undefined }}>{leadsPorContactar}</div><div className="n">Contactos de leads por fazer</div>
          </Link>
          <Link href="/leads" className="kpi clic" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="v num">{leadsConversa}</div><div className="n">Leads em conversa</div>
          </Link>
        </div>
      )}
      <div className="grid two">
        <div className="card">
          <h3>Próximos 14 dias</h3>
          {prox.length === 0 ? <div className="empty" style={{ padding: "18px 0" }}><b>Agenda livre</b>Sem sessões, prazos nem contactos nos próximos 14 dias.</div> : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {prox.slice(0, 10).map((x) => (
                <Link key={x.k} href={x.href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderBottom: "1px solid var(--line-soft)", fontSize: 13, color: "inherit", textDecoration: "none" }}>
                  <span style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: x.cor }} />
                  <span style={{ flex: 1, minWidth: 0 }}>{x.titulo}</span>
                  <span className="faint num" style={{ fontSize: 11 }}>{x.data === hoje ? "hoje" : dataCurta(x.data)}{x.hora ? ` ${x.hora}` : ""}</span>
                </Link>
              ))}
              {prox.length > 10 && <Link href="/calendario" className="faint" style={{ fontSize: 11, paddingTop: 8 }}>+ {prox.length - 10} no calendário →</Link>}
            </div>
          )}
        </div>
        <div className="card">
          <h3>Alertas{alertas.length > 0 && <span className="tot" style={{ color: "var(--coral)" }}>{alertas.length}</span>}</h3>
          {alertas.length === 0 ? <div className="empty" style={{ padding: "18px 0" }}><b>Tudo em dia</b>Nenhum lead por recontactar, nenhuma ação em atraso.</div> : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {alertas.slice(0, 8).map((x) => (
                <Link key={x.k} href={x.href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderBottom: "1px solid var(--line-soft)", fontSize: 13, color: "inherit", textDecoration: "none" }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{x.titulo}</span>
                  <span className="faint" style={{ fontSize: 11 }}>{x.nota}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid two">
        <div className="card">
          <h3>Valores em falta{falta.length > 0 && <span className="tot" style={{ color: "var(--amber)" }}><ValorSaldo valor={falta.reduce((a, m) => a + (Number(m.valor) || 0), 0)} /></span>}</h3>
          {falta.length === 0 ? <div className="empty" style={{ padding: "18px 0" }}><b>Ninguém deve nada</b>Todas as entradas estão marcadas como recebidas.</div> : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {falta.map((m) => (
                <Link key={m.id} href="/financas" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderBottom: "1px solid var(--line-soft)", fontSize: 13, color: "inherit", textDecoration: "none" }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{m.movimento}<span className="faint"> · {nomeCliente(m.clientes as Linha["clientes"])}</span></span>
                  <span className="num" style={{ color: "var(--amber)" }}><ValorSaldo valor={Number(m.valor) || 0} /></span>
                </Link>
              ))}
            </div>
          )}
          <Link href="/financas" className="btn sm" style={{ marginTop: 11, display: "inline-flex" }}>+ Acrescentar valor em falta</Link>
        </div>
        <BlocoNotas inicial={notas.data?.texto ?? ""} existe={!notas.error} />
      </div>
      <div className="card">
        <h3>Trabalhos por cliente · {nomeMes}{trabalhos.length > 0 && <span className="tot">{trabalhos.reduce((a, [, n]) => a + n, 0)}</span>}</h3>
        {trabalhos.length === 0 ? <div className="empty" style={{ padding: "18px 0" }}><b>Ainda sem trabalhos em {nomeMes}</b>Projetos com cliente e data neste mês aparecem aqui.</div> : (
          <div>
            {trabalhos.map(([n, c]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 2px", fontSize: 13 }}>
                <span style={{ flex: 1, minWidth: 0 }}>{n}</span>
                <span style={{ width: 120, height: 4, borderRadius: 4, background: "var(--line-soft)", overflow: "hidden" }}>
                  <i style={{ display: "block", height: "100%", width: `${(c / maxTrab) * 100}%`, background: "var(--viva)" }} />
                </span>
                <span className="num" style={{ width: 16, textAlign: "right" }}>{c}</span>
              </div>
            ))}
          </div>
        )}
        <div className="faint" style={{ fontSize: 11, marginTop: 10 }}>Projetos com data em {nomeMes}. Abra a ficha de um cliente para ver o ano inteiro.</div>
      </div>
      <div className="grid two">
        {temFin ? <GraficoLucro meses={serie.map(({ rotulo, v }) => ({ rotulo, v }))} /> : <div />}
        {bloco("Tarefas em andamento", emTrabalho, "Nenhum projeto em andamento. Move um cartão para «Em andamento» em Projetos.")}
      </div>
    </div>
  );
}
