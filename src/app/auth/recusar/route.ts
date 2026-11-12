import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MOTIVOS = ["nao-autorizado", "migracao"];

/**
 * Termina a sessão e manda para o login com o aviso.
 * Tem de ser um Route Handler: só aqui é possível apagar os cookies de sessão
 * (num Server Component o signOut não apaga o cookie e gera o ciclo de redirecionamentos).
 */
export async function GET(request: NextRequest) {
  const motivo = request.nextUrl.searchParams.get("motivo") ?? "nao-autorizado";
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = new URL("/login", request.url);
  url.searchParams.set("erro", MOTIVOS.includes(motivo) ? motivo : "nao-autorizado");
  return NextResponse.redirect(url);
}
