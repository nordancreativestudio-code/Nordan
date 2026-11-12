import type { Metadata } from "next";
import { EmBreve } from "@/components/EmBreve";

export const metadata: Metadata = { title: "Pedidos de design" };

export default function Pagina() {
  return <EmBreve titulo="Pedidos de design" texto="Briefs e pedidos de design." />;
}
