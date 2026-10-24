/** Poll status lifecycle: draft → lobby → live → closed → revealed */
export type PollStatus = 'draft' | 'lobby' | 'live' | 'closed' | 'revealed';

export type TieRule = 'co-winners' | 'host-picks' | 'sudden-death';

export interface PollSettings {
  votesPerPerson: number;           // default: 1
  allowChangeVote: boolean;         // default: true
  showLiveCountsHost: boolean;      // default: true (host screen only)
  showLiveCountsBigScreen: boolean; // default: false (keeps reveal exciting)
  requireNickname: boolean;         // default: false
  shuffleOptions: boolean;          // default: true
  tieRule: TieRule;                 // default: 'co-winners'
}

export interface PollOption {
  id: string;
  pollId: string;
  order: number;           // 0-indexed
  label: string;           // Auto: A, B, C, …
  title: string;           // max 40 chars
  imageUrl: string;        // data URL or https URL
}

export interface Poll {
  id: string;
  hostToken: string;       // secret token in the host URL
  title: string;           // max 80 chars
  subtitle?: string;       // max 120 chars
  status: PollStatus;
  joinCode: string;        // 6-char unambiguous code e.g. BOO482
  settings: PollSettings;
  options: PollOption[];
  createdAt: number;       // ms timestamp
  startedAt?: number;
  closedAt?: number;
  revealedAt?: number;
  expiresAt: number;       // 24h after createdAt
  decidedWinnerId?: string; // Set by host to resolve a tie
}

export interface Participant {
  id: string;              // deviceToken
  pollId: string;
  nickname?: string;
  joinedAt: number;
  shuffledOptionOrder?: string[]; // option IDs in shuffled order for this voter
}

export interface Vote {
  id: string;
  pollId: string;
  participantId: string;   // deviceToken
  optionIds: string[];     // supports multi-vote future, usually length 1
  createdAt: number;
  updatedAt: number;
}

export interface VoteTally {
  optionId: string;
  count: number;
  percentage: number;
}

export interface PollResult {
  pollId: string;
  totalVotes: number;
  totalParticipants: number;
  turnoutPercentage: number;
  tallies: VoteTally[];    // sorted descending by count
  isTie: boolean;
  isTieResolved?: boolean;
  decidedWinnerId?: string;
  winners: string[];       // winning optionId(s)
}

/** Draft poll state used in Poll Maker before saving */
export interface DraftPoll {
  title: string;
  subtitle: string;
  options: DraftOption[];
  settings: PollSettings;
}

export interface DraftOption {
  id: string;             // temp local id
  title: string;
  imageDataUrl: string;
  label: string;
}

export const DEFAULT_SETTINGS: PollSettings = {
  votesPerPerson: 1,
  allowChangeVote: true,
  showLiveCountsHost: true,
  showLiveCountsBigScreen: false,
  requireNickname: false,
  shuffleOptions: true,
  tieRule: 'co-winners',
};
