"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { fmtTempo } from "@/lib/tipos";

type Atual = { id: string; tarefa_id: string; inicio: string; confirmado_em: string | null; devido_em: string | null; agora: string };
const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" });

/**
 * Verificação das 20:00: se a pessoa tem um cronómetro a correr à noite, pergunta se ainda está a trabalhar.
 * Se não responder em 30 min, a base de dados pára o cronómetro à hora da pergunta (migração 0004).
 */
export function VerificaCronometro() {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const [atual, setAtual] = useState<Atual | null>(null);
  const [nome, setNome] = useState("");
  const [offset, setOffset] = useState(0); // relógio do servidor − relógio deste computador
  const [agora, setAgora] = useState(() => Date.now());
  const [hora, setHora] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const ler = useCallback(async () => {
    const r = await sb.rpc("cronometro_atual");
    const a = r.error ? null : ((r.data as Atual[] | null)?.[0] ?? null);
    setAtual(a);
    if (!a) return setNome("");
    setOffset(Date.parse(a.agora) - Date.now());
    const t = await sb.from("tarefas").select("titulo,projetos(nome)").eq("id", a.tarefa_id).maybeSingle();
    const d = t.data as { titulo: string; projetos: { nome: string } | { nome: string }[] | null } | null;
    const proj = Array.isArray(d?.projetos) ? d?.projetos[0]?.nome : d?.projetos?.nome;
    setNome(d ? `${d.titulo}${proj ? ` (${proj})` : ""}` : "uma tarefa");
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

  const devido = atual?.devido_em ? Date.parse(atual.devido_em) : null;
  if (!atual || devido == null || agora + offset < devido) return null;

  async function responder(acao: "continuar" | "parar" | "parei") {
    setOcupado(true);
    let r;
    if (acao === "continuar") r = await sb.rpc("confirmar_cronometro");
    else if (acao === "parar") r = await sb.rpc("parar_cronometro");
    else {
      const [h, m] = hora.split(":").map(Number);
      const f = new Date();
      f.setHours(h, m, 0, 0);
      if (f.getTime() > Date.now()) f.setDate(f.getDate() - 1);
      r = await sb.rpc("parar_cronometro", { p_fim: f.toISOString() });
    }
    setOcupado(false);
    if (r.error) return toast("Erro: " + r.error.message);
    toast(acao === "continuar" ? "Boa, o cronómetro continua" : "Cronómetro parado");
    window.dispatchEvent(new Event("nordan:cronometro"));
    ler();
  }

  return (
    <>
      <div className="scrim on" style={{ zIndex: 70 }} />
      <div className="modal on" style={{ zIndex: 71, width: "min(460px,94vw)" }} role="alertdialog" aria-label="Verificação do cronómetro">
        <header><h2>Ainda estás a trabalhar?</h2></header>
        <div className="mbody" style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 14 }}>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            O cronómetro de <b>{nome || "uma tarefa"}</b> continua a contar há{" "}
            <b className="num">{fmtTempo((agora + offset - Date.parse(atual.inicio)) / 1000)}</b>.
          </p>
          <p className="dica" style={{ margin: 0 }}>
            Se não responderes até às {hhmm(devido + 30 * 60_000)}, pára sozinho e o tempo fica contado só até às {hhmm(devido)}.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn pri" type="button" disabled={ocupado} onClick={() => responder("continuar")}>Sim, continuo</button>
            <button className="btn" type="button" disabled={ocupado} onClick={() => responder("parar")}>Parar agora</button>
          </div>
          <div className="fld"><label htmlFor="parei">Ou parei às</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="parei" className="in" type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ maxWidth: 140 }} />
              <button className="btn" type="button" disabled={ocupado || !hora} onClick={() => responder("parei")}>Registar</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
