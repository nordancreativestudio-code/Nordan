import { Shell } from "@/components/Shell";
import { VerificaCronometro } from "@/components/VerificaCronometro";
import { EquipaProvider } from "@/components/Equipa";
import { ToastProvider } from "@/components/Toast";
import { exigirAutorizado } from "@/lib/autorizacao";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await exigirAutorizado();
  return (
    <ToastProvider>
      <EquipaProvider>
        <Shell email={user.email ?? ""}>{children}</Shell>
        <VerificaCronometro />
      </EquipaProvider>
    </ToastProvider>
  );
}
