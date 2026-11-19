/** Tudo o que tem data no calendário. Datas em "AAAA-MM-DD" (dia na hora de Lisboa). */
export type TipoItem = "sessao" | "projeto" | "tarefa" | "contacto" | "reuniao" | "financas" | "google";

export const TIPOS_ITEM: { k: TipoItem; rotulo: string; porDefeito: boolean }[] = [
  { k: "sessao", rotulo: "Sessões com clientes", porDefeito: true },
  { k: "projeto", rotulo: "Prazos de projetos", porDefeito: true },
  { k: "tarefa", rotulo: "Prazos de tarefas", porDefeito: true },
  { k: "contacto", rotulo: "Contactos de leads", porDefeito: true },
  { k: "reuniao", rotulo: "Reuniões de leads", porDefeito: true },
  { k: "financas", rotulo: "Finanças por pagar/receber", porDefeito: false },
  { k: "google", rotulo: "Google Calendar", porDefeito: true },
];
export const ROTULO_TIPO: Record<TipoItem, string> = Object.fromEntries(TIPOS_ITEM.map((t) => [t.k, t.rotulo])) as Record<TipoItem, string>;
const ORDEM_TIPO = TIPOS_ITEM.map((t) => t.k);

export type Item = {
  key: string; tipo: TipoItem; data: string; hora: string | null;
  titulo: string; sub: string | null;
  /** pendente e já passou da data */
  atrasado: boolean;
  /** rota para onde ir ao clicar (o item "sessao" abre o editor no próprio calendário) */
  destino: string | null; sessaoId?: string;
  /** link externo (evento no Google Calendar), abre noutro separador */
  externo?: string | null;
};

export const ordenar = (a: Item, b: Item) =>
  (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99") || ORDEM_TIPO.indexOf(a.tipo) - ORDEM_TIPO.indexOf(b.tipo) || a.titulo.localeCompare(b.titulo, "pt");

const TZ = "Europe/Lisbon";
export const hojeLisboa = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
export const dataLisboa = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ });

const utc = (d: string) => new Date(d + "T12:00:00Z");
export const somaDias = (d: string, n: number) => new Date(utc(d).getTime() + n * 86_400_000).toISOString().slice(0, 10);

/** Células da vista mensal (semana a começar à segunda-feira): 5 ou 6 semanas. mes0 = 0..11 */
export function celulasMes(ano: number, mes0: number): string[] {
  const primeiro = new Date(Date.UTC(ano, mes0, 1, 12));
  const desvio = (primeiro.getUTCDay() + 6) % 7; // segunda = 0
  const dias = new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();
  const n = Math.ceil((desvio + dias) / 7) * 7;
  const ini = primeiro.getTime() - desvio * 86_400_000;
  return Array.from({ length: n }, (_, i) => new Date(ini + i * 86_400_000).toISOString().slice(0, 10));
}

export const DIAS_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
export const rotuloMesAno = (ano: number, mes0: number) => {
  const t = new Date(Date.UTC(ano, mes0, 1, 12)).toLocaleDateString("pt-PT", { month: "long", year: "numeric", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const rotuloDia = (d: string) => {
  const t = utc(d).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
