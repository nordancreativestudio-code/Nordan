import type { Metadata } from "next";
import { ProjetosView } from "@/components/projetos/ProjetosView";

export const metadata: Metadata = { title: "Projetos" };

export default function Pagina() {
  return <ProjetosView />;
}
