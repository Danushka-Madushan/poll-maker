/**
 * Firebase Firestore service layer with robust fallback.
 *
 * Collections:
 *   polls/{pollId}           — Poll document
 *   polls/{pollId}/options   — PollOption subcollection
 *   polls/{pollId}/participants/{deviceToken} — Participant
 *   polls/{pollId}/votes/{deviceToken}        — Vote (one per device)
 *
 * Real-time listeners use onSnapshot for < 1s sync.
 * Includes local BroadcastChannel fallback for offline / pre-activation testing.
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  type Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import type { Poll, PollOption, Participant, Vote, PollResult, PollStatus, VoteTally } from '../types/poll';
import { generateId, generateJoinCode, formatJoinCode, normalizeJoinCode, generateHostToken, orderToLabel } from '../utils/code';
import { removeRecentPoll, clearRecentPolls, getRecentPolls } from '../utils/device';

/* ------------------------------------------------------------------ */
/*  LOCAL BROADCAST CHANNEL & STORAGE (Fallback & Instant Sync)       */
/* ------------------------------------------------------------------ */

type BroadcastMsg =
  | { type: 'POLL_UPDATE'; pollId: string; data: Omit<Poll, 'options'> }
  | { type: 'OPTIONS_UPDATE'; pollId: string; options: PollOption[] }
  | { type: 'PARTICIPANTS_UPDATE'; pollId: string; participants: Participant[] }
  | { type: 'VOTES_UPDATE'; pollId: string; votes: Vote[] }
  | { type: 'POLL_DELETED'; pollId: string };

const inMemoryPollListeners = new Map<string, Set<(poll: Omit<Poll, 'options'>) => void>>();
const inMemoryDeleteListeners = new Map<string, Set<() => void>>();

function notifyLocalPoll(poll: Omit<Poll, 'options'>) {
  const listeners = inMemoryPollListeners.get(poll.id);
  if (listeners) {
    listeners.forEach((fn) => {
      try { fn(poll); } catch (e) { console.debug('Local poll notify error:', e); }
    });
  }
}

function notifyPollDeleted(pollId: string) {
  const listeners = inMemoryDeleteListeners.get(pollId);
  if (listeners) {
    listeners.forEach((fn) => {
      try { fn(); } catch (e) { console.debug('Local delete notify error:', e); }
    });
  }
}

let channel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel('halloween_poll_sync');
  }
} catch {
  channel = null;
}

function broadcast(msg: BroadcastMsg) {
  try {
    channel?.postMessage(msg);
  } catch (err) {
    console.debug('Broadcast failed:', err);
  }
}

