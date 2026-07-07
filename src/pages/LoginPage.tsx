import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { KeyRound, Spade } from "lucide-react";
import { Button } from "../components/Button";
import { FormField, TextInput } from "../components/FormField";
import { Panel } from "../components/Panel";
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
    <main className="grid min-h-screen place-items-center bg-felt-950 px-4 py-10 text-paper">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-gold-400 text-ink">
            <Spade className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Joker Manager</h1>
            <p className="text-sm text-muted">PlayLive Melbourne</p>
          </div>
        </div>
        <Panel className="p-5">
          <form className="grid gap-4" onSubmit={submit}>
            <FormField label="Staff name">
              <TextInput value={staffName} onChange={(event) => setStaffName(event.target.value)} autoComplete="username" />
            </FormField>
            <FormField label="Password">
              <TextInput
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </FormField>
            {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
            <Button type="submit" disabled={loading}>
              <KeyRound className="h-4 w-4" />
              {loading ? "Checking..." : "Enter dashboard"}
            </Button>
          </form>
          {IS_MOCK_MODE ? (
            <div className="mt-5 rounded-md border border-paper/10 bg-paper/5 p-3 text-xs leading-5 text-muted">
              Demo mode: staff uses 7777. Same account unlocks staff and admin tools.
            </div>
          ) : null}
        </Panel>
      </div>
    </main>
  );
}
