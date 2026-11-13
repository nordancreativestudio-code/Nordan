"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { linkSeguro } from "@/lib/tipos";
import { COR_ESTADO_CONTEUDO, ESTADOS_CONTEUDO } from "./campos";

export type Conteudo = { id: string; titulo: string; tipo: string; estado: string; responsavel: string | null; link_drive: string | null; comentarios: number };
type Msg = { id: string; tipo: string; texto: string | null; estado_de: string | null; estado_para: string | null; autor_nome: string | null; autor_tipo: string | null; criado_em: string };
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" });

/** Cartão de um conteúdo para aprovação: link, conversa e os botões Aprovar / Pedir alterações. */
export function ConteudoPortal({ c, previa, onMudou }: { c: Conteudo; previa: boolean; onMudou: () => void }) {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const ler = useCallback(async () => {
    const r = await sb.rpc("portal_comentarios", { p_conteudo: c.id });
    setMsgs(r.error ? [] : (r.data as Msg[]));
  }, [sb, c.id]);
  useEffect(() => { if (aberto) Promise.resolve().then(ler); }, [aberto, ler]);

  async function agir(acao: "aprovar" | "pedir_alteracoes" | "comentar") {
    setErro(null);
    if (acao === "pedir_alteracoes" && !texto.trim()) return setErro("Para pedir alterações, escreve o que queres mudar.");
    if (acao === "comentar" && !texto.trim()) return;
    setOcupado(true);
    const r = acao === "comentar"
      ? await sb.rpc("portal_comentar", { p_conteudo: c.id, p_texto: texto })
      : await sb.rpc("portal_responder_conteudo", { p_conteudo: c.id, p_acao: acao, p_comentario: texto.trim() || null });
    setOcupado(false);
    if (r.error) return setErro(r.error.message);
    setTexto("");
    toast(acao === "aprovar" ? "Conteúdo aprovado" : acao === "pedir_alteracoes" ? "Pedido de alterações enviado" : "Comentário enviado");
    ler();
    onMudou();
  }

  const link = linkSeguro(c.link_drive);
  return (
    <div className={"cont est-" + c.estado}>
      <button type="button" className="cont-cab" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        <span className="cont-t">{c.titulo}</span>
        <span className="pill">{c.tipo}</span>
        <span className={"pill " + (COR_ESTADO_CONTEUDO[c.estado] ?? "")}>{ESTADOS_CONTEUDO[c.estado] ?? c.estado}</span>
      </button>
      {aberto && (
        <div className="cont-corpo">
          {link ? <a className="btn sm" href={link} target="_blank" rel="noopener noreferrer">Abrir no Drive ↗</a> : <span className="dica">Ainda sem link.</span>}
          <div className="cap">Conversa</div>
          {msgs === null ? <div className="dica">A carregar…</div> : msgs.length === 0 ? <div className="dica">Sem mensagens.</div> : msgs.map((m) => (
            <div className={"msg " + (m.autor_tipo ?? "")} key={m.id}>
              <div className="quem"><b>{m.autor_nome ?? "?"}</b> · {quando(m.criado_em)}</div>
              {m.tipo === "mudanca_estado"
                ? <div className="dica">mudou o estado para “{ESTADOS_CONTEUDO[m.estado_para ?? ""] ?? m.estado_para}”</div>
                : <div style={{ whiteSpace: "pre-wrap" }}>{m.texto}</div>}
            </div>
          ))}
          {previa ? <p className="dica">Pré-visualização: só leitura.</p> : (
            <>
              <textarea className="in" placeholder="Escreve um comentário ou o que queres alterar…" value={texto} onChange={(e) => setTexto(e.target.value)} />
              {erro && <p className="erro-box" style={{ margin: 0 }}>{erro}</p>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" type="button" disabled={ocupado || !texto.trim()} onClick={() => agir("comentar")}>Comentar</button>
                <button className="btn pri" type="button" disabled={ocupado || c.estado === "aprovado"} onClick={() => agir("aprovar")}>Aprovar</button>
                <button className="btn" type="button" disabled={ocupado} onClick={() => agir("pedir_alteracoes")}>Pedir alterações</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