// Local cache keys
function getLocalPoll(pollId: string): Omit<Poll, 'options'> | null {
  try {
    const raw = localStorage.getItem(`hpoll_data_${pollId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalPoll(poll: Omit<Poll, 'options'>) {
  try {
    localStorage.setItem(`hpoll_data_${poll.id}`, JSON.stringify(poll));
    broadcast({ type: 'POLL_UPDATE', pollId: poll.id, data: poll });
    notifyLocalPoll(poll);
  } catch (err) {
    console.debug('Failed to save local poll:', err);
  }
}

function getLocalOptions(pollId: string): PollOption[] {
  try {
    const raw = localStorage.getItem(`hpoll_opts_${pollId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalOptions(pollId: string, options: PollOption[]) {
  try {
    localStorage.setItem(`hpoll_opts_${pollId}`, JSON.stringify(options));
    broadcast({ type: 'OPTIONS_UPDATE', pollId, options });
  } catch (err) {
    console.debug('Failed to save local options:', err);
  }
}

function getLocalParticipants(pollId: string): Participant[] {
  try {
    const raw = localStorage.getItem(`hpoll_parts_${pollId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalParticipants(pollId: string, participants: Participant[]) {
  try {
    localStorage.setItem(`hpoll_parts_${pollId}`, JSON.stringify(participants));
    broadcast({ type: 'PARTICIPANTS_UPDATE', pollId, participants });
  } catch (err) {
    console.debug('Failed to save local participants:', err);
  }
}

function getLocalVotes(pollId: string): Vote[] {
  try {
    const raw = localStorage.getItem(`hpoll_votes_${pollId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalVotes(pollId: string, votes: Vote[]) {
  try {
    localStorage.setItem(`hpoll_votes_${pollId}`, JSON.stringify(votes));
    broadcast({ type: 'VOTES_UPDATE', pollId, votes });
  } catch (err) {
    console.debug('Failed to save local votes:', err);
  }
}

/* ------------------------------------------------------------------ */
/*  POLL CRUD                                                         */
/* ------------------------------------------------------------------ */

export interface CreatePollInput {
  title: string;
  subtitle?: string;
  settings: Poll['settings'];
  options: Array<{ title: string; imageUrl: string }>;
}

/** Creates a poll + options atomically. Returns pollId and hostToken. */
export async function createPoll(input: CreatePollInput): Promise<{ pollId: string; hostToken: string }> {
  const pollId    = generateId();
  const hostToken = generateHostToken();
  const joinCode  = generateJoinCode();
  const now       = Date.now();

  const pollData: Omit<Poll, 'options'> = {
    id:         pollId,
    hostToken,
    title:      input.title,
    subtitle:   input.subtitle ?? '',
    status:     'lobby',
    joinCode,
    settings:   input.settings,
    createdAt:  now,
    expiresAt:  now + 24 * 60 * 60 * 1000,
  };

  const options: PollOption[] = input.options.map((opt, i) => ({
    id:       generateId(),
    pollId,
    order:    i,
    label:    orderToLabel(i),
    title:    opt.title,
    imageUrl: opt.imageUrl,
  }));

  // Save to local storage first for immediate availability
  saveLocalPoll(pollData);
  saveLocalOptions(pollId, options);
  // Also register joinCode mapping
  localStorage.setItem(`hpoll_code_${joinCode.toUpperCase()}`, pollId);
  localStorage.setItem(`hpoll_code_${formatJoinCode(joinCode)}`, pollId);

  // Attempt Firestore write
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'polls', pollId), pollData);
    for (const opt of options) {
      batch.set(doc(db, 'polls', pollId, 'options', opt.id), opt);
    }
    await batch.commit();
  } catch (err) {
    console.warn('Firestore write notice (falling back to local real-time mode):', err);
  }

  return { pollId, hostToken };
}

/** Updates poll draft options and settings while in Lobby status */
export async function updatePollDraft(
  pollId: string,
  hostToken: string,
  data: {
    title: string;
    subtitle?: string;
    settings: Poll['settings'];
    options: Array<{ title: string; imageUrl: string }>;
  }
): Promise<void> {
  const local = getLocalPoll(pollId);
  if (!local || local.hostToken !== hostToken) throw new Error('Unauthorized');
  if (local.status !== 'lobby') throw new Error('Cannot edit options once poll is started');

  const updatedPoll: Omit<Poll, 'options'> = {
    ...local,
    title: data.title,
    subtitle: data.subtitle ?? '',
    settings: data.settings,
  };

  const newOptions: PollOption[] = data.options.map((opt, i) => ({
    id: generateId(),
    pollId,
    order: i,
    label: orderToLabel(i),
    title: opt.title,
    imageUrl: opt.imageUrl,
  }));

  saveLocalPoll(updatedPoll);
  saveLocalOptions(pollId, newOptions);

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'polls', pollId), {
      title: data.title,
      subtitle: data.subtitle ?? '',
      settings: data.settings,
    });
    for (const opt of newOptions) {
      batch.set(doc(db, 'polls', pollId, 'options', opt.id), opt);
    }
    await batch.commit();
  } catch (err) {
    console.warn('Firestore updatePollDraft notice:', err);
  }
}

/** Updates poll status. Validates hostToken before writing. */
export async function updatePollStatus(
  pollId: string,
  _hostToken: string,
  status: PollStatus
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === 'live')     updates.startedAt  = Date.now();
  if (status === 'closed')   updates.closedAt   = Date.now();
  if (status === 'revealed') updates.revealedAt = Date.now();

  // Update local cache and dispatch locally
  const local = getLocalPoll(pollId);
  if (local) {
    const updated = { ...local, ...updates, status };
    saveLocalPoll(updated);
  }

  // Authoritative update to Cloud Firestore
  try {
    const pollRef = doc(db, 'polls', pollId);
    await updateDoc(pollRef, updates);
  } catch (err) {
    console.warn('Firestore update status notice:', err);
  }
}

/** Permanently purges a poll from existence in Firestore, local storage, and real-time tabs */
export async function purgePoll(pollId: string, _hostToken?: string): Promise<void> {
  // 1. Delete all local cache keys
  try {
    localStorage.removeItem(`hpoll_data_${pollId}`);
    localStorage.removeItem(`hpoll_opts_${pollId}`);
    localStorage.removeItem(`hpoll_parts_${pollId}`);
    localStorage.removeItem(`hpoll_votes_${pollId}`);

    // Remove join code mappings
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('hpoll_code_') && localStorage.getItem(key) === pollId) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.debug('Local storage purge notice:', err);
  }

  // 2. Remove from recent host polls list
  removeRecentPoll(pollId);

  // 3. Broadcast deletion event to all local tabs and in-memory listeners
  broadcast({ type: 'POLL_DELETED', pollId });
  notifyPollDeleted(pollId);

  // 4. Delete permanently from Cloud Firestore
  try {
    const batch = writeBatch(db);

    // Delete options subcollection
    const optSnap = await getDocs(collection(db, 'polls', pollId, 'options'));
    optSnap.forEach((d) => batch.delete(d.ref));

    // Delete participants subcollection
    const partSnap = await getDocs(collection(db, 'polls', pollId, 'participants'));
    partSnap.forEach((d) => batch.delete(d.ref));

    // Delete votes subcollection
    const voteSnap = await getDocs(collection(db, 'polls', pollId, 'votes'));
    voteSnap.forEach((d) => batch.delete(d.ref));

    // Delete the root poll document
    batch.delete(doc(db, 'polls', pollId));

    await batch.commit();
  } catch (err) {
    console.warn('Firestore purge error:', err);
  }
}

