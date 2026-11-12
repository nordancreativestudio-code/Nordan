"use client";

import { useEffect } from "react";

/** Gaveta lateral (ou painel ao centro com `centro`) com fundo escurecido. */
export function Gaveta({
  aberta, titulo, onFechar, centro, children, rodape,
}: {
  aberta: boolean; titulo: string; onFechar: () => void; centro?: boolean;
  children: React.ReactNode; rodape?: React.ReactNode;
}) {
  useEffect(() => {
    if (!aberta) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [aberta, onFechar]);
  return (
    <>
      <div className={"scrim" + (aberta ? " on" : "")} onClick={onFechar} />
      <aside className={"drawer" + (centro ? " centro" : "") + (aberta ? " on" : "")} aria-hidden={!aberta} role="dialog" aria-label={titulo}>
        <header>
          <h2>{titulo}</h2>
          <button className="btn sm" type="button" onClick={onFechar} aria-label="Fechar">✕</button>
        </header>
        <div className="form">{aberta && children}</div>
        {rodape && <footer>{rodape}</footer>}
      </aside>
    </>
  );
}
