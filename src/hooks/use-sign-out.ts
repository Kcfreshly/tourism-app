"use client";
import { useState } from "react";
import { authClient } from "@/components/auth-client";
import { forgetTravellerState } from "./browser-store";
import { flushBucketSync } from "./use-bucket-sync";

// Saves any unsent bucket change, ends the app session and the account
// session, then clears what this browser remembers about the traveller. Resolves false if sign-out failed,
// in which case nothing is cleared.
export function useSignOut() {
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    setSigningOut(true);
    try {
      await flushBucketSync();
      const response = await fetch("/api/v1/session", { method: "DELETE" });
      if (!response.ok) return false;
      await authClient.signOut();
      forgetTravellerState();
      return true;
    } catch {
      return false;
    } finally {
      setSigningOut(false);
    }
  }
  return { signOut, signingOut };
}
