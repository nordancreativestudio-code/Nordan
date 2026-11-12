"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ erroInicial }: { erroInicial: string | null }) {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado">("idle");
  const [erro, setErro] = useState<string | null>(erroInicial);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEstado("enviando");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true, // a base de dados recusa emails fora da lista de autorizados
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      const msg = /not authorized|não autorizad|Database error|signups not allowed/i.test(error.message)
        ? "Este email não está autorizado."
        : error.message;
      setErro(msg);
      setEstado("idle");
      return;
    }
    setEstado("enviado");
  }

  if (estado === "enviado") {
    return (
      <p className="ok">
        Link enviado para <b>{email}</b>. Abre o email neste dispositivo e carrega no link.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="fld">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          className="in"
          type="email"
          required
          autoComplete="email"
          placeholder="nome@nordan.pt"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <button className="btn pri" type="submit" disabled={estado === "enviando"}>
        {estado === "enviando" ? "A enviar…" : "Enviar link de acesso"}
      </button>
      {erro && <p className="erro">{erro}</p>}
    </form>
  );
}
