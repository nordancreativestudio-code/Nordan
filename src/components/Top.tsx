"use client";

import { usePathname } from "next/navigation";
import { VMAP } from "./vistas";

export function Top() {
  const pathname = usePathname();
  const base = "/" + (pathname.split("/")[1] ?? "");
  const v = VMAP[base] ?? VMAP["/"];
  return (
    <header className="top">
      <h1>{v.n}</h1>
      {v.sub && <span className="sub">{v.sub}</span>}
      <div className="spacer" />
      <input className="srch" type="search" placeholder="Procurar…" aria-label="Procurar" disabled />
      <button className="btn sino" title="Novidades" aria-label="Novidades" type="button">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 1.7a3.35 3.35 0 0 0-3.35 3.35v2.2c0 .72-.29 1.4-.8 1.9l-.45.45h9.2l-.45-.45a2.68 2.68 0 0 1-.8-1.9v-2.2A3.35 3.35 0 0 0 8 1.7Z" />
          <path d="M6.45 11.6a1.55 1.55 0 0 0 3.1 0" />
        </svg>
        <span className="bdg" />
      </button>
      <button className="btn pri" type="button" disabled>+ Novo</button>
    </header>
  );
}
