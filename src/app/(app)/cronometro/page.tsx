import type { Metadata } from "next";
import { EmBreve } from "@/components/EmBreve";

export const metadata: Metadata = { title: "Cronómetro" };

export default function Pagina() {
  return <EmBreve titulo="Cronómetro" texto="Tempo por tarefa." />;
}
