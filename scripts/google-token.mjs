#!/usr/bin/env node
/**
 * Obtém o GOOGLE_REFRESH_TOKEN da conta que vai ser dona do calendário (nordancreativestudio@gmail.com).
 * Corre-se UMA vez, no teu Mac:
 *
 *   node --env-file=.env.local scripts/google-token.mjs
 *
 * Precisa de GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env.local (credencial OAuth do tipo "Aplicação para computador").
 * O refresh token aparece só neste terminal: copia-o para o .env.local e para o Vercel. Não é gravado em ficheiro nem enviado a mais ninguém.
 */
import http from "node:http";
import crypto from "node:crypto";
import { exec } from "node:child_process";

const ID = process.env.GOOGLE_CLIENT_ID;
const SEGREDO = process.env.GOOGLE_CLIENT_SECRET;
const CONTA = "nordancreativestudio@gmail.com";
const ESCOPO = "https://www.googleapis.com/auth/calendar.events";
const PORTA = 53682;
const REDIRECT = `http://127.0.0.1:${PORTA}/callback`;

if (!ID || !SEGREDO) {
  console.error("Faltam GOOGLE_CLIENT_ID e/ou GOOGLE_CLIENT_SECRET no .env.local.\nCorre assim: node --env-file=.env.local scripts/google-token.mjs");
  process.exit(1);
}

const estado = crypto.randomBytes(16).toString("hex");
const verificador = crypto.randomBytes(32).toString("base64url");
const desafio = crypto.createHash("sha256").update(verificador).digest("base64url");

const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: ID, redirect_uri: REDIRECT, response_type: "code", scope: ESCOPO,
  access_type: "offline", prompt: "consent", login_hint: CONTA, state: estado,
  code_challenge: desafio, code_challenge_method: "S256",
});

const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url ?? "/", REDIRECT);
  if (u.pathname !== "/callback") { res.writeHead(404).end(); return; }
  const fim = (txt, codigo = 0) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(`<p style="font:16px system-ui">${txt}</p>`);
    servidor.close(); setTimeout(() => process.exit(codigo), 200);
  };
  if (u.searchParams.get("state") !== estado) return fim("Pedido inválido (state). Volta ao terminal e tenta de novo.", 1);
  if (u.searchParams.get("error")) return fim("O Google devolveu: " + u.searchParams.get("error") + ". Volta ao terminal.", 1);
  const code = u.searchParams.get("code");
  if (!code) return fim("Sem código. Volta ao terminal e tenta de novo.", 1);
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: ID, client_secret: SEGREDO, redirect_uri: REDIRECT, grant_type: "authorization_code", code_verifier: verificador }),
    });
    const j = await r.json();
    if (!r.ok || !j.refresh_token) {
      console.error("\nNão veio refresh token:", j.error_description ?? j.error ?? r.status,
        "\nSe já tinhas autorizado antes, remove o acesso em https://myaccount.google.com/permissions e repete.");
      return fim("Sem refresh token. Vê o terminal.", 1);
    }
    console.log("\n──────────────── COPIA PARA O .env.local E PARA O VERCEL ────────────────");
    console.log("GOOGLE_REFRESH_TOKEN=" + j.refresh_token);
    console.log("──────────────────────────────────────────────────────────────────────────");
    console.log("Conta autorizada:", CONTA, "· escopo:", ESCOPO);
    fim("Feito. Já podes fechar este separador e voltar ao terminal.");
  } catch (e) {
    console.error("Erro a trocar o código:", e instanceof Error ? e.message : e);
    fim("Erro. Vê o terminal.", 1);
  }
});

servidor.listen(PORTA, "127.0.0.1", () => {
  console.log(`\nAbre este endereço no browser e entra com ${CONTA}:\n\n${url}\n`);
  exec(`open "${url}"`, () => {});          // macOS; se não abrir, usa o endereço acima
  setTimeout(() => { console.error("Tempo esgotado (5 min)."); process.exit(1); }, 5 * 60_000);
});
