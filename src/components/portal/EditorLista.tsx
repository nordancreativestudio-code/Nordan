"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";

export type Campo = {
  k: string; label: string;
  tipo?: "texto" | "area" | "select" | "data" | "check" | "url";
  opcoes?: [string, string][];
  opcoesDe?: (linhas: Linha[]) => [string, string][];   // opções que dependem das outras linhas
  curto?: boolean;
};
export type Linha = { id: string; ordem: number } & Record<string, unknown>;

/**
 * Lista editável e reordenável ligada a uma tabela do Supabase (com coluna `ordem`).
 * O primeiro campo é o título da linha; os restantes aparecem por baixo.
 */
export function EditorLista({
  tabela, filtro, campos, placeholder, vazio, filho, classeLinha, versao = 0,
}: {
  tabela: string; filtro?: Record<string, string>; campos: Campo[]; placeholder: string;
  vazio?: ReactNode; filho?: (l: Linha) => ReactNode;
  classeLinha?: (l: Linha, todas: Linha[]) => string; versao?: number;
}) {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState("");
  const chave = JSON.stringify(filtro ?? {});

  const carregar = useCallback(async () => {
    let q = sb.from(tabela).select("*");
    for (const [k, v] of Object.entries(JSON.parse(chave) as Record<string, string>)) q = q.eq(k, v);
    const r = await q.order("ordem").order("criado_em");
    if (r.error) { setErro(r.error.message); setLinhas([]); return; }
    setErro(null);
    setLinhas(r.data as Linha[]);
  }, [sb, tabela, chave]);

  useEffect(() => { Promise.resolve().then(carregar); }, [carregar, versao]);

  async function muda(id: string, k: string, v: unknown) {
    setLinhas((ls) => ls?.map((l) => (l.id === id ? { ...l, [k]: v } : l)) ?? null);
    const r = await sb.from(tabela).update({ [k]: v }).eq("id", id);
    if (r.error) { toast("Erro: " + r.error.message); carregar(); }
  }
  async function adiciona() {
    const t = novo.trim();
    if (!t || !linhas) return;
    const ordem = linhas.length ? Math.max(...linhas.map((l) => l.ordem)) + 1 : 1;
    const r = await sb.from(tabela).insert({ ...(JSON.parse(chave) as object), [campos[0].k]: t, ordem });
    if (r.error) return toast("Erro: " + r.error.message);
    setNovo("");
    carregar();
  }
  async function move(i: number, dir: -1 | 1) {
    if (!linhas) return;
    const j = i + dir;
    if (j < 0 || j >= linhas.length) return;
    const nova = [...linhas];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    const mud = nova.map((l, k) => ({ id: l.id, ordem: k + 1, antes: l.ordem })).filter((m) => m.antes !== m.ordem);
    setLinhas(nova.map((l, k) => ({ ...l, ordem: k + 1 })));
    const rs = await Promise.all(mud.map((m) => sb.from(tabela).update({ ordem: m.ordem }).eq("id", m.id)));
    const e = rs.find((r) => r.error)?.error;
    if (e) { toast("Erro: " + e.message); carregar(); }
  }
  async function apaga(l: Linha) {
    if (!confirm(`Apagar "${String(l[campos[0].k] ?? "")}"?`)) return;
    const r = await sb.from(tabela).delete().eq("id", l.id);
    if (r.error) return toast("Erro: " + r.error.message);
    carregar();
  }

  if (erro) return <p className="erro-box">Não foi possível carregar ({erro}). Confirma que a migração 0007_portal.sql foi corrida.</p>;
  if (!linhas) return <div className="dica">A carregar…</div>;

  const campo = (l: Linha, c: Campo, principal = false) => {
    const v = l[c.k];
    const s = typeof v === "string" ? v : "";
    const guarda = (novoV: string) => { const n = novoV.trim() || null; if (n !== (s || null) && (n || !principal)) muda(l.id, c.k, n); };
    if (c.tipo === "check")
      return <label className="vis" key={c.k}><input type="checkbox" checked={!!v} onChange={(e) => muda(l.id, c.k, e.target.checked)} />{c.label}</label>;
    if (c.tipo === "select")
      return (
        <select className="in mini-in" key={c.k} title={c.label} aria-label={c.label} value={s} onChange={(e) => muda(l.id, c.k, e.target.value || null)}>
          {(c.opcoesDe ? c.opcoesDe(linhas) : c.opcoes)?.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
        </select>
      );
    if (c.tipo === "data")
      return <label className="vis" key={c.k}>{c.label}<input className="in dt" type="date" value={s} onChange={(e) => muda(l.id, c.k, e.target.value || null)} /></label>;
    if (c.tipo === "area")
      return <textarea className="in larga" key={c.k + s} placeholder={c.label} aria-label={c.label} defaultValue={s} onBlur={(e) => guarda(e.target.value)} />;
    return <input className={principal ? "tt" : c.curto ? "in mini-in" : "in larga"} style={c.curto && !principal ? { width: 130 } : undefined} key={c.k + s} type={c.tipo === "url" ? "url" : "text"} placeholder={c.label} aria-label={c.label}
      defaultValue={s} onBlur={(e) => guarda(e.target.value)} />;
  };

  return (
    <div className="elista">
      {linhas.length === 0 && (vazio ?? <div className="dica">Ainda não há nada aqui.</div>)}
      {linhas.map((l, i) => (
        <div className={"elinha " + (classeLinha?.(l, linhas) ?? "")} key={l.id}>
          <div className="l1">
            <span className="n num">{i + 1}</span>
            {campo(l, campos[0], true)}
            <button className="x" type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir" title="Subir">↑</button>
            <button className="x" type="button" disabled={i === linhas.length - 1} onClick={() => move(i, 1)} aria-label="Descer" title="Descer">↓</button>
            <button className="x" type="button" onClick={() => apaga(l)} aria-label="Apagar" title="Apagar">×</button>
          </div>
          {campos.length > 1 && <div className="l2">{campos.slice(1).map((c) => campo(l, c))}</div>}
          {filho && <div className="l3">{filho(l)}</div>}
        </div>
      ))}
      <div className="enovo">
        <input className="in" placeholder={placeholder} value={novo} onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adiciona(); } }} />
        <button className="btn" type="button" onClick={adiciona}>Adicionar</button>
      </div>
    </div>
  );
}
