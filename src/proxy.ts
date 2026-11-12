import { type NextRequest } from "next/server";
import { atualizarSessao } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  // Tudo menos ficheiros estáticos, fontes, marca e ícones.
  matcher: ["/((?!_next/static|_next/image|fonts|brand|favicon.ico|icon.png|apple-icon.png).*)"],
};
