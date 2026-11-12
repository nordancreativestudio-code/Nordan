import type { Metadata } from "next";
import { ClientesView } from "@/components/clientes/ClientesView";

export const metadata: Metadata = { title: "Clientes" };

export default function Pagina() {
  return <ClientesView />;
}
