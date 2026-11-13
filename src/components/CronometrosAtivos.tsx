"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fmtTempo } from "@/lib/tipos";
import { pc, useEquipa } from "./Equipa";
import { CronometroAtivo } from "./CronometroAtivo";

type Ativo = {
  registo_id: string; utilizador_id: string; nome: string | null; cor: string | null; iniciais: string | null;
  tarefa: string; projeto_id: string; projeto: string; inicio: string; agora: string;
};

/** Barra superior: uma pill por cada pessoa com cronómetro a correr. Sem cronómetros, nada. */
export function CronometrosAtivos() {
  const [sb] = useState(() => createClient());
  const router = useRouter();
  const { meuId } = useEquipa();
  const [ativos, setAtivos] = useState<Ativo[] | null>(null); // null = função ainda não existe (migração 0006)
  const [offset, setOffset] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());

  const ler = useCallback(async () => {
    const r = await sb.rpc("cronometros_ativos");
    if (r.error) return setAtivos(null);
    const l = r.data as Ativo[];
    if (l[0]) setOffset(Date.parse(l[0].agora) - Date.now());
    setAtivos(l);
  }, [sb]);

  useEffect(() => {
    Promise.resolve().then(ler);
    const i = setInterval(ler, 60_000);
    const t = setInterval(() => setAgora(Date.now()), 1000);
    window.addEventListener("focus", ler);
    window.addEventListener("nordan:cronometro", ler);
    return () => {
      clearInterval(i); clearInterval(t);
      window.removeEventListener("focus", ler);
      window.removeEventListener("nordan:cronometro", ler);
    };
  }, [ler]);

  if (ativos === null) return <CronometroAtivo />;

  async function pausar() {
    await sb.rpc("parar_cronometro");
    window.dispatchEvent(new Event("nordan:cronometro"));
  }

  return (
    <div className="cronativos">
      {ativos.map((a) => (
        <div className="cronativo" key={a.registo_id} style={pc(a.cor)}>
          <button type="button" className="abre" onClick={() => router.push(`/projetos?projeto=${a.projeto_id}`)}
            title={`${a.nome ?? "?"} · ${a.tarefa} · ${a.projeto}`}>
            <i className="dot on" />
            <b>{a.iniciais ?? "?"}</b>
            <span className="nm">{a.tarefa}<small> · {a.projeto}</small></span>
            <span className="cron num on">{fmtTempo((agora + offset - Date.parse(a.inicio)) / 1000, true)}</span>
          </button>
          {a.utilizador_id === meuId && (
            <button className="crb on" type="button" onClick={pausar} aria-label="Pausar o meu cronómetro" title="Pausar">❚❚</button>
          )}
        </div>
      ))}
    </div>
  );
}
