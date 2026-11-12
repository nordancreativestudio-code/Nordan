"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const Ctx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mostrar = useCallback((m: string) => {
    setMsg(m);
    setOn(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setOn(false), 2800);
  }, []);
  return (
    <Ctx.Provider value={mostrar}>
      {children}
      <div className={"toast" + (on ? " on" : "")} role="status">{msg}</div>
    </Ctx.Provider>
  );
}
