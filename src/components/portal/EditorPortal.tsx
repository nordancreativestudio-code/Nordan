"use client";

import { useState } from "react";
import { EditorLista } from "./EditorLista";
import { CAMPOS_BLOCO, CAMPOS_PAGINA, CAMPOS_PERGUNTA, CAMPOS_WORKFLOW } from "./campos";

const ABAS = ["Workflow", "Formulários", "Ferramentas", "Comunicação"] as const;

/** Editor interno do que o cliente lê no portal. */
export function EditorPortal() {
  const [aba, setAba] = useState<(typeof ABAS)[number]>("Workflow");
  const pagina = (p: string) => (
    <div className="card">
      <h3>{aba}</h3>
      <EditorLista
        key={p} tabela="conteudo_portal" filtro={{ pagina: p }} campos={CAMPOS_PAGINA} placeholder="Nova secção (título)…"
        filho={(l) => (
          <>
            <div className="cap">Blocos (links do Drive)</div>
            <EditorLista tabela="conteudo_portal_blocos" filtro={{ conteudo_portal_id: l.id }} campos={CAMPOS_BLOCO} placeholder="Novo bloco (título)…"
              vazio={<div className="dica">Sem blocos.</div>} />
          </>
        )}
      />
    </div>
  );
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
            Cada projeto novo recebe uma cópia destes passos. Alterar aqui não muda os projetos que já existem. A aba Workflow do portal mostra esta lista.
          </p>
          <EditorLista tabela="workflow_modelo" campos={CAMPOS_WORKFLOW} placeholder="Novo passo…" />
        </div>
      )}
      {aba === "Formulários" && (
        <div className="grid two" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {(["briefing", "feedback"] as const).map((t) => (
            <div className="card" key={t}>
              <h3>{t === "briefing" ? "Briefing" : "Feedback final"}</h3>
              <EditorLista tabela="formularios_modelo" filtro={{ tipo: t }} campos={CAMPOS_PERGUNTA} placeholder="Nova pergunta…"
                vazio={<div className="dica">Sem perguntas. O cliente só vê o formulário quando houver pelo menos uma.</div>} />
            </div>
          ))}
        </div>
      )}
      {aba === "Ferramentas" && pagina("ferramentas")}
      {aba === "Comunicação" && pagina("comunicacao")}
    </>
  );
}
