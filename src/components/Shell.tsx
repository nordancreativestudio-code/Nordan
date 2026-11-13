"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PortalView } from "@/components/portal/PortalView";
import { Rail } from "./Rail";
import { Top } from "./Top";

/**
 * Esqueleto do painel. Com ?vista=cliente&cliente=<id> mostra a pré-visualização do portal (só leitura):
 * sem barra lateral, sem cores nem pills da equipa. Usa as mesmas funções da base de dados que o portal real.
 */
export function Shell({ email, children }: { email: string; children: React.ReactNode }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const clienteId = sp.get("vista") === "cliente" ? sp.get("cliente") : null;

  if (clienteId) {
    const voltar = () => {
      const p = new URLSearchParams(sp.toString());
      ["vista", "cliente", "aba", "projeto"].forEach((k) => p.delete(k));
      router.push(p.size ? `${pathname}?${p}` : pathname);
    };
    return (
      <div className="app">
        <div className="main">
          <Top previa />
          <div className="scroll"><PortalView clienteId={clienteId} previa onVoltar={voltar} /></div>
        </div>
      </div>
    );
  }
  return (
    <div className="app">
      <Rail email={email} />
      <div className="main">
        <Top />
        <div className="scroll">{children}</div>
      </div>
    </div>
  );
}