/** Purges all recent polls permanently */
export async function purgeAllRecentPolls(): Promise<void> {
  const recent = getRecentPolls();
  for (const p of recent) {
    await purgePoll(p.pollId, p.hostToken);
  }
  clearRecentPolls();
}

/** Returns the poll with its options array (one-shot read). */
export async function getPoll(pollId: string): Promise<Poll | null> {
  // Try Firestore first
  try {
    const pollSnap = await getDoc(doc(db, 'polls', pollId));
    if (pollSnap.exists()) {
      const poll = pollSnap.data() as Omit<Poll, 'options'>;
      const optSnap = await getDocs(collection(db, 'polls', pollId, 'options'));
      const options: PollOption[] = optSnap.docs
        .map((d) => d.data() as PollOption)
        .sort((a, b) => a.order - b.order);
      return { ...poll, options };
    }
  } catch (err) {
    console.debug('Firestore getPoll notice:', err);
  }

  // Fallback to local
  const local = getLocalPoll(pollId);
  if (local) {
    const options = getLocalOptions(pollId);
    return { ...local, options };
  }

  return null;
}

/** Finds an active poll by its 6-char join code. */
export async function getPollByJoinCode(code: string): Promise<Poll | null> {
  const cleanCode = normalizeJoinCode(code);
  const formattedCode = formatJoinCode(cleanCode);

  // Try Firestore first using simple equality (avoids composite index and multiple 'in' clauses)
  try {
    const q = query(
      collection(db, 'polls'),
      where('joinCode', '==', cleanCode)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const pollDoc = snap.docs[0];
      const poll    = pollDoc.data() as Omit<Poll, 'options'>;
      if (poll.status !== 'draft') {
        const optSnap = await getDocs(collection(db, 'polls', poll.id, 'options'));
        const options: PollOption[] = optSnap.docs
          .map((d) => d.data() as PollOption)
          .sort((a, b) => a.order - b.order);
        // Cache locally for instant access
        saveLocalPoll(poll);
        saveLocalOptions(poll.id, options);
        return { ...poll, options };
      }
    }
  } catch (err) {
    console.debug('Firestore getPollByJoinCode notice:', err);
  }

  // Fallback to local
  const localPollId = localStorage.getItem(`hpoll_code_${cleanCode}`) ||
                      localStorage.getItem(`hpoll_code_${formattedCode}`);
  if (localPollId) {
    return getPoll(localPollId);
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  REAL-TIME SUBSCRIPTIONS                                           */
/* ------------------------------------------------------------------ */

/** Subscribes to poll document changes (status, settings). */
export function subscribeToPoll(
  pollId: string,
  onUpdate: (poll: Omit<Poll, 'options'>) => void,
  onError?: (err: Error) => void,
  onDeleted?: () => void
): Unsubscribe {
  // Register in-memory tab listener
  if (!inMemoryPollListeners.has(pollId)) {
    inMemoryPollListeners.set(pollId, new Set());
  }
  inMemoryPollListeners.get(pollId)!.add(onUpdate);

  if (onDeleted) {
    if (!inMemoryDeleteListeners.has(pollId)) {
      inMemoryDeleteListeners.set(pollId, new Set());
    }
    inMemoryDeleteListeners.get(pollId)!.add(onDeleted);
  }

  // Emit current local immediately
  const local = getLocalPoll(pollId);
  if (local) onUpdate(local);

  // Broadcast channel listener (receives updates from OTHER tabs)
  const handler = (e: MessageEvent<BroadcastMsg>) => {
    if (e.data.type === 'POLL_UPDATE' && e.data.pollId === pollId) {
      onUpdate(e.data.data);
    } else if (e.data.type === 'POLL_DELETED' && e.data.pollId === pollId) {
      onDeleted?.();
    }
  };
  channel?.addEventListener('message', handler);

  // Firestore listener
  let unsubFirestore: Unsubscribe = () => {};
  try {
    unsubFirestore = onSnapshot(
      doc(db, 'polls', pollId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<Poll, 'options'>;
          saveLocalPoll(data);
          onUpdate(data);
        } else {
          // Document was purged/deleted from Firestore
          onDeleted?.();
        }
      },
      (err) => {
        console.warn('Firestore poll listener notice:', err.message);
        onError?.(err);
      }
    );
  } catch (err) {
    console.debug('Firestore subscribeToPoll notice:', err);
  }

  return () => {
    inMemoryPollListeners.get(pollId)?.delete(onUpdate);
    if (onDeleted) inMemoryDeleteListeners.get(pollId)?.delete(onDeleted);
    channel?.removeEventListener('message', handler);
    unsubFirestore();
  };
}

/** Subscribes to options subcollection. */
export function subscribeToOptions(
  pollId: string,
  onUpdate: (options: PollOption[]) => void
): Unsubscribe {
  // Emit current local immediately
  const local = getLocalOptions(pollId);
  if (local.length > 0) onUpdate(local);

  const handler = (e: MessageEvent<BroadcastMsg>) => {
    if (e.data.type === 'OPTIONS_UPDATE' && e.data.pollId === pollId) {
      onUpdate(e.data.options);
    }
  };
  channel?.addEventListener('message', handler);

  let unsubFirestore: Unsubscribe = () => {};
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'polls', pollId, 'options'),
      (snap) => {
        const opts: PollOption[] = snap.docs
          .map((d) => d.data() as PollOption)
          .sort((a, b) => a.order - b.order);
        if (opts.length > 0) {
          saveLocalOptions(pollId, opts);
          onUpdate(opts);
        }
      },
      (err) => console.warn('Firestore options listener notice:', err.message)
    );
  } catch (err) {
    console.debug('Firestore subscribeToOptions notice:', err);
  }

  return () => {
    channel?.removeEventListener('message', handler);
    unsubFirestore();
  };
}

