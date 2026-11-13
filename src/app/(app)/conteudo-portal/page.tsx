import type { Metadata } from "next";
import { EditorPortal } from "@/components/portal/EditorPortal";

export const metadata: Metadata = { title: "Conteúdo do portal" };

export default function Pagina() {
  return <EditorPortal />;
}
