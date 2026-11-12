"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { VISTAS } from "./vistas";

export function Rail({ email }: { email: string }) {
  const pathname = usePathname();
  const ativo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav className="rail" aria-label="Secções">
      <Link className="brand" href="/" title="Ir para o Início">
        <Image src="/brand/icon.png" alt="" width={34} height={34} priority />
        <div>
          <b>NORDAN</b>
          <span>creative studio</span>
        </div>
      </Link>
      <div className="navlist">
        {VISTAS.map((g) => (
          <div key={g.g} style={{ display: "contents" }}>
            <div className="navgrp">{g.g}</div>
            {g.v.map((v) => (
              <Link
                key={v.k}
                className="nav"
                href={v.href}
                aria-current={ativo(v.href) ? "page" : undefined}
              >
                <span className="ic" aria-hidden="true">{v.ic}</span>
                {v.n}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="railfoot">
        <div><span className="dot on" />Supabase</div>
        <div className="quem" title={email}>{email}</div>
        <form action="/auth/sair" method="post">
          <button type="submit">Sair</button>
        </form>
      </div>
    </nav>
  );
}
