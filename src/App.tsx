import { Navigate, Route, Routes } from "react-router-dom";
import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { getStoredSession } from "./lib/mockApi";
import { SessionContext } from "./lib/session";
import type { StaffSession } from "./types";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AddTournamentPage } from "./pages/AddTournamentPage";
import { DrawResultPage } from "./pages/DrawResultPage";
import { HistoryPage } from "./pages/HistoryPage";
import { AdminPage } from "./pages/AdminPage";
import { TvDisplayPage } from "./pages/TvDisplayPage";

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
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={setSession} />} />
      <Route path="/tv" element={<TvDisplayPage />} />
      <Route element={<ProtectedRoutes session={session} onLogout={() => setSession(null)} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/add-tournament" element={<AddTournamentPage />} />
        <Route path="/draw-result" element={<DrawResultPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

