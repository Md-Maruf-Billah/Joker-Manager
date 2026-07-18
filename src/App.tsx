import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, useState } from "react";
import { AppShell } from "./components/AppShell";
import { getStoredSession } from "./lib/mockApi";
import { SessionContext } from "./lib/session";
import type { StaffSession } from "./types";
import { LoginPage } from "./pages/LoginPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const AddTournamentPage = lazy(() => import("./pages/AddTournamentPage").then((m) => ({ default: m.AddTournamentPage })));
const DrawResultPage = lazy(() => import("./pages/DrawResultPage").then((m) => ({ default: m.DrawResultPage })));
const HistoryPage = lazy(() => import("./pages/HistoryPage").then((m) => ({ default: m.HistoryPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then((m) => ({ default: m.AdminPage })));
const TvDisplayPage = lazy(() => import("./pages/TvDisplayPage").then((m) => ({ default: m.TvDisplayPage })));
const WaitlistPage = lazy(() => import("./pages/WaitlistPage").then((m) => ({ default: m.WaitlistPage })));
const WaitlistTvPage = lazy(() => import("./pages/WaitlistTvPage").then((m) => ({ default: m.WaitlistTvPage })));

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-paper/15 border-t-gold-400" />
    </div>
  );
}

function ProtectedRoutes({
  session,
  onLogout
}: {
  session: StaffSession | null;
  onLogout: () => void;
}) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SessionContext.Provider value={session}>
      <AppShell session={session} onLogout={onLogout} />
    </SessionContext.Provider>
  );
}

export default function App() {
  const [session, setSession] = useState<StaffSession | null>(() => getStoredSession());

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={setSession} />} />
        <Route path="/tv" element={<TvDisplayPage />} />
        <Route path="/waitlist-tv" element={<WaitlistTvPage />} />
        <Route element={<ProtectedRoutes session={session} onLogout={() => setSession(null)} />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/add-tournament" element={<AddTournamentPage />} />
          <Route path="/draw-result" element={<DrawResultPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/waitlist" element={<WaitlistPage />} />
        </Route>
        <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </Suspense>
  );
}
