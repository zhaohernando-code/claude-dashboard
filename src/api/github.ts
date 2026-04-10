/**
 * GitHub REST API 调用层（前端）
 * PAT 存于 localStorage，所有请求通过浏览器直接调用 GitHub API
 */

const API = 'https://api.github.com';

export const STATUS_LABELS = ['status:pending', 'status:running', 'status:completed', 'status:failed'] as const;
export type StatusLabel = typeof STATUS_LABELS[number];

export function getToken(): string {
  return localStorage.getItem('gh_token') || '';
}

export function setToken(token: string) {
  localStorage.setItem('gh_token', token);
}

export function clearToken() {
  localStorage.removeItem('gh_token');
}

function headers(token?: string): HeadersInit {
  return {
    'Authorization': `Bearer ${token || getToken()}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null as T;
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`GitHub API ${method} ${path} → ${res.status}: ${msg}`);
  }
  return res.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface GHUser {
  login: string;
  avatar_url: string;
  name: string;
}

export async function getMe(): Promise<GHUser> {
  return req('GET', '/user');
}

// ─── Repos ───────────────────────────────────────────────────────────────────

export interface GHRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  updated_at: string;
  open_issues_count: number;
  owner: { login: string; avatar_url: string };
}

export async function listRepos(username: string): Promise<GHRepo[]> {
  return req('GET', `/users/${username}/repos?per_page=100&sort=updated`);
}

export async function createRepo(name: string, description = '', isPrivate = false): Promise<GHRepo> {
  return req('POST', '/user/repos', { name, description, private: isPrivate, auto_init: true });
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export interface GHLabel {
  id: number;
  name: string;
  color: string;
}

export async function ensureStatusLabels(owner: string, repo: string): Promise<void> {
  const existing: GHLabel[] = await req('GET', `/repos/${owner}/${repo}/labels?per_page=100`);
  const existingNames = new Set(existing.map(l => l.name));
  const colors: Record<string, string> = {
    'status:pending': 'e4e669',
    'status:running': '0075ca',
    'status:completed': '0e8a16',
    'status:failed': 'd73a4a',
  };
  for (const label of STATUS_LABELS) {
    if (!existingNames.has(label)) {
      try {
        await req('POST', `/repos/${owner}/${repo}/labels`, { name: label, color: colors[label] });
      } catch { /* ignore 422 */ }
    }
  }
}

// ─── Issues ──────────────────────────────────────────────────────────────────

export interface GHIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  labels: GHLabel[];
  created_at: string;
  updated_at: string;
  comments: number;
}

export function getIssueStatus(issue: GHIssue): StatusLabel | null {
  for (const label of issue.labels) {
    if (STATUS_LABELS.includes(label.name as StatusLabel)) {
      return label.name as StatusLabel;
    }
  }
  return null;
}

export async function listIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'all'): Promise<GHIssue[]> {
  return req('GET', `/repos/${owner}/${repo}/issues?state=${state}&per_page=100&sort=created&direction=desc`);
}

export async function getIssue(owner: string, repo: string, number: number): Promise<GHIssue> {
  return req('GET', `/repos/${owner}/${repo}/issues/${number}`);
}

export async function createIssue(owner: string, repo: string, title: string, body: string): Promise<GHIssue> {
  await ensureStatusLabels(owner, repo);
  return req('POST', `/repos/${owner}/${repo}/issues`, { title, body, labels: ['status:pending'] });
}

export async function setIssueLabels(owner: string, repo: string, number: number, labels: string[]): Promise<GHIssue> {
  return req('PATCH', `/repos/${owner}/${repo}/issues/${number}`, { labels });
}

export async function retryIssue(owner: string, repo: string, issue: GHIssue): Promise<GHIssue> {
  const otherLabels = issue.labels
    .map(l => l.name)
    .filter(n => !STATUS_LABELS.includes(n as StatusLabel));
  return setIssueLabels(owner, repo, issue.number, [...otherLabels, 'status:pending']);
}

// ─── Comments ────────────────────────────────────────────────────────────────

export interface GHComment {
  id: number;
  body: string;
  created_at: string;
  user: { login: string; avatar_url: string };
}

export async function listComments(owner: string, repo: string, number: number): Promise<GHComment[]> {
  return req('GET', `/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`);
}

// ─── Usage ───────────────────────────────────────────────────────────────────

export interface UsageData {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_usd: number;
  duration_ms: number;
}

/**
 * 从 issue 评论列表中解析 token 用量数据
 * 查找包含 ```usage-json 代码块的评论
 */
export function parseUsageFromComments(comments: GHComment[]): UsageData | null {
  for (const comment of [...comments].reverse()) {
    const match = comment.body.match(/```usage-json\n([\s\S]*?)\n```/);
    if (match) {
      try {
        return JSON.parse(match[1]) as UsageData;
      } catch {
        // ignore
      }
    }
  }
  return null;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
