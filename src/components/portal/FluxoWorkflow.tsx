"use client";

export type PassoModelo = {
  id: string; fase: string | null; numero: string | null; titulo: string; frase: string | null;
  tipo: "nordan" | "cliente" | "juntos" | "marco" | "decisao"; ligacao_nao: string | null; legenda_nao: string | null;
};

const LEGENDA: [string, string][] = [
  ["nordan", "Nordan"], ["cliente", "Cliente"], ["juntos", "Juntos"], ["marco", "Marco / decisão"],
];

/**
 * Fluxo por fases. Nordan: lima a 8%; cliente: creme; juntos: verde Nordan; marco e decisão: lima.
 * A decisão é um losango e o "Não" é uma seta tracejada que volta ao passo indicado.
 * `atual` marca o passo em que o projeto está; `feitos` os já concluídos.
 */
export function FluxoWorkflow({
  modelo, atual, feitos, avenca, onFormulario,
}: {
  modelo: PassoModelo[]; atual: string | null; feitos: Set<string>; avenca: boolean; onFormulario: () => void;
}) {
  const fases = [...new Set(modelo.map((m) => m.fase ?? ""))];
  return (
    <div className="fluxo">
      <div className="fl-legenda" aria-label="Legenda">
        {LEGENDA.map(([t, l]) => (
          <span key={t} className="fl-chip"><i className={"fl-amostra tipo-" + (t === "marco" ? "marco" : t)} />{l}</span>
        ))}
        <span className="fl-chip"><i className="fl-seta-leg" />Seguinte</span>
        <span className="fl-chip"><i className="fl-seta-leg tr" />Volta atrás</span>
      </div>

      {fases.map((fase) => {
        const passos = modelo.filter((m) => (m.fase ?? "") === fase);
        return (
          <section className="fl-fase" key={fase || "_"}>
            {fase && <h3 className="fl-titulo">{fase}</h3>}
            <div className="fl-grid" style={{ ["--n" as string]: passos.length }}>
              {passos.map((p) => (
                <div className="fl-item" key={p.id}>
                  <div className={"fl-card tipo-" + p.tipo + (atual === p.id ? " atual" : "") + (feitos.has(p.id) ? " feito" : "")}>
                    {atual === p.id && <span className="fl-aqui">Estamos aqui</span>}
                    {p.numero && <span className="fl-num num">{p.numero}</span>}
                    <b className="fl-t">{p.titulo}</b>
                    {p.frase && <span className="fl-f">{p.frase}</span>}
                    {p.tipo === "cliente" && <span className="fl-tua">a tua parte</span>}
                    {feitos.has(p.id) && <span className="fl-ok" aria-label="feito">✓</span>}
                  </div>
                </div>
              ))}
              {passos.map((p, i) => {
                const j = p.ligacao_nao ? passos.findIndex((x) => x.id === p.ligacao_nao) : -1;
                if (p.tipo !== "decisao" || j < 0 || j > i) return null;
                const span = i - j + 1;
                return (
                  <div className="fl-volta" key={"v" + p.id} style={{ gridColumn: `${j + 1} / span ${span}`, ["--s" as string]: span }}>
                    <span>{p.legenda_nao ?? "Não: voltamos atrás"}</span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {avenca && (
        <section className="fl-fase">
          <h3 className="fl-titulo">Todos os meses</h3>
          <div className="fl-card tipo-marco fl-mensal">
            <b className="fl-t">Antes de produzir, perguntamos.</b>
            <span className="fl-f">Clientes com avença: preenches o planeamento do mês seguinte.</span>
            <button className="btn sm" type="button" onClick={onFormulario}>Abrir formulário</button>
          </div>
        </section>
      )}
    </div>
  );
}
