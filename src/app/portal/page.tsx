import { createClient } from "@/lib/supabase/server";

export default async function PortalInicio() {
  const supabase = await createClient();
  const { data: meus } = await supabase.rpc("portal_meus_clientes");
  const nomes = (Array.isArray(meus) ? meus : []).map((c: { nome: string }) => c.nome).join(", ");
  return (
    <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="empty">
        <b>{nomes ? `Olá, ${nomes}` : "Portal do cliente"}</b>
        O teu acesso está ativo. Os projetos, as aprovações e os formulários aparecem aqui em breve.
      </div>
    </div>
  );
}
