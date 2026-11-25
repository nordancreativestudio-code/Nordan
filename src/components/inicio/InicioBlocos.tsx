"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fmtTempo } from "@/lib/tipos";
import { pc } from "@/components/Equipa";
import { useSaldoVisivel } from "@/components/SaldoOculto";

type Ativo = {
  registo_id: string; utilizador_id: string; nome: string | null; cor: string | null; iniciais: string | null;
  tarefa: string; projeto_id: string; projeto: string; inicio: string; agora: string;
};

/** «Quem está em quê»: quem tem o cronómetro a correr, ao segundo, mais o resumo dos tempos registados. */
export function QuemEmQue({ resumo }: { resumo: string | null }) {
  const [sb] = useState(() => createClient());
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [offset, setOffset] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());

  const ler = useCallback(async () => {
    const r = await sb.rpc("cronometros_ativos");
    if (r.error) return;
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

  return (
    <div className="card">
      <h3>Quem está em quê{ativos.length > 0 && <span className="tot" style={{ color: "var(--lime)" }}>{ativos.length} a correr</span>}</h3>
      {ativos.length === 0 ? (
        <div className="faint" style={{ fontSize: 12, padding: "4px 2px" }}>
          Ninguém está a contar tempo neste momento. Carregue em ▶ numa tarefa — em Projetos — para começar.
        </div>
      ) : (
        ativos.map((a) => (
          <Link key={a.registo_id} href={`/projetos?projeto=${a.projeto_id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", color: "inherit", textDecoration: "none", fontSize: 13 }}>
            <span className="pill" style={pc(a.cor)}><i className="dot on" />{a.nome ?? a.iniciais ?? "Alguém"}</span>
            <span style={{ flex: 1, minWidth: 0 }}>{a.tarefa}<span className="faint"> · {a.projeto}</span></span>
            <span className="num" style={{ color: "var(--lime)" }}>{fmtTempo((agora + offset - Date.parse(a.inicio)) / 1000, true)}</span>
          </Link>
        ))
      )}
      {resumo && <div className="faint" style={{ fontSize: 12, marginTop: 10, paddingTop: 9, borderTop: "1px solid var(--line-soft)" }}>{resumo}</div>}
    </div>
  );
}

/** Bloco de notas partilhado; guarda sozinho 2 s depois de parar de escrever. */
export function BlocoNotas({ inicial, existe }: { inicial: string; existe: boolean }) {
  const [sb] = useState(() => createClient());
  const [texto, setTexto] = useState(inicial);
  const [estado, setEstado] = useState("Guarda sozinho, dois segundos depois de parar de escrever.");
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);

  function mudar(v: string) {
    setTexto(v);
    setEstado("A guardar…");
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(async () => {
      const { data: u } = await sb.auth.getUser();
      const r = await sb.from("notas_painel").upsert({ id: 1, texto: v, atualizado_em: new Date().toISOString(), atualizado_por: u.user?.id ?? null });
      setEstado(r.error ? `Não foi possível guardar: ${r.error.message}` : "Guardado às " + new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }));
    }, 2000);
  }

  return (
    <div className="card">
      <h3>Bloco de notas</h3>
      {existe ? (
        <>
          <textarea className="in" rows={6} value={texto} onChange={(e) => mudar(e.target.value)}
            placeholder="Apontamentos, lembretes, o que combinaram ao telefone…" style={{ width: "100%", resize: "vertical" }} />
          <span className="faint" style={{ display: "block", fontSize: 11, marginTop: 6 }}>{estado}</span>
        </>
      ) : (
        <div className="faint" style={{ fontSize: 12 }}>Falta correr a migração <b>0015_bloco_notas.sql</b> no SQL Editor do Supabase.</div>
      )}
    </div>
  );
}

/** Lucro por mês (só movimentos liquidados). Com os valores escondidos, as barras ficam mas os números não. */
export function GraficoLucro({ meses }: { meses: { rotulo: string; v: number }[] }) {
  const { visivel } = useSaldoVisivel();
  const max = Math.max(1, ...meses.map((m) => Math.abs(m.v)));
  const H = 110;
  return (
    <div className="card">
      <h3>Lucro por mês · 12 meses</h3>
      <div style={{ display: "flex", alignItems: "stretch", gap: 4, height: H * 2 + 18 }}>
        {meses.map((m) => {
          const h = Math.round((Math.abs(m.v) / max) * H);
          return (
            <div key={m.rotulo} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }} title={visivel ? `${m.rotulo}: ${m.v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}` : m.rotulo}>
              <div style={{ height: H, display: "flex", alignItems: "flex-end", width: "100%", justifyContent: "center" }}>
                {m.v > 0 && <div style={{ width: "70%", height: h, background: "var(--lime)", borderRadius: 4 }} />}
              </div>
              <div style={{ height: H, display: "flex", alignItems: "flex-start", width: "100%", justifyContent: "center", borderTop: "1px solid var(--line)" }}>
                {m.v < 0 && <div style={{ width: "70%", height: h, background: "var(--coral)", borderRadius: 4 }} />}
              </div>
              <div className="faint" style={{ fontSize: 10, height: 18, lineHeight: "18px", whiteSpace: "nowrap" }}>
                {m.rotulo}
              </div>
            </div>
          );
        })}
      </div>
      <div className="faint" style={{ fontSize: 11, marginTop: 8, display: "flex", gap: 12 }}>
        <span style={{ color: "var(--lime)" }}>■ positivo</span><span style={{ color: "var(--coral)" }}>■ negativo</span>
        <span>só movimentos liquidados{visivel ? " · passe o rato numa barra para ver o valor" : ""}</span>
      </div>
    </div>
  );
}
