// Diagnóstico da ligação ao Google Calendar. Não mostra nenhuma chave, só o resultado.
// Correr na pasta do projeto: node --env-file=.env.local scripts/google-diagnostico.mjs
const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: segredo, GOOGLE_REFRESH_TOKEN: token } = process.env;

const ok = (b) => (b ? "OK" : "PROBLEMA");
console.log("1) Variáveis presentes e com o tamanho esperado");
console.log(`   GOOGLE_CLIENT_ID      ${ok(id && id.endsWith(".apps.googleusercontent.com"))} (${id?.length ?? 0} caracteres; deve acabar em .apps.googleusercontent.com)`);
console.log(`   GOOGLE_CLIENT_SECRET  ${ok(segredo && segredo.startsWith("GOCSPX-"))} (${segredo?.length ?? 0} caracteres; deve começar por GOCSPX-)`);
console.log(`   GOOGLE_REFRESH_TOKEN  ${ok(token && token.startsWith("1//") && token.length > 100)} (${token?.length ?? 0} caracteres; deve começar por 1// e ter mais de 100)`);
for (const [n, v] of [["ID", id], ["SECRET", segredo], ["TOKEN", token]]) {
  if (v && (/\s/.test(v) || /^["']|["']$/.test(v))) console.log(`   ${n} tem espaços ou aspas: tira-os no .env.local`);
}
if (!id || !segredo || !token) { console.log("\nFaltam variáveis. Pára aqui."); process.exit(1); }

console.log("\n2) Pedir um access token ao Google");
const r = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: id, client_secret: segredo, refresh_token: token, grant_type: "refresh_token" }),
});
const j = await r.json().catch(() => ({}));
if (!r.ok) {
  console.log(`   FALHOU: ${j.error ?? r.status} - ${j.error_description ?? ""}`);
  if (j.error === "invalid_client") console.log("   => O ID ou o SECRET estão errados (ou o secret foi desativado). Cria/copia um secret novo em Clients e volta a gerar o token.");
  if (j.error === "invalid_grant") console.log("   => O token expirou ou foi revogado (app em Testing dura 7 dias) ou foi gerado com outro ID/secret. Volta a correr scripts/google-token.mjs.");
  process.exit(1);
}
console.log("   OK, o Google aceitou as 3 chaves.");

console.log("\n3) Ler o calendário principal");
const c = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1", {
  headers: { Authorization: `Bearer ${j.access_token}` },
});
const cj = await c.json().catch(() => ({}));
if (!c.ok) {
  console.log(`   FALHOU (${c.status}): ${cj.error?.message ?? ""}`);
  if (c.status === 403) console.log("   => Ativa a Google Calendar API em APIs e serviços > Biblioteca, ou o token não tem o scope do calendário.");
  process.exit(1);
}
console.log("   OK, o calendário respondeu. Está tudo ligado.");
