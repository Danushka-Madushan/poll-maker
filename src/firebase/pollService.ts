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
import { generateId, generateJoinCode, generateHostToken, orderToLabel } from '../utils/code';

/* ------------------------------------------------------------------ */
/*  LOCAL BROADCAST CHANNEL & STORAGE (Fallback & Instant Sync)       */
/* ------------------------------------------------------------------ */

type BroadcastMsg =
  | { type: 'POLL_UPDATE'; pollId: string; data: Omit<Poll, 'options'> }
  | { type: 'OPTIONS_UPDATE'; pollId: string; options: PollOption[] }
  | { type: 'PARTICIPANTS_UPDATE'; pollId: string; participants: Participant[] }
  | { type: 'VOTES_UPDATE'; pollId: string; votes: Vote[] };

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

/** Updates poll status. Validates hostToken before writing. */
export async function updatePollStatus(
  pollId: string,
  hostToken: string,
  status: PollStatus
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === 'live')     updates.startedAt  = Date.now();
  if (status === 'closed')   updates.closedAt   = Date.now();
  if (status === 'revealed') updates.revealedAt = Date.now();

  // Update local
  const local = getLocalPoll(pollId);
  if (local && local.hostToken === hostToken) {
    const updated = { ...local, ...updates, status };
    saveLocalPoll(updated);
  }

  // Update Firestore
  try {
    const pollRef = doc(db, 'polls', pollId);
    await updateDoc(pollRef, updates);
  } catch (err) {
    console.warn('Firestore update notice (using local real-time mode):', err);
  }
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
  const cleanCode = code.toUpperCase();

  // Try Firestore first
  try {
    const q = query(
      collection(db, 'polls'),
      where('joinCode', '==', cleanCode),
      where('status', 'in', ['lobby', 'live', 'closed', 'revealed'])
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const pollDoc = snap.docs[0];
      const poll    = pollDoc.data() as Omit<Poll, 'options'>;
      const optSnap = await getDocs(collection(db, 'polls', poll.id, 'options'));
      const options: PollOption[] = optSnap.docs
        .map((d) => d.data() as PollOption)
        .sort((a, b) => a.order - b.order);
      return { ...poll, options };
    }
  } catch (err) {
    console.debug('Firestore getPollByJoinCode notice:', err);
  }

  // Fallback to local
  const localPollId = localStorage.getItem(`hpoll_code_${cleanCode}`);
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
  onError?: (err: Error) => void
): Unsubscribe {
  // Emit current local immediately
  const local = getLocalPoll(pollId);
  if (local) onUpdate(local);

  // Broadcast channel listener
  const handler = (e: MessageEvent<BroadcastMsg>) => {
    if (e.data.type === 'POLL_UPDATE' && e.data.pollId === pollId) {
      onUpdate(e.data.data);
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

/** Registers an audience member as a participant. Idempotent. */
export async function joinPoll(
  pollId: string,
  deviceToken: string,
  nickname?: string
): Promise<void> {
  const local = getLocalParticipants(pollId);
  if (!local.some((p) => p.id === deviceToken)) {
    const participant: Participant = {
      id:        deviceToken,
      pollId,
      joinedAt:  Date.now(),
      nickname,
    };
    saveLocalParticipants(pollId, [...local, participant]);
  }

  try {
    const ref = doc(db, 'polls', pollId, 'participants', deviceToken);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      const participant: Participant = {
        id:        deviceToken,
        pollId,
        joinedAt:  Date.now(),
        nickname,
      };
      await setDoc(ref, participant);
    }
  } catch (err) {
    console.debug('Firestore joinPoll notice:', err);
  }
}

/** Casts or updates a vote. Idempotent per deviceToken. */
export async function castVote(
  pollId: string,
  deviceToken: string,
  optionIds: string[]
): Promise<void> {
  const now = Date.now();
  const localVotes = getLocalVotes(pollId);
  const existingIdx = localVotes.findIndex((v) => v.participantId === deviceToken);
  let updatedVotes: Vote[];

  if (existingIdx >= 0) {
    updatedVotes = localVotes.map((v, i) =>
      i === existingIdx ? { ...v, optionIds, updatedAt: now } : v
    );
  } else {
    const newVote: Vote = {
      id:            deviceToken,
      pollId,
      participantId: deviceToken,
      optionIds,
      createdAt:     now,
      updatedAt:     now,
    };
    updatedVotes = [...localVotes, newVote];
  }
  saveLocalVotes(pollId, updatedVotes);

  try {
    const ref = doc(db, 'polls', pollId, 'votes', deviceToken);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, { optionIds, updatedAt: now });
    } else {
      const vote: Vote = {
        id:            deviceToken,
        pollId,
        participantId: deviceToken,
        optionIds,
        createdAt:     now,
        updatedAt:     now,
      };
      await setDoc(ref, vote);
    }
  } catch (err) {
    console.debug('Firestore castVote notice:', err);
  }
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
  participantCount: number
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
  const winners  = tallies
    .filter((t) => t.count === maxCount && maxCount > 0)
    .map((t) => t.optionId);

  return {
    pollId: options[0]?.pollId ?? '',
    totalVotes,
    totalParticipants: Math.max(participantCount, totalVotes),
    turnoutPercentage: participantCount > 0
      ? Math.min(100, Math.round((totalVotes / participantCount) * 100))
      : (totalVotes > 0 ? 100 : 0),
    tallies,
    isTie: winners.length > 1,
    winners,
  };
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
