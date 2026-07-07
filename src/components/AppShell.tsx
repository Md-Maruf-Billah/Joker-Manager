import type { ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BarChart3, History, LogOut, Monitor, Plus, Shield, Spade } from "lucide-react";
import { clearSession } from "../lib/mockApi";
import type { StaffSession } from "../types";
import { Button } from "./Button";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/add-tournament", label: "Add", icon: Plus },
  { to: "/draw-result", label: "Draw", icon: Spade },
  { to: "/history", label: "History", icon: History },
  { to: "/admin", label: "Admin", icon: Shield },
  { to: "/tv", label: "TV", icon: Monitor }
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
    <div className="min-h-screen bg-felt-950 text-paper">
      <div className="border-b border-paper/10 bg-ink/88">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-gold-400 text-ink">
              <Spade className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-black">Joker Manager</div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted">PlayLive Melbourne</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 rounded-md border border-paper/10 bg-paper/5 px-3 py-2 text-sm text-muted">
              {session.staffName}
            </span>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[210px_1fr]">
        <nav className="grid grid-cols-3 gap-2 self-start sm:grid-cols-6 lg:sticky lg:top-6 lg:grid-cols-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition lg:justify-start",
                    isActive
                      ? "bg-gold-400 text-ink"
                      : "border border-paper/10 bg-paper/5 text-muted hover:bg-paper/9 hover:text-paper"
                  ].join(" ")
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
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
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-black text-paper">{title}</h1>
        {children ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{children}</p> : null}
      </div>
      {action}
    </div>
  );
}
