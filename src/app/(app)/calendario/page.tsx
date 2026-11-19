import type { Metadata } from "next";
import { CalendarioView } from "@/components/calendario/CalendarioView";

export const metadata: Metadata = { title: "Calendário" };

export default function Pagina() {
  return <CalendarioView />;
}
