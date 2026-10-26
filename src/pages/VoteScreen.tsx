import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Wifi, WifiOff, AlertTriangle, RotateCcw, Check } from 'lucide-react';
import OptionCard from '../components/ui/OptionCard';
import { GhostIcon, SkullIcon, CandleIcon, PumpkinIcon } from '../components/ui/HalloweenIcons';
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

/** Sharp zig-zag jagged teeth edge (Design Guide §5.5) */
const JaggedTeethEdge: React.FC<{ color: string; bg?: string; flip?: boolean; height?: number }> = ({
  color,
  bg = 'transparent',
  flip = false,
  height = 7,
}) => (
  <div
    style={{
      width: '100%',
      height,
      backgroundColor: bg,
      backgroundImage: `linear-gradient(135deg, ${color} 25%, transparent 25%), linear-gradient(225deg, ${color} 25%, transparent 25%)`,
      backgroundSize: `${height * 2}px ${height}px`,
      backgroundRepeat: 'repeat-x',
      transform: flip ? 'scaleY(-1)' : undefined,
      flexShrink: 0,
    }}
  />
);

const VoteScreen: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const [searchParams] = useSearchParams();
  const isWaiting = searchParams.get('waiting') === '1';
  const isClosed = searchParams.get('closed') === '1';
  const navigate = useNavigate();
  const { addToast } = useToast();
  const deviceToken = getDeviceToken();

  const [poll, setPoll] = useState<Omit<Poll, 'options'> | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [myVote, setMyVote] = useState<Vote | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [casting, setCasting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [justReconnected, setJustReconnected] = useState(false);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setJustReconnected(true);
      const t = setTimeout(() => setJustReconnected(false), 2500);
      return () => clearTimeout(t);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setJustReconnected(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
    return () => {
      u1();
      u2();
    };
  }, [pollId, navigate, addToast]);

  // Mobile focus & visibility change listener (reconciles on unlock / tab focus)
  useEffect(() => {
    if (!pollId) return;
    const handleSync = () => {
      if (document.visibilityState === 'visible') {
        getMyVote(pollId, deviceToken).then(setMyVote).catch(console.error);
        getPoll(pollId)
          .then((p) => {
            if (p) {
              setPoll(p);
              if (p.status === 'revealed') navigate(`/results/${pollId}`);
            }
          })
          .catch(console.error);
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

  // Subtle 5% Halftone Pattern Backdrop (Design Guide §5.5 — No bats during voting)
  const halftoneBackdrop = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'radial-gradient(var(--bone) 1.5px, transparent 1.5px)',
        backgroundSize: '18px 18px',
        opacity: 0.05,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );

  const networkBanner = (
    <>
      {isOffline && (
        <div
          style={{
            background: 'var(--blood)',
            color: 'var(--bone)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            borderBottom: '3px solid var(--void)',
            position: 'sticky',
            top: 0,
            zIndex: 999,
            letterSpacing: '0.06em',
          }}
        >
          <WifiOff size={15} />
          <span>DISCONNECTED · RECONNECTING… (VOTE SAFE)</span>
        </div>
      )}
      {!isOffline && justReconnected && (
        <div
          style={{
            background: 'var(--toxic)',
            color: 'var(--void)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 900,
            borderBottom: '3px solid var(--void)',
            position: 'sticky',
            top: 0,
            zIndex: 999,
            letterSpacing: '0.08em',
          }}
        >
          <Wifi size={15} />
          <span>RECONNECTED TO THE CRYPT</span>
        </div>
      )}
    </>
  );

  /* ---- WAITING STATE (LOBBY) ---- */
  if (poll?.status === 'lobby' || (isWaiting && !poll)) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'var(--void)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {halftoneBackdrop}
        {networkBanner}
        <div className="hazard-stripes" style={{ height: 10, width: '100%', position: 'relative', zIndex: 2 }} />

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              border: '4px solid var(--bone)',
              background: 'var(--ink)',
              maxWidth: 400,
              width: '100%',
              boxShadow: '8px 8px 0 var(--bone)',
              overflow: 'hidden',
            }}
          >
            {/* Status Header Strip */}
            <div
              style={{
                background: 'var(--bone)',
                color: 'var(--void)',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '0.12em',
              }}
            >
              <span className="blink-dot" style={{ background: 'var(--void)', width: 8, height: 8 }} />
              <span>YOU’RE IN · STANDBY</span>
            </div>
            <JaggedTeethEdge color="var(--bone)" height={7} />

            <div style={{ padding: '28px 24px 32px', textAlign: 'center' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  margin: '0 auto 18px',
                  background: 'var(--void)',
                  border: '3px solid var(--bone)',
                  boxShadow: '4px 4px 0 var(--pumpkin)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <GhostIcon size={44} color="var(--bone)" />
              </div>

              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(24px, 6vw, 32px)',
                  color: 'var(--bone)',
                  margin: '0 0 16px',
                  textTransform: 'uppercase',
                  lineHeight: 0.95,
                }}
              >
                {poll?.title ?? 'SUMMONING POLL…'}
              </h1>

              <div className="hazard-stripes" style={{ height: 8, width: '100%', margin: '18px 0' }} />

              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 16,
                  color: 'var(--ash)',
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                You’re in. The host is summoning the poll…
              </p>
            </div>
          </div>
        </div>

        <div className="hazard-stripes" style={{ height: 10, width: '100%', position: 'relative', zIndex: 2 }} />
      </div>
    );
  }

  /* ---- CLOSED STATE ---- */
  if (poll?.status === 'closed' || isClosed) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'var(--void)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {halftoneBackdrop}
        {networkBanner}
        <div className="hazard-stripes" style={{ height: 10, width: '100%', position: 'relative', zIndex: 2 }} />

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              border: '4px solid var(--blood)',
              background: 'var(--ink)',
              maxWidth: 400,
              width: '100%',
              boxShadow: '8px 8px 0 var(--blood)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background: 'var(--blood)',
                color: 'var(--bone)',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '0.12em',
              }}
            >
              <span>BALLOT BOX SEALED</span>
            </div>
            <JaggedTeethEdge color="var(--blood)" height={7} />

            <div style={{ padding: '28px 24px 32px', textAlign: 'center' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  margin: '0 auto 18px',
                  background: 'var(--void)',
                  border: '3px solid var(--blood)',
                  boxShadow: '4px 4px 0 var(--blood)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SkullIcon size={44} color="var(--blood)" />
              </div>

              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(24px, 6vw, 32px)',
                  color: 'var(--bone)',
                  margin: '0 0 14px',
                  textTransform: 'uppercase',
                  lineHeight: 0.95,
                }}
              >
                VOTING IS CLOSED.
              </h1>

              <div className="hazard-stripes" style={{ height: 8, width: '100%', margin: '18px 0' }} />

              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  color: 'var(--pumpkin)',
                  margin: 0,
                  letterSpacing: '0.08em',
                  fontWeight: 700,
                }}
              >
                THE SPIRITS ARE COUNTING.
              </p>
            </div>
          </div>
        </div>

        <div className="hazard-stripes" style={{ height: 10, width: '100%', position: 'relative', zIndex: 2 }} />
      </div>
    );
  }

  /* ---- REVEALED / TRANSITION TO RESULTS ---- */
  if (poll?.status === 'revealed') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--void)',
          flexDirection: 'column',
          gap: 16,
          padding: 20,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {halftoneBackdrop}
        <div
          style={{
            border: '4px solid var(--pumpkin)',
            background: 'var(--ink)',
            maxWidth: 400,
            width: '100%',
            boxShadow: '8px 8px 0 var(--pumpkin)',
            position: 'relative',
            zIndex: 1,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              background: 'var(--pumpkin)',
              color: 'var(--void)',
              padding: '8px 14px',
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: '0.12em',
            }}
          >
            RESULTS REVEALED
          </div>
          <JaggedTeethEdge color="var(--pumpkin)" height={7} />

          <div style={{ padding: '28px 24px 32px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <SkullIcon size={56} color="var(--pumpkin)" />
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 28,
                color: 'var(--pumpkin)',
                marginBottom: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              THE VEIL IS LIFTED!
            </h1>
            <div className="hazard-stripes" style={{ height: 8, width: '100%', margin: '16px 0' }} />
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: 'var(--bone)',
                margin: 0,
                letterSpacing: '0.08em',
              }}
            >
              ENTERING THE HALL OF SOULS…
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ---- VOTED CONFIRMATION STATE (Design Guide §4.6 & §9) ---- */
  if (myVote && poll?.status === 'live') {
    const votedOptions = options.filter((o) => myVote.optionIds.includes(o.id));
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--void)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {halftoneBackdrop}
        {networkBanner}

        {/* Sticky Top Bar */}
        <header style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <div className="hazard-stripes" style={{ height: 6, width: '100%' }} />
          <div
            style={{
              borderBottom: '3px solid var(--bone)',
              background: 'var(--ink)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <PumpkinIcon size={20} color="var(--pumpkin)" />
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(15px, 4vw, 20px)',
                  color: 'var(--bone)',
                  margin: 0,
                  textTransform: 'uppercase',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {poll.title}
              </h2>
            </div>
            <span className="chip chip-live" style={{ flexShrink: 0 }}>
              <span className="blink-dot" />
              LIVE
            </span>
          </div>
          <JaggedTeethEdge color="var(--bone)" height={6} />
        </header>

        {/* Locked-In Card Container */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 16px 32px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              border: '4px solid var(--pumpkin)',
              background: 'var(--ink)',
              maxWidth: 420,
              width: '100%',
              boxShadow: '8px 8px 0 var(--pumpkin)',
              overflow: 'hidden',
            }}
          >
            {/* Solid Banner Header */}
            <div
              style={{
                background: 'var(--pumpkin)',
                color: 'var(--void)',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <Check size={20} strokeWidth={3.5} />
              <span>VOTE LOCKED IN</span>
            </div>
            <JaggedTeethEdge color="var(--pumpkin)" height={7} />

            <div style={{ padding: '20px 18px 22px', textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--void)',
                  border: '2px solid var(--toxic)',
                  boxShadow: '3px 3px 0 var(--toxic)',
                  padding: '5px 12px',
                  marginBottom: 18,
                }}
              >
                <CandleIcon size={16} color="var(--toxic)" />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--toxic)',
                    letterSpacing: '0.08em',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {poll.settings.allowChangeVote
                    ? 'CHANGE ALLOWED UNTIL POLL STOPS'
                    : 'NO TAKE-BACKS'}
                </span>
              </div>

              {/* Chosen Option(s) Preview Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: votedOptions.length > 1 ? 'repeat(2, 1fr)' : '1fr',
                  gap: 14,
                  marginBottom: 20,
                  maxWidth: votedOptions.length === 1 ? 260 : '100%',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                {votedOptions.map((opt) => (
                  <div
                    key={opt.id}
                    style={{
                      border: '3px solid var(--bone)',
                      background: 'var(--void)',
                      boxShadow: '5px 5px 0 var(--bone)',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div style={{ position: 'relative', width: '100%', height: 0, paddingBottom: '100%', overflow: 'hidden', background: 'var(--void)' }}>
                      <img
                        src={opt.imageUrl}
                        alt={opt.title}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                      {/* Top-left Solid Option Label Chip */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          background: 'var(--pumpkin)',
                          color: 'var(--void)',
                          borderRight: '3px solid var(--void)',
                          borderBottom: '3px solid var(--void)',
                          padding: '3px 10px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 14,
                          fontWeight: 900,
                        }}
                      >
                        {opt.label}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '10px 12px',
                        borderTop: '3px solid var(--bone)',
                        fontFamily: 'var(--font-display)',
                        fontSize: 15,
                        color: 'var(--bone)',
                        textTransform: 'uppercase',
                        background: 'var(--ink)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.title}
                    </div>
                  </div>
                ))}
              </div>

              {poll.settings.allowChangeVote && (
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setMyVote(null);
                    setSelected(myVote.optionIds);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '3px solid var(--bone)',
                    boxShadow: '4px 4px 0 var(--bone)',
                    background: 'var(--void)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <RotateCcw size={16} /> CHANGE VOTE
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ---- ACTIVE VOTING STATE (Design Guide §4.6) ---- */
  const remaining = maxVotes - selected.length;
  const selectedLabels = options
    .filter((o) => selected.includes(o.id))
    .map((o) => o.label)
    .join(', ');

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--void)',
        position: 'relative',
      }}
    >
      {halftoneBackdrop}
      {networkBanner}

      {/* Sticky Top Header Bar */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20 }}>
        <div className="hazard-stripes" style={{ height: 6, width: '100%' }} />

        <div
          style={{
            borderBottom: '3px solid var(--bone)',
            background: 'var(--ink)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          {/* Left: Poll Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <PumpkinIcon size={20} color="var(--pumpkin)" />
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(15px, 4.2vw, 20px)',
                color: 'var(--bone)',
                margin: 0,
                textTransform: 'uppercase',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {poll?.title ?? '…'}
            </h1>
          </div>

          {/* Right: Vote Left Chip + Live Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                background: remaining === 0 ? 'var(--toxic)' : 'var(--void)',
                color: remaining === 0 ? 'var(--void)' : 'var(--pumpkin)',
                border: `2px solid ${remaining === 0 ? 'var(--void)' : 'var(--pumpkin)'}`,
                boxShadow: remaining === 0 ? '2px 2px 0 var(--bone)' : '2px 2px 0 var(--pumpkin)',
                padding: '3px 8px',
                fontWeight: 900,
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}
            >
              {maxVotes > 1
                ? `${remaining} VOTE${remaining !== 1 ? 'S' : ''} LEFT`
                : selected.length === 1
                  ? '1 PICKED'
                  : '1 VOTE LEFT'}
            </span>
            {poll && (
              <span className="chip chip-live">
                <span className="blink-dot" />
                LIVE
              </span>
            )}
          </div>
        </div>

        {/* Voter Guidance Sub-Bar (Zero Emojis — Geometric Skull Icon) */}
        <div
          style={{
            background: 'var(--void)',
            borderBottom: '3px solid var(--bone)',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <SkullIcon size={14} color="var(--pumpkin)" />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(10px, 2.7vw, 11px)',
                color: 'var(--bone)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              TAP CARD TO PICK · TAP PHOTO TO ZOOM
            </span>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: selected.length > 0 ? 'var(--toxic)' : 'var(--ash)',
              fontWeight: 700,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {selected.length}/{maxVotes}
          </span>
        </div>
        <JaggedTeethEdge color="var(--bone)" height={6} />
      </header>

      {/* 2-Column Square Option Card Grid */}
      <main
        style={{
          flex: 1,
          padding: '14px 12px 28px',
          position: 'relative',
          zIndex: 1,
          maxWidth: 640,
          width: '100%',
          margin: '0 auto',
        }}
      >
        {poll?.subtitle && (
          <div
            style={{
              background: 'var(--ink)',
              border: '2px solid var(--ash)',
              padding: '8px 12px',
              marginBottom: 14,
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--bone)',
            }}
          >
            {poll.subtitle}
          </div>
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
      </main>

      {/* Sticky Bottom CTA Dock (Design Guide §4.6) */}
      <footer
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 20,
          borderTop: '4px solid var(--bone)',
          background: 'var(--ink)',
          padding: '10px 12px 14px',
        }}
      >
        {/* Active Selection Status Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
            padding: '0 2px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ color: selected.length > 0 ? 'var(--toxic)' : 'var(--ash)', fontWeight: 700 }}>
            {selected.length > 0 ? `SELECTED: OPTION ${selectedLabels}` : 'NO CONTESTANT SELECTED'}
          </span>
          <span style={{ color: 'var(--ash)' }}>
            {selected.length}/{maxVotes} PICKED
          </span>
        </div>

        <button
          className="btn-primary"
          style={{
            width: '100%',
            fontSize: 20,
            padding: '16px 24px',
            boxShadow: selected.length > 0 ? '6px 6px 0 var(--bone)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            letterSpacing: '0.04em',
          }}
          onClick={handleCast}
          disabled={selected.length === 0 || casting || isOffline}
        >
          {isOffline ? (
            <>
              <WifiOff size={20} /> RECONNECTING…
            </>
          ) : casting ? (
            <>
              <AlertTriangle size={20} /> LOCKING IN VOTE…
            </>
          ) : selected.length === 0 ? (
            'SELECT AN OPTION TO VOTE'
          ) : selected.length > 1 ? (
            <>
              <Check size={22} strokeWidth={3} /> CAST {selected.length} VOTES
            </>
          ) : (
            <>
              <Check size={22} strokeWidth={3} /> CAST YOUR VOTE
            </>
          )}
        </button>
      </footer>
    </div>
  );
};

export default VoteScreen;
