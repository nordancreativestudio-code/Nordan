import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Garante que há sessão E que o email está na lista de autorizados
 * (tabela public.utilizadores_autorizados, via função public.autorizado()).
 * Quem não está autorizado é desligado e enviado para o login com aviso.
 */
export async function exigirAutorizado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: autorizado, error } = await supabase.rpc("autorizado");
  if (error) {
    // A função ainda não existe na base de dados (migração por correr).
    redirect("/login?erro=migracao");
  }
  if (!autorizado) {
    await supabase.auth.signOut();
    redirect("/login?erro=nao-autorizado");
  }
  return { supabase, user };
}
