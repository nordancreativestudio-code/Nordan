import type { Metadata } from "next";
import { EmBreve } from "@/components/EmBreve";

export const metadata: Metadata = { title: "Novidades" };

export default function Pagina() {
  return <EmBreve titulo="Novidades" texto="Registo do que acontece no painel." />;
}
