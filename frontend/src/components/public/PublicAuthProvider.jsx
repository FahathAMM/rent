"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { AuthDialog } from "@/components/auth/AuthDialog";

const PublicAuthContext = createContext(null);

/**
 * One AuthDialog shared by every (public) page instead of each page
 * wiring up its own authView state + <AuthDialog> instance — the popup
 * itself (AuthDialog) is unchanged; this just gives every page under
 * (public)/layout.jsx a single `openAuth("login" | "register")` call
 * instead of repeating the same three lines of state.
 */
export function PublicAuthProvider({ children }) {
  const [view, setView] = useState(null); // "login" | "register" | null

  const openAuth = useCallback((initialView = "login") => setView(initialView), []);
  const closeAuth = useCallback(() => setView(null), []);

  return (
    <PublicAuthContext.Provider value={{ openAuth }}>
      {children}
      <AuthDialog
        open={!!view}
        onOpenChange={(v) => !v && closeAuth()}
        initialView={view ?? "login"}
      />
    </PublicAuthContext.Provider>
  );
}

export function usePublicAuth() {
  const ctx = useContext(PublicAuthContext);
  if (!ctx) {
    throw new Error("usePublicAuth() must be used within a (public) route — PublicAuthProvider is missing from the layout.");
  }
  return ctx;
}
