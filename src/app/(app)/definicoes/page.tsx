import type { Metadata } from "next";
import { EquipaView } from "@/components/EquipaView";

export const metadata: Metadata = { title: "Equipa" };

export default function Pagina() {
  return <EquipaView />;
}
