export const ESTADOS = ["Para fazer", "Em andamento", "Standby", "Em aprovação", "Concluído"] as const;
export type Estado = (typeof ESTADOS)[number];
export const PRIORIDADES = ["Baixa", "Média", "Alta", "Urgente"] as const;
export const RESPONSAVEIS = ["André", "Nuno", "Ambos", "Outro"] as const;
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
  nif: string | null; localidade: string | null; notas: string | null;
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
  mostrar_tempo_ao_cliente?: boolean;
};
export type Registo = { tarefa_id: string; utilizador_id: string; inicio: string; fim: string | null };

/** 3725 s → "1h 2m" */
export const fmtTempo = (seg: number) => {
  const m = Math.floor(Math.max(0, seg) / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

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
