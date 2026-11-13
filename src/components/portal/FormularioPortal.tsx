"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { dataPt, mesRotulo } from "@/lib/tipos";

type Pergunta = { pergunta_id: string; pergunta: string; ajuda: string | null; tipo_campo: "texto" | "texto_longo" | "escala"; obrigatoria: boolean; resposta: string | null };
type Dados = {
  formulario: { tipo: string; titulo: string; frase_abertura: string | null; mensal: boolean };
  mes: string | null; estado: "novo" | "rascunho" | "enviado"; enviado_em: string | null; perguntas: Pergunta[];
};

/** Formulário do portal (briefing, feedback ou planeamento mensal). `previa` = só leitura. */
export function FormularioPortal({ projetoId, tipo, mes, previa }: { projetoId: string; tipo: string; mes: string | null; previa: boolean }) {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const [d, setD] = useState<Dados | null | undefined>(undefined);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const ler = useCallback(async () => {
    const r = await sb.rpc("portal_formulario", { p_projeto: projetoId, p_tipo: tipo, p_mes: mes });
    const x = r.error ? null : (r.data as Dados | null);
    setD(x);
    setVals(Object.fromEntries((x?.perguntas ?? []).map((p) => [p.pergunta_id, p.resposta ?? ""])));
  }, [sb, projetoId, tipo, mes]);
  useEffect(() => { Promise.resolve().then(ler); }, [ler]);

  async function guardar(enviar: boolean) {
    setErro(null);
    setOcupado(true);
    const r = await sb.rpc("portal_guardar_formulario", { p_projeto: projetoId, p_tipo: tipo, p_mes: mes, p_respostas: vals, p_enviar: enviar });
    setOcupado(false);
    if (r.error) return setErro(r.error.message);
    toast(enviar ? "Formulário enviado" : "Guardado");
    ler();
  }

  if (d === undefined) return <div className="dica">A carregar…</div>;
  if (!d) return <div className="card"><div className="empty"><b>Formulário indisponível</b>Não foi possível abrir este formulário.</div></div>;
  if (d.perguntas.length === 0) return <div className="card"><div className="empty"><b>{d.formulario.titulo}</b>Ainda não há perguntas neste formulário.</div></div>;

  const enviado = d.estado === "enviado";
  return (
    <div className="card formulario">
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>{d.formulario.titulo}</h2>
      {d.formulario.frase_abertura && <p style={{ margin: "0 0 6px", color: "var(--moss)" }}>{d.formulario.frase_abertura}</p>}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "6px 0 14px" }}>
        {d.mes && <span className="pill">{mesRotulo(d.mes)}</span>}
        {enviado ? <span className="pill lime">Enviado a {dataPt(d.enviado_em)}</span>
          : d.estado === "rascunho" ? <span className="pill amber">Rascunho</span> : <span className="pill">Por preencher</span>}
      </div>
      <div className="grid" style={{ gap: 16 }}>
        {d.perguntas.map((p, i) => (
          <div className="fld" key={p.pergunta_id}>
            <label htmlFor={"q" + p.pergunta_id} style={{ textTransform: "none", letterSpacing: "-0.02em", fontSize: 14, color: "var(--mist)", fontWeight: 500 }}>
              {i + 1}. {p.pergunta}{p.obrigatoria && " *"}
            </label>
            {p.tipo_campo === "escala" ? (
              <div className="seg">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" disabled={previa} className={"sb" + (vals[p.pergunta_id] === String(n) ? " on" : "")}
                    onClick={() => setVals((v) => ({ ...v, [p.pergunta_id]: String(n) }))}>{n}</button>
                ))}
              </div>
            ) : p.tipo_campo === "texto" ? (
              <input id={"q" + p.pergunta_id} className="in" disabled={previa} value={vals[p.pergunta_id] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [p.pergunta_id]: e.target.value }))} />
            ) : (
              <textarea id={"q" + p.pergunta_id} className="in" style={{ minHeight: 96 }} disabled={previa} value={vals[p.pergunta_id] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [p.pergunta_id]: e.target.value }))} />
            )}
            {p.ajuda && <div className="dica">{p.ajuda}</div>}
          </div>
        ))}
      </div>
      {erro && <p className="erro-box" style={{ marginTop: 12 }}>{erro}</p>}
      {previa ? <p className="dica" style={{ marginTop: 14 }}>Pré-visualização: só leitura.</p> : (
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {enviado
            ? <button className="btn pri" type="button" disabled={ocupado} onClick={() => guardar(true)}>Guardar alterações</button>
            : <>
                <button className="btn" type="button" disabled={ocupado} onClick={() => guardar(false)}>Guardar rascunho</button>
                <button className="btn pri" type="button" disabled={ocupado} onClick={() => guardar(true)}>Enviar</button>
              </>}
        </div>
      )}
    </div>
  );
}
