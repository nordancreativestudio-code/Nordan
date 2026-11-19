import type { Metadata } from "next";
import { SessoesPainel } from "@/components/sessoes/SessoesPainel";

export const metadata: Metadata = { title: "Calendário" };

export default function Pagina() {
  return <SessoesPainel escutarNovo />;
}
