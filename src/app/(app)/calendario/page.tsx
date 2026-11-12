import type { Metadata } from "next";
import { EmBreve } from "@/components/EmBreve";

export const metadata: Metadata = { title: "Calendário" };

export default function Pagina() {
  return <EmBreve titulo="Calendário" texto="Calendário editorial e agenda." />;
}
