/**
 * Anonymous device token — stored in localStorage so a single
 * person can't vote twice in the same poll from the same browser.
 */
const DEVICE_TOKEN_KEY = 'hpoll_device_token';

export function getDeviceToken(): string {
  let token = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    token = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  }
  return token;
}

/** Recent host polls (stored so host can resume) */
const RECENT_POLLS_KEY = 'hpoll_recent_host_polls';

export interface RecentPoll {
  pollId: string;
  hostToken: string;
  title: string;
  createdAt: number;
}

export function saveRecentPoll(poll: RecentPoll): void {
  const existing = getRecentPolls();
  const filtered = existing.filter((p) => p.pollId !== poll.pollId);
  const updated = [poll, ...filtered].slice(0, 5);
  localStorage.setItem(RECENT_POLLS_KEY, JSON.stringify(updated));
}

export function getRecentPolls(): RecentPoll[] {
  try {
    const raw = localStorage.getItem(RECENT_POLLS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function removeRecentPoll(pollId: string): void {
  try {
    const existing = getRecentPolls();
    const updated = existing.filter((p) => p.pollId !== pollId);
    localStorage.setItem(RECENT_POLLS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function clearRecentPolls(): void {
  try {
    localStorage.removeItem(RECENT_POLLS_KEY);
  } catch {
    // ignore
  }
}

/** Draft poll autosave */
const DRAFT_KEY = 'hpoll_draft_poll';

export function saveDraft(data: unknown): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

export function loadDraft<T>(): T | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}
