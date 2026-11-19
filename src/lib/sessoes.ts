export const ESTADOS_SESSAO = ["marcada", "cancelada", "realizada"] as const;
export const ROTULO_ESTADO: Record<string, string> = { marcada: "Marcada", cancelada: "Cancelada", realizada: "Realizada" };
export const TIPOS_SESSAO = ["Reunião", "Onboarding", "Planeamento", "Gravação", "Ponto de situação", "Entrega"];

export type Sessao = {
  id: string; cliente_id: string; projeto_id: string | null; titulo: string; tipo: string | null;
  inicio: string; fim: string | null; local_ou_link: string | null; nota_cliente: string | null;
  estado: (typeof ESTADOS_SESSAO)[number]; google_event_id: string | null;
};

/** "12/11/2026 · 15:00" na hora de Lisboa */
export const dataHoraPt = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" })
    .replace(", ", " · ");
export const horaPt = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" });
/** "quinta-feira, 12/11/2026" */
export const diaPt = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Lisbon" });

export type RespostaGoogle = { ok: boolean; erro?: string; acao?: string; convidados?: number };

/** Pede ao servidor para sincronizar (POST) ou remover (DELETE) o evento no Google Calendar. A sessão já está gravada. */
export async function googleSessao(id: string, metodo: "POST" | "DELETE"): Promise<RespostaGoogle> {
  try {
    const r = await fetch(`/api/sessoes/${id}/google`, { method: metodo });
    const j = (await r.json().catch(() => null)) as RespostaGoogle | null;
    return j ?? { ok: false, erro: "Resposta inesperada do servidor." };
  } catch {
    return { ok: false, erro: "Sem ligação ao servidor." };
  }
}
