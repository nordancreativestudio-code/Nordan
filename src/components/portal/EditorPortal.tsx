"use client";

import { Fragment, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { TITULO_FORM } from "@/lib/tipos";
import { EditorLista } from "./EditorLista";
import { CAMPOS_BLOCO, CAMPOS_PAGINA, CAMPOS_PERGUNTA, CAMPOS_WORKFLOW } from "./campos";

const ABAS = ["Workflow", "Formulários", "Ferramentas e Comunicação"] as const;

/** Título e frase de abertura de um formulário */
function Cabecalho({ tipo }: { tipo: string }) {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const [f, setF] = useState<{ titulo: string; frase_abertura: string | null } | null>(null);
  useEffect(() => {
    sb.from("formularios").select("titulo,frase_abertura").eq("tipo", tipo).maybeSingle().then((r) => setF(r.data));
  }, [sb, tipo]);
  async function guarda(campo: "titulo" | "frase_abertura", v: string) {
    const valor = v.trim() || null;
    if (campo === "titulo" && !valor) return;
    const r = await sb.from("formularios").update({ [campo]: valor }).eq("tipo", tipo);
    if (r.error) toast("Erro: " + r.error.message);
  }
  if (!f) return null;
  return (
    <div className="grid" style={{ gap: 8, marginBottom: 12 }}>
      <div className="fld"><label>Título do formulário</label>
        <input className="in" defaultValue={f.titulo} onBlur={(e) => guarda("titulo", e.target.value)} /></div>
      <div className="fld"><label>Frase de abertura</label>
        <textarea className="in" defaultValue={f.frase_abertura ?? ""} onBlur={(e) => guarda("frase_abertura", e.target.value)} /></div>
    </div>
  );
}

/** Editor interno do que o cliente lê no portal. */
export function EditorPortal() {
  const [aba, setAba] = useState<(typeof ABAS)[number]>("Workflow");
  const [form, setForm] = useState<"planeamento_mensal" | "briefing" | "feedback">("planeamento_mensal");
  return (
    <>
      <div className="bar-ferr">
        <div className="seg" role="tablist">
          {ABAS.map((a) => (
            <button key={a} type="button" role="tab" aria-selected={aba === a} className={"sb" + (aba === a ? " on" : "")} onClick={() => setAba(a)}>{a}</button>
          ))}
        </div>
      </div>
      {aba === "Workflow" && (
        <div className="card">
          <h3>Modelo de workflow</h3>
          <p className="dica" style={{ margin: "0 0 10px" }}>
            Cada projeto novo recebe uma cópia destes passos (por projeto, editas na gaveta do projeto). Alterar aqui não muda projetos que já existem.
            A aba Workflow do portal desenha este fluxo, por fases. Numa decisão, escolhe o passo a que o “Não” volta.
          </p>
          <EditorLista tabela="workflow_modelo" campos={CAMPOS_WORKFLOW} placeholder="Novo passo…" />
        </div>
      )}
      {aba === "Formulários" && (
        <div className="card">
          <div className="seg" style={{ marginBottom: 12 }}>
            {(["planeamento_mensal", "briefing", "feedback"] as const).map((t) => (
              <button key={t} type="button" className={"sb" + (form === t ? " on" : "")} onClick={() => setForm(t)}>{TITULO_FORM[t]}</button>
            ))}
          </div>
          <Fragment key={form}>
            <Cabecalho tipo={form} />
            <h3>Perguntas</h3>
            <EditorLista tabela="formularios_modelo" filtro={{ tipo: form }} campos={CAMPOS_PERGUNTA} placeholder="Nova pergunta…"
              vazio={<div className="dica">Sem perguntas. O cliente só vê o formulário quando houver pelo menos uma.</div>} />
          </Fragment>
        </div>
      )}
      {aba === "Ferramentas e Comunicação" && (
        <>
          <div className="card">
            <h3>Ferramentas e Comunicação</h3>
            <EditorLista
              tabela="conteudo_portal" filtro={{ pagina: "ferramentas_comunicacao" }} campos={CAMPOS_PAGINA} placeholder="Nova secção (título)…"
              filho={(l) => (
                <>
                  <div className="cap">Blocos (links do Drive)</div>
                  <EditorLista tabela="conteudo_portal_blocos" filtro={{ conteudo_portal_id: l.id }} campos={CAMPOS_BLOCO} placeholder="Novo bloco (título)…"
                    vazio={<div className="dica">Sem blocos.</div>} />
                </>
              )}
            />
          </div>
          <p className="dica">No fim desta aba o cliente vê “Fala connosco”, com os contactos de Definições → Contactos.</p>
        </>
      )}
    </>
  );
}
