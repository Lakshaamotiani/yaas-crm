"use client";

/**
 * Role helpers — single source of truth for "is the current user an admin?"
 * questions across the app. Pairs with the role-based RLS policies in
 * migration 0005: anything the database refuses to do for non-admins should
 * also be hidden from non-admins in the UI, otherwise reps see buttons that
 * just toast "permission denied" when clicked.
 */

import * as React from "react";
import { useCurrentUser } from "./store";

export type Role = "admin" | "rep";

export function useRole(): Role {
  const user = useCurrentUser();
  return user?.role === "admin" ? "admin" : "rep";
}

export function useIsAdmin(): boolean {
  return useRole() === "admin";
}

/**
 * Render children only when the current user is an admin. Optional `fallback`
 * lets you swap in a placeholder (e.g. a disabled button or a teaser card) —
 * default is render-nothing.
 */
export function AdminOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return useIsAdmin() ? <>{children}</> : <>{fallback}</>;
}
