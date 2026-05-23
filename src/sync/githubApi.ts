const API_BASE = 'https://api.github.com';
export const REPO_NAME = 'thinknode-data';

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** UTF-8–safe base64 encode */
export function encodeContent(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

/** UTF-8–safe base64 decode */
export function decodeContent(base64: string): string {
  // GitHub returns base64 with newlines — strip them
  const cleaned = base64.replace(/\n/g, '');
  return decodeURIComponent(escape(atob(cleaned)));
}

/** Validate a PAT and return the authenticated username */
export async function validateToken(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/user`, { headers: headers(token) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.login as string;
  } catch {
    return null;
  }
}

/** Ensure the thinknode-data repo exists; create it (private) if not */
export async function ensureRepo(token: string, username: string): Promise<void> {
  const res = await fetch(`${API_BASE}/repos/${username}/${REPO_NAME}`, {
    headers: headers(token),
  });

  if (res.ok) return; // repo exists

  if (res.status === 404) {
    // Create the repo
    const createRes = await fetch(`${API_BASE}/user/repos`, {
      method: 'POST',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: REPO_NAME,
        description: 'ThinkNode mind map data (auto-created)',
        private: true,
        auto_init: true, // creates an initial commit with README
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(`Failed to create repo: ${(err as Record<string, string>).message || createRes.statusText}`);
    }

    // Wait a moment for GitHub to fully initialize the repo
    await new Promise((r) => setTimeout(r, 1500));
    return;
  }

  throw new Error(`Failed to check repo: ${res.statusText}`);
}

export interface FileResult {
  content: string;
  sha: string;
}

/** Read a file from the repo. Returns null if file doesn't exist. */
export async function getFile(
  token: string,
  owner: string,
  path: string
): Promise<FileResult | null> {
  const res = await fetch(
    `${API_BASE}/repos/${owner}/${REPO_NAME}/contents/${path}`,
    { headers: headers(token) }
  );

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error(`Failed to get file ${path}: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    content: decodeContent(data.content),
    sha: data.sha,
  };
}

/** Create or update a file. Pass sha to update an existing file. Returns new SHA. */
export async function putFile(
  token: string,
  owner: string,
  path: string,
  content: string,
  sha?: string,
  message?: string
): Promise<string> {
  const body: Record<string, string> = {
    message: message || `Update ${path}`,
    content: encodeContent(content),
  };
  if (sha) {
    body.sha = sha;
  }

  const res = await fetch(
    `${API_BASE}/repos/${owner}/${REPO_NAME}/contents/${path}`,
    {
      method: 'PUT',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to write ${path}: ${(err as Record<string, string>).message || res.statusText}`
    );
  }

  const data = await res.json();
  return data.content.sha as string;
}

/** Delete a file from the repo */
export async function deleteFile(
  token: string,
  owner: string,
  path: string,
  sha: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/repos/${owner}/${REPO_NAME}/contents/${path}`,
    {
      method: 'DELETE',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Delete ${path}`,
        sha,
      }),
    }
  );

  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete ${path}: ${res.statusText}`);
  }
}

/** List files in a directory. Returns array of file names. */
export async function listFiles(
  token: string,
  owner: string,
  path: string
): Promise<Array<{ name: string; sha: string }>> {
  const res = await fetch(
    `${API_BASE}/repos/${owner}/${REPO_NAME}/contents/${path}`,
    { headers: headers(token) }
  );

  if (res.status === 404) return [];

  if (!res.ok) {
    throw new Error(`Failed to list ${path}: ${res.statusText}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) return []; // single file, not a directory

  return data.map((f: { name: string; sha: string }) => ({
    name: f.name,
    sha: f.sha,
  }));
}
