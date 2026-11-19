"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SelectOpcoes } from "@/components/SelectOpcoes";
import { Gaveta } from "@/components/Gaveta";
import { useToast } from "@/components/Toast";
import { dataCurta, dataPt, linkEmail, linkSeguro, linkWhatsApp, nul, tabelaEmFalta } from "@/lib/tipos";

type Lead = {
  id: string; nome: string; setor: string | null; subsetor: string | null; fase: string | null; estado: string; canal: string | null;
  contacto: string | null; telefone: string | null; email: string | null; web: string | null;
  primeiro_contacto: string | null; contacto_1: string | null; contacto_2: string | null; contacto_email: string | null;
  reuniao: string | null; ultimo_contacto: string | null; proximo_contacto: string | null; proximo_acao: string | null;
  decisor: string | null; cargo: string | null; resultado: string | null; motivo: string | null; formato: string | null;
  notas: string | null; cliente_id: string | null;
};
type Email = {
  id: string; empresa: string; tipo: string | null; estado: string | null; email: string | null; enviado: string | null;
  hora: string | null; assunto: string | null; modelo: string | null; thread_url: string | null; respondeu: string | null;
  lead_id: string | null; notas: string | null;
};
const FASES_BASE = ["Leads", "Contacto / Qualificação", "Reunião", "Onboarding"];
const SEM_FASE = "Sem fase";
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });

const TXT = ["nome", "subsetor", "contacto", "telefone", "email", "web", "proximo_acao", "decisor", "cargo", "motivo", "formato", "notas"] as const;
const SEL = ["setor", "fase", "canal", "resultado"] as const;
const DAT = ["primeiro_contacto", "contacto_1", "contacto_2", "contacto_email", "reuniao", "ultimo_contacto", "proximo_contacto"] as const;

