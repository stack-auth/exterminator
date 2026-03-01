"use client";

import {
  type GitHubConfig,
  type FileChange,
  getBaseSha,
  createBranch,
  commitFiles,
  openPullRequest,
} from "@/lib/github";

export interface CreatePrParams {
  token: string;
  config: GitHubConfig;
  files: FileChange[];
  title: string;
  body: string;
  branchName: string;
  commitMessage: string;
}

export interface CreatePrResult {
  success: boolean;
  prUrl: string | null;
  error?: string;
}

export async function createPr(
  params: CreatePrParams,
): Promise<CreatePrResult> {
  const { token, config, files, title, body, branchName, commitMessage } =
    params;

  try {
    const baseSha = await getBaseSha(token, config);
    await createBranch(token, config, branchName, baseSha);
    await commitFiles(token, config, branchName, files, commitMessage);
    const prUrl = await openPullRequest(token, config, branchName, title, body);

    return { success: true, prUrl };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, prUrl: null, error: message };
  }
}
