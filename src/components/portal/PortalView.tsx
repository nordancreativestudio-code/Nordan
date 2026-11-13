"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dataPt, fmtTempo, linkEmail, linkSeguro, linkWhatsApp, mesRotulo, primeiroDoMes } from "@/lib/tipos";
import { ConteudoPortal, type Conteudo } from "./ConteudoPortal";
import { FluxoWorkflow, type PassoModelo } from "./FluxoWorkflow";
import { FormularioPortal } from "./FormularioPortal";

type Cliente = { id: string; nome: string; avenca: boolean };
type ProjLista = { id: string; nome: string; tipo: string | null; prazo_estimado: string | null; passo_atual: string | null; passo_tipo: string | null; passos_total: number; passos_feitos: number; por_aprovar: number };
type Passo = { id: string; titulo: string; frase: string | null; tipo: string; modelo_id: string | null; data_prevista: string | null; data_real: string | null; numero: string | null };
type Detalhe = {
  projeto: { id: string; nome: string; tipo: string | null; prazo_estimado: string | null; link_entrega: string | null };
  passos: Passo[]; conteudos: Conteudo[];
  tarefas: { id: string; titulo: string; concluida: boolean; prazo: string | null; segundos: number | null }[];
};
type Pagina = { id: string; pagina: string; titulo: string; texto: string | null; blocos: { tipo: string; titulo: string; descricao: string | null; url_drive: string | null }[] };
type Contacto = { nome: string; telemovel: string | null; email: string | null };
type Paginas = { workflow: PassoModelo[]; paginas: Pagina[]; contactos: Contacto[] };

const ABAS: [string, string][] = [["projetos", "Projetos"], ["workflow", "Workflow"], ["formulario", "Formulário"], ["ferramentas", "Ferramentas e Comunicação"]];
const hoje = () => new Date().toISOString().slice(0, 10);