export function LeadsView() {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const router = useRouter();
  const pedido = useSearchParams().get("lead");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [fases, setFases] = useState<string[]>(FASES_BASE);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"leads" | "emails">("leads");
  const [vista, setVista] = useState<"fase" | "setor">("fase");
  const [fSetor, setFSetor] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fProx, setFProx] = useState(false);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<Partial<Lead> | null>(null);
  const [formEmail, setFormEmail] = useState<Partial<Email> | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [arrastar, setArrastar] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [l, e, f] = await Promise.all([
      sb.from("leads").select("*").order("nome").limit(5000),
      sb.from("emails_prospecao").select("*").order("enviado", { ascending: false, nullsFirst: false }).limit(5000),
      sb.from("opcoes").select("valor").eq("lista", "lead_fase").order("ordem"),
    ]);
    const er = l.error ?? e.error;
    if (er) { setErro(tabelaEmFalta(er) ? "falta-migracao" : er.message); setLeads([]); return; }
    setErro(null);
    setLeads(l.data as Lead[]);
    setEmails(e.data as Email[]);
    if (f.data?.length) setFases(f.data.map((r) => r.valor as string));
  }, [sb]);

  useEffect(() => { Promise.resolve().then(carregar); }, [carregar]);
  useEffect(() => {
    const h = () => (aba === "emails" ? setFormEmail({}) : setForm({ estado: "Novo", fase: fases[0] ?? null }));
    window.addEventListener("nordan:novo", h);
    return () => window.removeEventListener("nordan:novo", h);
  }, [aba, fases]);

  // ?lead=<id> (vindo do Calendário): abre a gaveta dessa lead
  useEffect(() => {
    if (!pedido || !leads) return;
    const l = leads.find((x) => x.id === pedido);
    Promise.resolve().then(() => { if (l) setForm(l); router.replace("/leads"); });
  }, [pedido, leads, router]);

  const t = hoje();
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (leads ?? []).filter((l) =>
      (!fSetor || l.setor === fSetor) && (!fEstado || l.estado === fEstado) &&
      (!fProx || (l.proximo_contacto && l.proximo_contacto <= t)) &&
      (!q || [l.nome, l.contacto, l.email, l.telefone, l.notas, l.setor, l.proximo_acao].join(" ").toLowerCase().includes(q)));
  }, [leads, fSetor, fEstado, fProx, busca, t]);

  const setores = useMemo(() => [...new Set((leads ?? []).map((l) => l.setor).filter(Boolean) as string[])].sort(), [leads]);
  const estados = useMemo(() => [...new Set((leads ?? []).map((l) => l.estado))].sort(), [leads]);
  const vencidos = (leads ?? []).filter((l) => l.estado !== "Perdido" && l.proximo_contacto && l.proximo_contacto <= t);
  const ativas = (leads ?? []).filter((l) => l.estado !== "Perdido");
  const emailsDe = (id: string) => emails.filter((e) => e.lead_id === id);
  const nomeLead = useMemo(() => new Map((leads ?? []).map((l) => [l.id, l.nome])), [leads]);

  const colunas = useMemo(() => {
    const cols = [...fases];
    if (filtradas.some((l) => !l.fase || !cols.includes(l.fase))) cols.push(SEM_FASE);
    return cols.map((c) => [c, filtradas.filter((l) => (c === SEM_FASE ? !l.fase || !fases.includes(l.fase) : l.fase === c))] as const);
  }, [filtradas, fases]);
  const grupos = useMemo(() => {
    const m = new Map<string, Lead[]>();
    for (const l of filtradas) m.set(l.setor || "Sem setor", [...(m.get(l.setor || "Sem setor") ?? []), l]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtradas]);

  const set = (k: keyof Lead, v: string | null) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    if (!form?.nome?.trim()) return toast("O nome é obrigatório");
    const dados: Record<string, string | null> = { estado: form.estado || "Novo", nome: form.nome.trim() };
    for (const k of [...TXT, ...SEL, ...DAT]) if (k !== "nome") dados[k] = nul(form[k]) as string | null;
    setAGuardar(true);
    const r = form.id ? await sb.from("leads").update(dados).eq("id", form.id) : await sb.from("leads").insert(dados);
    setAGuardar(false);
    if (r.error) return toast("Erro: " + r.error.message);
    setForm(null); toast("Guardado"); carregar();
  }
  async function apagar() {
    if (!form?.id || !confirm("Apagar esta lead? Os emails ligados ficam sem lead.")) return;
    const r = await sb.from("leads").delete().eq("id", form.id);
    if (r.error) return toast("Erro: " + r.error.message);
    setForm(null); carregar();
  }
  async function mover(id: string, fase: string) {
    const l = leads?.find((x) => x.id === id);
    if (!l || l.fase === fase) return;
    const novaFase = fase === SEM_FASE ? null : fase;
    setLeads((ls) => ls!.map((x) => (x.id === id ? { ...x, fase: novaFase } : x)));
    const r = await sb.from("leads").update({ fase: novaFase }).eq("id", id);
    if (r.error) { toast("Erro: " + r.error.message); carregar(); }
  }

  const setE = (k: keyof Email, v: string | null) => setFormEmail((f) => ({ ...f, [k]: v }));
  async function guardarEmail() {
    if (!formEmail?.empresa?.trim()) return toast("A empresa é obrigatória");
    const dados: Record<string, string | null> = { empresa: formEmail.empresa.trim() };
    for (const k of ["tipo", "estado", "email", "enviado", "hora", "assunto", "modelo", "thread_url", "respondeu", "lead_id", "notas"] as const) dados[k] = nul(formEmail[k]) as string | null;
    setAGuardar(true);
    const r = formEmail.id ? await sb.from("emails_prospecao").update(dados).eq("id", formEmail.id) : await sb.from("emails_prospecao").insert(dados);
    setAGuardar(false);
    if (r.error) return toast("Erro: " + r.error.message);
    setFormEmail(null); toast("Guardado"); carregar();
  }
  async function apagarEmail() {
    if (!formEmail?.id || !confirm("Apagar este email?")) return;
    const r = await sb.from("emails_prospecao").delete().eq("id", formEmail.id);
    if (r.error) return toast("Erro: " + r.error.message);
    setFormEmail(null); carregar();
  }

  if (erro === "falta-migracao") return <div className="card"><div className="empty"><b>Falta correr a migração 0009</b>As tabelas de leads ainda não existem.</div></div>;
  if (erro) return <div className="card"><div className="empty"><b>Erro</b>{erro}</div></div>;
  if (!leads) return <div className="card"><div className="empty">A carregar…</div></div>;

  const cartao = (l: Lead) => {
    const atrasado = l.proximo_contacto && l.proximo_contacto <= t && l.estado !== "Perdido";
    return (
      <div key={l.id} className="card" draggable onDragStart={() => setArrastar(l.id)} onDragEnd={() => setArrastar(null)}
        onClick={() => setForm(l)} style={{ padding: 10, cursor: "pointer", opacity: l.estado === "Perdido" ? 0.55 : 1 }}>
        <b style={{ fontWeight: 600, fontSize: 13 }}>{l.nome}</b>
        <div className="faint" style={{ fontSize: 11 }}>{[l.setor, l.contacto].filter(Boolean).join(" · ") || "—"}</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
          <span className={"pill" + (l.estado === "Follow-up" ? " amber" : l.estado === "Conversa" ? " lime" : l.estado === "Perdido" ? " done" : "")}>{l.estado}</span>
          {l.proximo_contacto && <span className={"pill" + (atrasado ? " coral" : "")}>{dataCurta(l.proximo_contacto)}</span>}
          {emailsDe(l.id).length > 0 && <span className="faint" style={{ fontSize: 11 }}>✉ {emailsDe(l.id).length}</span>}
        </div>
        {l.proximo_acao && <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>{l.proximo_acao}</div>}
      </div>
    );
  };

  const doLead = form?.id ? emailsDe(form.id) : [];

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid kpis">
        <div className="kpi hi"><div className="v num">{ativas.length}</div><div className="n">Leads ativas</div></div>
        <button type="button" className="kpi clic" style={{ textAlign: "left" }} onClick={() => { setAba("leads"); setFProx(!fProx); }}>
          <div className="v num" style={{ color: vencidos.length ? "var(--coral)" : undefined }}>{vencidos.length}</div>
          <div className="n">Contactos por fazer (hoje ou em atraso)</div></button>
        <div className="kpi"><div className="v num">{ativas.filter((l) => l.estado === "Conversa").length}</div><div className="n">Em conversa</div></div>
        <div className="kpi"><div className="v num">{emails.length}</div><div className="n">Emails de prospeção</div></div>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <div className="seg">
            <button type="button" className={"sb" + (aba === "leads" ? " on" : "")} onClick={() => setAba("leads")}>Leads</button>
            <button type="button" className={"sb" + (aba === "emails" ? " on" : "")} onClick={() => setAba("emails")}>Emails de prospeção</button>
          </div>
          {aba === "leads" && (
            <>
              <div className="seg">
                <button type="button" className={"sb" + (vista === "fase" ? " on" : "")} onClick={() => setVista("fase")}>Por fase</button>
                <button type="button" className={"sb" + (vista === "setor" ? " on" : "")} onClick={() => setVista("setor")}>Por setor</button>
              </div>
              <select className="in" style={{ width: "auto" }} value={fSetor} onChange={(e) => setFSetor(e.target.value)} aria-label="Setor">
                <option value="">Todos os setores</option>{setores.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select className="in" style={{ width: "auto" }} value={fEstado} onChange={(e) => setFEstado(e.target.value)} aria-label="Estado">
                <option value="">Todos os estados</option>{estados.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button type="button" className={"btn sm" + (fProx ? " pri" : "")} onClick={() => setFProx(!fProx)}>Contactos por fazer</button>
            </>
          )}
          <input className="in" style={{ width: 180 }} placeholder="Pesquisar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <span style={{ flex: 1 }} />
          <button className="btn" type="button" onClick={() => (aba === "emails" ? setFormEmail({}) : setForm({ estado: "Novo", fase: fases[0] ?? null }))}>
            {aba === "emails" ? "+ Email" : "+ Lead"}
          </button>
        </div>

        {aba === "leads" && vista === "fase" && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${colunas.length}, minmax(220px, 1fr))`, gap: 10, overflowX: "auto" }}>
            {colunas.map(([c, ls]) => (
              <div key={c} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (arrastar) mover(arrastar, c); setArrastar(null); }}
                style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 120 }}>
                <h3 style={{ margin: 0 }}>{c}<span className="tot">{ls.length}</span></h3>
                {ls.map(cartao)}
                {ls.length === 0 && <div className="faint" style={{ fontSize: 12 }}>Vazio</div>}
              </div>
            ))}
          </div>
        )}

        {aba === "leads" && vista === "setor" && (
          grupos.length === 0 ? <div className="empty" style={{ padding: "22px 0" }}>Nenhuma lead.</div> :
          grupos.map(([s, ls]) => (
            <details key={s} className="grp" open={grupos.length <= 3}>
              <summary><b>{s}</b> <span className="tot">{ls.length}</span></summary>
              <div style={{ overflowX: "auto" }}>
                <table><thead><tr><th>Nome</th><th>Fase</th><th>Estado</th><th>Contacto</th><th>Próximo contacto</th><th>Próxima ação</th></tr></thead>
                  <tbody>{ls.map((l) => (
                    <tr key={l.id} style={{ cursor: "pointer" }} onClick={() => setForm(l)}>
                      <td>{l.nome}</td><td className="faint">{l.fase ?? "—"}</td><td><span className="pill">{l.estado}</span></td>
                      <td className="faint">{l.contacto ?? "—"}</td>
                      <td style={{ color: l.proximo_contacto && l.proximo_contacto <= t && l.estado !== "Perdido" ? "var(--coral)" : undefined }}>{dataPt(l.proximo_contacto) || "—"}</td>
                      <td className="faint">{l.proximo_acao ?? "—"}</td>
                    </tr>))}</tbody></table>
              </div>
            </details>
          ))
        )}

        {aba === "emails" && (() => {
          const q = busca.trim().toLowerCase();
          const ls = emails.filter((e) => !q || [e.empresa, e.email, e.assunto, e.tipo].join(" ").toLowerCase().includes(q));
          return ls.length === 0 ? <div className="empty" style={{ padding: "22px 0" }}>Sem emails de prospeção.</div> : (
            <div style={{ overflowX: "auto" }}>
              <table><thead><tr><th>Enviado</th><th>Empresa</th><th>Tipo</th><th>Estado</th><th>Assunto</th><th>Lead</th></tr></thead>
                <tbody>{ls.map((e) => (
                  <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => setFormEmail(e)}>
                    <td style={{ whiteSpace: "nowrap" }}>{dataPt(e.enviado) || "—"}</td><td>{e.empresa}</td>
                    <td className="faint">{e.tipo ?? "—"}</td><td><span className={"pill" + (e.estado === "Respondeu" ? " lime" : "")}>{e.estado ?? "—"}</span></td>
                    <td className="faint">{e.assunto ?? "—"}</td><td className="faint">{nomeLead.get(e.lead_id ?? "") ?? "—"}</td>
                  </tr>))}</tbody></table>
            </div>
          );
        })()}
      </div>

      <Gaveta aberta={form !== null} titulo={form?.id ? form.nome ?? "Lead" : "Nova lead"} onFechar={() => setForm(null)}
        rodape={form && <>{form.id && <button className="btn dgr" type="button" onClick={apagar}>Apagar</button>}<span style={{ flex: 1 }} />
          <button className="btn" type="button" onClick={() => setForm(null)}>Cancelar</button>
          <button className="btn pri" type="button" disabled={aGuardar} onClick={guardar}>{aGuardar ? "A guardar…" : "Guardar"}</button></>}>
        {form && (<>
          <div className="fld"><label>Nome / empresa</label><input className="in" autoFocus value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} /></div>
          <div className="row2">
            <div className="fld"><label>Setor</label><SelectOpcoes lista="lead_setor" valor={form.setor ?? ""} onChange={(v) => set("setor", v)} /></div>
            <div className="fld"><label>Subsetor</label><input className="in" value={form.subsetor ?? ""} onChange={(e) => set("subsetor", e.target.value)} /></div>
          </div>
          <div className="row2">
            <div className="fld"><label>Fase</label><SelectOpcoes lista="lead_fase" valor={form.fase ?? ""} onChange={(v) => set("fase", v)} /></div>
            <div className="fld"><label>Estado</label><SelectOpcoes lista="lead_estado" valor={form.estado ?? "Novo"} vazio={null} onChange={(v) => set("estado", v)} /></div>
          </div>
          <div className="row2">
            <div className="fld"><label>Canal</label><SelectOpcoes lista="lead_canal" valor={form.canal ?? ""} onChange={(v) => set("canal", v)} /></div>
            <div className="fld"><label>Resultado</label><SelectOpcoes lista="lead_resultado" valor={form.resultado ?? ""} onChange={(v) => set("resultado", v)} /></div>
          </div>
          <div className="row2">
            <div className="fld"><label>Pessoa de contacto</label><input className="in" value={form.contacto ?? ""} onChange={(e) => set("contacto", e.target.value)} /></div>
            <div className="fld"><label>Decisor</label><input className="in" value={form.decisor ?? ""} onChange={(e) => set("decisor", e.target.value)} /></div>
          </div>
          <div className="row2">
            <div className="fld"><label>Telefone</label><input className="in" value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} />
              {linkWhatsApp(form.telefone) && <a className="faint" style={{ fontSize: 11 }} href={linkWhatsApp(form.telefone)!} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>}</div>
            <div className="fld"><label>Email</label><input className="in" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
              {linkEmail(form.email) && <a className="faint" style={{ fontSize: 11 }} href={linkEmail(form.email)!}>Escrever email</a>}</div>
          </div>
          <div className="row2">
            <div className="fld"><label>Cargo</label><input className="in" value={form.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} /></div>
            <div className="fld"><label>Site</label><input className="in" value={form.web ?? ""} onChange={(e) => set("web", e.target.value)} />
              {linkSeguro(form.web) && <a className="faint" style={{ fontSize: 11 }} href={linkSeguro(form.web)!} target="_blank" rel="noopener noreferrer">Abrir site</a>}</div>
          </div>
          <h3 style={{ margin: "6px 0 0" }}>Datas</h3>
          <div className="row2">
            {([["primeiro_contacto", "Primeiro contacto"], ["contacto_1", "1.º contacto"], ["contacto_2", "2.º contacto"], ["contacto_email", "Contacto por email"], ["reuniao", "Reunião"], ["ultimo_contacto", "Último contacto"]] as const).map(([k, r]) => (
              <div className="fld" key={k}><label>{r}</label><input className="in" type="date" value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></div>))}
          </div>
          <div className="row2">
            <div className="fld"><label>Próximo contacto</label><input className="in" type="date" value={form.proximo_contacto ?? ""} onChange={(e) => set("proximo_contacto", e.target.value)} /></div>
            <div className="fld"><label>Próxima ação</label><input className="in" value={form.proximo_acao ?? ""} onChange={(e) => set("proximo_acao", e.target.value)} /></div>
          </div>
          <div className="row2">
            <div className="fld"><label>Formato</label><input className="in" value={form.formato ?? ""} onChange={(e) => set("formato", e.target.value)} /></div>
            <div className="fld"><label>Motivo (se perdida)</label><input className="in" value={form.motivo ?? ""} onChange={(e) => set("motivo", e.target.value)} /></div>
          </div>
          <div className="fld"><label>Notas</label><textarea className="in" value={form.notas ?? ""} onChange={(e) => set("notas", e.target.value)} /></div>
          {form.id && (
            <>
              <h3 style={{ margin: "6px 0 0" }}>Emails de prospeção<span className="tot">{doLead.length}</span></h3>
              <div className="lista">
                {doLead.map((e) => (
                  <div className="li" key={e.id} style={{ cursor: "pointer" }} onClick={() => { setForm(null); setAba("emails"); setFormEmail(e); }}>
                    <span className="nm">{e.assunto || e.empresa}</span><span className="faint" style={{ fontSize: 11 }}>{dataPt(e.enviado)}</span>
                    <span className={"pill" + (e.estado === "Respondeu" ? " lime" : "")}>{e.estado ?? "—"}</span>
                  </div>))}
                {doLead.length === 0 && <div className="faint" style={{ fontSize: 12 }}>Sem emails ligados.</div>}
              </div>
              <button className="btn sm" type="button" style={{ alignSelf: "flex-start" }}
                onClick={() => { const l = form; setForm(null); setAba("emails"); setFormEmail({ empresa: l.nome, lead_id: l.id, email: l.email, enviado: hoje() }); }}>+ Email para esta lead</button>
            </>
          )}
        </>)}
      </Gaveta>

      <Gaveta aberta={formEmail !== null} titulo={formEmail?.id ? "Email de prospeção" : "Novo email de prospeção"} onFechar={() => setFormEmail(null)}
        rodape={formEmail && <>{formEmail.id && <button className="btn dgr" type="button" onClick={apagarEmail}>Apagar</button>}<span style={{ flex: 1 }} />
          <button className="btn" type="button" onClick={() => setFormEmail(null)}>Cancelar</button>
          <button className="btn pri" type="button" disabled={aGuardar} onClick={guardarEmail}>{aGuardar ? "A guardar…" : "Guardar"}</button></>}>
        {formEmail && (<>
          <div className="fld"><label>Empresa</label><input className="in" autoFocus value={formEmail.empresa ?? ""} onChange={(e) => setE("empresa", e.target.value)} /></div>
          <div className="row2">
            <div className="fld"><label>Tipo</label><SelectOpcoes lista="email_tipo" valor={formEmail.tipo ?? ""} onChange={(v) => setE("tipo", v)} /></div>
            <div className="fld"><label>Estado</label><SelectOpcoes lista="email_estado" valor={formEmail.estado ?? ""} onChange={(v) => setE("estado", v)} /></div>
          </div>
          <div className="row2">
            <div className="fld"><label>Email</label><input className="in" value={formEmail.email ?? ""} onChange={(e) => setE("email", e.target.value)} /></div>
            <div className="fld"><label>Lead</label>
              <select className="in" value={formEmail.lead_id ?? ""} onChange={(e) => setE("lead_id", e.target.value || null)}>
                <option value="">—</option>{(leads ?? []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select></div>
          </div>
          <div className="row2">
            <div className="fld"><label>Enviado em</label><input className="in" type="date" value={formEmail.enviado ?? ""} onChange={(e) => setE("enviado", e.target.value)} /></div>
            <div className="fld"><label>Hora</label><input className="in" value={formEmail.hora ?? ""} onChange={(e) => setE("hora", e.target.value)} placeholder="hh:mm" /></div>
          </div>
          <div className="fld"><label>Assunto</label><input className="in" value={formEmail.assunto ?? ""} onChange={(e) => setE("assunto", e.target.value)} /></div>
          <div className="row2">
            <div className="fld"><label>Modelo</label><input className="in" value={formEmail.modelo ?? ""} onChange={(e) => setE("modelo", e.target.value)} /></div>
            <div className="fld"><label>Respondeu</label><input className="in" value={formEmail.respondeu ?? ""} onChange={(e) => setE("respondeu", e.target.value)} /></div>
          </div>
          <div className="fld"><label>Link da conversa</label><input className="in" value={formEmail.thread_url ?? ""} onChange={(e) => setE("thread_url", e.target.value)} />
            {linkSeguro(formEmail.thread_url) && <a className="faint" style={{ fontSize: 11 }} href={linkSeguro(formEmail.thread_url)!} target="_blank" rel="noopener noreferrer">Abrir conversa</a>}</div>
          <div className="fld"><label>Notas</label><textarea className="in" value={formEmail.notas ?? ""} onChange={(e) => setE("notas", e.target.value)} /></div>
        </>)}
      </Gaveta>
    </div>
  );
}
