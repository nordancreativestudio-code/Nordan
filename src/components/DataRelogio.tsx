"use client";

import { useEffect, useState } from "react";

/** Data por extenso e relógio ao segundo, na hora de Lisboa (só no cabeçalho do Início). */
export function DataRelogio() {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    Promise.resolve().then(() => setAgora(new Date()));
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  // até montar no browser não mostra nada (evita diferenças entre servidor e cliente)
  if (!agora) return <span className="sub" style={{ visibility: "hidden" }}>&nbsp;</span>;
  const dataTxt = agora.toLocaleDateString("pt-PT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Lisbon",
  });
  const data = dataTxt.charAt(0).toUpperCase() + dataTxt.slice(1);
  const hora = agora.toLocaleTimeString("pt-PT", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Lisbon",
  });
  return (
    <>
      <span className="sub">{data}</span>
      <span
        className="num"
        aria-label={`Hora: ${hora}`}
        style={{ marginLeft: 10, fontSize: 15, color: "var(--lime)", letterSpacing: "-0.02em" }}
      >
        {hora}
      </span>
    </>
  );
}
