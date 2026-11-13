import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ToastProvider } from "@/components/Toast";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Portal do cliente" };

/**
 * Portal do cliente. Entra quem está em clientes_utilizadores (cliente) ou na equipa (pré-visualização).
 * Quem não é nem uma coisa nem outra é desligado e vê o aviso no login.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: equipa }, { data: meus, error }] = await Promise.all([
    supabase.rpc("autorizado"),
    supabase.rpc("portal_meus_clientes"),
  ]);
  if (!equipa && (error || !Array.isArray(meus) || meus.length === 0)) redirect("/auth/recusar?motivo=nao-autorizado");

  return (
    <ToastProvider>
    <div className="portal">
      <header className="top">
        <Image src="/brand/icon.png" alt="" width={30} height={30} style={{ borderRadius: 8 }} />
        <h1>Nordan</h1>
        <span className="sub">portal do cliente</span>
        <div className="spacer" />
        <span className="sub">{user.email}</span>
        <form action="/auth/sair" method="post"><button className="btn sm" type="submit">Sair</button></form>
      </header>
      <main className="scroll">{children}</main>
    </div>
    </ToastProvider>
  );
}
