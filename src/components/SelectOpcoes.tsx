"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NOVO = "__novo__";

/** Select com lista guardada na base (tabela opcoes) e "+ Adicionar novo…" que fica gravado. */
export function SelectOpcoes({
  lista, valor, onChange, fallback = [], vazio = "—",
}: {
  lista: string; valor: string; onChange: (v: string) => void; fallback?: string[]; vazio?: string | null;
}) {
  const [sb] = useState(() => createClient());
  const [itens, setItens] = useState<string[]>(fallback);
  const [novo, setNovo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    sb.from("opcoes").select("valor").eq("lista", lista).order("ordem").order("valor")
      .then(({ data }) => { if (vivo && data && data.length) setItens(data.map((r) => r.valor as string)); });
    return () => { vivo = false; };
  }, [sb, lista]);

  async function guardar() {
    const v = (novo ?? "").trim();
    if (!v) return;
    const ja = itens.find((i) => i.toLowerCase() === v.toLowerCase());
    if (!ja) {
      const { error } = await sb.from("opcoes").upsert({ lista, valor: v, ordem: itens.length + 1 }, { onConflict: "lista,valor", ignoreDuplicates: true });
      if (error) { setErro("Não foi possível gravar a opção."); return; }
      setItens((l) => [...l, v]);
    }
    onChange(ja ?? v); setNovo(null); setErro(null);
  }

  if (novo !== null) return (
    <div>
      <div style={{ display: "flex", gap: 6 }}>
        <input className="in" autoFocus value={novo} placeholder="Nova opção"
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardar(); } if (e.key === "Escape") setNovo(null); }} />
        <button className="btn" type="button" onClick={guardar}>Guardar</button>
        <button className="btn" type="button" onClick={() => { setNovo(null); setErro(null); }}>×</button>
      </div>
      {erro && <div className="sub" style={{ color: "var(--coral)" }}>{erro}</div>}
    </div>
  );

  return (
    <select className="in" value={valor} onChange={(e) => (e.target.value === NOVO ? setNovo("") : onChange(e.target.value))}>
      {vazio !== null && <option value="">{vazio}</option>}
      {valor && !itens.includes(valor) && <option>{valor}</option>}
      {itens.map((s) => <option key={s}>{s}</option>)}
      <option value={NOVO}>+ Adicionar novo…</option>
    </select>
  );
}
