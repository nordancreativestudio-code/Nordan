import { exigirEquipaApi } from "@/lib/api-auth";
import { GoogleErro, listarEventos } from "@/lib/google-calendar";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const DIA = 86_400_000;

/** GET /api/google/eventos?de=AAAA-MM-DD&ate=AAAA-MM-DD — eventos do Google Calendar da Nordan (só leitura, só equipa). */
export async function GET(req: Request) {
  const a = await exigirEquipaApi(req);
  if ("erro" in a) return a.erro;
  const u = new URL(req.url);
  const de = u.searchParams.get("de") ?? "", ate = u.searchParams.get("ate") ?? "";
  if (!DATA.test(de) || !DATA.test(ate)) return Response.json({ ok: false, erro: "Datas inválidas." }, { status: 400 });
  const t0 = Date.parse(de + "T00:00:00Z"), t1 = Date.parse(ate + "T00:00:00Z");
  if (!(t1 >= t0) || t1 - t0 > 62 * DIA) return Response.json({ ok: false, erro: "Intervalo inválido." }, { status: 400 });
  try {
    // margem de 1 dia para cada lado por causa do fuso; o ecrã só usa os dias que mostra
    const eventos = await listarEventos(new Date(t0 - DIA).toISOString(), new Date(t1 + 2 * DIA).toISOString());
    return Response.json({ ok: true, eventos });
  } catch (e) {
    const g = e instanceof GoogleErro;
    if (!g) console.error("[google/eventos]", e instanceof Error ? e.message : "erro desconhecido");
    return Response.json({ ok: false, erro: g ? e.message : "Erro inesperado ao falar com o Google." }, { status: g && e.naoConfigurado ? 503 : 502 });
  }
}
