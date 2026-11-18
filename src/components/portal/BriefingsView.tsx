"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { TITULO_FORM, dataPt, mesRotulo, tabelaEmFalta } from "@/lib/tipos";

type Linha = {
  id: string; tipo: string; mes: string | null; estado: string; enviado_em: string | null; lido_em: string | null;
  respostas: { pergunta_id: string; pergunta: string; resposta: string | null }[];
  projetos: { nome: string; clientes: { nome: string } | null } | null;
};

/** Tudo o que os clientes preencheram no portal (briefing, feedback, planeamento), num só sítio. */
export function BriefingsView() {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"por_ler" | "todos">("por_ler");

  const ler = useCallback(async () => {
    const r = await sb.from("formularios_respostas")
      .select("id,tipo,mes,estado,enviado_em,lido_em,respostas,projetos(nome,clientes(nome))")
      .order("enviado_em", { ascending: false, nullsFirst: false });
    if (r.error) { setErro(tabelaEmFalta(r.error) ? "Falta correr as migrações do portal." : r.error.message); setLinhas([]); return; }
    setLinhas(r.data as unknown as Linha[]);
  }, [sb]);
  useEffect(() => { Promise.resolve().then(ler); }, [ler]);

  async function lido(id: string) {
    const u = await sb.auth.getUser();
    const r = await sb.from("formularios_respostas").update({ lido_em: new Date().toISOString(), lido_por: u.data.user?.id ?? null }).eq("id", id);
    if (r.error) return toast("Erro: " + r.error.message);
    ler();
  }

  if (!linhas) return <div className="dica">A carregar…</div>;
  const enviados = linhas.filter((l) => l.estado === "enviado");
  const porLer = enviados.filter((l) => !l.lido_em);
  const lista = filtro === "por_ler" ? porLer : linhas;

  return (
    <>
      <div className="bar-ferr">
        <div className="seg" role="tablist">
          <button type="button" className={"sb" + (filtro === "por_ler" ? " on" : "")} onClick={() => setFiltro("por_ler")}>Por ler ({porLer.length})</button>
          <button type="button" className={"sb" + (filtro === "todos" ? " on" : "")} onClick={() => setFiltro("todos")}>Todos ({linhas.length})</button>
        </div>
      </div>
      {erro && <div className="dica" style={{ color: "var(--coral)" }}>{erro}</div>}
      {lista.length === 0 && !erro && (
        <div className="card"><div className="empty"><b>{filtro === "por_ler" ? "Nada por ler" : "Ainda sem respostas"}</b>
          Quando um cliente enviar um briefing ou feedback no portal, aparece aqui.</div></div>
      )}
      {lista.map((r) => (
        <details className="msg" key={r.id} style={{ marginBottom: 8 }}>
          <summary style={{ cursor: "pointer", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ fontWeight: 500 }}>{r.projetos?.clientes?.nome ?? "Sem cliente"} · {r.projetos?.nome ?? "Projeto"}</b>
            <span className="pill">{TITULO_FORM[r.tipo] ?? r.tipo}{r.mes ? ` · ${mesRotulo(r.mes)}` : ""}</span>
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
