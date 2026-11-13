import { RESPONSAVEIS } from "@/lib/tipos";
import type { Campo } from "./EditorLista";

export const ESTADOS_CONTEUDO: Record<string, string> = {
  para_aprovacao: "Para aprovação", alteracoes_pedidas: "Alterações pedidas", aprovado: "Aprovado",
};
export const COR_ESTADO_CONTEUDO: Record<string, string> = { para_aprovacao: "amber", alteracoes_pedidas: "coral", aprovado: "lime" };
export const TIPOS_PASSO: [string, string][] = [
  ["nordan", "Tipo: Nordan"], ["cliente", "Tipo: cliente"], ["juntos", "Tipo: juntos"], ["marco", "Tipo: marco"], ["decisao", "Tipo: decisão"],
];

export const CAMPOS_WORKFLOW: Campo[] = [
  { k: "titulo", label: "Passo" },
  { k: "fase", label: "Fase", curto: true },
  { k: "numero", label: "Nº", curto: true },
  { k: "tipo", label: "Tipo", tipo: "select", opcoes: TIPOS_PASSO },
  { k: "frase", label: "Frase que o cliente lê neste passo" },
  { k: "ligacao_nao", label: "Se a resposta for Não, volta a", tipo: "select",
    opcoesDe: (ls) => [["", "Decisão: volta a —"], ...ls.map((l) => [l.id, `Volta a: ${String(l.numero ?? "")} ${String(l.titulo ?? "")}`.trim()] as [string, string])] },
  { k: "legenda_nao", label: "Legenda do Não (só nas decisões)" },
];
export const CAMPOS_PASSO: Campo[] = [
  { k: "titulo", label: "Passo" },
  { k: "tipo", label: "Tipo", tipo: "select", opcoes: TIPOS_PASSO },
  { k: "data_prevista", label: "Previsto", tipo: "data" },
  { k: "data_real", label: "Feito em", tipo: "data" },
];
export const CAMPOS_PERGUNTA: Campo[] = [
  { k: "pergunta", label: "Pergunta" },
  { k: "ajuda", label: "Texto de ajuda (opcional)" },
  { k: "tipo_campo", label: "Tipo de resposta", tipo: "select", opcoes: [["texto_longo", "Resposta longa"], ["texto", "Resposta curta"], ["escala", "Escala de 1 a 5"]] },
  { k: "obrigatoria", label: "Obrigatória", tipo: "check" },
];
export const CAMPOS_PAGINA: Campo[] = [
  { k: "titulo", label: "Título" },
  { k: "texto", label: "Texto", tipo: "area" },
];
export const CAMPOS_BLOCO: Campo[] = [
  { k: "titulo", label: "Título do bloco" },
  { k: "tipo", label: "Tipo", tipo: "select", opcoes: [["link", "Link"], ["video", "Vídeo"], ["ficheiro", "Ficheiro"]] },
  { k: "url_drive", label: "Link do Google Drive", tipo: "url" },
  { k: "descricao", label: "Descrição (opcional)" },
];
export const CAMPOS_CONTEUDO: Campo[] = [
  { k: "titulo", label: "Conteúdo" },
  { k: "tipo", label: "Tipo", tipo: "select", opcoes: ["Vídeo", "Foto", "Texto", "Design"].map((t) => [t, t]) },
  { k: "estado", label: "Estado", tipo: "select", opcoes: Object.entries(ESTADOS_CONTEUDO) },
  { k: "responsavel", label: "Responsável", tipo: "select", opcoes: [["", "Responsável"], ...RESPONSAVEIS.map((r) => [r, r] as [string, string])] },
  { k: "link_drive", label: "Link do Google Drive", tipo: "url" },
];