/** Linha do tempo de um projeto: passo atual destacado, "a tua parte" nos passos do cliente, aviso discreto se passou da data. */
function Timeline({ passos }: { passos: Passo[] }) {
  const atual = passos.find((p) => !p.data_real)?.id;
  return (
    <ol className="tl">
      {passos.map((p) => {
        const atraso = p.tipo === "cliente" && !p.data_real && !!p.data_prevista && p.data_prevista < hoje();
        return (
          <li key={p.id} className={(p.data_real ? "feito " : "") + (p.id === atual ? "atual " : "") + "tipo-" + p.tipo}>
            <i className="tl-ponto" />
            <div className="tl-corpo">
              <div className="tl-linha">
                <b>{p.numero ? p.numero + " · " : ""}{p.titulo}</b>
                {p.tipo === "cliente" && <span className="pill lime">a tua parte</span>}
                {p.tipo === "juntos" && <span className="pill">juntos</span>}
                {p.id === atual && <span className="pill lime">passo atual</span>}
              </div>
              {p.frase && <div className="dica">{p.frase}</div>}
              <div className="dica">
                {p.data_real ? `Feito a ${dataPt(p.data_real)}` : p.data_prevista ? `Previsto: ${dataPt(p.data_prevista)}` : ""}
              </div>
              {atraso && <div className="tl-aviso">Esta parte já passou da data prevista ({dataPt(p.data_prevista)}).</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ProjetoDetalhe({ id, previa, onVoltar }: { id: string; previa: boolean; onVoltar: () => void }) {
  const [sb] = useState(() => createClient());
  const [d, setD] = useState<Detalhe | null | undefined>(undefined);
  const [form, setForm] = useState<"briefing" | "feedback" | null>(null);
  const ler = useCallback(async () => {
    const r = await sb.rpc("portal_projeto", { p_projeto: id });
    setD(r.error ? null : (r.data as Detalhe | null));
  }, [sb, id]);
  useEffect(() => { Promise.resolve().then(ler); }, [ler]);

  if (d === undefined) return <div className="dica">A carregar…</div>;
  if (!d) return <div className="card"><div className="empty"><b>Projeto indisponível</b>Não encontrámos este projeto.</div></div>;
  const link = linkSeguro(d.projeto.link_entrega);
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div><button className="btn sm" type="button" onClick={onVoltar}>← Projetos</button></div>
      <div className="card">
        <h2 style={{ fontSize: 22 }}>{d.projeto.nome}</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {d.projeto.tipo && <span className="pill">{d.projeto.tipo}</span>}
          {d.projeto.prazo_estimado && <span className="pill sky">Prazo estimado: {dataPt(d.projeto.prazo_estimado)}</span>}
          {link && <a className="pill lime" href={link} target="_blank" rel="noopener noreferrer">Entrega ↗</a>}
        </div>
      </div>
      <div className="card"><h3>Fases do projeto</h3>
        {d.passos.length === 0 ? <div className="dica">Ainda não há passos definidos.</div> : <Timeline passos={d.passos} />}
      </div>
      <div className="card"><h3>Conteúdos para aprovação</h3>
        {d.conteudos.length === 0 ? <div className="dica">Ainda não há conteúdos para ver.</div>
          : <div className="lista">{d.conteudos.map((c) => <ConteudoPortal key={c.id} c={c} previa={previa} onMudou={ler} />)}</div>}
      </div>
      {d.tarefas.length > 0 && (
        <div className="card"><h3>Tarefas</h3>
          <div className="lista">
            {d.tarefas.map((t) => (
              <div className="li" key={t.id}>
                <span className="nm" style={t.concluida ? { textDecoration: "line-through", color: "var(--faint)" } : undefined}>{t.titulo}</span>
                {t.prazo && <span className="dica">{dataPt(t.prazo)}</span>}
                {t.segundos != null && <span className="pill num">{fmtTempo(t.segundos)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card"><h3>Formulários</h3>
        <div className="seg" style={{ marginBottom: form ? 12 : 0 }}>
          {(["briefing", "feedback"] as const).map((t) => (
            <button key={t} type="button" className={"sb" + (form === t ? " on" : "")} onClick={() => setForm(form === t ? null : t)}>
              {t === "briefing" ? "Briefing" : "Feedback final"}
            </button>
          ))}
        </div>
        {form && <FormularioPortal key={form} projetoId={id} tipo={form} mes={null} previa={previa} />}
      </div>
    </div>
  );
}

/**
 * O portal tal como o cliente o vê. Serve o portal real (previa = false) e a pré-visualização da equipa
 * (previa = true: só leitura). Todos os dados vêm das funções portal_* da base de dados, que decidem o que o cliente pode ver.
 */
export function PortalView({ clienteId, previa, onVoltar }: { clienteId: string; previa: boolean; onVoltar?: () => void }) {
  const [sb] = useState(() => createClient());
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const aba = ABAS.some(([k]) => k === sp.get("aba")) ? (sp.get("aba") as string) : "projetos";
  const projetoParam = sp.get("projeto");

  const [cliente, setCliente] = useState<Cliente | null | undefined>(undefined);
  const [projetos, setProjetos] = useState<ProjLista[]>([]);
  const [paginas, setPaginas] = useState<Paginas | null>(null);
  const [passos, setPassos] = useState<Passo[]>([]);
  const [mes, setMes] = useState(() => primeiroDoMes(1));

  const param = useCallback((k: string, v: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    if (k === "aba") p.delete("projeto");
    router.replace(`${pathname}?${p}`);
  }, [sp, router, pathname]);

  const carregar = useCallback(async () => {
    const [c, pr, pg] = await Promise.all([
      sb.rpc("portal_cliente", { p_cliente: clienteId }),
      sb.rpc("portal_projetos", { p_cliente: clienteId }),
      sb.rpc("portal_paginas"),
    ]);
    setCliente(c.error ? null : (c.data as Cliente | null));
    setProjetos(pr.error ? [] : (pr.data as ProjLista[]));
    setPaginas(pg.error ? null : (pg.data as Paginas | null));
  }, [sb, clienteId]);
  useEffect(() => { Promise.resolve().then(carregar); }, [carregar]);

  // projeto de referência das abas Workflow e Formulário
  const projetoId = projetoParam && projetos.some((p) => p.id === projetoParam) ? projetoParam : (projetos[0]?.id ?? null);
  useEffect(() => {
    if (aba !== "workflow" || !projetoId) return;
    let vivo = true;
    sb.rpc("portal_projeto", { p_projeto: projetoId }).then((r) => { if (vivo) setPassos(r.error ? [] : ((r.data as Detalhe | null)?.passos ?? [])); });
    return () => { vivo = false; };
  }, [sb, aba, projetoId]);

  const atual = useMemo(() => passos.find((p) => !p.data_real)?.modelo_id ?? null, [passos]);
  const feitos = useMemo(() => new Set(passos.filter((p) => p.data_real && p.modelo_id).map((p) => p.modelo_id as string)), [passos]);

  if (cliente === undefined) return <div className="dica">A carregar…</div>;
  if (!cliente) return <div className="card"><div className="empty"><b>Sem acesso</b>Este cliente não existe ou não tens acesso a ele.</div></div>;

  const seletor = projetos.length > 1 && (
    <div className="fld" style={{ maxWidth: 320, marginBottom: 12 }}><label>Projeto</label>
      <select className="in" value={projetoId ?? ""} onChange={(e) => param("projeto", e.target.value)}>
        {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select></div>
  );
  const semProjetos = <div className="card"><div className="empty"><b>Ainda não há projetos</b>Quando houver um projeto visível, aparece aqui.</div></div>;
  const secao = paginas?.paginas.filter((p) => p.pagina === "ferramentas_comunicacao") ?? [];

  return (
    <div className="portal-view">
      {previa && (
        <div className="banner-previa" role="status">
          <span>Pré-visualização: a ver como <b>{cliente.nome}</b></span>
          <button className="btn sm" type="button" onClick={onVoltar}>Voltar à vista interna</button>
        </div>
      )}
      <div className="bar-ferr" style={{ justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 20 }}>{previa ? cliente.nome : `Olá, ${cliente.nome}`}</h2>
        <div className="seg" role="tablist">
          {ABAS.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={aba === k} className={"sb" + (aba === k ? " on" : "")} onClick={() => param("aba", k === "projetos" ? null : k)}>{l}</button>
          ))}
        </div>
      </div>

      {aba === "projetos" && (projetoParam && projetos.some((p) => p.id === projetoParam)
        ? <ProjetoDetalhe key={projetoParam} id={projetoParam} previa={previa} onVoltar={() => param("projeto", null)} />
        : projetos.length === 0 ? semProjetos : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
            {projetos.map((p) => (
              <button key={p.id} type="button" className="card pj" onClick={() => param("projeto", p.id)}>
                <b style={{ fontSize: 16 }}>{p.nome}</b>
                <span className="dica">{p.tipo}</span>
                {p.passo_atual && <span className={"pill " + (p.passo_tipo === "cliente" ? "lime" : "")}>{p.passo_atual}{p.passo_tipo === "cliente" ? " · a tua parte" : ""}</span>}
                {p.passos_total > 0 && <span className="bar-n"><span className="bar"><i style={{ width: `${(p.passos_feitos / p.passos_total) * 100}%` }} /></span><span className="num">{p.passos_feitos}/{p.passos_total}</span></span>}
                <span className="dica">{p.prazo_estimado ? `Prazo estimado: ${dataPt(p.prazo_estimado)}` : ""}</span>
                {p.por_aprovar > 0 && <span className="pill amber">{p.por_aprovar} para aprovar</span>}
              </button>
            ))}
          </div>
        ))}

      {aba === "workflow" && (
        <>
          {seletor}
          {paginas && paginas.workflow.length > 0
            ? <FluxoWorkflow modelo={paginas.workflow} atual={atual} feitos={feitos} avenca={cliente.avenca} onFormulario={() => param("aba", "formulario")} />
            : <div className="card"><div className="empty"><b>Workflow</b>Ainda não há passos definidos.</div></div>}
        </>
      )}

      {aba === "formulario" && (
        !projetoId ? semProjetos : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              {seletor}
              <div className="fld" style={{ maxWidth: 240, marginBottom: 12 }}><label>Mês</label>
                <select className="in" value={mes} onChange={(e) => setMes(e.target.value)}>
                  {[-1, 0, 1, 2, 3].map((n) => primeiroDoMes(n)).map((m) => <option key={m} value={m}>{mesRotulo(m)}</option>)}
                </select></div>
            </div>
            <FormularioPortal key={projetoId + mes} projetoId={projetoId} tipo="planeamento_mensal" mes={mes} previa={previa} />
          </>
        )
      )}

      {aba === "ferramentas" && (
        <div className="grid" style={{ gap: 14 }}>
          {secao.map((s) => (
            <div className="card" key={s.id}>
              <h3>{s.titulo}</h3>
              {s.texto && <p style={{ margin: "0 0 10px", whiteSpace: "pre-wrap" }}>{s.texto}</p>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {s.blocos.map((b, i) => {
                  const u = linkSeguro(b.url_drive);
                  return u ? <a key={i} className="btn sm" href={u} target="_blank" rel="noopener noreferrer" title={b.descricao ?? undefined}>{b.titulo} ↗</a>
                    : <span key={i} className="pill">{b.titulo}</span>;
                })}
              </div>
            </div>
          ))}
          {(paginas?.contactos.length ?? 0) > 0 && (
            <div>
              <h3 className="cap" style={{ margin: "6px 2px 10px" }}>Fala connosco</h3>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
                {paginas!.contactos.map((c, i) => {
                  const wa = linkWhatsApp(c.telemovel), em = linkEmail(c.email);
                  return (
                    <div className="card contacto" key={i}>
                      <b style={{ fontSize: 16 }}>{c.nome}</b>
                      {c.telemovel && <span className="dica">{c.telemovel}</span>}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                        {wa && <a className="btn pri" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                        {em && <a className={"btn" + (wa ? "" : " pri")} href={em}>{wa ? "Email" : "Enviar email"}</a>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
