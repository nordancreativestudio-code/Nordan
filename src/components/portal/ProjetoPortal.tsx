"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { EditorLista } from "./EditorLista";
import { CAMPOS_CONTEUDO, CAMPOS_PASSO, ESTADOS_CONTEUDO } from "./campos";

type Coment = { id: string; tipo: string; texto: string | null; estado_de: string | null; estado_para: string | null; autor_nome: string | null; autor_tipo: string | null; criado_em: string };
type Resp = { id: string; tipo: string; pergunta_texto: string; resposta: string | null; atualizado_em: string };
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" });

/** Conversa de um conteúdo: comentários e mudanças de estado, com autor e data. */
function Conversa({ conteudoId }: { conteudoId: string }) {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const [itens, setItens] = useState<Coment[] | null>(null);
  const [texto, setTexto] = useState("");

  const ler = useCallback(async () => {
    const r = await sb.from("comentarios").select("*").eq("conteudo_id", conteudoId).order("criado_em");
    setItens(r.error ? [] : (r.data as Coment[]));
  }, [sb, conteudoId]);
  useEffect(() => { Promise.resolve().then(ler); }, [ler]);

  async function comentar() {
    const t = texto.trim();
    if (!t) return;
    const r = await sb.from("comentarios").insert({ conteudo_id: conteudoId, texto: t });
    if (r.error) return toast("Erro: " + r.error.message);
    setTexto("");
    ler();
  }

  return (
    <details className="conversa">
      <summary>Conversa e histórico{itens ? ` (${itens.length})` : ""}</summary>
      {itens?.map((c) => (
        <div className={"msg " + (c.autor_tipo ?? "")} key={c.id}>
          <div className="quem"><b>{c.autor_nome ?? "?"}</b> · {c.autor_tipo === "cliente" ? "cliente" : "equipa"} · {quando(c.criado_em)}</div>
          {c.tipo === "mudanca_estado"
            ? <div className="dica">mudou o estado de “{ESTADOS_CONTEUDO[c.estado_de ?? ""] ?? c.estado_de}” para “{ESTADOS_CONTEUDO[c.estado_para ?? ""] ?? c.estado_para}”</div>
            : <div>{c.texto}</div>}
        </div>
      ))}
      <div className="enovo">
        <input className="in" placeholder="Comentar (o cliente vê)…" value={texto} onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); comentar(); } }} />
        <button className="btn" type="button" onClick={comentar}>Comentar</button>
      </div>
    </details>
  );
}

/** Respostas do cliente ao briefing e ao feedback (só leitura). */
function Respostas({ projetoId }: { projetoId: string }) {
  const [sb] = useState(() => createClient());
  const [rs, setRs] = useState<Resp[] | null>(null);
  useEffect(() => {
    sb.from("formularios_respostas").select("id,tipo,pergunta_texto,resposta,atualizado_em").eq("projeto_id", projetoId).order("criado_em")
      .then((r) => setRs(r.error ? [] : (r.data as Resp[])));
  }, [sb, projetoId]);
  if (!rs) return <div className="dica">A carregar…</div>;
  return (
    <>
      {(["briefing", "feedback"] as const).map((tipo) => {
        const l = rs.filter((r) => r.tipo === tipo && r.resposta);
        return (
          <div key={tipo} style={{ marginBottom: 10 }}>
            <div className="cap" style={{ marginBottom: 6 }}>{tipo === "briefing" ? "Briefing" : "Feedback final"}</div>
            {l.length === 0 ? <div className="dica">O cliente ainda não respondeu.</div> : l.map((r) => (
              <div className="msg" key={r.id}>
                <div className="quem">{r.pergunta_texto}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{r.resposta}</div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

/** Blocos do portal dentro da gaveta de um projeto: timings, conteúdos para aprovação e formulários. */
export function ProjetoPortal({ projetoId }: { projetoId: string }) {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const [versao, setVersao] = useState(0);

  async function aplicar() {
    const r = await sb.rpc("aplicar_workflow", { p_projeto: projetoId });
    if (r.error) return toast("Erro: " + r.error.message);
    setVersao((v) => v + 1);
  }

  return (
    <>
      <details className="grp">
        <summary>Timings por fase</summary>
        <div className="conteudo">
          <div className="dica">O passo atual é o primeiro sem data em “Feito em”. O cliente vê esta linha do tempo.</div>
          <EditorLista
            tabela="projeto_passos" filtro={{ projeto_id: projetoId }} campos={CAMPOS_PASSO} placeholder="Novo passo…" versao={versao}
            classeLinha={(l, todas) => (l.data_real ? "feito" : todas.find((x) => !x.data_real)?.id === l.id ? "atual" : "")}
            vazio={<div className="enovo"><span className="dica" style={{ flex: 1 }}>Este projeto ainda não tem passos.</span>
              <button className="btn" type="button" onClick={aplicar}>Aplicar o workflow</button></div>}
          />
        </div>
      </details>
      <details className="grp">
        <summary>Conteúdos para aprovação</summary>
        <div className="conteudo">
          <EditorLista
            tabela="conteudos" filtro={{ projeto_id: projetoId }} campos={CAMPOS_CONTEUDO} placeholder="Novo conteúdo (título)…"
            classeLinha={(l) => "est-" + String(l.estado)}
            filho={(l) => <Conversa key={String(l.estado)} conteudoId={l.id} />}
          />
        </div>
      </details>
      <details className="grp">
        <summary>Briefing e feedback</summary>
        <div className="conteudo"><Respostas projetoId={projetoId} /></div>
      </details>
    </>
  );
}
