import type {
  AdminAdjustmentPayload,
  CreateTournamentPayload,
  JokerData,
  StaffSession,
  SubmitDrawPayload,
  UpsertTournamentTypePayload
} from "../types";
import { appError } from "./errors";
import { mockApi } from "./mockApi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw appError("JM-API-001", "API base URL is not configured.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const payload = (await response.json()) as { ok: boolean; data?: T; error?: string };

  if (!response.ok || !payload.ok) {
    if (payload.error?.startsWith("[")) {
      throw new Error(payload.error);
    }

    throw appError("JM-API-002", payload.error ?? "Request failed.");
  }

  return payload.data as T;
}

export const api = {
  verifyPin(staffName: string, pin: string): Promise<StaffSession> {
    if (!API_BASE_URL) {
      return mockApi.verifyPin(staffName, pin);
    }

    return request<StaffSession>("/api/auth/verify-pin", {
      method: "POST",
      body: JSON.stringify({ staffName, pin })
    });
  },
  dashboard() {
    if (!API_BASE_URL) {
      return mockApi.dashboard();
    }

    return request("/api/dashboard");
  },
  tournamentTypes(includeInactive = false) {
    if (!API_BASE_URL) {
      return mockApi.tournamentTypes(includeInactive);
    }

    return request(`/api/tournament-types${includeInactive ? "?includeInactive=true" : ""}`);
  },
  saveTournamentType(payload: UpsertTournamentTypePayload) {
    if (!API_BASE_URL) {
      return mockApi.saveTournamentType(payload);
    }

    return request("/api/tournament-types/save", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  createTournament(payload: CreateTournamentPayload) {
    if (!API_BASE_URL) {
      return mockApi.createTournament(payload);
    }

    return request("/api/tournament/create", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  pendingDraw() {
    if (!API_BASE_URL) {
      return mockApi.pendingDraw();
    }

    return request("/api/draw/pending");
  },
  cards() {
    if (!API_BASE_URL) {
      return mockApi.cards();
    }

    return request("/api/cards");
  },
  submitDraw(payload: SubmitDrawPayload) {
    if (!API_BASE_URL) {
      return mockApi.submitDraw(payload);
    }

    return request("/api/draw/submit", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  history() {
    if (!API_BASE_URL) {
      return mockApi.history();
    }

    return request("/api/history");
  },
  auditLog() {
    if (!API_BASE_URL) {
      return mockApi.auditLog();
    }

    return request("/api/admin/audit-log");
  },
  exportBackup(): Promise<JokerData | Record<string, unknown>> {
    if (!API_BASE_URL) {
      return mockApi.exportBackup();
    }

    return request("/api/admin/export-backup");
  },
  tv() {
    if (!API_BASE_URL) {
      return mockApi.tv();
    }

    return request("/api/tv");
  },
  adminAdjustment(payload: AdminAdjustmentPayload) {
    if (!API_BASE_URL) {
      return mockApi.adminAdjustment(payload);
    }

    return request("/api/admin/adjustment", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
