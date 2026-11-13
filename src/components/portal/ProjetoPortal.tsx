"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { TITULO_FORM, dataPt, mesRotulo, primeiroDoMes } from "@/lib/tipos";
import { EditorLista } from "./EditorLista";
import { CAMPOS_CONTEUDO, CAMPOS_PASSO, ESTADOS_CONTEUDO } from "./campos";

type Coment = { id: string; tipo: string; texto: string | null; estado_de: string | null; estado_para: string | null; autor_nome: string | null; autor_tipo: string | null; criado_em: string };
type Resp = {
  id: string; tipo: string; mes: string | null; estado: string; enviado_em: string | null; lido_em: string | null;
  respostas: { pergunta_id: string; pergunta: string; resposta: string | null }[];
};
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

/** Respostas do cliente aos formulários, por mês, com "Lido" e o aviso "A aguardar o cliente". */
function Respostas({ projetoId, clienteId }: { projetoId: string; clienteId: string | null }) {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const [rs, setRs] = useState<Resp[] | null>(null);
  const [avenca, setAvenca] = useState(false);
  const proximo = primeiroDoMes(1);

  const ler = useCallback(async () => {
    const [r, c] = await Promise.all([
      sb.from("formularios_respostas").select("id,tipo,mes,estado,enviado_em,lido_em,respostas").eq("projeto_id", projetoId).order("criado_em", { ascending: false }),
      clienteId ? sb.from("clientes").select("avenca").eq("id", clienteId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setRs(r.error ? [] : (r.data as Resp[]));
    setAvenca(!!(c.data as { avenca?: boolean } | null)?.avenca);
  }, [sb, projetoId, clienteId]);
  useEffect(() => { Promise.resolve().then(ler); }, [ler]);

  async function lido(id: string) {
    const u = await sb.auth.getUser();
    const r = await sb.from("formularios_respostas").update({ lido_em: new Date().toISOString(), lido_por: u.data.user?.id ?? null }).eq("id", id);
    if (r.error) return toast("Erro: " + r.error.message);
    ler();
  }

  if (!rs) return <div className="dica">A carregar…</div>;
  const doMes = rs.find((r) => r.tipo === "planeamento_mensal" && r.mes === proximo);
  return (
    <>
      {avenca && (
        <div className="msg" style={{ borderColor: !doMes || doMes.estado !== "enviado" ? "rgba(255,201,60,.4)" : undefined }}>
          <div className="quem">Planeamento mensal · {mesRotulo(proximo)}</div>
          <div>{!doMes ? "A aguardar o cliente" : doMes.estado === "enviado" ? `Enviado a ${dataPt(doMes.enviado_em)}` : "O cliente tem um rascunho por enviar"}</div>
        </div>
      )}
      {rs.length === 0 && !avenca && <div className="dica">O cliente ainda não respondeu a nenhum formulário.</div>}
      {rs.map((r) => (
        <details className="msg" key={r.id}>
          <summary style={{ cursor: "pointer", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ fontWeight: 500 }}>{TITULO_FORM[r.tipo] ?? r.tipo}{r.mes ? ` · ${mesRotulo(r.mes)}` : ""}</b>
            <span className={"pill " + (r.estado === "enviado" ? "lime" : "amber")}>{r.estado === "enviado" ? `Enviado ${dataPt(r.enviado_em)}` : "Rascunho"}</span>
            {r.estado === "enviado" && (r.lido_em
              ? <span className="dica">Lido a {dataPt(r.lido_em)}</span>
              : <button className="btn sm" type="button" onClick={(e) => { e.preventDefault(); lido(r.id); }}>Marcar lido</button>)}
          </summary>
          {r.respostas.map((x) => (
            <div key={x.pergunta_id} style={{ marginTop: 8 }}>
              <div className="quem">{x.pergunta}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{x.resposta ?? <span className="faint">sem resposta</span>}</div>
            </div>
          ))}
        </details>
      ))}
    </>
  );
}

/** Blocos do portal dentro da gaveta de um projeto: timings, conteúdos para aprovação e formulários. */
export function ProjetoPortal({ projetoId, clienteId }: { projetoId: string; clienteId: string | null }) {
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
        <summary>Formulários do cliente</summary>
        <div className="conteudo"><Respostas projetoId={projetoId} clienteId={clienteId} /></div>
      </details>
    </>
  );
}
