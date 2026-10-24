import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import OptionCard from '../components/ui/OptionCard';
import { useToast } from '../components/ui/ToastContext';
import {
  subscribeToPoll,
  subscribeToOptions,
  joinPoll,
  castVote,
  getMyVote,
  getPoll,
} from '../firebase/pollService';
import type { Poll, PollOption, Vote } from '../types/poll';
import { getDeviceToken } from '../utils/device';
import { playTap } from '../utils/audio';

function getOptionSortScore(deviceToken: string, optionId: string): number {
  let hash = 0;
  const str = deviceToken + optionId;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

const VoteScreen: React.FC = () => {
  const { pollId }        = useParams<{ pollId: string }>();
  const [searchParams]    = useSearchParams();
  const isWaiting         = searchParams.get('waiting') === '1';
  const isClosed          = searchParams.get('closed') === '1';
  const navigate          = useNavigate();
  const { addToast }      = useToast();
  const deviceToken       = getDeviceToken();

  const [poll, setPoll]         = useState<Omit<Poll, 'options'> | null>(null);
  const [options, setOptions]   = useState<PollOption[]>([]);
  const [myVote, setMyVote]     = useState<Vote | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [casting, setCasting]   = useState(false);
  const [joined, setJoined]     = useState(false);

  // Ensure participant is joined
  useEffect(() => {
    if (!pollId || joined) return;
    joinPoll(pollId, deviceToken)
      .then(() => setJoined(true))
      .catch(console.error);
  }, [pollId, deviceToken, joined]);

  // Load existing vote
  useEffect(() => {
    if (!pollId) return;
    getMyVote(pollId, deviceToken).then(setMyVote).catch(console.error);
  }, [pollId, deviceToken]);

  // Real-time subscriptions
  useEffect(() => {
    if (!pollId) return;
    const u1 = subscribeToPoll(pollId, (p) => {
      setPoll(p);
      // Auto-navigate when status changes
      if (p.status === 'revealed') navigate(`/results/${pollId}`);
    });
    const u2 = subscribeToOptions(pollId, (opts) => {
      setOptions(opts);
    });
    return () => { u1(); u2(); };
  }, [pollId, navigate]);

  // Mobile focus & visibility change listener (reconciles on unlock / tab focus)
  useEffect(() => {
    if (!pollId) return;
    const handleSync = () => {
      if (document.visibilityState === 'visible') {
        getMyVote(pollId, deviceToken).then(setMyVote).catch(console.error);
        getPoll(pollId).then((p) => {
          if (p) {
            setPoll(p);
            if (p.status === 'revealed') navigate(`/results/${pollId}`);
          }
        }).catch(console.error);
      }
    };
    document.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [pollId, deviceToken, navigate]);

  // Stable shuffled options per voter session (pure hash of deviceToken + optionId)
  const displayOptions = useMemo(() => {
    if (options.length === 0) return [];
    if (!poll?.settings.shuffleOptions) return options;
    return [...options].sort(
      (a, b) => getOptionSortScore(deviceToken, a.id) - getOptionSortScore(deviceToken, b.id)
    );
  }, [options, poll?.settings.shuffleOptions, deviceToken]);

  const maxVotes = poll?.settings.votesPerPerson ?? 1;

  const toggleSelect = (optId: string) => {
    if (myVote && !poll?.settings.allowChangeVote) return;
    playTap();
    setSelected((prev) => {
      if (prev.includes(optId)) {
        return prev.filter((id) => id !== optId);
      }
      if (maxVotes === 1) {
        return [optId];
      }
      if (prev.length >= maxVotes) {
        addToast({ message: `You can only select up to ${maxVotes} options.` });
        return prev;
      }
      return [...prev, optId];
    });
  };

  const handleCast = useCallback(async () => {
    if (selected.length === 0 || !pollId) return;
    setCasting(true);
    try {
      await castVote(pollId, deviceToken, selected);
      const vote = await getMyVote(pollId, deviceToken);
      setMyVote(vote);
      addToast({ message: 'Vote locked in!' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cast vote. Tap to retry.';
      addToast({ message: msg });
    } finally {
      setCasting(false);
    }
  }, [pollId, deviceToken, selected, addToast]);

  if (!pollId) return null;

  /* ---- WAITING STATE ---- */
  if (poll?.status === 'lobby' || (isWaiting && !poll)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--void)', flexDirection: 'column', gap: 24, padding: 24 }}>
        <div style={{ border: '3px solid var(--bone)', background: 'var(--ink)', padding: 32, textAlign: 'center', maxWidth: 360, width: '100%' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--toxic)', marginBottom: 8 }}>YOU'RE IN</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--bone)', marginBottom: 16 }}>
            {poll?.title ?? '…'}
          </h1>
          <div className="blink-dot" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--ash)' }}>
            You're in. The host is summoning the poll…
          </p>
        </div>
      </div>
    );
  }

  /* ---- CLOSED STATE ---- */
  if (poll?.status === 'closed' || isClosed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--void)', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ border: '3px solid var(--bone)', background: 'var(--ink)', padding: 32, textAlign: 'center', maxWidth: 360, width: '100%' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--bone)', marginBottom: 16 }}>VOTING IS CLOSED.</h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--ash)' }}>
            The spirits are counting. Result coming soon.
          </p>
        </div>
      </div>
    );
  }

  /* ---- VOTED CONFIRMATION ---- */
  if (myVote && poll?.status === 'live') {
    const votedOptions = options.filter((o) => myVote.optionIds.includes(o.id));
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--void)' }}>
        {/* Sticky top bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '3px solid var(--bone)', background: 'var(--ink)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--bone)', margin: 0 }}>{poll.title}</h2>
          <span className="chip chip-live"><span className="blink-dot" />LIVE</span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 }}>
          <div style={{ border: '4px solid var(--pumpkin)', background: 'var(--ink)', padding: 32, textAlign: 'center', maxWidth: 420, width: '100%', boxShadow: '8px 8px 0 var(--pumpkin)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--pumpkin)', marginBottom: 16, letterSpacing: '0.08em', whiteSpace: 'pre-line' }}>
              {poll.settings.allowChangeVote
                ? 'VOTE LOCKED IN.\n(CHANGE ALLOWED UNTIL POLL CLOSES)'
                : 'VOTE LOCKED IN.\nNO TAKE-BACKS.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: votedOptions.length > 1 ? 'repeat(2, 1fr)' : '1fr', gap: 12, marginBottom: 16 }}>
              {votedOptions.map((opt) => (
                <div key={opt.id} style={{ border: '3px solid var(--bone)', overflow: 'hidden' }}>
                  <img src={opt.imageUrl} alt={opt.title} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '8px 12px', borderTop: '2px solid var(--bone)', fontFamily: 'var(--font-display)', fontSize: 14, textTransform: 'uppercase' }}>
                    {opt.label} — {opt.title}
                  </div>
                </div>
              ))}
            </div>
            {poll.settings.allowChangeVote && (
              <button
                className="btn-ghost"
                onClick={() => { setMyVote(null); setSelected(myVote.optionIds); }}
                style={{ width: '100%' }}
              >
                CHANGE VOTE
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---- VOTING STATE ---- */
  const remaining = maxVotes - selected.length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--void)' }}>
      {/* Sticky top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '3px solid var(--bone)', background: 'var(--ink)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(14px, 4vw, 20px)', color: 'var(--bone)', margin: 0, flex: 1 }}>
          {poll?.title ?? '…'}
        </h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', whiteSpace: 'nowrap' }}>
          {remaining} VOTE{remaining !== 1 ? 'S' : ''} LEFT
        </span>
        {poll && <span className="chip chip-live"><span className="blink-dot" />LIVE</span>}
      </div>

      {/* Options grid */}
      <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
        {poll?.subtitle && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ash)', marginBottom: 12 }}>{poll.subtitle}</p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {displayOptions.map((opt) => (
            <OptionCard
              key={opt.id}
              option={opt}
              selected={selected.includes(opt.id)}
              onClick={() => toggleSelect(opt.id)}
            />
          ))}
        </div>
      </div>

      {/* Sticky bottom CTA */}
      <div style={{ position: 'sticky', bottom: 0, borderTop: '3px solid var(--bone)', background: 'var(--ink)', padding: 12 }}>
        <button
          className="btn-primary"
          style={{ width: '100%', fontSize: 20, padding: '16px 24px' }}
          onClick={handleCast}
          disabled={selected.length === 0 || casting}
        >
          {casting ? 'CASTING…' : 'CAST YOUR VOTE'}
        </button>
      </div>
    </div>
  );
};

export default VoteScreen;
