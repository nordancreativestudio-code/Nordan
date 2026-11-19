"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { linkSeguro, tabelaEmFalta } from "@/lib/tipos";
import { dataHoraPt, googleSessao, ROTULO_ESTADO, type Sessao } from "@/lib/sessoes";
import { EditorSessao } from "./EditorSessao";

type Opt = { id: string; nome: string };

/**
 * Lista e edição de sessões. Com `clienteId` mostra só as desse cliente (secção da gaveta do cliente);
 * sem ele mostra todas (página Calendário) e deixa escolher o cliente.
 */
export function SessoesPainel({ clienteId, escutarNovo = false }: { clienteId?: string; escutarNovo?: boolean }) {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const [sessoes, setSessoes] = useState<Sessao[] | null>(null);
  const [clientes, setClientes] = useState<Opt[]>([]);
  const [projetos, setProjetos] = useState<(Opt & { cliente_id: string | null })[]>([]);
  const [falta, setFalta] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<Partial<Sessao> | null>(null);
  const [falhas, setFalhas] = useState<Set<string>>(new Set()); // sessões cuja última sincronização com o Google falhou
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [agora, setAgora] = useState(0); // atualizado em cada carregamento (não se chama Date.now durante o render)

  const carregar = useCallback(async () => {
    let q = sb.from("sessoes").select("*").order("inicio");
    if (clienteId) q = q.eq("cliente_id", clienteId);
    const [s, c, p] = await Promise.all([
      q,
      sb.from("clientes").select("id,nome").order("nome"),
      sb.from("projetos").select("id,nome,cliente_id").order("nome"),
    ]);
    if (s.error) { setFalta(tabelaEmFalta(s.error)); setErro(tabelaEmFalta(s.error) ? null : s.error.message); setSessoes([]); return; }
    setFalta(false); setErro(null); setAgora(Date.now());
    setSessoes(s.data as Sessao[]);
    setClientes((c.data ?? []) as Opt[]);
    setProjetos((p.data ?? []) as (Opt & { cliente_id: string | null })[]);
  }, [sb, clienteId]);
  useEffect(() => { Promise.resolve().then(carregar); }, [carregar]);

  useEffect(() => {
    if (!escutarNovo) return;
    const h = () => setEdicao({});
    window.addEventListener("nordan:novo", h);
    return () => window.removeEventListener("nordan:novo", h);
  }, [escutarNovo]);

  const marcar = (id: string, falhou: boolean) =>
    setFalhas((s) => { const n = new Set(s); if (falhou) n.add(id); else n.delete(id); return n; });

  async function reenviar(s: Sessao) {
    setOcupada(s.id);
    const g = await googleSessao(s.id, "POST");
    setOcupada(null);
    marcar(s.id, !g.ok);
    toast(g.ok ? (g.convidados ? "Convite enviado" : "Evento criado, sem convidados (o cliente não tem emails no portal)") : "O convite não seguiu: " + (g.erro ?? "erro do Google"));
    carregar();
  }
  async function cancelar(s: Sessao) {
    if (!confirm(`Cancelar "${s.titulo}"? Os convidados recebem o aviso do Google.`)) return;
    setOcupada(s.id);
    const r = await sb.from("sessoes").update({ estado: "cancelada" }).eq("id", s.id);
    if (r.error) { setOcupada(null); return toast("Erro: " + r.error.message); }
    const g = await googleSessao(s.id, "POST");
    setOcupada(null);
    marcar(s.id, !g.ok);
    toast(g.ok ? "Sessão cancelada e convidados avisados" : "Sessão cancelada, mas o evento no Google não foi removido: " + (g.erro ?? "erro do Google"));
    carregar();
  }
  async function apagar(s: Sessao) {
    if (!confirm(`Apagar "${s.titulo}"? Esta ação não se desfaz.`)) return;
    setOcupada(s.id);
    if (s.google_event_id) {
      const g = await googleSessao(s.id, "DELETE");
      if (!g.ok && !confirm("O evento não foi removido do Google (" + (g.erro ?? "erro") + "). Apagar a sessão mesmo assim?")) { setOcupada(null); return; }
    }
    const r = await sb.from("sessoes").delete().eq("id", s.id);
    setOcupada(null);
    if (r.error) return toast("Erro: " + r.error.message);
    toast("Sessão apagada");
    carregar();
  }

  if (falta) return <div className="dica">Disponível depois de correr a migração 0014_sessoes.sql no Supabase.</div>;
  if (erro) return <p className="erro-box">Erro ao carregar sessões: {erro}</p>;
  if (!sessoes) return <div className="dica">A carregar…</div>;

  const proximas = sessoes.filter((s) => s.estado === "marcada" && new Date(s.fim ?? s.inicio).getTime() >= agora);
  const outras = sessoes.filter((s) => !proximas.includes(s)).reverse();
  const nomeCliente = (id: string) => clientes.find((c) => c.id === id)?.nome ?? "—";

  const linha = (s: Sessao) => {
    const link = linkSeguro(s.local_ou_link);
    const porEnviar = s.estado === "marcada" && !s.google_event_id;
    const falhou = falhas.has(s.id);
    return (
      <div className="li" key={s.id} style={{ flexWrap: "wrap" }}>
        <span className="nm" style={{ flexBasis: 220 }}>
          <b style={{ fontWeight: 500 }}>{s.titulo}</b>
          <span className="dica" style={{ display: "block" }}>
            {dataHoraPt(s.inicio)}{!clienteId && ` · ${nomeCliente(s.cliente_id)}`}{s.local_ou_link && !link ? ` · ${s.local_ou_link}` : ""}
          </span>
        </span>
        {s.tipo && <span className="pill">{s.tipo}</span>}
        {s.estado !== "marcada" && <span className="pill done">{ROTULO_ESTADO[s.estado]}</span>}
        {s.estado === "marcada" && (falhou || porEnviar
          ? <span className="pill amber">{falhou && s.google_event_id ? "Alteração não seguiu" : "Convite não seguiu"}</span>
          : <span className="pill lime">Convite enviado</span>)}
        {link && <a className="btn sm" href={link} target="_blank" rel="noopener noreferrer">Abrir link ↗</a>}
        {s.estado === "marcada" && (falhou || porEnviar) &&
          <button className="btn sm" type="button" disabled={ocupada === s.id} onClick={() => reenviar(s)}>{ocupada === s.id ? "A enviar…" : "Reenviar convite"}</button>}
        <button className="btn sm" type="button" disabled={ocupada === s.id} onClick={() => setEdicao(s)}>Editar</button>
        {s.estado === "marcada" && <button className="btn sm" type="button" disabled={ocupada === s.id} onClick={() => cancelar(s)}>Cancelar</button>}
        <button className="btn sm dgr" type="button" disabled={ocupada === s.id} onClick={() => apagar(s)}>Apagar</button>
      </div>
    );
  };

  return (
    <div>
      {edicao ? (
        <EditorSessao
          key={edicao.id ?? "nova"} inicial={edicao} clienteFixo={clienteId} clientes={clientes} projetos={projetos}
          onFechar={() => setEdicao(null)}
          onGuardado={(id, falhou) => { marcar(id, falhou); setEdicao(null); carregar(); }}
        />
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <button className="btn" type="button" onClick={() => setEdicao({})}>+ Nova sessão</button>
          <a className="btn sm" href="https://calendar.google.com/calendar" target="_blank" rel="noopener noreferrer">Abrir Google Calendar ↗</a>
        </div>
      )}
      {sessoes.length === 0 && !edicao && <div className="dica">Ainda não há sessões{clienteId ? " para este cliente" : ""}.</div>}
      {proximas.length > 0 && <><div className="grpcab">Próximas <span className="ct">{proximas.length}</span></div><div className="lista">{proximas.map(linha)}</div></>}
      {outras.length > 0 && (
        <details className="grp"><summary>Passadas e canceladas <span className="ct">{outras.length}</span></summary>
          <div className="conteudo lista">{outras.map(linha)}</div></details>
      )}
    </div>
  );
}
