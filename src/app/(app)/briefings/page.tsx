import type { Metadata } from "next";
import { BriefingsView } from "@/components/portal/BriefingsView";

export const metadata: Metadata = { title: "Briefings dos clientes" };

export default function Pagina() {
  return <BriefingsView />;
}
