"use client";

import { useUser } from "@stackframe/stack";
import { stackClientApp } from "@/lib/stack-client";

/**
 * Returns the GitHub OAuth access token from the user's connected account.
 * Returns null if not connected yet.
 */
export function useGitHubToken() {
  const user = useUser();
  const account = user?.useConnectedAccount("github", { or: "return-null" });
  const token = account?.useAccessToken();
  return token?.accessToken ?? null;
}

/**
 * Initiates the GitHub OAuth connection flow with `repo` scope.
 * Call this when the user hasn't connected their GitHub account yet.
 */
export async function connectGitHub() {
  await stackClientApp.signInWithOAuth("github", {
    scopes: ["repo"],
  });
}
