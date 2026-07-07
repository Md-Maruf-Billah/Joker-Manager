import { createContext, useContext } from "react";
import type { StaffSession } from "../types";

export const SessionContext = createContext<StaffSession | null>(null);

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("Session is not available.");
  }

  return session;
}

