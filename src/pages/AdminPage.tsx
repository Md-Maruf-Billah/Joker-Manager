import { Fragment, FormEvent, useEffect, useState } from "react";
import { Download, KeyRound, PlusCircle, RotateCcw, Save, ShieldCheck, UserCheck, UserPlus, UserX, X } from "lucide-react";
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
import type { AuditLogEntry, DashboardData, StaffListItem, TournamentType } from "../types";

type StaffRowMode = { staffId: string; kind: "pin" | "toggle" } | null;

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

  const [staffList, setStaffList] = useState<StaffListItem[]>([]);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffPin, setNewStaffPin] = useState("");
  const [addStaffPassword, setAddStaffPassword] = useState("");
  const [staffRowMode, setStaffRowMode] = useState<StaffRowMode>(null);
  const [rowPinValue, setRowPinValue] = useState("");
  const [rowPassword, setRowPassword] = useState("");
  const [staffError, setStaffError] = useState("");
  const [staffMessage, setStaffMessage] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);

  async function load() {
    const [nextDashboard, nextAudit, nextTypes, nextStaff] = await Promise.all([
      api.dashboard(),
      api.auditLog(),
      api.tournamentTypes(true),
      api.staffList()
    ]);
    setDashboard(nextDashboard as DashboardData);
    setAudit(nextAudit as AuditLogEntry[]);
    setTournamentTypes(nextTypes as TournamentType[]);
    setStaffList(nextStaff);
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

  async function submitAddStaff(event: FormEvent) {
    event.preventDefault();
    setStaffError("");
    setStaffMessage("");
    setStaffLoading(true);

    try {
      await api.createStaff({
        newStaffName,
        newPin: newStaffPin,
        staffName: session.staffName,
        pin: addStaffPassword
      });
      setStaffMessage(`${newStaffName} added.`);
      setNewStaffName("");
      setNewStaffPin("");
      setAddStaffPassword("");
      await load();
    } catch (err) {
      setStaffError(errorMessage(err, "JM-STAFF-900", "Could not add staff member."));
    } finally {
      setStaffLoading(false);
    }
  }

  function openStaffRow(staffId: string, kind: "pin" | "toggle") {
    setStaffRowMode({ staffId, kind });
    setRowPinValue("");
    setRowPassword("");
    setStaffError("");
    setStaffMessage("");
  }

  function closeStaffRow() {
    setStaffRowMode(null);
    setRowPinValue("");
    setRowPassword("");
  }

  async function submitPinReset(event: FormEvent, member: StaffListItem) {
    event.preventDefault();
    setStaffError("");
    setStaffMessage("");
    setStaffLoading(true);

    try {
      await api.setStaffPin({
        targetStaffName: member.staffName,
        newPin: rowPinValue,
        staffName: session.staffName,
        pin: rowPassword
      });
      setStaffMessage(`PIN updated for ${member.staffName}.`);
      closeStaffRow();
      await load();
    } catch (err) {
      setStaffError(errorMessage(err, "JM-STAFF-901", "Could not reset PIN."));
    } finally {
      setStaffLoading(false);
    }
  }

  async function submitToggleActive(event: FormEvent, member: StaffListItem) {
    event.preventDefault();
    setStaffError("");
    setStaffMessage("");
    setStaffLoading(true);

    try {
      await api.setStaffActive({
        targetStaffName: member.staffName,
        active: !member.active,
        staffName: session.staffName,
        pin: rowPassword
      });
      setStaffMessage(`${member.staffName} ${member.active ? "deactivated" : "reactivated"}.`);
      closeStaffRow();
      await load();
    } catch (err) {
      setStaffError(errorMessage(err, "JM-STAFF-902", "Could not update staff status."));
    } finally {
      setStaffLoading(false);
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
        Change jackpot state, tournament dropdown values, and staff access. Every staff member has the same permission
        level.
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
          <PanelHeader
            title="Staff"
            action={<span className="text-xs text-muted">{staffList.filter((item) => item.active).length} active</span>}
          >
            Add staff members, reset PINs, and deactivate accounts. Everyone shares the same permission level.
          </PanelHeader>
          <form className="grid gap-4 border-b border-paper/10 p-5 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submitAddStaff}>
            <FormField label="New staff name">
              <TextInput value={newStaffName} onChange={(event) => setNewStaffName(event.target.value)} placeholder="Sarah" />
            </FormField>
            <FormField label="New PIN" hint="At least 4 characters">
              <TextInput value={newStaffPin} onChange={(event) => setNewStaffPin(event.target.value)} type="password" />
            </FormField>
            <FormField label="Your staff password">
              <TextInput value={addStaffPassword} onChange={(event) => setAddStaffPassword(event.target.value)} type="password" />
            </FormField>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={!newStaffName.trim() || newStaffPin.length < 4 || !addStaffPassword || staffLoading}
              >
                <UserPlus className="h-4 w-4" />
                {staffLoading ? "Adding..." : "Add staff"}
              </Button>
            </div>
          </form>
          {staffError ? <div className="p-5 pb-0"><StatusMessage tone="error">{staffError}</StatusMessage></div> : null}
          {staffMessage ? <div className="p-5 pb-0"><StatusMessage tone="success">{staffMessage}</StatusMessage></div> : null}
          <div className="divide-y divide-paper/10">
            {staffList.map((member) => {
              const expanded = staffRowMode?.staffId === member.staffId ? staffRowMode.kind : null;

              return (
                <Fragment key={member.staffId}>
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <div className="font-semibold text-paper">{member.staffName}</div>
                      <div className="text-xs text-muted">{member.active ? "Active" : "Inactive"}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-9 px-2.5 text-xs"
                        onClick={() => (expanded === "pin" ? closeStaffRow() : openStaffRow(member.staffId, "pin"))}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Reset PIN
                      </Button>
                      <Button
                        type="button"
                        variant={member.active ? "danger" : "secondary"}
                        className="min-h-9 px-2.5 text-xs"
                        onClick={() => (expanded === "toggle" ? closeStaffRow() : openStaffRow(member.staffId, "toggle"))}
                      >
                        {member.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                        {member.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </div>
                  {expanded === "pin" ? (
                    <div className="bg-paper/[0.03] p-4">
                      <form className="grid gap-4 sm:grid-cols-3" onSubmit={(event) => void submitPinReset(event, member)}>
                        <FormField label="New PIN" hint="At least 4 characters">
                          <TextInput value={rowPinValue} onChange={(event) => setRowPinValue(event.target.value)} type="password" />
                        </FormField>
                        <FormField label="Your staff password">
                          <TextInput value={rowPassword} onChange={(event) => setRowPassword(event.target.value)} type="password" />
                        </FormField>
                        <div className="flex items-end gap-2">
                          <Button type="submit" disabled={rowPinValue.length < 4 || !rowPassword || staffLoading}>
                            {staffLoading ? "Saving..." : "Save PIN"}
                          </Button>
                          <Button type="button" variant="ghost" onClick={closeStaffRow}>
                            <X className="h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </div>
                  ) : null}
                  {expanded === "toggle" ? (
                    <div className="bg-paper/[0.03] p-4">
                      <form className="grid gap-4 sm:grid-cols-3" onSubmit={(event) => void submitToggleActive(event, member)}>
                        <FormField label="Your staff password">
                          <TextInput value={rowPassword} onChange={(event) => setRowPassword(event.target.value)} type="password" />
                        </FormField>
                        <div className="flex items-end gap-2 sm:col-span-2">
                          <Button type="submit" variant={member.active ? "danger" : "primary"} disabled={!rowPassword || staffLoading}>
                            {staffLoading ? "Applying..." : member.active ? "Confirm deactivate" : "Confirm reactivate"}
                          </Button>
                          <Button type="button" variant="ghost" onClick={closeStaffRow}>
                            <X className="h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </div>
                  ) : null}
                </Fragment>
              );
            })}
          </div>
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
