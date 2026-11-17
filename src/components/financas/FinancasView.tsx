"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SelectOpcoes } from "@/components/SelectOpcoes";
import { Gaveta } from "@/components/Gaveta";
import { useToast } from "@/components/Toast";
import { dataPt, nul, tabelaEmFalta } from "@/lib/tipos";

type Mov = {
  id: string; data: string; movimento: string; tipo: "Entrada" | "Saída"; valor: number;
  categoria: string | null; pago: boolean; recebido: string | null; cliente_id: string | null; notas: string | null;
};
type Cfg = { saldo: number; saldo_data: string | null; saldo_confirmado: boolean };
type CliMin = { id: string; nome: string };
type Form = Partial<Mov> & { valorTxt?: string };

const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });
const mesDe = (d: string) => d.slice(0, 7);
const euro = (n: number) => n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
const num = (v: unknown) => Number(v) || 0;
const lerValor = (t: string) => { const n = parseFloat(t.replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) ? n : NaN; };
const efeito = (m: Pick<Mov, "tipo" | "valor" | "pago"> | null) => (!m || !m.pago ? 0 : m.tipo === "Saída" ? -num(m.valor) : num(m.valor));
const mudaMes = (m: string, n: number) => {
  const [a, b] = m.split("-").map(Number); const d = new Date(a, b - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const rotuloMes = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

export function FinancasView() {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const [movs, setMovs] = useState<Mov[] | null>(null);
  const [clientes, setClientes] = useState<CliMin[]>([]);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [saldoForm, setSaldoForm] = useState<string | null>(null);

  const [mes, setMes] = useState(() => mesDe(hoje()));
  const [fTipo, setFTipo] = useState<"" | "Entrada" | "Saída">("");
  const [fEstado, setFEstado] = useState<"" | "pago" | "pendente">("");
  const [fCateg, setFCateg] = useState("");
  const [fCliente, setFCliente] = useState("");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    const [m, c, k] = await Promise.all([
      sb.from("financas").select("*").order("data", { ascending: false }).order("criado_em", { ascending: false }),
      sb.from("clientes").select("id,nome").order("nome"),
      sb.from("config_financas").select("saldo,saldo_data,saldo_confirmado").eq("id", 1).maybeSingle(),
    ]);
    const e = m.error ?? c.error ?? k.error;
    if (e) { setErro(tabelaEmFalta(e) ? "falta-migracao" : e.message); setMovs([]); return; }
    setErro(null);
    setMovs((m.data ?? []).map((r) => ({ ...r, valor: num(r.valor) })) as Mov[]);
    setClientes((c.data ?? []) as CliMin[]);
    setCfg(k.data ? { ...k.data, saldo: num(k.data.saldo) } : { saldo: 0, saldo_data: null, saldo_confirmado: false });
  }, [sb]);

  useEffect(() => { Promise.resolve().then(carregar); }, [carregar]);
  useEffect(() => {
    const h = (e: Event) => {
      const tipo = (e as CustomEvent<string>).detail === "Saída" ? "Saída" : "Entrada";
      setForm({ data: hoje(), tipo, pago: tipo === "Saída", valorTxt: "" });
    };
    window.addEventListener("nordan:novo", h);
    return () => window.removeEventListener("nordan:novo", h);
  }, []);

  const nomeCliente = useMemo(() => new Map(clientes.map((c) => [c.id, c.nome])), [clientes]);

  /** Aplica uma variação ao saldo, lendo o valor atual da base mesmo antes de gravar (evita sobrescrever acertos feitos noutro aparelho). */
  async function ajustarSaldo(delta: number) {
    if (!delta) return;
    const r = await sb.from("config_financas").select("saldo").eq("id", 1).maybeSingle();
    if (r.error) { toast("Não foi possível atualizar o saldo: " + r.error.message); return; }
    const novo = Math.round((num(r.data?.saldo) + delta) * 100) / 100;
    const w = await sb.from("config_financas").upsert({ id: 1, saldo: novo, saldo_data: hoje() });
    if (w.error) toast("Não foi possível atualizar o saldo: " + w.error.message);
  }

  const doMes = useMemo(() => (movs ?? []).filter((m) => mesDe(m.data) === mes), [movs, mes]);
  const totais = useMemo(() => {
    let ent = 0, sai = 0, entPend = 0, saiPend = 0;
    for (const m of doMes) {
      if (m.tipo === "Entrada") { ent += m.valor; if (!m.pago) entPend += m.valor; }
      else { sai += m.valor; if (!m.pago) saiPend += m.valor; }
    }
    return { ent, sai, res: ent - sai, entPend, saiPend };
  }, [doMes]);

  // pendentes de todos os meses
  const pendentes = useMemo(() => {
    let rec = 0, pag = 0;
    for (const m of movs ?? []) if (!m.pago) { if (m.tipo === "Entrada") rec += m.valor; else pag += m.valor; }
    return { rec, pag };
  }, [movs]);

  const somaRegistada = useMemo(() => Math.round((movs ?? []).reduce((t, m) => t + efeito(m), 0) * 100) / 100, [movs]);
  const diferenca = cfg ? Math.round((cfg.saldo - somaRegistada) * 100) / 100 : 0;

  const categorias = useMemo(() => [...new Set(doMes.map((m) => m.categoria).filter(Boolean) as string[])].sort(), [doMes]);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return doMes.filter((m) =>
      (!fTipo || m.tipo === fTipo) &&
      (!fEstado || (fEstado === "pago" ? m.pago : !m.pago)) &&
      (!fCateg || m.categoria === fCateg) &&
      (!fCliente || m.cliente_id === fCliente) &&
      (!q || `${m.movimento} ${m.categoria ?? ""} ${m.notas ?? ""} ${nomeCliente.get(m.cliente_id ?? "") ?? ""}`.toLowerCase().includes(q)));
  }, [doMes, fTipo, fEstado, fCateg, fCliente, busca, nomeCliente]);
  const somaLista = lista.reduce((t, m) => t + (m.tipo === "Saída" ? -m.valor : m.valor), 0);

  // por categoria (só saídas e entradas do mês, pagas ou não)
  const porCategoria = useMemo(() => {
    const mp = new Map<string, { ent: number; sai: number }>();
    for (const m of doMes) {
      const k = m.categoria || "Sem categoria"; const x = mp.get(k) ?? { ent: 0, sai: 0 };
      if (m.tipo === "Entrada") x.ent += m.valor; else x.sai += m.valor;
      mp.set(k, x);
    }
    return [...mp.entries()].sort((a, b) => b[1].ent + b[1].sai - (a[1].ent + a[1].sai));
  }, [doMes]);

  const abrir = (m: Mov) => setForm({ ...m, valorTxt: String(m.valor).replace(".", ",") });
  const set = <K extends keyof Mov>(k: K, v: Mov[K] | null) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    if (!form) return;
    const mov = form.movimento?.trim();
    const valor = lerValor(form.valorTxt ?? "");
    if (!mov) return toast("Descreve o movimento");
    if (!Number.isFinite(valor) || valor <= 0) return toast("O valor tem de ser um número maior que zero");
    if (!form.data) return toast("Indica a data");
    const pago = !!form.pago;
    const dados = {
      data: form.data, movimento: mov, tipo: form.tipo ?? "Entrada", valor, categoria: nul(form.categoria), pago,
      recebido: pago ? (form.recebido || hoje()) : null, cliente_id: nul(form.cliente_id), notas: nul(form.notas),
    };
    setAGuardar(true);
    const antes = form.id ? (movs ?? []).find((m) => m.id === form.id) ?? null : null;
    const r = form.id ? await sb.from("financas").update(dados).eq("id", form.id) : await sb.from("financas").insert(dados);
    setAGuardar(false);
    if (r.error) return toast("Erro: " + r.error.message);
    await ajustarSaldo(efeito({ tipo: dados.tipo, valor, pago }) - efeito(antes));
    setForm(null);
    toast("Guardado");
    carregar();
  }

  async function apagar() {
    if (!form?.id) return;
    const m = (movs ?? []).find((x) => x.id === form.id);
    if (!confirm("Apagar este movimento?" + (m?.pago ? " O saldo será corrigido." : ""))) return;
    const r = await sb.from("financas").delete().eq("id", form.id);
    if (r.error) return toast("Erro: " + r.error.message);
    await ajustarSaldo(-efeito(m ?? null));
    setForm(null);
    toast("Apagado");
    carregar();
  }

  async function alternarPago(m: Mov) {
    const pago = !m.pago;
    const r = await sb.from("financas").update({ pago, recebido: pago ? hoje() : null }).eq("id", m.id);
    if (r.error) return toast("Erro: " + r.error.message);
    await ajustarSaldo(efeito({ ...m, pago }) - efeito(m));
    carregar();
  }

  async function guardarSaldo() {
    const v = lerValor(saldoForm ?? "");
    if (!Number.isFinite(v)) return toast("Indica um valor válido");
    const r = await sb.from("config_financas").upsert({ id: 1, saldo: v, saldo_data: hoje(), saldo_confirmado: true });
    if (r.error) return toast("Erro: " + r.error.message);
    setSaldoForm(null);
    toast("Saldo acertado");
    carregar();
  }

  if (erro === "falta-migracao") return (
    <div className="card"><div className="empty"><b>Falta correr a migração 0009</b>As tabelas de finanças ainda não existem na base de dados.</div></div>
  );
  if (erro) return <div className="card"><div className="empty"><b>Erro</b>{erro}</div></div>;
  if (!movs || !cfg) return <div className="card"><div className="empty">A carregar…</div></div>;

  const filtrado = fTipo || fEstado || fCateg || fCliente || busca;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid kpis">
        <button type="button" className="kpi hi clic" style={{ textAlign: "left" }} onClick={() => setSaldoForm(String(cfg.saldo).replace(".", ","))}>
          <div className="n">Conta bancária</div>
          <div className="v num">{euro(cfg.saldo)}</div>
          <div className="n">{cfg.saldo_data ? `atualizado ${dataPt(cfg.saldo_data)} · ` : ""}clica para acertar</div>
        </button>
        <div className="kpi"><div className="n">Entradas · {rotuloMes(mes)}</div><div className="v num">{euro(totais.ent)}</div>
          <div className="n">{totais.entPend > 0 ? `${euro(totais.entPend)} por receber` : "tudo recebido"}</div></div>
        <div className="kpi"><div className="n">Saídas · {rotuloMes(mes)}</div><div className="v num">{euro(totais.sai)}</div>
          <div className="n">{totais.saiPend > 0 ? `${euro(totais.saiPend)} por pagar` : "tudo pago"}</div></div>
        <div className="kpi"><div className="n">Resultado do mês</div>
          <div className="v num" style={{ color: totais.res >= 0 ? "var(--lime)" : "var(--coral)" }}>{euro(totais.res)}</div>
          <div className="n">entradas − saídas</div></div>
        <div className="kpi"><div className="n">A receber (total)</div><div className="v num">{euro(pendentes.rec)}</div>
          <div className="n">{pendentes.pag > 0 ? `a pagar ${euro(pendentes.pag)}` : "nada por pagar"}</div></div>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <button className="btn sm" type="button" onClick={() => setMes(mudaMes(mes, -1))} aria-label="Mês anterior">‹</button>
          <b style={{ textTransform: "capitalize", minWidth: 130, textAlign: "center" }}>{rotuloMes(mes)}</b>
          <button className="btn sm" type="button" onClick={() => setMes(mudaMes(mes, 1))} aria-label="Mês seguinte">›</button>
          {mes !== mesDe(hoje()) && <button className="btn sm" type="button" onClick={() => setMes(mesDe(hoje()))}>Este mês</button>}
          <span style={{ flex: 1 }} />
          <button className="btn" type="button" onClick={() => setForm({ data: hoje(), tipo: "Entrada", pago: false, valorTxt: "" })}>+ Entrada</button>
          <button className="btn" type="button" onClick={() => setForm({ data: hoje(), tipo: "Saída", pago: true, valorTxt: "" })}>+ Saída</button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <div className="seg">
            {([["", "Todos"], ["Entrada", "Entradas"], ["Saída", "Saídas"]] as const).map(([v, t]) => (
              <button key={v} type="button" className={"sb" + (fTipo === v ? " on" : "")} onClick={() => setFTipo(v)}>{t}</button>
            ))}
          </div>
          <div className="seg">
            {([["", "Qualquer estado"], ["pago", "Pago / recebido"], ["pendente", "Pendente"]] as const).map(([v, t]) => (
              <button key={v} type="button" className={"sb" + (fEstado === v ? " on" : "")} onClick={() => setFEstado(v)}>{t}</button>
            ))}
          </div>
          <select className="in" style={{ width: "auto" }} value={fCateg} onChange={(e) => setFCateg(e.target.value)} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="in" style={{ width: "auto" }} value={fCliente} onChange={(e) => setFCliente(e.target.value)} aria-label="Cliente">
            <option value="">Todos os clientes</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <input className="in" style={{ width: 180 }} placeholder="Pesquisar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          {filtrado && <button className="btn sm" type="button" onClick={() => { setFTipo(""); setFEstado(""); setFCateg(""); setFCliente(""); setBusca(""); }}>Limpar</button>}
        </div>

        {lista.length === 0 ? (
          <div className="empty" style={{ padding: "22px 0" }}>
            {doMes.length === 0 ? "Sem movimentos neste mês." : "Nenhum movimento com estes filtros."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Data</th><th>Movimento</th><th>Categoria</th><th>Cliente</th><th>Estado</th><th className="num" style={{ textAlign: "right" }}>Valor</th></tr></thead>
              <tbody>
                {lista.map((m) => (
                  <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => abrir(m)}>
                    <td style={{ whiteSpace: "nowrap" }}>{dataPt(m.data)}</td>
                    <td>{m.movimento}</td>
                    <td className="faint">{m.categoria ?? "—"}</td>
                    <td className="faint">{nomeCliente.get(m.cliente_id ?? "") ?? "—"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button type="button" className={"pill " + (m.pago ? "lime" : "amber")} style={{ cursor: "pointer" }}
                        title={m.pago ? "Marcar como pendente" : m.tipo === "Entrada" ? "Marcar como recebido" : "Marcar como pago"}
                        onClick={() => alternarPago(m)}>
                        {m.pago ? (m.tipo === "Entrada" ? "Recebido" : "Pago") : "Pendente"}
                      </button>
                    </td>
                    <td className="num" style={{ fontWeight: 700, color: m.tipo === "Entrada" ? "var(--lime)" : "var(--coral)" }}>
                      {m.tipo === "Saída" ? "−" : "+"}{euro(m.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={5} className="faint">{lista.length} movimento{lista.length === 1 ? "" : "s"}{filtrado ? " (filtrado)" : ""}</td>
                <td className="num" style={{ fontWeight: 700 }}>{euro(somaLista)}</td></tr></tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Por categoria · {rotuloMes(mes)}</h3>
          {porCategoria.length === 0 ? <div className="empty" style={{ padding: "18px 0" }}>Sem movimentos.</div> : (
            <div className="lista">
              {porCategoria.map(([c, v]) => (
                <div className="li" key={c}>
                  <span className="nm">{c}</span>
                  {v.ent > 0 && <span className="num" style={{ color: "var(--lime)", fontWeight: 700 }}>+{euro(v.ent)}</span>}
                  {v.sai > 0 && <span className="num" style={{ color: "var(--coral)", fontWeight: 700 }}>−{euro(v.sai)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3>Conferência da conta
            <span className="tot" style={{ color: Math.abs(diferenca) < 1 ? "var(--lime)" : "var(--amber)" }}>{Math.abs(diferenca) < 1 ? "bate certo" : "diferença"}</span>
          </h3>
          <div className="lista">
            <div className="li"><span className="nm">O que diz a conta</span><b className="num">{euro(cfg.saldo)}</b></div>
            <div className="li"><span className="nm">Soma dos movimentos pagos / recebidos</span><b className="num">{euro(somaRegistada)}</b></div>
            <div className="li"><span className="nm">Diferença</span><b className="num" style={{ color: Math.abs(diferenca) < 1 ? "var(--lime)" : "var(--amber)" }}>{euro(diferenca)}</b></div>
          </div>
          <div className="sub faint" style={{ marginTop: 8 }}>
            O saldo ajusta-se sozinho ao marcar um movimento como pago ou recebido. Se a diferença não for zero, acerta o saldo com o valor real do banco.
          </div>
        </div>
      </div>

      <Gaveta
        aberta={form !== null}
        titulo={form?.id ? "Movimento" : form?.tipo === "Saída" ? "Nova saída" : "Nova entrada"}
        onFechar={() => setForm(null)}
        centro
        rodape={form && (
          <>
            {form.id && <button className="btn dgr" type="button" onClick={apagar}>Apagar</button>}
            <span style={{ flex: 1 }} />
            <button className="btn" type="button" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn pri" type="button" disabled={aGuardar} onClick={guardar}>{aGuardar ? "A guardar…" : "Guardar"}</button>
          </>
        )}
      >
        {form && (
          <>
            <div className="fld"><label>Tipo</label>
              <div className="seg">
                {(["Entrada", "Saída"] as const).map((t) => (
                  <button key={t} type="button" className={"sb" + (form.tipo === t ? " on" : "")}
                    onClick={() => setForm((f) => ({ ...f, tipo: t, categoria: null }))}>{t}</button>
                ))}
              </div>
            </div>
            <div className="fld"><label>Movimento</label>
              <input className="in" value={form.movimento ?? ""} onChange={(e) => set("movimento", e.target.value)} placeholder="Ex.: Avença de novembro" autoFocus />
            </div>
            <div className="row2">
              <div className="fld"><label>Valor (€)</label>
                <input className="in" inputMode="decimal" value={form.valorTxt ?? ""} onChange={(e) => setForm((f) => ({ ...f, valorTxt: e.target.value }))} placeholder="0,00" />
              </div>
              <div className="fld"><label>Data</label>
                <input className="in" type="date" value={form.data ?? ""} onChange={(e) => set("data", e.target.value)} />
              </div>
            </div>
            <div className="row2">
              <div className="fld"><label>Categoria</label>
                <SelectOpcoes key={form.tipo} lista={form.tipo === "Saída" ? "fin_categoria_saida" : "fin_categoria_entrada"}
                  valor={form.categoria ?? ""} onChange={(v) => set("categoria", v)} />
              </div>
              <div className="fld"><label>Cliente</label>
                <select className="in" value={form.cliente_id ?? ""} onChange={(e) => set("cliente_id", e.target.value || null)}>
                  <option value="">—</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="row2">
              <div className="fld"><label>Estado</label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, textTransform: "none", letterSpacing: 0, color: "var(--mist)" }}>
                  <input type="checkbox" checked={!!form.pago} onChange={(e) => setForm((f) => ({ ...f, pago: e.target.checked, recebido: e.target.checked ? (f?.recebido || hoje()) : null }))} />
                  {form.tipo === "Saída" ? "Já foi pago" : "Já foi recebido"}
                </label>
              </div>
              {form.pago && (
                <div className="fld"><label>{form.tipo === "Saída" ? "Data de pagamento" : "Data de receção"}</label>
                  <input className="in" type="date" value={form.recebido ?? ""} onChange={(e) => set("recebido", e.target.value)} />
                </div>
              )}
            </div>
            <div className="fld"><label>Notas</label>
              <textarea className="in" value={form.notas ?? ""} onChange={(e) => set("notas", e.target.value)} />
            </div>
          </>
        )}
      </Gaveta>

      <Gaveta
        aberta={saldoForm !== null} titulo="Acertar saldo da conta" onFechar={() => setSaldoForm(null)} centro
        rodape={<><span style={{ flex: 1 }} /><button className="btn" type="button" onClick={() => setSaldoForm(null)}>Cancelar</button>
          <button className="btn pri" type="button" onClick={guardarSaldo}>Guardar</button></>}
      >
        <div className="fld"><label>Saldo atual no banco (€)</label>
          <input className="in" inputMode="decimal" autoFocus value={saldoForm ?? ""} onChange={(e) => setSaldoForm(e.target.value)} />
        </div>
        <div className="sub faint">Escreve o valor que vês na conta bancária hoje. A partir daqui, o painel ajusta-o sozinho a cada movimento pago ou recebido.</div>
      </Gaveta>
    </div>
  );
}
