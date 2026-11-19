"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Gaveta } from "@/components/Gaveta";
import { EditorSessao } from "@/components/sessoes/EditorSessao";
import { SessoesPainel } from "@/components/sessoes/SessoesPainel";
import { linkSeguro, tabelaEmFalta } from "@/lib/tipos";
import { horaPt, type Sessao } from "@/lib/sessoes";
import {
  DIAS_SEMANA, TIPOS_ITEM, celulasMes, dataLisboa, hojeLisboa, ordenar, rotuloDia, rotuloMesAno, somaDias,
  type Item, type TipoItem,
} from "@/lib/calendario";

type Opt = { id: string; nome: string };
type Proj = Opt & { cliente_id: string | null; prazo: string | null; estado: string };
type Tar = { id: string; titulo: string; prazo: string; projeto_id: string };
type LeadC = { id: string; nome: string; proximo_contacto: string | null; proximo_acao: string | null; reuniao: string | null };
type Mov = { id: string; data: string; movimento: string; tipo: "Entrada" | "Saída"; valor: number };
type EvG = { id: string; titulo: string; inicio: string; fim: string | null; diaInteiro: boolean; local: string | null; link: string | null };
type Vista = "mes" | "agenda" | "sessoes";

const euro = (n: number) => Number(n).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

