import type { Metadata } from "next";
import { EmBreve } from "@/components/EmBreve";

export const metadata: Metadata = { title: "Leads" };

export default function Pagina() {
  return <EmBreve titulo="Leads" texto="Leads por setor." />;
}
