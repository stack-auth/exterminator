const API = "https://api.github.com";

export interface GitHubConfig {
  owner: string;
  repo: string;
  baseBranch: string;
}

export interface FileChange {
  path: string;
  content: string;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Get the SHA of the latest commit on a branch.
 */
export async function getBaseSha(
  token: string,
  config: GitHubConfig,
): Promise<string> {
  const res = await fetch(
    `${API}/repos/${config.owner}/${config.repo}/git/ref/heads/${config.baseBranch}`,
    { headers: headers(token) },
  );
  if (!res.ok) {
    throw new Error(`Failed to get base ref: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.object.sha;
}

/**
 * Create a new branch from a given SHA.
 */
export async function createBranch(
  token: string,
  config: GitHubConfig,
  branchName: string,
  sha: string,
): Promise<void> {
  const res = await fetch(
    `${API}/repos/${config.owner}/${config.repo}/git/refs`,
    {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to create branch: ${res.status} ${await res.text()}`);
  }
}

/**
 * Commit multiple file changes as a single commit using the Git Data API.
 *
 * Flow: create blobs → create tree → create commit → update branch ref.
 */
export async function commitFiles(
  token: string,
  config: GitHubConfig,
  branchName: string,
  files: FileChange[],
  message: string,
): Promise<string> {
  const hdrs = headers(token);
  const repoBase = `${API}/repos/${config.owner}/${config.repo}`;

  // Get current commit SHA for the branch (as parent)
  const refRes = await fetch(
    `${repoBase}/git/ref/heads/${branchName}`,
    { headers: hdrs },
  );
  if (!refRes.ok) {
    throw new Error(`Failed to get branch ref: ${refRes.status}`);
  }
  const refData = await refRes.json();
  const parentSha = refData.object.sha;

  // Get the tree SHA of the parent commit
  const commitRes = await fetch(
    `${repoBase}/git/commits/${parentSha}`,
    { headers: hdrs },
  );
  if (!commitRes.ok) {
    throw new Error(`Failed to get parent commit: ${commitRes.status}`);
  }
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // Create blobs for each file
  const treeItems = await Promise.all(
    files.map(async (file) => {
      const blobRes = await fetch(`${repoBase}/git/blobs`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          content: file.content,
          encoding: "utf-8",
        }),
      });
      if (!blobRes.ok) {
        throw new Error(`Failed to create blob for ${file.path}: ${blobRes.status}`);
      }
      const blob = await blobRes.json();
      return {
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      };
    }),
  );

  // Create tree
  const treeRes = await fetch(`${repoBase}/git/trees`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems,
    }),
  });
  if (!treeRes.ok) {
    throw new Error(`Failed to create tree: ${treeRes.status}`);
  }
  const tree = await treeRes.json();

  // Create commit
  const newCommitRes = await fetch(`${repoBase}/git/commits`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [parentSha],
    }),
  });
  if (!newCommitRes.ok) {
    throw new Error(`Failed to create commit: ${newCommitRes.status}`);
  }
  const newCommit = await newCommitRes.json();

  // Update branch ref to point to new commit
  const updateRes = await fetch(`${repoBase}/git/refs/heads/${branchName}`, {
    method: "PATCH",
    headers: hdrs,
    body: JSON.stringify({ sha: newCommit.sha }),
  });
  if (!updateRes.ok) {
    throw new Error(`Failed to update branch ref: ${updateRes.status}`);
  }

  return newCommit.sha;
}

/**
 * Open a pull request.
 */
export async function openPullRequest(
  token: string,
  config: GitHubConfig,
  head: string,
  title: string,
  body: string,
): Promise<string> {
  const res = await fetch(
    `${API}/repos/${config.owner}/${config.repo}/pulls`,
    {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        title,
        body,
        head,
        base: config.baseBranch,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to create PR: ${res.status} ${await res.text()}`);
  }
  const pr = await res.json();
  return pr.html_url;
}
