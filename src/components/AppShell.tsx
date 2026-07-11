import type { ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BarChart3, History, LogOut, Monitor, Plus, Shield, Spade } from "lucide-react";
import { clearSession } from "../lib/mockApi";
import type { StaffSession } from "../types";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/add-tournament", label: "Add tournament", icon: Plus },
  { to: "/draw-result", label: "Draw result", icon: Spade },
  { to: "/history", label: "History", icon: History },
  { to: "/admin", label: "Admin", icon: Shield },
  { to: "/tv", label: "TV display", icon: Monitor }
];

export function AppShell({
  session,
  onLogout
}: {
  session: StaffSession;
  onLogout: () => void;
}) {
  const navigate = useNavigate();

  function handleLogout() {
    clearSession();
    onLogout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-surface text-ink">
      <aside className="sticky top-0 flex h-screen w-[220px] flex-shrink-0 flex-col border-r border-black/[0.08] bg-[rgba(246,246,248,0.8)] p-3.5 backdrop-blur-2xl backdrop-saturate-150 sm:w-[248px]">
        <div className="flex items-center gap-2.5 px-2.5 pb-5 pt-1.5">
          <img src="/brand/playlive-icon.png" alt="" className="h-[26px] w-auto" />
          <div className="min-w-0">
            <div className="truncate text-[14.5px] font-black leading-tight text-ink">Joker Manager</div>
            <div className="truncate text-[10px] font-semibold tracking-[0.14em] text-faint">PLAYLIVE MELBOURNE</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "flex min-h-[38px] items-center gap-2.5 rounded-[9px] px-3 text-[13.5px] font-semibold transition",
                    isActive ? "bg-brand-red text-white" : "text-muted hover:bg-black/[0.035] hover:text-ink"
                  ].join(" ")
                }
              >
                <Icon className="h-[17px] w-[17px] flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <div className="flex items-center gap-2.5 rounded-[10px] bg-black/[0.035] px-2.5 py-2.5">
            <div className="grid h-[26px] w-[26px] flex-shrink-0 place-items-center rounded-full bg-[#E5E5E7] text-xs font-bold text-[#48484a]">
              {session.staffName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-bold text-ink">{session.staffName}</div>
              <div className="text-[10.5px] text-faint">Staff access</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-9 items-center gap-2.5 rounded-[9px] border border-black/10 px-2.5 text-[12.5px] font-semibold text-muted transition hover:bg-black/[0.03]"
          >
            <LogOut className="h-[15px] w-[15px]" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 sm:py-10 lg:px-11 lg:pb-20">
        <div className="mx-auto max-w-[1220px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function PageTitle({
  title,
  children,
  action
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[27px] font-extrabold text-ink">{title}</h1>
        {children ? <p className="mt-1.5 max-w-[480px] text-sm leading-6 text-muted">{children}</p> : null}
      </div>
      {action}
    </div>
  );
}
