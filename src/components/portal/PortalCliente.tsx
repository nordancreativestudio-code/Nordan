"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PortalView } from "./PortalView";

/** Portal real: escolhe o cliente ao qual este login pertence e mostra o portal. */
export function PortalCliente() {
  const [sb] = useState(() => createClient());
  const [meus, setMeus] = useState<{ cliente_id: string; nome: string }[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    sb.rpc("portal_meus_clientes").then((r) => {
      const l = r.error ? [] : (r.data as { cliente_id: string; nome: string }[]);
      setMeus(l);
      setSel(l[0]?.cliente_id ?? null);
    });
  }, [sb]);
  if (!meus) return <div className="dica">A carregar…</div>;
  if (!sel) return <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}><div className="empty"><b>Sem acesso ao portal</b>Se és da equipa, usa a “Vista do cliente” no painel.</div></div>;
  return (
    <>
      {meus.length > 1 && (
        <div className="fld" style={{ maxWidth: 280, marginBottom: 12 }}><label>Cliente</label>
          <select className="in" value={sel} onChange={(e) => setSel(e.target.value)}>
            {meus.map((m) => <option key={m.cliente_id} value={m.cliente_id}>{m.nome}</option>)}
          </select></div>
      )}
      <PortalView clienteId={sel} previa={false} />
    </>
  );
}
