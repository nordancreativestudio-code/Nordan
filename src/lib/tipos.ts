export const ESTADOS = ["Para fazer", "Em andamento", "Standby", "Em aprovação", "Concluído"] as const;
export type Estado = (typeof ESTADOS)[number];
export const PRIORIDADES = ["Baixa", "Média", "Alta", "Urgente"] as const;
export const RESPONSAVEIS = ["André", "Nuno", "Ambos", "Outro"] as const;
/** Cores de pessoa sugeridas no ecrã Equipa (o lima e o coral estão reservados). */
export const PALETA_PESSOAS = ["#55D3FF", "#FFC93C", "#B48CFF", "#FF8FC7", "#5CE0B0", "#FF9F5A"];
export const MARCAS = ["Nordan Creative", "Nordan Family"];
export const TIPOS = ["Fotografia", "Vídeo", "Edição", "Marketing", "Social", "Impressão", "Reunião", "Outro"];
export const SETORES = [
  "Restauração", "Retalho", "Estética & Beleza", "Saúde & Bem-estar", "Imobiliário",
  "Indústria & B2B", "Eventos", "Institucional", "Outro",
];
export const ESTADOS_CLIENTE = ["Ativo", "Pontual", "Inativo"] as const;

export type Cliente = {
  id: string; nome: string; setor: string | null; estado: (typeof ESTADOS_CLIENTE)[number];
  contacto: string | null; telefone: string | null; email: string | null; web: string | null;
  nif: string | null; localidade: string | null; notas: string | null; avenca?: boolean; historico_visivel?: boolean;
};
export type Projeto = {
  id: string; cliente_id: string | null; nome: string; estado: Estado;
  prioridade: (typeof PRIORIDADES)[number]; responsavel: (typeof RESPONSAVEIS)[number];
  marca: string | null; tipo: string | null; inicio: string | null; prazo: string | null;
  prazo_estimado: string | null; link_entrega: string | null; notas: string | null;
  ordem: number; visivel_ao_cliente: boolean;
};
export type Tarefa = {
  id: string; projeto_id: string; titulo: string; concluida: boolean; prazo: string | null;
  prazo_estimado: string | null; ordem: number; visivel_ao_cliente: boolean;
  mostrar_tempo_ao_cliente?: boolean; responsavel?: string | null; descricao?: string | null;
};
export type Registo = { id: string; tarefa_id: string; utilizador_id: string; inicio: string; fim: string | null };
export type TempoTarefa = { tarefa_id: string; projeto_id: string; segundos: number; abertos: number };

/** 3725 s → "1h 2m"; com segundos (cronómetro a correr) → "1h 02m 05s" */
export const fmtTempo = (seg: number, comSegundos = false) => {
  const t = Math.floor(Math.max(0, seg));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  if (!comSegundos) return h ? `${h}h ${m}m` : `${m}m`;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}h ${p(m)}m ${p(s)}s` : `${m}m ${p(s)}s`;
};
/** ISO → valor de <input type="datetime-local"> na hora local, e o inverso */
export const paraInputLocal = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
export const deInputLocal = (v: string) => new Date(v).toISOString();

/** "" → null, texto aparado */
export const nul = (v: unknown) => {
  if (typeof v !== "string") return v ?? null;
  const t = v.trim();
  return t === "" ? null : t;
};
export const tabelaEmFalta = (e: { code?: string; message?: string }) =>
  e.code === "PGRST205" || e.code === "42P01" || /does not exist|schema cache/i.test(e.message ?? "");
export const dataCurta = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-PT", { day: "2-digit", month: "short" }).replace(".", "") : "";

/** "2026-11-12" → "12/11/2026"; timestamps → data na hora de Lisboa */
export const dataPt = (v?: string | null) => {
  if (!v) return "";
  if (v.length === 10) { const [y, m, d] = v.split("-"); return `${d}/${m}/${y}`; }
  return new Date(v).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Lisbon" });
};
/** só aceita links http(s); evita javascript: e afins em dados editáveis */
export const linkSeguro = (u?: string | null) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);
/** 936 309 455 → https://wa.me/351936309455 (9 dígitos = Portugal; outros números com indicativo) */
export const linkWhatsApp = (tel?: string | null) => {
  const d = (tel ?? "").replace(/\D/g, "");
  if (!d) return null;
  return `https://wa.me/${d.length === 9 ? "351" + d : d.replace(/^00/, "")}`;
};
export const linkEmail = (e?: string | null) => (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) ? `mailto:${e.trim()}` : null);
/** primeiro dia do mês (hoje + n meses), como "2026-12-01" */
export const primeiroDoMes = (n: number) => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
export const mesRotulo = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
export const TITULO_FORM: Record<string, string> = { briefing: "Briefing", feedback: "Feedback final", planeamento_mensal: "Planeamento mensal" };
