/**
 * Cliente mínimo da Google Calendar API (sem dependências), SÓ para o servidor.
 * As credenciais vêm de variáveis de ambiente (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 * GOOGLE_REFRESH_TOKEN) e nunca saem daqui: nem para o browser, nem para as mensagens de erro.
 * Usa o calendário principal ("primary") da conta a que pertence o refresh token.
 */

const TZ = "Europe/Lisbon";
const BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** Erro seguro para mostrar ao utilizador (nunca inclui tokens). */
export class GoogleErro extends Error {
  constructor(message: string, readonly naoConfigurado = false) { super(message); }
}
class EventoInexistente extends Error {}

export type DadosEvento = {
  titulo: string;
  inicio: string;          // ISO (timestamptz)
  fim: string | null;      // ISO; sem fim → 1 hora
  local: string | null;    // local ou link
  nota: string | null;     // nota ao cliente → descrição
  convidados: string[];    // emails
};

let cache: { token: string; expira: number } | null = null;

async function tokenAcesso(): Promise<string> {
  // tolera erros de colagem (espaços, quebras de linha, aspas à volta) nos valores postos na Vercel
  const limpa = (v?: string) => v?.trim().replace(/^["']|["']$/g, "").trim() || undefined;
  const id = limpa(process.env.GOOGLE_CLIENT_ID), segredo = limpa(process.env.GOOGLE_CLIENT_SECRET), refresh = limpa(process.env.GOOGLE_REFRESH_TOKEN);
  if (!id || !segredo || !refresh) throw new GoogleErro("Google Calendar não está configurado no servidor.", true);
  if (cache && cache.expira > Date.now() + 60_000) return cache.token;
  let r: Response;
  try {
    r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: id, client_secret: segredo, refresh_token: refresh, grant_type: "refresh_token" }),
      cache: "no-store",
    });
  } catch {
    throw new GoogleErro("Não foi possível contactar o Google.");
  }
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!r.ok || !j.access_token) {
    throw new GoogleErro(j.error === "invalid_grant"
      ? "O acesso ao Google expirou ou foi revogado. É preciso gerar um novo refresh token."
      : "O Google recusou a autenticação (" + (j.error ?? r.status) + (j.error_description ? ": " + j.error_description.slice(0, 120) : "") + ")."
        + (j.error === "invalid_client" ? " Verifica GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (completos, sem aspas nem espaços)." : ""));
  }
  cache = { token: j.access_token, expira: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

function corpo(d: DadosEvento) {
  const inicio = new Date(d.inicio);
  const fim = d.fim ? new Date(d.fim) : new Date(inicio.getTime() + 60 * 60_000);
  const local = d.local?.trim() || null;
  const nota = d.nota?.trim() || "";
  const descricao = [nota, local && /^https?:\/\//i.test(local) ? `Link: ${local}` : ""].filter(Boolean).join("\n\n");
  return {
    summary: d.titulo,
    location: local ?? "",
    description: descricao,
    start: { dateTime: inicio.toISOString(), timeZone: TZ },
    end: { dateTime: fim.toISOString(), timeZone: TZ },
    attendees: d.convidados.map((email) => ({ email })),
    // lembretes do organizador: 1 dia e 1 hora antes. Os convidados usam os lembretes do seu próprio Google Calendar.
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 }, { method: "popup", minutes: 24 * 60 },
        { method: "email", minutes: 60 }, { method: "popup", minutes: 60 },
      ],
    },
  };
}

async function pedir(metodo: "POST" | "PATCH" | "DELETE", id: string | null, corpoJson?: unknown): Promise<{ id?: string }> {
  const token = await tokenAcesso();
  let r: Response;
  try {
    r = await fetch(`${BASE}${id ? "/" + encodeURIComponent(id) : ""}?sendUpdates=all`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, ...(corpoJson ? { "Content-Type": "application/json" } : {}) },
      body: corpoJson ? JSON.stringify(corpoJson) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new GoogleErro("Não foi possível contactar o Google.");
  }
  if (r.status === 404 || r.status === 410) throw new EventoInexistente();
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new GoogleErro("O Google recusou o pedido: " + (j.error?.message ?? r.status).toString().slice(0, 200));
  }
  return metodo === "DELETE" ? {} : ((await r.json()) as { id?: string });
}

/** Cria o evento e devolve o id. */
export async function criarEvento(d: DadosEvento): Promise<string> {
  const r = await pedir("POST", null, corpo(d));
  if (!r.id) throw new GoogleErro("O Google não devolveu o id do evento.");
  return r.id;
}

/** Atualiza o evento; se já não existir no Google, cria um novo. Devolve o id final. */
export async function atualizarEvento(id: string, d: DadosEvento): Promise<string> {
  try {
    await pedir("PATCH", id, corpo(d));
    return id;
  } catch (e) {
    if (e instanceof EventoInexistente) return criarEvento(d);
    throw e;
  }
}

/** Apaga o evento (avisa os convidados). Se já não existir, conta como feito. */
export async function apagarEvento(id: string): Promise<void> {
  try { await pedir("DELETE", id); } catch (e) { if (!(e instanceof EventoInexistente)) throw e; }
}

export type EventoGoogle = {
  id: string; titulo: string;
  /** dia inteiro: "AAAA-MM-DD" (fim exclusivo); com hora: ISO */
  inicio: string; fim: string | null; diaInteiro: boolean;
  local: string | null; link: string | null;
};

/** Eventos do calendário principal entre duas datas ISO (só leitura). Ignora cancelados e os recusados pela conta. */
export async function listarEventos(timeMin: string, timeMax: string): Promise<EventoGoogle[]> {
  const token = await tokenAcesso();
  const out: EventoGoogle[] = [];
  let pagina: string | undefined;
  for (let i = 0; i < 4; i++) {
    const q = new URLSearchParams({
      timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250", showDeleted: "false",
      fields: "nextPageToken,items(id,status,summary,start,end,location,htmlLink,attendees(self,responseStatus))",
    });
    if (pagina) q.set("pageToken", pagina);
    let r: Response;
    try {
      r = await fetch(`${BASE}?${q}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    } catch {
      throw new GoogleErro("Não foi possível contactar o Google.");
    }
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new GoogleErro("O Google recusou o pedido: " + (j.error?.message ?? r.status).toString().slice(0, 200));
    }
    const j = (await r.json()) as {
      nextPageToken?: string;
      items?: { id: string; status?: string; summary?: string; location?: string; htmlLink?: string;
        start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string };
        attendees?: { self?: boolean; responseStatus?: string }[] }[];
    };
    for (const e of j.items ?? []) {
      if (e.status === "cancelled" || !e.start) continue;
      if (e.attendees?.some((a) => a.self && a.responseStatus === "declined")) continue;
      const diaInteiro = !!e.start.date;
      const inicio = e.start.date ?? e.start.dateTime;
      if (!inicio) continue;
      out.push({
        id: e.id, titulo: e.summary?.trim() || "(sem título)", inicio, diaInteiro,
        fim: (e.end?.date ?? e.end?.dateTime) ?? null, local: e.location?.trim() || null, link: e.htmlLink ?? null,
      });
    }
    pagina = j.nextPageToken;
    if (!pagina) break;
  }
  return out;
}
