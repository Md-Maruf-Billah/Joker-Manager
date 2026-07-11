export type Role = "staff" | "admin";

export type TournamentType = {
  id: string;
  name: string;
  shortName: string;
  jackpotPerEntry: number;
  active: boolean;
};

export type JackpotState = {
  jackpotId: "JOKER_MAIN";
  currentCycleId: string;
  currentJackpot: number;
  cardsRemaining: number;
  lastCardPulled: string | null;
  lastRunId: string | null;
  lastUpdated: string;
};

export type RunStatus = "Awaiting Draw" | "Complete" | "Voided";

export type TournamentRun = {
  runId: string;
  date: string;
  timeCreated: string;
  tournamentTypeId: string;
  tournamentName: string;
  entries: number;
  jackpotPerEntry: number;
  contribution: number;
  openingJackpot: number;
  availableJackpot: number;
  winnerName: string | null;
  cardPulled: string | null;
  jokerHit: boolean;
  jackpotPaid: number;
  closingJackpot: number;
  cardsBefore: number;
  cardsAfter: number;
  staffName: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
};

export type RemovedCard = {
  cycleId: string;
  card: string;
  runId: string;
  removedDate: string;
  playerName: string;
};

export type JackpotCycle = {
  cycleId: string;
  startDate: string;
  endDate: string | null;
  startingDeckSize: number;
  totalContributions: number;
  jackpotPaid: number;
  winnerName: string | null;
  winningRunId: string | null;
  cardsRemainingWhenHit: number | null;
  status: "Active" | "Closed";
};

export type AuditLogEntry = {
  logId: string;
  timestamp: string;
  staffName: string;
  role: Role;
  action:
    | "CREATE_RUN"
    | "SUBMIT_DRAW"
    | "EDIT_RUN"
    | "VOID_RUN"
    | "MANUAL_ADJUSTMENT"
    | "SAVE_TOURNAMENT_TYPE"
    | "VERIFY_PASSWORD"
    | "CREATE_STAFF"
    | "SET_STAFF_PIN"
    | "SET_STAFF_ACTIVE"
    | "PUSH_TV_ANNOUNCEMENT"
    | "CLEAR_TV_ANNOUNCEMENT";
  recordId: string;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  reason: string;
  source: "dashboard" | "admin" | "api";
};

export type StaffMember = {
  staffId: string;
  staffName: string;
  passwordHash: string;
  role: Role;
  active: boolean;
};

export type StaffListItem = {
  staffId: string;
  staffName: string;
  role: Role;
  active: boolean;
};

export type StaffSession = {
  staffName: string;
  role: Role;
  expiresAt: string;
};

export type JokerData = {
  settings: Record<string, string>;
  tournamentTypes: TournamentType[];
  jackpotState: JackpotState;
  runs: TournamentRun[];
  removedCards: RemovedCard[];
  cycles: JackpotCycle[];
  auditLog: AuditLogEntry[];
  staff: StaffMember[];
};

export type CardView = {
  code: string;
  label: string;
  rank: string;
  suit: string | null;
  suitName: string | null;
  color: "red" | "black" | "joker";
  removed: boolean;
  removal?: RemovedCard;
};

export type TvTier = "fresh" | "building" | "hot" | "probability" | "danger";

export type TvMessage = {
  active: boolean;
  title: string;
  sub: string;
};

export type TvDisplayData = {
  jackpot: number;
  cardsRemaining: number;
  tier: TvTier;
  showLatestWinner: boolean;
  showProbability: boolean;
  latestWinner: {
    name: string;
    amount: number;
  } | null;
  copy: {
    headline: string;
    subline: string;
    cta: string;
  };
  tvMessage: TvMessage;
  refreshedAt: string;
};

export type JackpotTrendPoint = {
  date: string;
  jackpot: number;
};

export type DashboardData = {
  jackpotState: JackpotState;
  pendingRun: TournamentRun | null;
  latestRun: TournamentRun | null;
  activeCycle: JackpotCycle;
  recentAudit: AuditLogEntry[];
  jackpotTrend: JackpotTrendPoint[];
};

export type LoginBootstrapData = {
  session: StaffSession;
  dashboard: DashboardData;
};

export type AddTournamentBootstrapData = {
  tournamentTypes: TournamentType[];
  dashboard: DashboardData;
};

export type DrawBootstrapData = {
  pendingRun: TournamentRun | null;
  cards: CardView[];
};

export type HistoryBootstrapData = {
  runs: TournamentRun[];
  dashboard: DashboardData;
};

export type AdminBootstrapData = {
  dashboard: DashboardData;
  audit: AuditLogEntry[];
  tournamentTypes: TournamentType[];
  staffList: StaffListItem[];
  tvMessage: TvMessage;
};

export type CreateTournamentPayload = {
  tournamentTypeId: string;
  entries: number;
  staffName: string;
  pin: string;
};

export type SubmitDrawPayload = {
  runId: string;
  winnerName: string;
  cardPulled: string;
  staffName: string;
  pin: string;
  jokerConfirmed: boolean;
};

export type AdminAdjustmentPayload = {
  adjustmentType: "add" | "subtract" | "set" | "reset_deck";
  amount?: number;
  reason: string;
  staffName: string;
  pin: string;
};

export type UpsertTournamentTypePayload = {
  tournamentTypeId?: string;
  name: string;
  shortName: string;
  jackpotPerEntry: number;
  active: boolean;
  staffName: string;
  pin: string;
};

export type EditRunPayload = {
  runId: string;
  staffName: string;
  pin: string;
  reason: string;
  winnerName?: string;
  entries?: number;
};

export type VoidRunPayload = {
  runId: string;
  staffName: string;
  pin: string;
  reason: string;
};

export type CreateStaffPayload = {
  newStaffName: string;
  newPin: string;
  staffName: string;
  pin: string;
};

export type SetStaffPinPayload = {
  targetStaffName: string;
  newPin: string;
  staffName: string;
  pin: string;
};

export type SetStaffActivePayload = {
  targetStaffName: string;
  active: boolean;
  staffName: string;
  pin: string;
};

export type PushTvAnnouncementPayload = {
  title: string;
  sub: string;
  staffName: string;
  pin: string;
};

export type ClearTvAnnouncementPayload = {
  staffName: string;
  pin: string;
};
