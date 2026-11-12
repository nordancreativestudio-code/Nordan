import type { Metadata } from "next";
import { EmBreve } from "@/components/EmBreve";

export const metadata: Metadata = { title: "Finanças" };

export default function Pagina() {
  return <EmBreve titulo="Finanças" texto="Entradas, saídas e gráficos." />;
}