export function CalendarioView() {
  const [sb] = useState(() => createClient());
  const router = useRouter();
  const [hoje] = useState(hojeLisboa);
  const [vista, setVista] = useState<Vista>("mes");
  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)));
  const [mes0, setMes0] = useState(() => Number(hoje.slice(5, 7)) - 1);
  const [sel, setSel] = useState<string>(hoje);
  const [ligados, setLigados] = useState<Set<TipoItem>>(() => new Set(TIPOS_ITEM.filter((t) => t.porDefeito).map((t) => t.k)));

  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [projetos, setProjetos] = useState<Proj[]>([]);
  const [tarefas, setTarefas] = useState<Tar[]>([]);
  const [leads, setLeads] = useState<LeadC[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [clientes, setClientes] = useState<Opt[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [edicao, setEdicao] = useState<Partial<Sessao> | null>(null);
  const [eventosG, setEventosG] = useState<EvG[]>([]);
  const [erroG, setErroG] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [s, p, t, l, f, c] = await Promise.all([
      sb.from("sessoes").select("*").eq("estado", "marcada").order("inicio"),
      sb.from("projetos").select("id,nome,cliente_id,prazo,estado"),
      sb.from("tarefas").select("id,titulo,prazo,projeto_id").eq("concluida", false).not("prazo", "is", null),
      sb.from("leads").select("id,nome,proximo_contacto,proximo_acao,reuniao").or("proximo_contacto.not.is.null,reuniao.not.is.null").limit(5000),
      sb.from("financas").select("id,data,movimento,tipo,valor").eq("pago", false).limit(5000),
      sb.from("clientes").select("id,nome").order("nome"),
    ]);
    const av: string[] = [];
    const nota = (nome: string, e: { code?: string; message?: string } | null) => {
      if (e) av.push(tabelaEmFalta(e) ? (nome === "sessões" ? "Sessões: falta correr a migração 0014_sessoes.sql." : `Falta uma tabela (${nome}).`) : `Erro a ler ${nome}: ${e.message}`);
    };
    nota("sessões", s.error); nota("projetos", p.error); nota("tarefas", t.error); nota("leads", l.error); nota("finanças", f.error); nota("clientes", c.error);
    setSessoes(s.error ? [] : (s.data as Sessao[]));
    setProjetos(p.error ? [] : (p.data as Proj[]));
    setTarefas(t.error ? [] : (t.data as Tar[]));
    setLeads(l.error ? [] : (l.data as LeadC[]));
    setMovs(f.error ? [] : (f.data as Mov[]));
    setClientes(c.error ? [] : (c.data as Opt[]));
    setAvisos(av);
    setCarregado(true);
  }, [sb]);
  useEffect(() => { Promise.resolve().then(carregar); }, [carregar]);

  // "+ Novo" (barra de cima) cria uma sessão, exceto no separador Sessões, que trata disso sozinho
  useEffect(() => {
    if (vista === "sessoes") return;
    const h = () => setEdicao({});
    window.addEventListener("nordan:novo", h);
    return () => window.removeEventListener("nordan:novo", h);
  }, [vista]);

  // Google Calendar (só leitura): vai buscar o intervalo que o ecrã mostra (grelha do mês ou próximos 30 dias)
  const celulas = useMemo(() => celulasMes(ano, mes0), [ano, mes0]);
  const deG = vista === "mes" ? celulas[0] : hoje;
  const ateG = vista === "mes" ? celulas[celulas.length - 1] : somaDias(hoje, 30);
  const querG = vista !== "sessoes" && ligados.has("google");
  useEffect(() => {
    if (!querG) return;
    let vivo = true;
    fetch(`/api/google/eventos?de=${deG}&ate=${ateG}`)
      .then((r) => r.json().catch(() => null))
      .then((j: { ok: boolean; erro?: string; eventos?: EvG[] } | null) => {
        if (!vivo) return;
        if (j?.ok) { setEventosG(j.eventos ?? []); setErroG(null); } else { setEventosG([]); setErroG(j?.erro ?? "Resposta inesperada do servidor."); }
      })
      .catch(() => { if (vivo) { setEventosG([]); setErroG("Sem ligação ao servidor."); } });
    return () => { vivo = false; };
  }, [querG, deG, ateG]);

  const itens = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const nomeCliente = (id: string) => clientes.find((c) => c.id === id)?.nome ?? null;
    const nomeProj = (id: string) => projetos.find((p) => p.id === id)?.nome ?? null;
    const abertos = new Set(projetos.filter((p) => p.estado !== "Concluído").map((p) => p.id));
    for (const s of sessoes) {
      out.push({ key: "s" + s.id, tipo: "sessao", data: dataLisboa(s.inicio), hora: horaPt(s.inicio), titulo: s.titulo,
        sub: [s.tipo, nomeCliente(s.cliente_id)].filter(Boolean).join(" · ") || null, atrasado: false, destino: null, sessaoId: s.id });
    }
    for (const p of projetos) {
      if (!p.prazo || p.estado === "Concluído") continue;
      out.push({ key: "p" + p.id, tipo: "projeto", data: p.prazo, hora: null, titulo: p.nome,
        sub: ["Prazo do projeto", p.cliente_id ? nomeCliente(p.cliente_id) : null].filter(Boolean).join(" · "), atrasado: p.prazo < hoje, destino: `/projetos?projeto=${p.id}` });
    }
    for (const t of tarefas) {
      if (!abertos.has(t.projeto_id)) continue; // tarefas de projetos concluídos ou sem projeto visível não contam como pendentes
      out.push({ key: "t" + t.id, tipo: "tarefa", data: t.prazo, hora: null, titulo: t.titulo,
        sub: ["Prazo da tarefa", nomeProj(t.projeto_id)].filter(Boolean).join(" · "), atrasado: t.prazo < hoje, destino: `/projetos?projeto=${t.projeto_id}` });
    }
    for (const l of leads) {
      if (l.proximo_contacto) out.push({ key: "lc" + l.id, tipo: "contacto", data: l.proximo_contacto, hora: null, titulo: l.nome,
        sub: l.proximo_acao || "Próximo contacto", atrasado: l.proximo_contacto < hoje, destino: `/leads?lead=${l.id}` });
      if (l.reuniao) out.push({ key: "lr" + l.id, tipo: "reuniao", data: l.reuniao, hora: null, titulo: l.nome,
        sub: "Reunião", atrasado: false, destino: `/leads?lead=${l.id}` });
    }
    for (const m of movs) {
      out.push({ key: "f" + m.id, tipo: "financas", data: m.data, hora: null, titulo: m.movimento,
        sub: `${m.tipo === "Entrada" ? "A receber" : "A pagar"} · ${euro(m.valor)}`, atrasado: m.data < hoje, destino: "/financas" });
    }
    // eventos do Google; os que nasceram das sessões do painel já aparecem como sessões
    const dasSessoes = new Set(sessoes.map((s) => s.google_event_id).filter(Boolean));
    for (const e of eventosG) {
      if (dasSessoes.has(e.id)) continue;
      const ext = linkSeguro(e.link);
      const sub = e.local || "Google Calendar";
      if (e.diaInteiro) {
        // fim exclusivo; limita a 31 dias para não encher o calendário
        const fim = e.fim && e.fim > e.inicio ? e.fim : somaDias(e.inicio, 1);
        for (let d = e.inicio, n = 0; d < fim && n < 31; d = somaDias(d, 1), n++)
          out.push({ key: `g${e.id}${d}`, tipo: "google", data: d, hora: null, titulo: e.titulo, sub, atrasado: false, destino: null, externo: ext });
      } else {
        out.push({ key: "g" + e.id, tipo: "google", data: dataLisboa(e.inicio), hora: horaPt(e.inicio), titulo: e.titulo, sub, atrasado: false, destino: null, externo: ext });
      }
    }
    return out;
  }, [sessoes, projetos, tarefas, leads, movs, clientes, hoje, eventosG]);

  const contagem = useMemo(() => {
    const c = {} as Record<TipoItem, number>;
    TIPOS_ITEM.forEach((t) => (c[t.k] = 0));
    itens.forEach((i) => c[i.tipo]++);
    return c;
  }, [itens]);

  const visiveis = useMemo(() => itens.filter((i) => ligados.has(i.tipo)).sort(ordenar), [itens, ligados]);
  const porDia = useMemo(() => {
    const m: Record<string, Item[]> = {};
    visiveis.forEach((i) => (m[i.data] ??= []).push(i));
    return m;
  }, [visiveis]);

  const mesStr = `${ano}-${String(mes0 + 1).padStart(2, "0")}`;
  const noMes = celulas.filter((d) => d.startsWith(mesStr)).reduce((n, d) => n + (porDia[d]?.length ?? 0), 0);

  const mover = (n: number) => {
    const d = new Date(Date.UTC(ano, mes0 + n, 1, 12));
    setAno(d.getUTCFullYear()); setMes0(d.getUTCMonth());
  };
  const irHoje = () => { setAno(Number(hoje.slice(0, 4))); setMes0(Number(hoje.slice(5, 7)) - 1); setSel(hoje); };
  const alternar = (k: TipoItem) => setLigados((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  function abrir(i: Item) {
    if (i.tipo === "google") { if (i.externo) window.open(i.externo, "_blank", "noopener,noreferrer"); }
    else if (i.tipo === "sessao") setEdicao(sessoes.find((s) => s.id === i.sessaoId) ?? null);
    else if (i.destino) router.push(i.destino);
  }

  const linha = (i: Item, comData = false) => (
    <button key={i.key} type="button" className={"cal-item t-" + i.tipo} onClick={() => abrir(i)}>
      <span className="pt" />
      {i.hora && <span className="hr">{i.hora}</span>}
      <span className="tx">
        <b style={{ fontWeight: 500 }}>{i.titulo}</b>
        <span className="sub">{i.sub}{comData ? ` · ${rotuloDia(i.data)}` : ""}</span>
      </span>
      {i.atrasado && <span className="pill coral">Em atraso</span>}
    </button>
  );

  // agenda: atrasados (pendentes) + próximos 30 dias
  const fimAgenda = somaDias(hoje, 30);
  const atrasados = visiveis.filter((i) => i.atrasado);
  const diasAgenda = Object.keys(porDia).filter((d) => d >= hoje && d <= fimAgenda).sort();

  const diaSel = porDia[sel] ?? [];

  return (
    <>
      <div className="cal-barra">
        <div className="seg" role="tablist">
          {([["mes", "Mês"], ["agenda", "Agenda"], ["sessoes", "Sessões"]] as [Vista, string][]).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={vista === k} className={"sb" + (vista === k ? " on" : "")} onClick={() => setVista(k)}>{l}</button>
          ))}
        </div>
        {vista === "mes" && (<>
          <div className="seg">
            <button className="sb" type="button" onClick={() => mover(-1)} aria-label="Mês anterior">‹</button>
            <button className="sb" type="button" onClick={irHoje}>Hoje</button>
            <button className="sb" type="button" onClick={() => mover(1)} aria-label="Mês seguinte">›</button>
          </div>
          <h2 className="tit">{rotuloMesAno(ano, mes0)}</h2>
        </>)}
      </div>

      {vista === "sessoes" ? <SessoesPainel escutarNovo /> : (<>
        <div className="seg cal-filtros" aria-label="Filtros">
          {TIPOS_ITEM.map((t) => (
            <button key={t.k} type="button" className={"sb t-" + t.k + (ligados.has(t.k) ? " on" : "")} aria-pressed={ligados.has(t.k)} onClick={() => alternar(t.k)}>
              <i className="cdot" />{t.rotulo} <span className="ct">{contagem[t.k]}</span>
            </button>
          ))}
        </div>
        {avisos.map((a) => <p key={a} className="erro-box">{a}</p>)}
        {querG && erroG && <p className="erro-box">Google Calendar: {erroG}</p>}
        {!carregado ? <div className="dica">A carregar…</div> : vista === "mes" ? (
          <div className="cal-corpo">
            <div className="card">
              <div className="cal-grid">
                {DIAS_SEMANA.map((d) => <div key={d} className="cal-sem">{d}</div>)}
                {celulas.map((d) => {
                  const lista = porDia[d] ?? [];
                  const dentro = d.startsWith(mesStr);
                  return (
                    <button key={d} type="button" onClick={() => setSel(d)}
                      className={"cal-dia" + (dentro ? "" : " fora") + (d === hoje ? " hoje" : "") + (d === sel ? " sel" : "")}
                      aria-label={`${rotuloDia(d)}: ${lista.length} ${lista.length === 1 ? "item" : "itens"}`}>
                      <span className="n">{Number(d.slice(8))}</span>
                      {lista.slice(0, 3).map((i) => (
                        <span key={i.key} className={"cal-chip t-" + i.tipo + (i.atrasado ? " atr" : "")}>{i.hora ? i.hora + " " : ""}{i.titulo}</span>
                      ))}
                      {lista.length > 3 && <span className="cal-mais">+{lista.length - 3} mais</span>}
                      {lista.length > 0 && <span className="pts">{lista.slice(0, 6).map((i) => <i key={i.key} className={"t-" + i.tipo} />)}</span>}
                    </button>
                  );
                })}
              </div>
              {noMes === 0 && <div className="dica" style={{ marginTop: 10 }}>Nada com data em {rotuloMesAno(ano, mes0)}{ligados.size < TIPOS_ITEM.length ? " (com os filtros ligados)" : ""}.</div>}
            </div>
            <div className="card">
              <h3>{rotuloDia(sel)}</h3>
              {diaSel.length === 0 ? <div className="dica">Nada neste dia.</div> : <div>{diaSel.map((i) => linha(i))}</div>}
            </div>
          </div>
        ) : (
          <div className="card">
            {atrasados.length === 0 && diasAgenda.length === 0 && <div className="empty"><b>Nada nos próximos 30 dias</b>Sem itens com data até {rotuloDia(fimAgenda)}.</div>}
            {atrasados.length > 0 && (<>
              <div className="cal-dia-cab" style={{ color: "var(--coral)" }}>Em atraso</div>
              {atrasados.map((i) => linha(i, true))}
            </>)}
            {diasAgenda.map((d) => (
              <div key={d}>
                <div className={"cal-dia-cab" + (d === hoje ? " hoje" : "")}>{d === hoje ? "Hoje · " : ""}{rotuloDia(d)}</div>
                {porDia[d].filter((i) => !(i.atrasado)).map((i) => linha(i))}
              </div>
            ))}
          </div>
        )}
      </>)}

      <Gaveta centro aberta={!!edicao} titulo={edicao?.id ? "Sessão" : "Nova sessão"} onFechar={() => setEdicao(null)}>
        {edicao && (
          <div style={{ gridColumn: "1/-1" }}>
            <EditorSessao
              key={edicao.id ?? "nova"} inicial={edicao} clientes={clientes} projetos={projetos}
              onFechar={() => setEdicao(null)} onGuardado={() => { setEdicao(null); carregar(); }}
            />
          </div>
        )}
      </Gaveta>
    </>
  );
}