/** Subscribes to participants (joined count). */
export function subscribeToParticipants(
  pollId: string,
  onUpdate: (participants: Participant[]) => void
): Unsubscribe {
  const local = getLocalParticipants(pollId);
  onUpdate(local);

  const handler = (e: MessageEvent<BroadcastMsg>) => {
    if (e.data.type === 'PARTICIPANTS_UPDATE' && e.data.pollId === pollId) {
      onUpdate(e.data.participants);
    }
  };
  channel?.addEventListener('message', handler);

  let unsubFirestore: Unsubscribe = () => {};
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'polls', pollId, 'participants'),
      (snap) => {
        const parts = snap.docs.map((d) => d.data() as Participant);
        saveLocalParticipants(pollId, parts);
        onUpdate(parts);
      },
      (err) => console.warn('Firestore participants listener notice:', err.message)
    );
  } catch (err) {
    console.debug('Firestore subscribeToParticipants notice:', err);
  }

  return () => {
    channel?.removeEventListener('message', handler);
    unsubFirestore();
  };
}

/** Subscribes to votes (for host live tally). */
export function subscribeToVotes(
  pollId: string,
  onUpdate: (votes: Vote[]) => void
): Unsubscribe {
  const local = getLocalVotes(pollId);
  onUpdate(local);

  const handler = (e: MessageEvent<BroadcastMsg>) => {
    if (e.data.type === 'VOTES_UPDATE' && e.data.pollId === pollId) {
      onUpdate(e.data.votes);
    }
  };
  channel?.addEventListener('message', handler);

  let unsubFirestore: Unsubscribe = () => {};
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'polls', pollId, 'votes'),
      (snap) => {
        const v = snap.docs.map((d) => d.data() as Vote);
        saveLocalVotes(pollId, v);
        onUpdate(v);
      },
      (err) => console.warn('Firestore votes listener notice:', err.message)
    );
  } catch (err) {
    console.debug('Firestore subscribeToVotes notice:', err);
  }

  return () => {
    channel?.removeEventListener('message', handler);
    unsubFirestore();
  };
}

