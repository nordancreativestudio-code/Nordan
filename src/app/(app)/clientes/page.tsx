import type { Metadata } from "next";
import { EmBreve } from "@/components/EmBreve";

export const metadata: Metadata = { title: "Clientes" };

export default function Pagina() {
  return <EmBreve titulo="Clientes" texto="Fichas de cliente e histórico." />;
}
