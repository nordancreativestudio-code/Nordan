"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { PALETA_PESSOAS } from "@/lib/tipos";
import { pc, useEquipa } from "./Equipa";

export function EquipaView() {
  const [sb] = useState(() => createClient());
  const toast = useToast();
  const { pessoas, meuId, semMigracao, recarregar } = useEquipa();

  async function mudar(email: string, cor: string) {
    const r = await sb.rpc("definir_cor", { p_email: email, p_cor: cor.toUpperCase() });
    if (r.error)
      return toast(/check/i.test(r.error.message) ? "Essa cor está reservada (lima da marca ou coral dos alertas)" : "Erro: " + r.error.message);
    toast("Cor atualizada");
    recarregar();
  }

  if (semMigracao)
    return (
      <div className="card"><div className="empty"><b>Falta a migração</b>
        Corre a migração 0006_equipa_cores.sql no SQL Editor do Supabase.</div></div>
    );

  return (
    <div className="card">
      <h3>Equipa</h3>
      <div className="lista">
        {pessoas.map((p) => (
          <div className="li pessoa" key={p.email} style={pc(p.cor)}>
            <span className="avatar">{p.iniciais ?? "?"}</span>
            <span className="nm">
              <b style={{ fontWeight: 500 }}>{p.nome ?? p.email}</b>{p.utilizador_id === meuId && <span className="faint"> (tu)</span>}
              <br /><small className="faint">{p.email}{!p.utilizador_id && " · ainda não entrou"}</small>
            </span>
            <div className="amostras" role="group" aria-label={`Cor de ${p.nome ?? p.email}`}>
              {PALETA_PESSOAS.map((c) => (
                <button key={c} type="button" className={"amostra" + (p.cor === c ? " on" : "")} style={{ background: c }}
                  onClick={() => mudar(p.email, c)} aria-label={`Usar ${c}`} aria-pressed={p.cor === c} title={c} />
              ))}
              <input type="color" key={p.cor} defaultValue={p.cor ?? "#A0C6B6"} onBlur={(e) => { if (e.target.value.toUpperCase() !== p.cor) mudar(p.email, e.target.value); }} title="Outra cor" aria-label="Outra cor" />
            </div>
          </div>
        ))}
      </div>
      <p className="dica" style={{ margin: "12px 0 0" }}>
        A cor aparece no kanban, nos filtros, na página Início e nos cronómetros. O lima e o coral estão reservados.
        Para adicionar pessoas, insere o email na tabela utilizadores_autorizados no Supabase: recebem uma cor automaticamente.
      </p>
    </div>
  );
}
