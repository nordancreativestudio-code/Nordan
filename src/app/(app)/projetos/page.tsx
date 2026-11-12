import type { Metadata } from "next";
import { EmBreve } from "@/components/EmBreve";

export const metadata: Metadata = { title: "Projetos" };

export default function Pagina() {
  return <EmBreve titulo="Projetos" texto="O kanban de 4 colunas e a tabela entram no passo 2." />;
}
