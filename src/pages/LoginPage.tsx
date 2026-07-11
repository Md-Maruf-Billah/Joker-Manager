import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { Button } from "../components/Button";
import { FormField, TextInput } from "../components/FormField";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { getStoredSession, storeSession } from "../lib/mockApi";
import type { StaffSession } from "../types";

const IS_MOCK_MODE = !import.meta.env.VITE_API_BASE_URL;

export function LoginPage({ onLogin }: { onLogin: (session: StaffSession) => void }) {
  const [staffName, setStaffName] = useState(IS_MOCK_MODE ? "staff" : "");
  const [pin, setPin] = useState(IS_MOCK_MODE ? "7777" : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const existing = getStoredSession();

  if (existing) {
    return <Navigate to="/dashboard" replace />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session = await api.verifyPin(staffName, pin);
      storeSession(session);
      onLogin(session);
    } catch (err) {
      setError(errorMessage(err, "JM-AUTH-900", "Login failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="grid min-h-screen place-items-center px-6 py-10"
      style={{
        background:
          "radial-gradient(ellipse 900px 600px at 50% 20%, rgba(236,30,36,0.06), transparent 60%), #F5F5F7"
      }}
    >
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center gap-4">
          <img src="/brand/playlive-icon.png" alt="PlayLive" className="h-[52px] w-auto" />
          <div className="text-center">
            <div className="text-[21px] font-extrabold text-ink">Joker Manager</div>
            <div className="mt-1 text-[12.5px] font-semibold uppercase tracking-[0.16em] text-faint">
              PlayLive Melbourne
            </div>
          </div>
        </div>
        <div className="rounded-[20px] border border-black/[0.08] bg-white p-7 shadow-panel">
          <form className="grid gap-4" onSubmit={submit}>
            <FormField label="Staff name">
              <TextInput
                value={staffName}
                onChange={(event) => setStaffName(event.target.value)}
                autoComplete="username"
                className="min-h-[46px]"
              />
            </FormField>
            <FormField label="Password">
              <TextInput
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                type="password"
                autoComplete="current-password"
                className="min-h-[46px]"
              />
            </FormField>
            {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
            <Button type="submit" disabled={loading} className="mt-1 min-h-12">
              <KeyRound className="h-4 w-4" />
              {loading ? "Checking..." : "Sign in"}
            </Button>
          </form>
          {IS_MOCK_MODE ? (
            <div className="mt-5 rounded-[10px] border border-black/[0.06] bg-black/[0.03] p-3 text-[12.5px] leading-6 text-muted">
              Demo mode: staff name <b className="text-inksoft">staff</b>, password{" "}
              <b className="text-inksoft">7777</b>.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
