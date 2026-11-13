"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";

export type Pessoa = { email: string; nome: string | null; cor: string | null; iniciais: string | null; utilizador_id: string | null };
type Ctx = {
  pessoas: Pessoa[]; meuId: string | null; semMigracao: boolean; recarregar: () => void;
  corDeNome: (nome?: string | null) => string | null;
  corDeId: (id?: string | null) => string | null;
};
const C = createContext<Ctx>({
  pessoas: [], meuId: null, semMigracao: false, recarregar: () => {}, corDeNome: () => null, corDeId: () => null,
});
export const useEquipa = () => useContext(C);

/** Passa a cor da pessoa ao CSS (variável --pc). Sem cor, o CSS usa o valor neutro/por omissão. */
export const pc = (cor?: string | null) => (cor ? ({ "--pc": cor } as CSSProperties) : undefined);

/**
 * Equipa (cores e iniciais) para todo o painel + ligação em tempo real:
 * qualquer alteração em registos_tempo, feita por qualquer conta, dispara "nordan:cronometro".
 */
export function EquipaProvider({ children }: { children: React.ReactNode }) {
  const [sb] = useState(() => createClient());
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [semMigracao, setSemMigracao] = useState(false);

  const ler = useCallback(async () => {
    const [e, u] = await Promise.all([sb.rpc("equipa"), sb.auth.getUser()]);
    setSemMigracao(!!e.error);
    setPessoas(e.error ? [] : (e.data as Pessoa[]));
    setMeuId(u.data.user?.id ?? null);
  }, [sb]);

  useEffect(() => {
    Promise.resolve().then(ler);
    const ch = sb
      .channel("painel")
      .on("postgres_changes", { event: "*", schema: "public", table: "registos_tempo" }, () =>
        window.dispatchEvent(new Event("nordan:cronometro")))
      .on("postgres_changes", { event: "*", schema: "public", table: "utilizadores_autorizados" }, () => ler())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, ler]);

  const valor = useMemo<Ctx>(() => ({
    pessoas, meuId, semMigracao, recarregar: ler,
    corDeNome: (nome) => (nome ? pessoas.find((p) => p.nome === nome)?.cor ?? null : null),
    corDeId: (id) => (id ? pessoas.find((p) => p.utilizador_id === id)?.cor ?? null : null),
  }), [pessoas, meuId, semMigracao, ler]);

  return <C.Provider value={valor}>{children}</C.Provider>;
}
