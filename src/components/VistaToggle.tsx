"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Alternador "Interna / Cliente" (só existe no painel da equipa).
 * O estado vive no URL: ?vista=cliente&cliente=<id>. Em "Cliente" o painel mostra o portal tal como esse cliente o vê, só em leitura.
 */
export function VistaToggle() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [sb] = useState(() => createClient());
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    sb.from("clientes").select("id,nome").order("nome").then((r) => setClientes(r.error ? [] : (r.data as { id: string; nome: string }[])));
  }, [sb]);

  const cliente = sp.get("vista") === "cliente" ? sp.get("cliente") : null;

  function ir(vista: "interna" | "cliente", id?: string) {
    const p = new URLSearchParams(sp.toString());
    p.delete("aba"); p.delete("projeto");
    if (vista === "interna") { p.delete("vista"); p.delete("cliente"); }
    else { p.set("vista", "cliente"); p.set("cliente", id ?? cliente ?? clientes[0]?.id ?? ""); }
    router.push(p.size ? `${pathname}?${p}` : pathname);
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
      <div className="seg" role="group" aria-label="Vista">
        <button type="button" className={"sb" + (!cliente ? " on" : "")} onClick={() => ir("interna")}>Interna</button>
        <button type="button" className={"sb" + (cliente ? " on" : "")} disabled={clientes.length === 0} onClick={() => ir("cliente")}
          title={clientes.length === 0 ? "Cria primeiro um cliente" : "Ver o painel como um cliente"}>Cliente</button>
      </div>
      {cliente && (
        <select className="in mini-in" style={{ width: 170 }} aria-label="Cliente a pré-visualizar" value={cliente} onChange={(e) => ir("cliente", e.target.value)}>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      )}
    </div>
  );
}
