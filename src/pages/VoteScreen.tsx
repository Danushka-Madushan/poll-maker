import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import OptionCard from '../components/ui/OptionCard';
import BatsAnimation from '../components/ui/BatsAnimation';
import { GhostIcon, SkullIcon, CandleIcon } from '../components/ui/HalloweenIcons';
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
    const u1 = subscribeToPoll(
      pollId,
      (p) => {
        setPoll(p);
        // Auto-navigate when status changes
        if (p.status === 'revealed') navigate(`/results/${pollId}`);
      },
      undefined,
      () => {
        addToast({ message: 'This poll has been purged.' });
        navigate('/');
      }
    );
    const u2 = subscribeToOptions(pollId, (opts) => {
      setOptions(opts);
    });
    return () => { u1(); u2(); };
  }, [pollId, navigate, addToast]);

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--void)', flexDirection: 'column', gap: 24, padding: 24, position: 'relative', overflow: 'hidden' }}>
        <BatsAnimation />
        <div style={{ border: '4px solid var(--bone)', background: 'var(--ink)', padding: 32, textAlign: 'center', maxWidth: 380, width: '100%', boxShadow: '8px 8px 0 var(--bone)', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <GhostIcon size={56} color="var(--bone)" />
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--toxic)', marginBottom: 8, letterSpacing: '0.1em' }}>
            <span className="blink-dot" style={{ marginRight: 6 }} />YOU'RE IN THE CRYPT
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--bone)', marginBottom: 16, textTransform: 'uppercase' }}>
            {poll?.title ?? '…'}
          </h1>
          <div className="hazard-stripes" style={{ height: 8, width: '100%', margin: '16px 0' }} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ash)', margin: 0 }}>
            The host is summoning the contestants. Voting will begin shortly…
          </p>
        </div>
      </div>
    );
  }

  /* ---- CLOSED STATE ---- */
  if (poll?.status === 'closed' || isClosed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--void)', flexDirection: 'column', gap: 16, padding: 24, position: 'relative', overflow: 'hidden' }}>
        <BatsAnimation />
        <div style={{ border: '4px solid var(--blood)', background: 'var(--ink)', padding: 32, textAlign: 'center', maxWidth: 380, width: '100%', boxShadow: '8px 8px 0 var(--blood)', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <SkullIcon size={56} color="var(--blood)" />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--bone)', marginBottom: 12, textTransform: 'uppercase' }}>
            VOTING IS CLOSED.
          </h1>
          <div className="hazard-stripes" style={{ height: 8, width: '100%', margin: '16px 0' }} />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ash)', margin: 0 }}>
            THE DEAD ARE COUNTING BALLOTS…
          </p>
        </div>
      </div>
    );
  }

  /* ---- VOTED CONFIRMATION ---- */
  if (myVote && poll?.status === 'live') {
    const votedOptions = options.filter((o) => myVote.optionIds.includes(o.id));
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--void)', position: 'relative', overflow: 'hidden' }}>
        <BatsAnimation />
        {/* Top hazard stripes */}
        <div className="hazard-stripes" style={{ height: 4, width: '100%' }} />

        {/* Sticky top bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '3px solid var(--bone)', background: 'var(--ink)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--bone)', margin: 0 }}>{poll.title}</h2>
          <span className="chip chip-live"><span className="blink-dot" />LIVE</span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24, position: 'relative', zIndex: 1 }}>
          <div style={{ border: '4px solid var(--pumpkin)', background: 'var(--ink)', padding: 28, textAlign: 'center', maxWidth: 420, width: '100%', boxShadow: '8px 8px 0 var(--pumpkin)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <CandleIcon size={36} color="var(--toxic)" />
            </div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--pumpkin)', marginBottom: 16, letterSpacing: '0.08em', whiteSpace: 'pre-line', fontWeight: 700 }}>
              {poll.settings.allowChangeVote
                ? 'VOTE LOCKED IN.\n(CHANGE ALLOWED UNTIL POLL CLOSES)'
                : 'VOTE LOCKED IN.\nNO TAKE-BACKS.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: votedOptions.length > 1 ? 'repeat(2, 1fr)' : '1fr', gap: 12, marginBottom: 16 }}>
              {votedOptions.map((opt) => (
                <div key={opt.id} style={{ border: '3px solid var(--bone)', overflow: 'hidden', boxShadow: '3px 3px 0 var(--bone)' }}>
                  <img src={opt.imageUrl} alt={opt.title} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '8px 10px', borderTop: '2px solid var(--bone)', fontFamily: 'var(--font-display)', fontSize: 13, textTransform: 'uppercase', background: 'var(--void)' }}>
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
                ↺ CHANGE VOTE
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--void)', position: 'relative', overflow: 'hidden' }}>
      <BatsAnimation />
      {/* Top accent hazard stripes */}
      <div className="hazard-stripes" style={{ height: 4, width: '100%' }} />

      {/* Sticky top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '3px solid var(--bone)', background: 'var(--ink)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(14px, 4vw, 20px)', color: 'var(--bone)', margin: 0, flex: 1, textTransform: 'uppercase' }}>
          {poll?.title ?? '…'}
        </h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', whiteSpace: 'nowrap' }}>
          {maxVotes > 1 ? (
            <span style={{ background: remaining === 0 ? 'var(--toxic)' : 'var(--void)', color: remaining === 0 ? 'var(--void)' : 'var(--pumpkin)', border: '1px solid var(--bone)', padding: '3px 8px', fontWeight: 700 }}>
              {remaining} VOTE{remaining !== 1 ? 'S' : ''} LEFT
            </span>
          ) : (
            <span style={{ background: selected.length === 1 ? 'var(--toxic)' : 'var(--void)', color: selected.length === 1 ? 'var(--void)' : 'var(--bone)', border: '1px solid var(--bone)', padding: '3px 8px', fontWeight: 700 }}>
              {selected.length === 1 ? '1 PICKED' : 'CHOOSE 1'}
            </span>
          )}
        </span>
        {poll && <span className="chip chip-live"><span className="blink-dot" />LIVE</span>}
      </div>

      {/* Voter Guidance Strip */}
      <div style={{ background: 'var(--void)', borderBottom: '2px solid var(--ash)', padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 9 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--pumpkin)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>☠</span> TAP CARD TO PICK · TAP PHOTO TO ENLARGE
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', textTransform: 'uppercase' }}>
          {selected.length}/{maxVotes} PICKED
        </span>
      </div>

      {/* Options grid */}
      <div style={{ flex: 1, padding: '12px 12px 32px', overflowY: 'auto', position: 'relative', zIndex: 1 }}>
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
      <div style={{ position: 'sticky', bottom: 0, zIndex: 20, borderTop: '3px solid var(--bone)', background: 'var(--ink)', padding: 12 }}>
        <button
          className="btn-primary"
          style={{ width: '100%', fontSize: 20, padding: '16px 24px', boxShadow: selected.length > 0 ? '6px 6px 0 var(--bone)' : 'none' }}
          onClick={handleCast}
          disabled={selected.length === 0 || casting}
        >
          {casting ? 'CASTING…' : selected.length === 0 ? 'CHOOSE A CONTESTANT' : selected.length > 1 ? `🎃 CAST ${selected.length} VOTES` : '🎃 CAST YOUR VOTE'}
        </button>
      </div>
    </div>
  );
};

export default VoteScreen;
