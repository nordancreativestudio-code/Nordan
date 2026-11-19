import { exigirEquipaApi } from "@/lib/api-auth";
import { GoogleErro, apagarEvento, atualizarEvento, criarEvento } from "@/lib/google-calendar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx = { params: Promise<{ id: string }> };

function falha(e: unknown) {
  const g = e instanceof GoogleErro;
  if (!g) console.error("[sessoes/google]", e instanceof Error ? e.message : "erro desconhecido");
  return Response.json(
    { ok: false, erro: g ? e.message : "Erro inesperado ao falar com o Google." },
    { status: g && e.naoConfigurado ? 503 : 502 },
  );
}

/**
 * Sincroniza a sessão com o Google Calendar (a sessão já está gravada na base):
 * marcada → cria ou atualiza o evento e envia o convite (sendUpdates=all);
 * cancelada → apaga o evento (os convidados são avisados); realizada → nada a enviar.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ ok: false, erro: "Sessão inválida." }, { status: 400 });
  const a = await exigirEquipaApi(req);
  if ("erro" in a) return a.erro;
  const { supabase } = a;

  const { data: s, error } = await supabase.from("sessoes").select("*").eq("id", id).maybeSingle();
  if (error || !s) return Response.json({ ok: false, erro: "Sessão não encontrada." }, { status: 404 });

  try {
    if (s.estado === "cancelada") {
      if (s.google_event_id) {
        await apagarEvento(s.google_event_id);
        await supabase.from("sessoes").update({ google_event_id: null }).eq("id", id);
      }
      return Response.json({ ok: true, acao: "cancelada", convidados: 0 });
    }
    if (s.estado === "realizada") return Response.json({ ok: true, acao: "nenhuma", convidados: 0 });

    const { data: cu } = await supabase.from("clientes_utilizadores").select("email").eq("cliente_id", s.cliente_id);
    const convidados = [...new Set((cu ?? []).map((r) => (r.email as string).toLowerCase()))];
    const dados = { titulo: s.titulo, inicio: s.inicio, fim: s.fim, local: s.local_ou_link, nota: s.nota_cliente, convidados };

    const novoId = s.google_event_id ? await atualizarEvento(s.google_event_id, dados) : await criarEvento(dados);
    if (novoId !== s.google_event_id) {
      const u = await supabase.from("sessoes").update({ google_event_id: novoId }).eq("id", id);
      if (u.error) return Response.json({ ok: false, erro: "O convite seguiu, mas não foi possível gravar o id do evento." }, { status: 500 });
    }
    return Response.json({ ok: true, acao: s.google_event_id ? "atualizada" : "criada", convidados: convidados.length });
  } catch (e) {
    return falha(e);
  }
}

/** Remove o evento do Google (usado antes de apagar a sessão). */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ ok: false, erro: "Sessão inválida." }, { status: 400 });
  const a = await exigirEquipaApi(req);
  if ("erro" in a) return a.erro;
  const { data: s } = await a.supabase.from("sessoes").select("google_event_id").eq("id", id).maybeSingle();
  if (!s?.google_event_id) return Response.json({ ok: true });
  try {
    await apagarEvento(s.google_event_id);
    return Response.json({ ok: true });
  } catch (e) {
    return falha(e);
  }
}
