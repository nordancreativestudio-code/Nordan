"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SelectOpcoes } from "@/components/SelectOpcoes";
import { useToast } from "@/components/Toast";
import { deInputLocal, nul, paraInputLocal } from "@/lib/tipos";
import { ESTADOS_SESSAO, ROTULO_ESTADO, TIPOS_SESSAO, googleSessao, type Sessao } from "@/lib/sessoes";

type Opt = { id: string; nome: string };

/** Formulário de uma sessão. Grava primeiro na base; depois pede o convite ao Google (se falhar, a sessão fica gravada). */
export function EditorSessao({
  inicial, clienteFixo, clientes, projetos, onFechar, onGuardado,
}: {
  inicial: Partial<Sessao>;
  clienteFixo?: string;
  clientes: Opt[];
  projetos: (Opt & { cliente_id: string | null })[];
  onFechar: () => void;
  /** falhouGoogle: a sessão ficou gravada mas o convite não seguiu */
  onGuardado: (id: string, falhouGoogle: boolean) => void;
}) {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const [f, setF] = useState({
    cliente_id: clienteFixo ?? inicial.cliente_id ?? "",
    projeto_id: inicial.projeto_id ?? "",
    titulo: inicial.titulo ?? "",
    tipo: inicial.tipo ?? "",
    inicio: inicial.inicio ? paraInputLocal(inicial.inicio) : "",
    fim: inicial.fim ? paraInputLocal(inicial.fim) : "",
    local_ou_link: inicial.local_ou_link ?? "",
    nota_cliente: inicial.nota_cliente ?? "",
    estado: inicial.estado ?? "marcada",
  });
  const [aGuardar, setAGuardar] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const projetosDoCliente = projetos.filter((p) => p.cliente_id === f.cliente_id);

  async function guardar() {
    if (!f.cliente_id) return toast("Escolhe o cliente");
    if (!f.titulo.trim()) return toast("O título é obrigatório");
    if (!f.inicio) return toast("Indica a data e hora de início");
    if (f.fim && new Date(f.fim) <= new Date(f.inicio)) return toast("O fim tem de ser depois do início");
    setAGuardar(true);
    const dados = {
      cliente_id: f.cliente_id, projeto_id: nul(f.projeto_id), titulo: f.titulo.trim(), tipo: nul(f.tipo),
      inicio: deInputLocal(f.inicio), fim: f.fim ? deInputLocal(f.fim) : null,
      local_ou_link: nul(f.local_ou_link), nota_cliente: nul(f.nota_cliente), estado: f.estado,
    };
    const r = inicial.id
      ? await sb.from("sessoes").update(dados).eq("id", inicial.id).select("id").single()
      : await sb.from("sessoes").insert(dados).select("id").single();
    if (r.error || !r.data) { setAGuardar(false); return toast("Erro: " + (r.error?.message ?? "não gravou")); }
    const g = await googleSessao(r.data.id as string, "POST");
    setAGuardar(false);
    if (g.ok) {
      toast(g.acao === "cancelada" ? "Sessão cancelada e convidados avisados"
        : g.acao === "nenhuma" ? "Sessão guardada"
        : g.convidados ? `Sessão guardada e convite enviado a ${g.convidados} ${g.convidados === 1 ? "pessoa" : "pessoas"}`
        : "Sessão guardada no Google Calendar, sem convidados (este cliente ainda não tem emails no portal)");
    } else {
      toast("Sessão guardada, mas o convite não seguiu: " + (g.erro ?? "erro do Google"));
    }
    onGuardado(r.data.id as string, !g.ok);
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        {!clienteFixo && (
          <div className="fld"><label>Cliente</label>
            <select className="in" value={f.cliente_id} onChange={(e) => setF((x) => ({ ...x, cliente_id: e.target.value, projeto_id: "" }))}>
              <option value="">— escolhe —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></div>
        )}
        <div className="fld"><label>Título</label><input className="in" value={f.titulo} onChange={(e) => set("titulo", e.target.value)} autoFocus /></div>
        <div className="fld"><label>Tipo</label>
          <SelectOpcoes lista="link_sessao_tipo" fallback={TIPOS_SESSAO} valor={f.tipo} onChange={(v) => set("tipo", v)} /></div>
        <div className="fld"><label>Projeto (opcional)</label>
          <select className="in" value={f.projeto_id} onChange={(e) => set("projeto_id", e.target.value)} disabled={!f.cliente_id}>
            <option value="">—</option>
            {projetosDoCliente.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select></div>
        <div className="fld"><label>Início</label><input className="in" type="datetime-local" value={f.inicio} onChange={(e) => set("inicio", e.target.value)} /></div>
        <div className="fld"><label>Fim (opcional)</label><input className="in" type="datetime-local" value={f.fim} onChange={(e) => set("fim", e.target.value)} /></div>
        <div className="fld" style={{ gridColumn: "1/-1" }}><label>Local ou link</label>
          <input className="in" value={f.local_ou_link} placeholder="Morada ou link (Meet, Zoom…)" onChange={(e) => set("local_ou_link", e.target.value)} /></div>
        <div className="fld" style={{ gridColumn: "1/-1" }}><label>Nota ao cliente</label>
          <textarea className="in" value={f.nota_cliente} onChange={(e) => set("nota_cliente", e.target.value)} />
          <div className="dica">Vai na descrição do convite e aparece no portal. Não escrevas aqui nada interno.</div></div>
        {inicial.id && (
          <div className="fld"><label>Estado</label>
            <select className="in" value={f.estado} onChange={(e) => set("estado", e.target.value)}>
              {ESTADOS_SESSAO.map((s) => <option key={s} value={s}>{ROTULO_ESTADO[s]}</option>)}
            </select></div>
        )}
      </div>
      <div className="dica" style={{ marginTop: 8 }}>Ao guardar, o convite segue por Google Calendar para os emails do cliente no portal. Sem hora de fim, o evento dura 1 hora.</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn pri" type="button" onClick={guardar} disabled={aGuardar}>{aGuardar ? "A guardar…" : "Guardar e enviar convite"}</button>
        <button className="btn" type="button" onClick={onFechar} disabled={aGuardar}>Cancelar</button>
      </div>
    </div>
  );
}
