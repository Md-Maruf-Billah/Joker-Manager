import { FormEvent, useEffect, useState } from "react";
import { Download, PlusCircle, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { PageTitle } from "../components/AppShell";
import { Button } from "../components/Button";
import { FormField, TextInput } from "../components/FormField";
import { Metric, Panel, PanelHeader } from "../components/Panel";
import { SelectField } from "../components/SelectField";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { formatCurrency, formatDateTime } from "../lib/format";
import { resetMockData } from "../lib/mockApi";
import { useSession } from "../lib/session";
import type { AuditLogEntry, DashboardData, TournamentType } from "../types";

export function AdminPage() {
  const session = useSession();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [tournamentTypes, setTournamentTypes] = useState<TournamentType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("__new");
  const [typeName, setTypeName] = useState("");
  const [typeShortName, setTypeShortName] = useState("");
  const [typeAmount, setTypeAmount] = useState("");
  const [typeActive, setTypeActive] = useState("true");
  const [typePassword, setTypePassword] = useState("");
  const [adjustmentType, setAdjustmentType] = useState("add");
  const [amount, setAmount] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const showDemoTools = import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL;

  async function load() {
    const [nextDashboard, nextAudit, nextTypes] = await Promise.all([
      api.dashboard(),
      api.auditLog(),
      api.tournamentTypes(true)
    ]);
    setDashboard(nextDashboard as DashboardData);
    setAudit(nextAudit as AuditLogEntry[]);
    setTournamentTypes(nextTypes as TournamentType[]);
  }

  useEffect(() => {
    void load().catch((err) => setError(errorMessage(err, "JM-ADMIN-001", "Could not load admin.")));
  }, []);

  function resetTypeForm() {
    setSelectedTypeId("__new");
    setTypeName("");
    setTypeShortName("");
    setTypeAmount("");
    setTypeActive("true");
    setTypePassword("");
  }

  function selectTournamentType(value: string) {
    setSelectedTypeId(value);
    if (value === "__new") {
      resetTypeForm();
      return;
    }

    const type = tournamentTypes.find((item) => item.id === value);
    if (!type) {
      return;
    }

    setTypeName(type.name);
    setTypeShortName(type.shortName);
    setTypeAmount(String(type.jackpotPerEntry));
    setTypeActive(String(type.active));
  }

  async function saveTournamentType(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await api.saveTournamentType({
        tournamentTypeId: selectedTypeId === "__new" ? undefined : selectedTypeId,
        name: typeName,
        shortName: typeShortName,
        jackpotPerEntry: Number(typeAmount),
        active: typeActive === "true",
        staffName: session.staffName,
        pin: typePassword
      });
      setMessage("Tournament type saved. Add Tournament dropdown updated.");
      resetTypeForm();
      await load();
    } catch (err) {
      setError(errorMessage(err, "JM-TYPE-900", "Tournament type save failed."));
    } finally {
      setLoading(false);
    }
  }

  async function exportBackup() {
    setError("");
    setMessage("");

    try {
      const backup = await api.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `joker-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Backup exported.");
    } catch (err) {
      setError(errorMessage(err, "JM-BACKUP-001", "Backup export failed."));
    }
  }

  function resetDemo() {
    resetMockData();
    setMessage("Demo data reset.");
    void load();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (adjustmentType === "reset_deck" && resetConfirm !== "RESET") {
      setError("[JM-ADJ-003] Type RESET before resetting the deck.");
      return;
    }

    setLoading(true);

    try {
      await api.adminAdjustment({
        adjustmentType: adjustmentType as "add" | "subtract" | "set" | "reset_deck",
        amount: adjustmentType === "reset_deck" ? undefined : Number(amount),
        reason,
        staffName: session.staffName,
        pin
      });
      setMessage("Adjustment applied and logged.");
      setAmount("");
      setResetConfirm("");
      setReason("");
      setPin("");
      await load();
    } catch (err) {
      setError(errorMessage(err, "JM-ADJ-900", "Adjustment failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageTitle
        title="Admin"
        action={
          <div className="flex flex-wrap gap-2">
            {showDemoTools ? (
              <Button type="button" variant="danger" onClick={resetDemo}>
                <RotateCcw className="h-4 w-4" />
                Reset demo data
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => void exportBackup()}>
              <Download className="h-4 w-4" />
              Export backup
            </Button>
          </div>
        }
      >
        Change jackpot state and tournament dropdown values with the shared staff account.
      </PageTitle>
      {error ? <div className="mb-4"><StatusMessage tone="error">{error}</StatusMessage></div> : null}
      {message ? <div className="mb-4"><StatusMessage tone="success">{message}</StatusMessage></div> : null}
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <PanelHeader
            title="Tournament types"
            action={
              <Button type="button" variant="secondary" onClick={resetTypeForm}>
                <PlusCircle className="h-4 w-4" />
                New type
              </Button>
            }
          >
            Add or edit tournament names and per-entry jackpot amounts. Active types appear in Add Tournament.
          </PanelHeader>
          <form className="grid gap-4 p-5" onSubmit={saveTournamentType}>
            <SelectField
              label="Edit existing"
              value={selectedTypeId}
              onValueChange={selectTournamentType}
              options={[
                { value: "__new", label: "Create new tournament type" },
                ...tournamentTypes.map((type) => ({
                  value: type.id,
                  label: type.name,
                  detail: `${formatCurrency(type.jackpotPerEntry)} per entry${type.active ? "" : " (inactive)"}`
                }))
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Tournament name">
                <TextInput value={typeName} onChange={(event) => setTypeName(event.target.value)} placeholder="Friday Joker Bounty" />
              </FormField>
              <FormField label="Short name">
                <TextInput value={typeShortName} onChange={(event) => setTypeShortName(event.target.value)} placeholder="Friday Joker" />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Jackpot per entry">
                <TextInput value={typeAmount} onChange={(event) => setTypeAmount(event.target.value)} inputMode="decimal" placeholder="40" />
              </FormField>
              <SelectField
                label="Status"
                value={typeActive}
                onValueChange={setTypeActive}
                options={[
                  { value: "true", label: "Active" },
                  { value: "false", label: "Inactive" }
                ]}
              />
            </div>
            <FormField label="Staff password">
              <TextInput value={typePassword} onChange={(event) => setTypePassword(event.target.value)} type="password" />
            </FormField>
            <Button variant="admin" type="submit" disabled={!typeName.trim() || !typeAmount || !typePassword || loading}>
              <Save className="h-4 w-4" />
              {loading ? "Saving..." : "Save tournament type"}
            </Button>
          </form>
        </Panel>
        <Panel>
          <PanelHeader title="Current state">Manual adjustment tools for exceptional corrections.</PanelHeader>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Metric label="Current jackpot" value={dashboard ? formatCurrency(dashboard.jackpotState.currentJackpot) : "..."} tone="gold" />
            <Metric label="Cards remaining" value={dashboard ? `${dashboard.jackpotState.cardsRemaining} / 53` : "..."} tone="green" />
          </div>
          <form className="grid gap-4 border-t border-paper/10 p-5" onSubmit={submit}>
            <SelectField
              label="Adjustment type"
              value={adjustmentType}
              onValueChange={setAdjustmentType}
              options={[
                { value: "add", label: "Add amount" },
                { value: "subtract", label: "Subtract amount" },
                { value: "set", label: "Set amount" },
                { value: "reset_deck", label: "Reset deck" }
              ]}
            />
            {adjustmentType !== "reset_deck" ? (
              <FormField label="Amount">
                <TextInput value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="500" />
              </FormField>
            ) : (
              <div className="rounded-md border border-joker-red/35 bg-joker-red/10 p-4">
                <div className="text-sm font-black text-paper">Deck reset confirmation</div>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Reset deck removes all cards from current cycle demo view and sets cards remaining to 53.
                </p>
                <FormField label="Type RESET">
                  <TextInput value={resetConfirm} onChange={(event) => setResetConfirm(event.target.value)} placeholder="RESET" />
                </FormField>
              </div>
            )}
            <FormField label="Reason">
              <TextInput value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Correction reason" />
            </FormField>
            <FormField label="Staff password">
              <TextInput value={pin} onChange={(event) => setPin(event.target.value)} type="password" />
            </FormField>
            <Button
              variant="admin"
              type="submit"
              disabled={!reason.trim() || !pin || loading || (adjustmentType === "reset_deck" && resetConfirm !== "RESET")}
            >
              <ShieldCheck className="h-4 w-4" />
              {loading ? "Applying..." : "Apply adjustment"}
            </Button>
          </form>
        </Panel>
        <Panel className="xl:col-span-2">
          <PanelHeader title="Change log">Every write action leaves a trail.</PanelHeader>
          <div className="max-h-[620px] overflow-auto divide-y divide-paper/10">
            {audit.map((log) => (
              <div key={log.logId} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-semibold text-paper">{log.action}</span>
                  <span className="text-xs text-muted">{formatDateTime(log.timestamp)}</span>
                </div>
                <div className="mt-2 text-sm leading-6 text-muted">
                  {log.staffName} ({log.role}) changed {log.fieldChanged} from {log.oldValue || "blank"} to {log.newValue || "blank"}.
                </div>
                <div className="mt-1 text-xs text-muted">Reason: {log.reason}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
