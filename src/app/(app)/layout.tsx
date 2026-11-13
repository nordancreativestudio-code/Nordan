import { Rail } from "@/components/Rail";
import { Top } from "@/components/Top";
import { VerificaCronometro } from "@/components/VerificaCronometro";
import { EquipaProvider } from "@/components/Equipa";
import { ToastProvider } from "@/components/Toast";
import { exigirAutorizado } from "@/lib/autorizacao";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await exigirAutorizado();
  return (
    <ToastProvider>
    <EquipaProvider>
    <div className="app">
      <Rail email={user.email ?? ""} />
      <div className="main">
        <Top />
        <div className="scroll">{children}</div>
      </div>
    </div>
    <VerificaCronometro />
    </EquipaProvider>
    </ToastProvider>
  );
}
