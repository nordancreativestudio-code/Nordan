import { createClient } from "@/lib/supabase/server";

/**
 * Para Route Handlers: só utilizadores com sessão E na lista de autorizados (public.autorizado()).
 * Devolve o cliente Supabase (com a sessão de quem pede, por isso a RLS continua a aplicar-se)
 * ou uma Response de erro pronta a devolver.
 */
export async function exigirEquipaApi(req: Request) {
  // proteção CSRF simples: pedidos vindos de outro site são recusados
  const origem = req.headers.get("origin");
  if (origem) {
    let host = "";
    try { host = new URL(origem).host; } catch { /* origem inválida */ }
    if (host !== (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))) {
      return { erro: Response.json({ ok: false, erro: "Origem não permitida." }, { status: 403 }) };
    }
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: Response.json({ ok: false, erro: "Sessão terminada." }, { status: 401 }) };
  const { data: autorizado, error } = await supabase.rpc("autorizado");
  if (error || !autorizado) return { erro: Response.json({ ok: false, erro: "Não autorizado." }, { status: 403 }) };
  return { supabase };
}
