"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtTempo } from "@/lib/tipos";

type Atual = { tarefa_id: string; inicio: string; agora: string };

/** Indicador no topo: a tarefa com o meu cronómetro a correr, o tempo ao segundo e o botão de pausa. */
export function CronometroAtivo() {
  const [sb] = useState(() => createClient());
  const [atual, setAtual] = useState<Atual | null>(null);
  const [nome, setNome] = useState("");
  const [offset, setOffset] = useState(0); // relógio do servidor − relógio deste computador
  const [agora, setAgora] = useState(() => Date.now());

  const ler = useCallback(async () => {
    const r = await sb.rpc("cronometro_atual");
    const a = r.error ? null : ((r.data as Atual[] | null)?.[0] ?? null);
    setAtual(a);
    if (!a) return;
    setOffset(Date.parse(a.agora) - Date.now());
    const t = await sb.from("tarefas").select("titulo").eq("id", a.tarefa_id).maybeSingle();
    setNome((t.data as { titulo: string } | null)?.titulo ?? "Tarefa");
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

  if (!atual) return null;

  async function pausar() {
    await sb.rpc("parar_cronometro");
    window.dispatchEvent(new Event("nordan:cronometro"));
  }

  return (
    <div className="cronativo" title={nome}>
      <i className="dot on" />
      <span className="nm">{nome}</span>
      <span className="cron num on">{fmtTempo((agora + offset - Date.parse(atual.inicio)) / 1000, true)}</span>
      <button className="crb on" type="button" onClick={pausar} aria-label="Pausar cronómetro" title="Pausar">❚❚</button>
    </div>
  );
}