/* ------------------------------------------------------------------ */
/*  AUDIENCE ACTIONS                                                  */
/* ------------------------------------------------------------------ */

/** Registers an audience member as a participant. Idempotent single-roundtrip write. */
export async function joinPoll(
  pollId: string,
  deviceToken: string,
  nickname?: string
): Promise<void> {
  const cleanNickname = nickname?.trim() || '';
  const participantData: Record<string, unknown> = {
    id:        deviceToken,
    pollId,
    joinedAt:  Date.now(),
    nickname:  cleanNickname,
  };

  const participant: Participant = {
    id:        deviceToken,
    pollId,
    joinedAt:  Date.now(),
    nickname:  cleanNickname || undefined,
  };

  const local = getLocalParticipants(pollId);
  if (!local.some((p) => p.id === deviceToken)) {
    saveLocalParticipants(pollId, [...local, participant]);
  }

  try {
    const ref = doc(db, 'polls', pollId, 'participants', deviceToken);
    await setDoc(ref, participantData, { merge: true });
  } catch (err) {
    console.warn('Firestore joinPoll notice:', err);
  }
}

/** Casts or updates a vote. Idempotent per deviceToken with exponential retry. */
export async function castVote(
  pollId: string,
  deviceToken: string,
  optionIds: string[]
): Promise<void> {
  const localPoll = getLocalPoll(pollId);
  if (localPoll && localPoll.status !== 'live') {
    throw new Error('Voting is not live. Votes can only be cast while the poll is live.');
  }

  const now = Date.now();
  const localVotes = getLocalVotes(pollId);
  const existingVote = localVotes.find((v) => v.participantId === deviceToken);
  const createdAt = existingVote?.createdAt ?? now;

  const voteData: Vote = {
    id:            deviceToken,
    pollId,
    participantId: deviceToken,
    optionIds,
    createdAt,
    updatedAt:     now,
  };

  const existingIdx = localVotes.findIndex((v) => v.participantId === deviceToken);
  const updatedVotes = existingIdx >= 0
    ? localVotes.map((v, i) => (i === existingIdx ? voteData : v))
    : [...localVotes, voteData];
  saveLocalVotes(pollId, updatedVotes);

  // Single-roundtrip atomic upsert with exponential retry for mobile reliability
  const ref = doc(db, 'polls', pollId, 'votes', deviceToken);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await setDoc(ref, voteData, { merge: true });
      return;
    } catch (err) {
      lastError = err as Error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
      }
    }
  }

  console.warn('Firestore castVote failed after 3 attempts:', lastError);
  throw lastError || new Error('Failed to record vote. Please check your connection and tap again.');
}

