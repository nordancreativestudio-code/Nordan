import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dataCurta, tabelaEmFalta } from "@/lib/tipos";

type Linha = {
  id: string; nome: string; estado: string; prioridade: string; responsavel: string;
  prazo: string | null; prazo_estimado: string | null;
  clientes: { nome: string } | { nome: string }[] | null;
};

const nomeCliente = (c: Linha["clientes"]) => (Array.isArray(c) ? c[0]?.nome : c?.nome) ?? "Sem cliente";
const PILL: Record<string, string> = { Urgente: "coral", Alta: "amber" };

export default async function Inicio() {
  const sb = await createClient();
  const [pj, tf] = await Promise.all([
    sb.from("projetos")
      .select("id,nome,estado,prioridade,responsavel,prazo,prazo_estimado,clientes(nome)")
      .neq("estado", "Concluído")
      .order("ordem"),
    sb.from("tarefas").select("projeto_id,concluida"),
  ]);
  if (pj.error && !tabelaEmFalta(pj.error)) throw new Error(pj.error.message);

  const projetos = (pj.data ?? []) as unknown as Linha[];
  const porEstado = (e: string) => projetos.filter((p) => p.estado === e);
  const emTrabalho = porEstado("Em andamento");
  const emAprovacao = porEstado("Em aprovação");

  // progresso (tarefas concluídas / total) por projeto
  const prog = new Map<string, { t: number; c: number }>();
  for (const t of tf.data ?? []) {
    const x = prog.get(t.projeto_id) ?? { t: 0, c: 0 };
    x.t += 1; if (t.concluida) x.c += 1;
    prog.set(t.projeto_id, x);
  }

  const bloco = (titulo: string, lista: Linha[], vazio: string) => (
    <div className="card">
      <h3>{titulo}<span className="tot">{lista.length}</span></h3>
      {lista.length === 0 ? (
        <div className="empty" style={{ padding: "18px 0" }}>{vazio}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {lista.map((p) => {
            const g = prog.get(p.id);
            const pct = g && g.t ? Math.round((g.c / g.t) * 100) : 0;
            const prazo = p.prazo ?? p.prazo_estimado;
            return (
              <Link
                key={p.id}
                href="/projetos"
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 2px",
                  borderBottom: "1px solid var(--line-soft)", fontSize: 13, color: "inherit", textDecoration: "none",
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontWeight: 500 }}>{p.nome}</b>
                  <span className="faint" style={{ display: "block", fontSize: 11 }}>{nomeCliente(p.clientes)}</span>
                </span>
                {g && g.t > 0 && <span className="faint" style={{ fontSize: 11 }}>{g.c}/{g.t} · {pct}%</span>}
                {PILL[p.prioridade] && <span className={`pill ${PILL[p.prioridade]}`}>{p.prioridade}</span>}
                <span className="pill">{p.responsavel}</span>
                {prazo && <span className="faint" style={{ fontSize: 11, minWidth: 48, textAlign: "right" }}>{dataCurta(prazo)}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid kpis">
        <Link href="/projetos" className="kpi hi clic" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="v num">{emTrabalho.length}</div><div className="n">Projetos em trabalho</div>
        </Link>
        <div className="kpi"><div className="v num">{emAprovacao.length}</div><div className="n">Em aprovação do cliente</div></div>
        <div className="kpi"><div className="v num">{porEstado("Para fazer").length}</div><div className="n">Para fazer</div></div>
        <div className="kpi"><div className="v num">{porEstado("Standby").length}</div><div className="n">Em standby</div></div>
      </div>
      <div className="grid two">
        {bloco("Em trabalho agora", emTrabalho, "Nenhum projeto em andamento. Move um cartão para «Em andamento» em Projetos.")}
        {bloco("Em aprovação do cliente", emAprovacao, "Nada à espera de aprovação.")}
      </div>
    </div>
  );
}
