import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Painel autenticado: tudo é renderizado por pedido (sessão nos cookies), sem pré-render em cache.
  cacheComponents: false,
};

export default nextConfig;
