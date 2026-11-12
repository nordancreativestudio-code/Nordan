import { EmBreve } from "@/components/EmBreve";

export default function Inicio() {
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid kpis">
        <div className="kpi hi"><div className="v num">0</div><div className="n">Projetos ativos</div></div>
        <div className="kpi"><div className="v num">0 €</div><div className="n">Faturado este mês</div></div>
        <div className="kpi"><div className="v num">0 €</div><div className="n">Despesas este mês</div></div>
        <div className="kpi"><div className="v num">0</div><div className="n">Leads em aberto</div></div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span className="pill lime">Ligado ao Supabase</span>
        <span className="pill amber">Em aprovação</span>
        <span className="pill coral">Urgente</span>
        <span className="pill sky">Reunião</span>
        <span className="pill">Para fazer</span>
      </div>
      <EmBreve titulo="Passo 1 concluído" texto="Projeto, login por email, guarda de sessão e tokens de design. As secções entram uma a uma." />
    </div>
  );
}
