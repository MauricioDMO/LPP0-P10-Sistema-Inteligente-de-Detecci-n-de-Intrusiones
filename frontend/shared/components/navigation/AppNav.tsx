"use client";

import {
  IconActivityHeartbeat,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconGlobe,
  IconHistory,
  IconMenu2,
  IconShieldLock,
  IconX,
  type Icon,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems: Array<{ href: string; label: string; detail: string; icon: Icon }> = [
  { href: "/live", label: "En vivo", detail: "WebSocket", icon: IconActivityHeartbeat },
  { href: "/historical", label: "Histórico", detail: "Elasticsearch", icon: IconHistory },
  { href: "/blocked", label: "Bloqueos", detail: "IPS", icon: IconShieldLock },
  { href: "/geo", label: "Geografía", detail: "Heatmap", icon: IconGlobe },
  { href: "/rankings", label: "Rankings", detail: "Top N", icon: IconChartBar },
];

export function AppNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      <button
        aria-controls="app-sidebar"
        aria-expanded={isOpen}
        className="fixed left-3 top-3 z-50 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-soc-outline/80 bg-soc-low/95 text-white shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur transition hover:border-soc-primary/55 hover:bg-soc-blue/15 lg:hidden"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <span className="sr-only">Abrir navegación</span>
        <IconMenu2 size={21} stroke={1.8} />
      </button>

      {isOpen ? (
        <button
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] border-r border-soc-outline/80 bg-soc-low/95 px-3 py-3 text-foreground shadow-[28px_0_70px_rgba(0,0,0,0.38)] backdrop-blur-xl transition-[width,transform] duration-300 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "lg:w-[80px]" : "lg:w-[280px]"}`}
        id="app-sidebar"
      >
        <nav className="flex h-full flex-col" aria-label="Navegación principal">
          <div className={`mb-4 flex items-start justify-between gap-3 rounded-lg border border-soc-outline/70 bg-soc-lowest/65 p-3 transition-[gap,padding] duration-300 ${isCollapsed ? "lg:justify-center lg:gap-0 lg:px-2" : ""}`}>
            <div className={`min-w-0 overflow-hidden transition-[width,opacity,transform] duration-300 ${isCollapsed ? "lg:w-0 lg:-translate-x-1 lg:opacity-0" : "lg:w-[160px] lg:translate-x-0 lg:opacity-100"}`}>
              <div className="truncate whitespace-nowrap text-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-soc-primary">Suricata</div>
              <div className="mt-1 truncate whitespace-nowrap text-nowrap text-lg font-black tracking-[-0.04em] text-white">Threat Ops</div>
              <div className="mt-1 truncate whitespace-nowrap text-nowrap text-xs text-soc-muted">Panel IPS / IDS</div>
            </div>
            <button
              className="hidden self-stretch px-2 items-center justify-center rounded-md border border-soc-outline/70 bg-soc-low text-soc-muted transition hover:border-soc-primary/50 hover:text-white lg:inline-flex"
              onClick={() => setIsCollapsed((collapsed) => !collapsed)}
              title={isCollapsed ? "Expandir navegación" : "Colapsar navegación"}
              type="button"
            >
              <span className="sr-only">{isCollapsed ? "Expandir navegación" : "Colapsar navegación"}</span>
              {isCollapsed ? <IconChevronRight size={18} stroke={1.8} /> : <IconChevronLeft size={18} stroke={1.8} />}
            </button>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-soc-outline/70 bg-soc-low text-soc-muted transition hover:border-soc-primary/50 hover:text-white lg:hidden"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <span className="sr-only">Cerrar navegación</span>
              <IconX size={18} stroke={1.8} />
            </button>
          </div>

          <div className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (pathname === "/" && item.href === "/live");
              const ItemIcon = item.icon;

              return (
                <Link
                  className={`group flex w-full items-center overflow-hidden rounded-lg border p-2 transition-[width,gap,transform,background-color,border-color,box-shadow] duration-300 hover:-translate-y-0.5 ${isCollapsed ? "lg:w-14 lg:justify-center lg:gap-0" : "gap-3 lg:w-full"} ${
                    isActive
                      ? "border-soc-primary/65 bg-soc-blue/20 text-white shadow-[0_0_28px_rgba(77,142,255,0.16)]"
                      : "border-soc-outline/70 bg-soc-lowest/45 text-soc-muted hover:border-soc-primary/35 hover:bg-soc-blue/10 hover:text-white"
                  }`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setIsOpen(false)}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${isActive ? "border-soc-primary/40 bg-soc-primary/10 text-soc-primary" : "border-soc-outline/70 bg-soc-low text-soc-muted group-hover:text-white"}`}>
                    <ItemIcon size={20} stroke={1.8} />
                  </div>
                  <span className={`min-w-0 max-w-full overflow-hidden transition-[width,opacity,transform] duration-300 ${isCollapsed ? "lg:w-0 lg:-translate-x-1 lg:opacity-0" : "lg:w-[168px] lg:translate-x-0 lg:opacity-100"}`}>
                    <span className="block truncate whitespace-nowrap text-nowrap text-xs font-black uppercase tracking-[0.13em]">{item.label}</span>
                    <span className="mt-1 block truncate whitespace-nowrap text-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-soc-muted">{item.detail}</span>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className={`mt-auto overflow-hidden truncate whitespace-nowrap text-nowrap rounded-lg border border-soc-outline/60 bg-soc-lowest/45 p-3 font-mono text-[10px] uppercase tracking-[0.14em] text-soc-muted transition-[max-height,opacity,padding,border-color] duration-300 ${isCollapsed ? "lg:max-h-0 lg:border-transparent lg:p-0 lg:opacity-0" : "lg:max-h-16 lg:opacity-100"}`}>
            Live buffer / Redis PubSub
          </div>
        </nav>
      </aside>
    </>
  );
}