/** Gets an existing vote for this device. */
export async function getMyVote(
  pollId: string,
  deviceToken: string
): Promise<Vote | null> {
  // Check local first
  const localVotes = getLocalVotes(pollId);
  const found = localVotes.find((v) => v.participantId === deviceToken);
  if (found) return found;

  try {
    const snap = await getDoc(doc(db, 'polls', pollId, 'votes', deviceToken));
    return snap.exists() ? (snap.data() as Vote) : null;
  } catch (err) {
    console.debug('Firestore getMyVote notice:', err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  RESULTS COMPUTATION                                               */
/* ------------------------------------------------------------------ */

/** Computes poll results from a votes array and options array. */
export function computeResults(
  votes: Vote[],
  options: PollOption[],
  participantCount: number,
  decidedWinnerId?: string
): PollResult {
  const counts = new Map<string, number>();
  for (const opt of options) counts.set(opt.id, 0);
  for (const vote of votes) {
    for (const optId of vote.optionIds) {
      counts.set(optId, (counts.get(optId) ?? 0) + 1);
    }
  }

  const totalVotes = votes.length;

  const tallies: VoteTally[] = options
    .map((opt) => ({
      optionId:   opt.id,
      count:      counts.get(opt.id) ?? 0,
      percentage: totalVotes > 0
        ? Math.round(((counts.get(opt.id) ?? 0) / totalVotes) * 100)
        : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const maxCount = tallies[0]?.count ?? 0;
  const rawWinners = tallies
    .filter((t) => t.count === maxCount && maxCount > 0)
    .map((t) => t.optionId);

  const hasTie = rawWinners.length > 1;
  const resolved = hasTie && Boolean(decidedWinnerId && rawWinners.includes(decidedWinnerId));
  const winners = resolved ? [decidedWinnerId!] : rawWinners;

  return {
    pollId: options[0]?.pollId ?? '',
    totalVotes,
    totalParticipants: Math.max(participantCount, totalVotes),
    turnoutPercentage: participantCount > 0
      ? Math.min(100, Math.round((totalVotes / participantCount) * 100))
      : (totalVotes > 0 ? 100 : 0),
    tallies,
    isTie: hasTie && !resolved,
    isTieResolved: resolved,
    decidedWinnerId: resolved ? decidedWinnerId : undefined,
    winners,
  };
}

/** Resolves a tie by allowing host to designate a single winner */
export async function resolveTieWinner(
  pollId: string,
  _hostToken: string,
  winnerOptionId: string
): Promise<void> {
  const local = getLocalPoll(pollId);
  if (local) {
    const updated = { ...local, decidedWinnerId: winnerOptionId };
    saveLocalPoll(updated);
  }
  try {
    const pollRef = doc(db, 'polls', pollId);
    await updateDoc(pollRef, { decidedWinnerId: winnerOptionId });
  } catch (err) {
    console.debug('Firestore resolveTieWinner notice:', err);
  }
}

/* ------------------------------------------------------------------ */
/*  CSV EXPORT                                                        */
/* ------------------------------------------------------------------ */

export function exportResultsCSV(
  poll: Poll,
  result: PollResult
): void {
  const rows = [
    ['Option', 'Label', 'Votes', 'Percentage'],
    ...result.tallies.map((t) => {
      const opt = poll.options.find((o) => o.id === t.optionId);
      return [
        `"${(opt?.title ?? t.optionId).replace(/"/g, '""')}"`,
        opt?.label ?? '',
        String(t.count),
        `${t.percentage}%`,
      ];
    }),
    [],
    ['Total Votes', String(result.totalVotes)],
    ['Participants', String(result.totalParticipants)],
    ['Turnout', `${result.turnoutPercentage}%`],
  ];

  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${poll.title.replace(/[^a-z0-9]/gi, '_')}_results.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
