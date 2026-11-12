import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/** Destino do link enviado por email: troca o código/token por uma sessão. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();
  let erro: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    erro = error?.message ?? null;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    erro = error?.message ?? null;
  } else {
    erro = "Link inválido";
  }

  if (erro) {
    const url = new URL("/login", origin);
    url.searchParams.set("erro", "link");
    return NextResponse.redirect(url);
  }
  return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", origin));
}
