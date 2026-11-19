"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SelectOpcoes } from "@/components/SelectOpcoes";
import { Gaveta } from "@/components/Gaveta";
import { useToast } from "@/components/Toast";
import { SessoesPainel } from "@/components/sessoes/SessoesPainel";
import {
  ESTADOS_CLIENTE, SETORES, nul, tabelaEmFalta, dataCurta,
  type Cliente, type Projeto,
} from "@/lib/tipos";

type ProjMin = Pick<Projeto, "id" | "cliente_id" | "nome" | "estado" | "prazo">;
type Form = Partial<Cliente>;
const CAMPOS = ["nome", "setor", "estado", "contacto", "telefone", "email", "web", "nif", "localidade", "notas"] as const;

export function ClientesView() {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [projetos, setProjetos] = useState<ProjMin[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [a_guardar, setAGuardar] = useState(false);
  const [convites, setConvites] = useState<{ id: string; email: string; utilizador_id: string | null }[] | null>(null);
  const [novoEmail, setNovoEmail] = useState("");

  const lerConvites = useCallback(async (clienteId: string) => {
    const r = await sb.from("clientes_utilizadores").select("id,email,utilizador_id").eq("cliente_id", clienteId).order("criado_em");
    setConvites(r.error ? null : r.data); // null = migração 0007 por correr
  }, [sb]);
  const abrir = (c: Cliente) => { setForm(c); setNovoEmail(""); setConvites(null); lerConvites(c.id); };
  async function convidar() {
    const email = novoEmail.trim().toLowerCase();
    if (!form?.id || !/^\S+@\S+\.\S+$/.test(email)) return toast("Escreve um email válido");
    const r = await sb.from("clientes_utilizadores").insert({ cliente_id: form.id, email });
    if (r.error) return toast(r.error.code === "23505" ? "Esse email já tem acesso" : "Erro: " + r.error.message);
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const e = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: `${base}/auth/callback` } });
    toast(e.error ? "Acesso criado, mas o email não seguiu: " + e.error.message : "Acesso criado e link enviado para " + email);
    setNovoEmail("");
    lerConvites(form.id);
  }
  async function reenviar(email: string) {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const e = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: `${base}/auth/callback` } });
    toast(e.error ? "O email não seguiu: " + e.error.message : "Link enviado para " + email);
  }
  async function retirar(id: string, email: string) {
    if (!form?.id || !confirm(`Retirar o acesso de ${email} ao portal?`)) return;
    const r = await sb.from("clientes_utilizadores").delete().eq("id", id);
    if (r.error) return toast("Erro: " + r.error.message);
    lerConvites(form.id);
  }

  const carregar = useCallback(async () => {
    const [c, p] = await Promise.all([
      sb.from("clientes").select("*").order("nome"),
      sb.from("projetos").select("id,cliente_id,nome,estado,prazo"),
    ]);
    const e = c.error ?? p.error;
    if (e) {
      setErro(tabelaEmFalta(e) ? "falta-migracao" : e.message);
      setClientes([]);
      return;
    }
    setErro(null);
    setClientes(c.data as Cliente[]);
    setProjetos(p.data as ProjMin[]);
  }, [sb]);

  useEffect(() => { Promise.resolve().then(carregar); }, [carregar]);
  useEffect(() => {
    const h = () => setForm({ estado: "Ativo" });
    window.addEventListener("nordan:novo", h);
    return () => window.removeEventListener("nordan:novo", h);
  }, []);

  const set = (k: keyof Cliente, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    if (!form?.nome?.trim()) return toast("O nome é obrigatório");
    setAGuardar(true);
    const dados = Object.fromEntries(CAMPOS.map((k) => [k, nul(form[k])]));
    dados.nome = form.nome.trim();
    dados.estado = form.estado || "Ativo";
    dados.avenca = !!form.avenca;
    // só grava se a coluna existe (veio no select *) ou foi tocada; assim não falha antes da migração 0013
    if (form.historico_visivel !== undefined) dados.historico_visivel = !!form.historico_visivel;
    const r = form.id
      ? await sb.from("clientes").update(dados).eq("id", form.id)
      : await sb.from("clientes").insert(dados);
    setAGuardar(false);
    if (r.error) return toast("Erro: " + r.error.message);
    toast(form.id ? "Cliente guardado" : "Cliente criado");
    setForm(null);
    carregar();
  }

  async function apagar() {
    if (!form?.id) return;
    if (!confirm(`Apagar o cliente "${form.nome}"? Os projetos ficam sem cliente.`)) return;
    const r = await sb.from("clientes").delete().eq("id", form.id);
    if (r.error) return toast("Erro: " + r.error.message);
    toast("Cliente apagado");
    setForm(null);
    carregar();
  }

  if (erro === "falta-migracao")
    return (
      <div className="card"><div className="empty"><b>Faltam as tabelas</b>
        Corre a migração 0002_clientes_projetos_tarefas.sql no SQL Editor do Supabase.</div></div>
    );
  if (erro) return <div className="card"><p className="erro-box">Erro ao carregar: {erro}</p></div>;
  if (!clientes) return <div className="dica">A carregar…</div>;

  const abertos = (id: string) => projetos.filter((p) => p.cliente_id === id && p.estado !== "Concluído").length;
  const tabela = (lista: Cliente[]) => (
    <div className="tw">
      <table>
        <thead><tr><th>Cliente</th><th>Setor</th><th>Contacto</th><th>Telefone</th><th>Localidade</th><th style={{ textAlign: "right" }}>Projetos em curso</th></tr></thead>
        <tbody>
          {lista.map((c) => (
            <tr key={c.id} onClick={() => abrir(c)}>
              <td><b style={{ fontWeight: 500 }}>{c.nome}</b></td>
              <td>{c.setor ? <span className="pill">{c.setor}</span> : <span className="faint">—</span>}</td>
              <td>{c.contacto ?? <span className="faint">—</span>}</td>
              <td>{c.telefone ?? <span className="faint">—</span>}</td>
              <td>{c.localidade ?? <span className="faint">—</span>}</td>
              <td className="num">{abertos(c.id)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const por = (e: string) => clientes.filter((c) => c.estado === e);
  const ativos = por("Ativo"), pontuais = por("Pontual"), inativos = por("Inativo");
  const doCliente = form?.id ? projetos.filter((p) => p.cliente_id === form.id) : [];

  return (
    <>
      {clientes.length === 0 ? (
        <div className="card"><div className="empty"><b>Ainda não há clientes</b>Carrega em “+ Novo” para criar o primeiro.</div></div>
      ) : (
        <>
          {ativos.length > 0 && (<><div className="grpcab">Clientes ativos <span className="ct">{ativos.length}</span></div>{tabela(ativos)}</>)}
          {pontuais.length > 0 && (<details className="grp" open={ativos.length === 0}><summary>Pontuais <span className="ct">{pontuais.length}</span></summary>{tabela(pontuais)}</details>)}
          {inativos.length > 0 && (<details className="grp"><summary>Inativos <span className="ct">{inativos.length}</span></summary>{tabela(inativos)}</details>)}
        </>
      )}

      <Gaveta
        centro aberta={!!form} titulo={form?.id ? form.nome || "Cliente" : "Novo cliente"} onFechar={() => setForm(null)}
        rodape={<>
          <button className="btn pri" type="button" onClick={guardar} disabled={a_guardar}>{a_guardar ? "A guardar…" : "Guardar"}</button>
          <button className="btn" type="button" onClick={() => setForm(null)}>Cancelar</button>
          <div className="spacer" />
          {form?.id && <button className="btn dgr" type="button" onClick={apagar}>Apagar</button>}
        </>}
      >
        {form && (<>
          <div className="fld full"><label>Nome do cliente</label><input className="in" value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} autoFocus /></div>
          <div className="fld"><label>Setor</label>
            <SelectOpcoes lista="setor" fallback={SETORES} valor={form.setor ?? ""} onChange={(v) => set("setor", v)} /></div>
          <div className="fld"><label>Estado</label>
            <select className="in" value={form.estado ?? "Ativo"} onChange={(e) => set("estado", e.target.value)}>
              {ESTADOS_CLIENTE.map((s) => <option key={s}>{s}</option>)}
            </select></div>
          <label className="chk full"><input type="checkbox" checked={!!form.avenca} onChange={(e) => setForm((f) => ({ ...f, avenca: e.target.checked }))} />Cliente com avença (tem o formulário de planeamento mensal)</label>
          <label className="chk full"><input type="checkbox" checked={!!form.historico_visivel} onChange={(e) => setForm((f) => ({ ...f, historico_visivel: e.target.checked }))} />Cliente regular: vê todo o histórico</label>
          <div className="dica full" style={{ marginTop: -6 }}>Com isto ligado, o cliente vê no portal todos os projetos e tarefas, mesmo os não marcados como “Visível ao cliente”. Desligado, só vê os marcados.</div>
          <div className="fld"><label>Pessoa de contacto</label><input className="in" value={form.contacto ?? ""} onChange={(e) => set("contacto", e.target.value)} /></div>
          <div className="fld"><label>Telefone</label><input className="in" type="tel" value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} /></div>
          <div className="fld"><label>Email</label><input className="in" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
          <div className="fld"><label>Website / Instagram</label><input className="in" value={form.web ?? ""} onChange={(e) => set("web", e.target.value)} /></div>
          <div className="fld"><label>NIF</label><input className="in" value={form.nif ?? ""} onChange={(e) => set("nif", e.target.value)} /></div>
          <div className="fld"><label>Localidade</label><input className="in" value={form.localidade ?? ""} onChange={(e) => set("localidade", e.target.value)} /></div>
          <div className="fld full"><label>Notas</label><textarea className="in" value={form.notas ?? ""} onChange={(e) => set("notas", e.target.value)} /></div>
          {form.id && (<>
            <div className="fld full"><label>Faturação</label>
              <div className="rollups">
                <div className="rollup"><div className="cap">Faturado</div><div className="v">0 €</div></div>
                <div className="rollup"><div className="cap">Pendente</div><div className="v">0 €</div></div>
              </div>
              <div className="dica">Passa a vir das Finanças quando essa secção existir.</div>
            </div>
            <div className="fld full"><label>Portal do cliente</label>
              {convites === null ? <div className="dica">Disponível depois de correr a migração 0007_portal.sql.</div> : (<>
                {convites.length === 0 && <div className="dica">Ninguém deste cliente tem acesso ao portal.</div>}
                <div className="lista">
                  {convites.map((c) => (
                    <div className="li" key={c.id}>
                      <span className="nm">{c.email}</span>
                      <span className={"pill" + (c.utilizador_id ? " lime" : "")}>{c.utilizador_id ? "já entrou" : "ainda não entrou"}</span>
                      <button className="btn sm" type="button" onClick={() => reenviar(c.email)}>Reenviar link</button>
                      <button className="btn sm dgr" type="button" onClick={() => retirar(c.id, c.email)}>Retirar</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="in" type="email" placeholder="email do cliente" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); convidar(); } }} />
                  <button className="btn" type="button" onClick={convidar}>Convidar para o portal</button>
                </div>
                <div className="dica">Ao convidar, o cliente recebe logo no email o link de acesso ao portal. Só vê projetos marcados como “Visível ao cliente”.</div>
              </>)}
            </div>
            <div className="fld full"><label>Sessões</label>
              <SessoesPainel clienteId={form.id} />
              <div className="dica">O convite segue por Google Calendar para os emails deste cliente no portal.</div>
            </div>
            <div className="fld full"><label>Projetos ({doCliente.length})</label>
              {doCliente.length === 0 ? <div className="dica">Sem projetos para este cliente.</div> : (
                <div className="lista">
                  {doCliente.map((p) => (
                    <div className="li" key={p.id}>
                      <span className="nm">{p.nome}</span>
                      {p.prazo && <span className="dica">{dataCurta(p.prazo)}</span>}
                      <span className={"pill " + (p.estado === "Concluído" ? "lime" : p.estado === "Em aprovação" ? "amber" : p.estado === "Em andamento" ? "sky" : "")}>{p.estado}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>)}
        </>)}
      </Gaveta>
    </>
  );
}
