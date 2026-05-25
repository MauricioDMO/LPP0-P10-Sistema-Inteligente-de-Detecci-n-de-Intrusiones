"use client";

import {
  IconActivityHeartbeat,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconGlobe,
  IconHistory,
  IconLogout,
  IconMenu2,
  IconUsers,
  IconShieldLock,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { SuricataLogo } from "../brands/Suricata";

type NavIcon = ComponentType<Omit<SVGProps<SVGSVGElement>, "stroke"> & { size?: number | string; stroke?: number | string }>;

const navItems: Array<{ href: string; label: string; detail: string; icon: NavIcon; roles?: string[] }> = [
  { href: "/live", label: "En vivo", detail: "WebSocket", icon: IconActivityHeartbeat },
  { href: "/geo", label: "Geografía", detail: "Heatmap", icon: IconGlobe },
  { href: "/historical", label: "Histórico", detail: "Elasticsearch", icon: IconHistory },
  { href: "/rankings", label: "Rankings", detail: "Top N", icon: IconChartBar },
  { href: "/blocked", label: "Bloqueos", detail: "IPS", icon: IconShieldLock },
  { href: "/suricata", label: "Suricata", detail: "Reglas", icon: SuricataLogo, roles: ["admin", "analyst"] },
  { href: "/admin/users", label: "Usuarios", detail: "Admin", icon: IconUsers, roles: ["admin"] },
];

export function AppNav() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { user, isAuthenticated, hasRole, logout } = useAuth();
  const visibleNavItems = navItems.filter((item) => !item.roles || item.roles.some((role) => hasRole(role)));

  return (
    <>
      <button
        aria-controls="app-sidebar"
        aria-expanded={!isCollapsed}
        className="fixed left-3 top-3 z-50 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-soc-outline/80 bg-soc-low/95 text-white shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur transition hover:border-soc-primary/55 hover:bg-soc-blue/15 lg:hidden"
        onClick={() => setIsCollapsed(false)}
        type="button"
      >
        <span className="sr-only">Abrir navegación</span>
        <IconMenu2 size={21} stroke={1.8} />
      </button>

      {!isCollapsed ? (
        <button
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden"
          onClick={() => setIsCollapsed(true)}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-70 border-r border-soc-outline/80 bg-soc-low/95 px-3 py-3 text-foreground shadow-[28px_0_70px_rgba(0,0,0,0.38)] backdrop-blur-xl transition-[width,transform] duration-300 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 ${
          isCollapsed ? "-translate-x-full" : "translate-x-0"
        } ${isCollapsed ? "lg:w-20" : "lg:w-70"}`}
        id="app-sidebar"
      >
        <nav className="flex h-full flex-col" aria-label="Navegación principal">
          <div className={`mb-4 flex items-start justify-between gap-3 border-b border-soc-outline/45 px-2 pb-3 transition-[gap,padding] duration-300 ${isCollapsed ? "lg:justify-center lg:gap-0 lg:px-0" : ""}`}>
            <div className={`min-w-0 overflow-hidden transition-[width,opacity,transform] duration-300 ${isCollapsed ? "lg:w-0 lg:-translate-x-1 lg:opacity-0" : "lg:w-40 lg:translate-x-0 lg:opacity-100"}`}>
              <div className="truncate whitespace-nowrap text-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-soc-primary">Suricata</div>
              <div className="mt-1 truncate whitespace-nowrap text-nowrap text-lg font-black tracking-[-0.04em] text-white">Threat Ops</div>
              <div className="mt-1 truncate whitespace-nowrap text-nowrap text-xs text-soc-muted">Panel IPS / IDS</div>
            </div>
            <button
              className="hidden self-stretch px-2 items-center justify-center rounded-md text-soc-muted transition hover:bg-soc-blue/10 hover:text-white lg:inline-flex"
              onClick={() => setIsCollapsed((collapsed) => !collapsed)}
              title={isCollapsed ? "Expandir navegación" : "Colapsar navegación"}
              type="button"
            >
              <span className="sr-only">{isCollapsed ? "Expandir navegación" : "Colapsar navegación"}</span>
              {isCollapsed ? <IconChevronRight size={18} stroke={1.8} /> : <IconChevronLeft size={18} stroke={1.8} />}
            </button>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-soc-muted transition hover:bg-soc-blue/10 hover:text-white lg:hidden"
              onClick={() => setIsCollapsed(true)}
              type="button"
            >
              <span className="sr-only">Cerrar navegación</span>
              <IconX size={18} stroke={1.8} />
            </button>
          </div>

          <div className="divide-y divide-soc-outline/35">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href || (pathname.startsWith(`${item.href}/`) && item.href !== "/live") || (pathname === "/" && item.href === "/live");
              const ItemIcon = item.icon;

              return (
                <Link
                  className={`group flex w-full items-center overflow-hidden rounded-lg px-2 py-1.5 transition-[width,gap,transform,background-color,color] duration-300 hover:-translate-y-0.5 ${isCollapsed ? "lg:w-12 lg:justify-center lg:gap-0" : "gap-2.5 lg:w-full"} ${
                    isActive
                      ? "bg-soc-blue/18 text-white"
                      : "text-soc-muted hover:bg-soc-blue/10 hover:text-white"
                  }`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setIsCollapsed(true)}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${isActive ? "text-soc-primary" : "text-soc-muted group-hover:text-white"}`}>
                    <ItemIcon size={24} stroke={1.75} />
                  </div>
                  <span className={`min-w-0 max-w-full overflow-hidden transition-[width,opacity,transform] duration-300 ${isCollapsed ? "lg:w-0 lg:-translate-x-1 lg:opacity-0" : "lg:w-42 lg:translate-x-0 lg:opacity-100"}`}>
                    <span className="block truncate whitespace-nowrap text-nowrap text-xs font-black uppercase tracking-[0.13em]">{item.label}</span>
                    <span className="mt-1 block truncate whitespace-nowrap text-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-soc-muted">{item.detail}</span>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className={`mt-auto space-y-2 overflow-hidden border-t border-soc-outline/45 pt-3 transition-[max-height,opacity,padding,border-color] duration-300 ${isCollapsed ? "lg:max-h-0 lg:border-transparent lg:pt-0 lg:opacity-0" : "lg:max-h-40 lg:opacity-100"}`}>
            {isAuthenticated && user ? (
              <div className="px-2">
                <div className="truncate whitespace-nowrap text-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-soc-primary">{user.username}</div>
                <div className="mt-1 truncate whitespace-nowrap text-nowrap text-xs text-soc-muted">{user.roles.join(" · ")}</div>
                <button
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold text-soc-muted transition hover:bg-soc-danger/10 hover:text-white"
                  onClick={() => {
                    void logout();
                    setIsCollapsed(true);
                  }}
                  type="button"
                >
                  <IconLogout size={15} stroke={1.8} />
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <Link
                className="block rounded-lg px-3 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-soc-blue/15"
                href="/login"
                onClick={() => setIsCollapsed(true)}
              >
                Iniciar sesión
              </Link>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
}
