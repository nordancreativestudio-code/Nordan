import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar" };

const ERROS: Record<string, string> = {
  "nao-autorizado": "Esta conta não está autorizada a entrar no painel.",
  link: "O link já não é válido. Pede um novo.",
  migracao: "A base de dados ainda não tem a tabela de autorizados. Corre a migração no Supabase.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  return (
    <main className="login">
      <div className="card">
        <Image
          className="logo"
          src="/brand/logo-lima.png"
          alt="Nordan creative studio"
          width={1600}
          height={1600}
          priority
        />
        <h1>Painel interno</h1>
        <p>Escreve o teu email e recebes um link para entrar. Sem palavra-passe.</p>
        <LoginForm erroInicial={erro ? ERROS[erro] ?? "Não foi possível entrar." : null} />
        <div className="rodape">Só contas autorizadas da Nordan</div>
      </div>
    </main>
  );
}
