"use client";
import { useSyncExternalStore } from "react";

const CHAVE = "nordan.saldo.visivel";
const EVT = "nordan-saldo";

function ouvir(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
}
function lerVisivel() { try { return localStorage.getItem(CHAVE) === "1"; } catch { return false; } }

/** Preferência (neste aparelho) de mostrar ou esconder o saldo da conta. Por defeito está escondido. */
export function useSaldoVisivel() {
  const visivel = useSyncExternalStore(ouvir, lerVisivel, () => false);
  const alternar = () => {
    try { localStorage.setItem(CHAVE, visivel ? "0" : "1"); } catch { /* sem armazenamento: não guarda */ }
    window.dispatchEvent(new Event(EVT));
  };
  return { visivel, alternar };
}

const euro = (n: number) => n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

/** O valor do saldo, ou pontos se estiver escondido. */
export function ValorSaldo({ valor }: { valor: number }) {
  const { visivel } = useSaldoVisivel();
  return <>{visivel ? euro(valor) : "•••••• €"}</>;
}

/** Botão único que mostra ou esconde todos os valores de uma página. */
export function OlhoSaldo() {
  const { visivel, alternar } = useSaldoVisivel();
  return (
    <button type="button" className="btn sm" onClick={alternar} aria-pressed={visivel}>
      {visivel ? "Esconder valores" : "Mostrar valores"}
    </button>
  );
}
