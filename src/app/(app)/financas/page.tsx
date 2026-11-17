import type { Metadata } from "next";
import { FinancasView } from "@/components/financas/FinancasView";

export const metadata: Metadata = { title: "Finanças" };

export default function Pagina() {
  return <FinancasView />;
}
