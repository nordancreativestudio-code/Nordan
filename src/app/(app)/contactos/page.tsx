"use client";

import { EditorLista } from "@/components/portal/EditorLista";

/** Contactos do cartão "Fala connosco" do portal. */
export default function Pagina() {
  return (
    <div className="card">
      <h3>Contactos do portal</h3>
      <p className="dica" style={{ margin: "0 0 10px" }}>
        Aparecem no fim da aba “Ferramentas e Comunicação”, um cartão por linha. Com telemóvel, o cartão tem o botão WhatsApp (o link é calculado:
        números com 9 dígitos são portugueses; para outros países escreve o indicativo, ex.: +44 7700 900123). Com email, tem o botão de email.
        O que ficar vazio não aparece.
      </p>
      <EditorLista
        tabela="equipa_contactos" placeholder="Novo contacto (nome)…"
        campos={[{ k: "nome", label: "Nome" }, { k: "telemovel", label: "Telemóvel / WhatsApp", curto: true }, { k: "email", label: "Email", curto: true }]}
      />
    </div>
  );
}
