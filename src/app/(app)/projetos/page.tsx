import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjetosView } from "@/components/projetos/ProjetosView";

export const metadata: Metadata = { title: "Projetos" };

export default function Pagina() {
  return (
    <Suspense>
      <ProjetosView />
    </Suspense>
  );
}
