"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/live", label: "En vivo", detail: "WebSocket" },
  { href: "/historical", label: "Histórico", detail: "Elasticsearch" },
  { href: "/blocked", label: "Bloqueos", detail: "IPS" },
  { href: "/geo", label: "Geografía", detail: "Heatmap" },
  { href: "/rankings", label: "Rankings", detail: "Top N" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="px-3 pt-3 text-foreground sm:px-4 lg:px-6" aria-label="Navegación principal">
      <div className="mx-auto grid max-w-[1800px] grid-cols-2 gap-2 rounded-lg border border-soc-outline/80 bg-soc-low/85 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur md:grid-cols-5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname === "/" && item.href === "/live");

          return (
            <Link
              className={`group rounded-md border px-3 py-3 transition hover:-translate-y-0.5 ${
                isActive
                  ? "border-soc-primary/65 bg-soc-blue/20 shadow-[0_0_24px_rgba(77,142,255,0.13)]"
                  : "border-soc-outline/70 bg-soc-lowest/55 hover:border-soc-primary/35 hover:bg-soc-blue/10"
              }`}
              href={item.href}
              key={item.href}
            >
              <div className={`text-xs font-black uppercase tracking-[0.13em] ${isActive ? "text-white" : "text-soc-muted group-hover:text-white"}`}>{item.label}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-soc-muted">{item.detail}</div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
