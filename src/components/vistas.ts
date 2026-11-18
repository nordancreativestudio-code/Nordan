/** Estrutura da barra lateral. Espelha o dashboard atual (Operação / Comercial / Gestão). */
export type Vista = { k: string; href: string; n: string; ic: string; sub?: string };
export const VISTAS: { g: string; v: Vista[] }[] = [
  {
    g: "Operação",
    v: [
      { k: "inicio", href: "/", n: "Início", ic: "◐", sub: "o dia de hoje" },
      { k: "projetos", href: "/projetos", n: "Projetos", ic: "▣", sub: "kanban e tabela" },
      { k: "calendario", href: "/calendario", n: "Calendário", ic: "▦", sub: "editorial e agenda" },
      { k: "briefings", href: "/briefings", n: "Briefings", ic: "✧", sub: "o que os clientes preencheram" },
    ],
  },
  {
    g: "Comercial",
    v: [
      { k: "clientes", href: "/clientes", n: "Clientes", ic: "◆", sub: "fichas e histórico" },
      { k: "leads", href: "/leads", n: "Leads", ic: "◈", sub: "por setor" },
    ],
  },
  {
    g: "Gestão",
    v: [
      { k: "financas", href: "/financas", n: "Finanças", ic: "€", sub: "entradas e saídas" },
      { k: "novidades", href: "/novidades", n: "Novidades", ic: "◌" },
    ],
  },
  {
    g: "Definições",
    v: [
      { k: "definicoes", href: "/definicoes", n: "Equipa", ic: "◍", sub: "pessoas e cores" },
      { k: "contactos", href: "/contactos", n: "Contactos", ic: "☏", sub: "Fala connosco (portal)" },
      { k: "conteudo-portal", href: "/conteudo-portal", n: "Conteúdo do portal", ic: "❖", sub: "o que o cliente lê" },
    ],
  },
];
export const VMAP: Record<string, Vista> = {};
VISTAS.forEach((g) => g.v.forEach((v) => (VMAP[v.href] = v)));
