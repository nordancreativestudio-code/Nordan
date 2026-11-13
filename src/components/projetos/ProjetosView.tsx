"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Gaveta } from "@/components/Gaveta";
import { useToast } from "@/components/Toast";
import { pc, useEquipa } from "@/components/Equipa";
import { ProjetoPortal } from "@/components/portal/ProjetoPortal";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ESTADOS, MARCAS, PRIORIDADES, RESPONSAVEIS, TIPOS, dataCurta, nul, tabelaEmFalta,
  deInputLocal, fmtTempo, paraInputLocal,
  type Estado, type Projeto, type Registo, type Tarefa, type TempoTarefa,
} from "@/lib/tipos";

type CliMin = { id: string; nome: string };
type Form = Partial<Projeto>;
const COR: Record<Estado, string> = {
  "Para fazer": "var(--faint)", "Em andamento": "var(--sky)", Standby: "var(--moss)",
  "Em aprovação": "var(--amber)", Concluído: "var(--lime)",
};
const CAMPOS = ["cliente_id", "marca", "tipo", "inicio", "prazo", "prazo_estimado", "link_entrega", "notas"] as const;
const hoje = () => new Date().toISOString().slice(0, 10);

export function ProjetosView() {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const { corDeNome, corDeId } = useEquipa();
  const router = useRouter();
  const pedido = useSearchParams().get("projeto");
  const [projetos, setProjetos] = useState<Projeto[] | null>(null);
  const [clientes, setClientes] = useState<CliMin[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [resp, setResp] = useState<string>("Todos");
  const [arrasta, setArrasta] = useState<string | null>(null);
  const [sobre, setSobre] = useState<Estado | null>(null);
  const [novaTarefa, setNovaTarefa] = useState("");
  const [registos, setRegistos] = useState<Registo[]>([]);
  const [semTempo, setSemTempo] = useState(false);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [tempos, setTempos] = useState<Record<string, TempoTarefa>>({});
  const [lidoEm, setLidoEm] = useState(() => Date.now());
  const [aberta, setAberta] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [p, c, t, rg, eu, tt] = await Promise.all([
      sb.from("projetos").select("*").order("ordem").order("criado_em"),
      sb.from("clientes").select("id,nome").order("nome"),
      sb.from("tarefas").select("*").order("ordem").order("criado_em"),
      sb.from("registos_tempo").select("id,tarefa_id,utilizador_id,inicio,fim").order("inicio"),
      sb.auth.getUser(),
      sb.from("tempos_tarefa").select("tarefa_id,projeto_id,segundos,abertos"),
    ]);
    const e = p.error ?? c.error ?? t.error;
    if (e) {
      setErro(tabelaEmFalta(e) ? "falta-migracao" : e.message);
      setProjetos([]);
      return;
    }
    setErro(null);
    setProjetos(p.data as Projeto[]);
    setClientes(c.data as CliMin[]);
    setTarefas(t.data as Tarefa[]);
    // sem a migração 0003 o resto do kanban continua a funcionar, só sem cronómetro
    // (sem a 0005 também: os totais vêm da view tempos_tarefa)
    setSemTempo(!!rg.error || !!tt.error);
    setRegistos(rg.error ? [] : (rg.data as Registo[]));
    setTempos(tt.error ? {} : Object.fromEntries((tt.data as TempoTarefa[]).map((x) => [x.tarefa_id, x])));
    setLidoEm(Date.now());
    setMeuId(eu.data.user?.id ?? null);
  }, [sb]);

  useEffect(() => { Promise.resolve().then(carregar); }, [carregar]);
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    window.addEventListener("nordan:cronometro", carregar);
    return () => { clearInterval(t); window.removeEventListener("nordan:cronometro", carregar); };
  }, [carregar]);
  useEffect(() => {
    const h = () => setForm({ estado: "Para fazer", prioridade: "Média", responsavel: "André", visivel_ao_cliente: false });
    window.addEventListener("nordan:novo", h);
    return () => window.removeEventListener("nordan:novo", h);
  }, []);

  // ?projeto=<id> (vindo das pills do topo): abre a gaveta desse projeto
  useEffect(() => {
    if (!pedido || !projetos) return;
    const p = projetos.find((x) => x.id === pedido);
    Promise.resolve().then(() => { if (p) setForm(p); router.replace("/projetos"); });
  }, [pedido, projetos, router]);

  const nomeCli = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c.nome])), [clientes]);
  const visiveis = useMemo(
    () => (projetos ?? []).filter((p) => resp === "Todos" || p.responsavel === resp || p.responsavel === "Ambos"),
    [projetos, resp],
  );
  const doProjeto = (id?: string) => tarefas.filter((t) => t.projeto_id === id);

  async function mover(id: string, estado: Estado, antesDe: string | null) {
    if (!projetos) return;
    const col = projetos.filter((p) => p.estado === estado && p.id !== id).sort((a, b) => a.ordem - b.ordem);
    const i = antesDe ? col.findIndex((p) => p.id === antesDe) : col.length;
    const idx = i < 0 ? col.length : i;
    const prev = col[idx - 1]?.ordem, next = col[idx]?.ordem;
    const ordem = prev == null && next == null ? 1 : prev == null ? next! - 1 : next == null ? prev + 1 : (prev + next) / 2;
    setProjetos(projetos.map((p) => (p.id === id ? { ...p, estado, ordem } : p)));
    const r = await sb.from("projetos").update({ estado, ordem }).eq("id", id);
    if (r.error) { toast("Erro ao mover: " + r.error.message); carregar(); }
  }

  async function guardar() {
    if (!form?.nome?.trim()) return toast("O nome é obrigatório");
    setAGuardar(true);
    const dados: Record<string, unknown> = Object.fromEntries(CAMPOS.map((k) => [k, nul(form[k])]));
    Object.assign(dados, {
      nome: form.nome.trim(), estado: form.estado ?? "Para fazer", prioridade: form.prioridade ?? "Média",
      responsavel: form.responsavel ?? "André", visivel_ao_cliente: !!form.visivel_ao_cliente,
    });
    let r;
    if (form.id) r = await sb.from("projetos").update(dados).eq("id", form.id);
    else {
      const naCol = (projetos ?? []).filter((p) => p.estado === dados.estado);
      dados.ordem = naCol.length ? Math.max(...naCol.map((p) => p.ordem)) + 1 : 1;
      r = await sb.from("projetos").insert(dados);
    }
    setAGuardar(false);
    if (r.error) return toast("Erro: " + r.error.message);
    toast(form.id ? "Projeto guardado" : "Projeto criado");
    setForm(null);
    carregar();
  }

  async function apagar() {
    if (!form?.id) return;
    if (!confirm(`Apagar o projeto "${form.nome}" e as suas tarefas?`)) return;
    const r = await sb.from("projetos").delete().eq("id", form.id);
    if (r.error) return toast("Erro: " + r.error.message);
    toast("Projeto apagado");
    setForm(null);
    carregar();
  }

  // total vindo da base de dados + o que passou desde a leitura, por cada cronómetro a correr
  const segundos = (id: string) => {
    const t = tempos[id];
    return t ? t.segundos + (t.abertos * Math.max(0, agora - lidoEm)) / 1000 : 0;
  };
  const corQuemCorre = (id: string) => corDeId(registos.find((r) => r.tarefa_id === id && !r.fim)?.utilizador_id);
  const aCorrer = (id: string) => (tempos[id]?.abertos ?? 0) > 0;
  const aMinha = (id: string) => registos.some((r) => r.tarefa_id === id && !r.fim && r.utilizador_id === meuId);
  const avisa = () => window.dispatchEvent(new Event("nordan:cronometro")); // recarrega aqui e no topo
  async function alternaCronometro(id: string) {
    const r = aMinha(id) ? await sb.rpc("parar_cronometro") : await sb.rpc("iniciar_cronometro", { p_tarefa: id });
    if (r.error) return toast("Erro: " + r.error.message);
    avisa();
  }
  async function mudaRegisto(id: string, campos: Partial<Registo>) {
    const r = await sb.from("registos_tempo").update(campos).eq("id", id);
    if (r.error) toast(/check/i.test(r.error.message) ? "O fim não pode ser antes do início" : "Erro: " + r.error.message);
    avisa();
  }
  async function apagaRegisto(id: string) {
    if (!confirm("Apagar este registo de tempo?")) return;
    const r = await sb.from("registos_tempo").delete().eq("id", id);
    if (r.error) return toast("Erro: " + r.error.message);
    avisa();
  }
  async function moveTarefa(id: string, dir: -1 | 1) {
    const ts = doProjeto(form?.id);
    const i = ts.findIndex((t) => t.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= ts.length) return;
    const nova = [...ts];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    const mud = nova.map((t, k) => ({ id: t.id, ordem: k + 1 })).filter((m, k) => nova[k].ordem !== m.ordem);
    const ord = Object.fromEntries(nova.map((t, k) => [t.id, k + 1]));
    setTarefas((all) => all.map((t) => (ord[t.id] ? { ...t, ordem: ord[t.id] } : t)).sort((a, b) => a.ordem - b.ordem));
    const rs = await Promise.all(mud.map((m) => sb.from("tarefas").update({ ordem: m.ordem }).eq("id", m.id)));
    const e = rs.find((r) => r.error)?.error;
    if (e) { toast("Erro: " + e.message); carregar(); }
  }

  async function addTarefa() {
    const titulo = novaTarefa.trim();
    if (!titulo || !form?.id) return;
    const ts = doProjeto(form.id);
    const ordem = ts.length ? Math.max(...ts.map((t) => t.ordem)) + 1 : 1;
    const r = await sb.from("tarefas").insert({ projeto_id: form.id, titulo, ordem });
    if (r.error) return toast("Erro: " + r.error.message);
    setNovaTarefa("");
    carregar();
  }
  async function mudaTarefa(id: string, campos: Partial<Tarefa>) {
    setTarefas((ts) => ts.map((t) => (t.id === id ? { ...t, ...campos } : t)));
    const r = await sb.from("tarefas").update(campos).eq("id", id);
    if (r.error) { toast("Erro: " + r.error.message); carregar(); }
  }
  async function apagaTarefa(id: string) {
    const r = await sb.from("tarefas").delete().eq("id", id);
    if (r.error) return toast("Erro: " + r.error.message);
    carregar();
  }

  if (erro === "falta-migracao")
    return (
      <div className="card"><div className="empty"><b>Faltam as tabelas</b>
        Corre a migração 0002_clientes_projetos_tarefas.sql no SQL Editor do Supabase.</div></div>
    );
  if (erro) return <div className="card"><p className="erro-box">Erro ao carregar: {erro}</p></div>;
  if (!projetos) return <div className="dica">A carregar…</div>;

  const set = (k: keyof Projeto, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const tarefasForm = doProjeto(form?.id);

  return (
    <>
      <div className="bar-ferr">
        <div className="seg" role="group" aria-label="Filtrar por responsável">
          {["Todos", "André", "Nuno"].map((r) => (
            <button key={r} type="button" className={"sb" + (resp === r ? " on" : "")} style={pc(corDeNome(r))} onClick={() => setResp(r)}>
              {corDeNome(r) && <i className="cdot" />}{r}
            </button>
          ))}
        </div>
      </div>

      <div className="board">
        {ESTADOS.map((estado) => {
          const cartoes = visiveis.filter((p) => p.estado === estado).sort((a, b) => a.ordem - b.ordem);
          return (
            <section
              key={estado} className={"col" + (sobre === estado ? " over" : "")} data-s={estado}
              onDragOver={(e) => { if (arrasta) { e.preventDefault(); setSobre(estado); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(null); }}
              onDrop={(e) => { e.preventDefault(); setSobre(null); if (arrasta) mover(arrasta, estado, null); setArrasta(null); }}
            >
              <header>
                <span className="cdot" style={{ background: COR[estado] }} />
                <span className="nm">{estado}</span>
                <span className="ct">{cartoes.length}</span>
              </header>
              <div className="body">
                {cartoes.length === 0 && <div className="vz">Sem projetos</div>}
                {cartoes.map((p) => {
                  const ts = doProjeto(p.id), feitas = ts.filter((t) => t.concluida).length;
                  const tot = ts.reduce((s, t) => s + segundos(t.id), 0), corre = ts.some((t) => aCorrer(t.id));
                  const corCorre = corQuemCorre(ts.find((t) => aCorrer(t.id))?.id ?? "");
                  const atraso = !!p.prazo && p.prazo < hoje() && p.estado !== "Concluído";
                  return (
                    <article
                      key={p.id} className={"pcard" + (arrasta === p.id ? " drag" : "")} data-p={p.prioridade} draggable
                      onDragStart={(e) => { setArrasta(p.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", p.id); }}
                      onDragEnd={() => { setArrasta(null); setSobre(null); }}
                      onDragOver={(e) => { if (arrasta && arrasta !== p.id) { e.preventDefault(); e.stopPropagation(); setSobre(estado); } }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setSobre(null); if (arrasta && arrasta !== p.id) mover(arrasta, estado, p.id); setArrasta(null); }}
                      onClick={() => setForm(p)}
                    >
                      <div className="t">{p.nome}</div>
                      {p.cliente_id && <div className="cli">{nomeCli[p.cliente_id]}</div>}
                      <div className="meta">
                        <span className={"pill " + (p.prioridade === "Urgente" ? "coral" : p.prioridade === "Alta" ? "amber" : "")}>{p.prioridade}</span>
                        {p.prazo && <span className={"prazo" + (atraso ? " atraso" : "")}>{dataCurta(p.prazo)}</span>}
                        {(tot > 0 || corre) && (
                          <span className={"tcard num" + (corre ? " on" : "")} style={pc(corCorre)} title={corre ? "Cronómetro a correr" : "Tempo total"}>
                            {corre && <i className="dot on" />}{fmtTempo(tot)}
                          </span>
                        )}
                        <span className="resp-n" style={pc(corDeNome(p.responsavel))}><i className="cdot" />{p.responsavel}</span>
                      </div>
                      {ts.length > 0 && (
                        <div className="bar-n">
                          <div className="bar"><i style={{ width: `${(feitas / ts.length) * 100}%` }} /></div>
                          <span className="num">{feitas}/{ts.length}</span>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <Gaveta
        aberta={!!form} titulo={form?.id ? form.nome || "Projeto" : "Novo projeto"} onFechar={() => setForm(null)}
        rodape={<>
          <button className="btn pri" type="button" onClick={guardar} disabled={aGuardar}>{aGuardar ? "A guardar…" : "Guardar"}</button>
          <button className="btn" type="button" onClick={() => setForm(null)}>Cancelar</button>
          <div className="spacer" />
          {form?.id && <button className="btn dgr" type="button" onClick={apagar}>Apagar</button>}
        </>}
      >
        {form && (<>
          <div className="fld"><label>Nome</label><input className="in" value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} autoFocus /></div>
          <div className="fld"><label>Cliente</label>
            <select className="in" value={form.cliente_id ?? ""} onChange={(e) => set("cliente_id", e.target.value)}>
              <option value="">—</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></div>
          <div className="row2">
            <div className="fld"><label>Estado</label>
              <select className="in" value={form.estado ?? "Para fazer"} onChange={(e) => set("estado", e.target.value)}>
                {ESTADOS.map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="fld"><label>Prioridade</label>
              <select className="in" value={form.prioridade ?? "Média"} onChange={(e) => set("prioridade", e.target.value)}>
                {PRIORIDADES.map((s) => <option key={s}>{s}</option>)}
              </select></div>
          </div>
          <div className="row2">
            <div className="fld"><label>Responsável</label>
              <select className="in" value={form.responsavel ?? "André"} onChange={(e) => set("responsavel", e.target.value)}>
                {RESPONSAVEIS.map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="fld"><label>Marca</label>
              <select className="in" value={form.marca ?? ""} onChange={(e) => set("marca", e.target.value)}>
                <option value="">—</option>
                {MARCAS.map((s) => <option key={s}>{s}</option>)}
              </select></div>
          </div>
          <div className="fld"><label>Tipo de trabalho</label>
            <select className="in" value={form.tipo ?? ""} onChange={(e) => set("tipo", e.target.value)}>
              <option value="">—</option>
              {TIPOS.map((s) => <option key={s}>{s}</option>)}
            </select></div>
          <div className="row2">
            <div className="fld"><label>Início</label><input className="in" type="date" value={form.inicio ?? ""} onChange={(e) => set("inicio", e.target.value)} /></div>
            <div className="fld"><label>Prazo / entrega</label><input className="in" type="date" value={form.prazo ?? ""} onChange={(e) => set("prazo", e.target.value)} /></div>
          </div>
          <div className="fld"><label>Prazo estimado</label><input className="in" type="date" value={form.prazo_estimado ?? ""} onChange={(e) => set("prazo_estimado", e.target.value)} /></div>
          <div className="fld"><label>Link da entrega</label><input className="in" type="url" value={form.link_entrega ?? ""} onChange={(e) => set("link_entrega", e.target.value)} /></div>
          <div className="fld"><label>Notas</label><textarea className="in" value={form.notas ?? ""} onChange={(e) => set("notas", e.target.value)} /></div>
          <label className="chk">
            <input type="checkbox" checked={!!form.visivel_ao_cliente} onChange={(e) => set("visivel_ao_cliente", e.target.checked)} />
            Visível ao cliente (portal)
          </label>

          <div className="fld"><label>Tarefas{tarefasForm.length ? ` (${tarefasForm.filter((t) => t.concluida).length}/${tarefasForm.length})` : ""}</label>
            {!form.id ? <div className="dica">Guarda o projeto para poderes adicionar tarefas.</div> : (<>
              <div className="ckl">
                {tarefasForm.map((t, k) => {
                  const minha = aMinha(t.id), corre = aCorrer(t.id);
                  const regs = registos.filter((r) => r.tarefa_id === t.id);
                  return (
                  <div className={"it" + (t.concluida ? " done" : "")} key={t.id}>
                    <div className="l1">
                      <input type="checkbox" checked={t.concluida} onChange={(e) => mudaTarefa(t.id, { concluida: e.target.checked })} aria-label="Concluída" />
                      <input className="tt" defaultValue={t.titulo} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.titulo) mudaTarefa(t.id, { titulo: v }); }} />
                      {!semTempo && (<>
                        <button type="button" className={"crb" + (minha ? " on" : "")} style={pc(corDeId(meuId))} onClick={() => alternaCronometro(t.id)}
                          title={minha ? "Pausar" : "Iniciar"} aria-label={minha ? "Pausar cronómetro" : "Iniciar cronómetro"}>
                          {minha ? "❚❚" : "▶"}
                        </button>
                        <span className={"cron num" + (corre ? " on" : "")} style={pc(corQuemCorre(t.id))}>{fmtTempo(segundos(t.id), corre)}</span>
                      </>)}
                    </div>
                    <div className="l2">
                      <select className="in mini-in" title="Responsável" value={t.responsavel ?? ""} onChange={(e) => mudaTarefa(t.id, { responsavel: e.target.value || null })}>
                        <option value="">Responsável</option>
                        {RESPONSAVEIS.map((r) => <option key={r}>{r}</option>)}
                      </select>
                      <input className="in dt" type="date" title="Prazo" value={t.prazo ?? ""} onChange={(e) => mudaTarefa(t.id, { prazo: e.target.value || null })} />
                      <span className="spacer" />
                      <button className="x" type="button" disabled={k === 0} onClick={() => moveTarefa(t.id, -1)} aria-label="Subir tarefa" title="Subir">↑</button>
                      <button className="x" type="button" disabled={k === tarefasForm.length - 1} onClick={() => moveTarefa(t.id, 1)} aria-label="Descer tarefa" title="Descer">↓</button>
                      <button className="btn sm" type="button" onClick={() => setAberta(aberta === t.id ? null : t.id)} aria-expanded={aberta === t.id}>
                        {aberta === t.id ? "Fechar" : "Detalhes"}
                      </button>
                      <button className="x" type="button" onClick={() => apagaTarefa(t.id)} aria-label="Apagar tarefa" title="Apagar">×</button>
                    </div>
                    {aberta === t.id && (
                      <div className="l3">
                        <textarea className="in" placeholder="Descrição" defaultValue={t.descricao ?? ""}
                          onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (t.descricao ?? null)) mudaTarefa(t.id, { descricao: v }); }} />
                        <div className="l2" style={{ paddingLeft: 0 }}>
                          <label className="vis">Prazo estimado
                            <input className="in dt" type="date" value={t.prazo_estimado ?? ""} onChange={(e) => mudaTarefa(t.id, { prazo_estimado: e.target.value || null })} /></label>
                          <label className="vis"><input type="checkbox" checked={t.visivel_ao_cliente} onChange={(e) => mudaTarefa(t.id, { visivel_ao_cliente: e.target.checked })} />Visível ao cliente</label>
                          {!semTempo && <label className="vis"><input type="checkbox" checked={!!t.mostrar_tempo_ao_cliente} onChange={(e) => mudaTarefa(t.id, { mostrar_tempo_ao_cliente: e.target.checked })} />Mostrar tempo ao cliente</label>}
                        </div>
                        {!semTempo && (<>
                          <div className="cap">Registos de tempo ({regs.length})</div>
                          {regs.length === 0 && <div className="dica">Sem registos. Carrega em play para começar.</div>}
                          {regs.map((r) => {
                            const meu = r.utilizador_id === meuId;
                            return (
                              <div className="reg" key={r.id + r.inicio + (r.fim ?? "")}>
                                <input className="in" type="datetime-local" aria-label="Início" disabled={!meu} defaultValue={paraInputLocal(r.inicio)}
                                  onBlur={(e) => { if (e.target.value && e.target.value !== paraInputLocal(r.inicio)) mudaRegisto(r.id, { inicio: deInputLocal(e.target.value) }); }} />
                                {r.fim ? (
                                  <input className="in" type="datetime-local" aria-label="Fim" disabled={!meu} defaultValue={paraInputLocal(r.fim)}
                                    onBlur={(e) => { if (e.target.value && e.target.value !== paraInputLocal(r.fim!)) mudaRegisto(r.id, { fim: deInputLocal(e.target.value) }); }} />
                                ) : <span className="pill lime">a correr</span>}
                                {!meu && <span className="dica">do colega</span>}
                                {meu && <button className="x" type="button" onClick={() => apagaRegisto(r.id)} aria-label="Apagar registo" title="Apagar registo">×</button>}
                              </div>
                            );
                          })}
                        </>)}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <input className="in" placeholder="Nova tarefa…" value={novaTarefa} onChange={(e) => setNovaTarefa(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTarefa(); } }} />
                <button className="btn" type="button" onClick={addTarefa}>Adicionar</button>
              </div>
            </>)}
          </div>
          {form.id && <ProjetoPortal key={form.id} projetoId={form.id} />}
        </>)}
      </Gaveta>
    </>
  );
}
