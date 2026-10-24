import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import StatusChip from '../components/ui/StatusChip';
import HoldButton from '../components/ui/HoldButton';
import OptionCard from '../components/ui/OptionCard';
import { useToast } from '../components/ui/ToastContext';
import {
  subscribeToPoll,
  subscribeToOptions,
  subscribeToParticipants,
  subscribeToVotes,
  updatePollStatus,
  computeResults,
  exportResultsCSV,
} from '../firebase/pollService';
import type { Poll, PollOption, Participant, Vote } from '../types/poll';
import { isMuted, toggleMuted } from '../utils/audio';

const HostDashboard: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const [searchParams] = useSearchParams();
  const hostToken = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [poll, setPoll]               = useState<Omit<Poll, 'options'> | null>(null);
  const [options, setOptions]         = useState<PollOption[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [votes, setVotes]             = useState<Vote[]>([]);
  const [muted, setMuted]             = useState(isMuted());
  const [loading, setLoading]         = useState(true);

  // Real-time subscriptions
  useEffect(() => {
    if (!pollId) return;
    const unsub1 = subscribeToPoll(pollId, (p) => { setPoll(p); setLoading(false); });
    const unsub2 = subscribeToOptions(pollId, setOptions);
    const unsub3 = subscribeToParticipants(pollId, setParticipants);
    const unsub4 = subscribeToVotes(pollId, setVotes);
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [pollId]);

  // Compute results when votes change
  const result = useMemo(() => {
    if (options.length === 0) return null;
    return computeResults(votes, options, participants.length);
  }, [votes, options, participants.length]);

  const changeStatus = useCallback(async (status: Poll['status']) => {
    if (!pollId || !hostToken) return;
    try {
      await updatePollStatus(pollId, hostToken, status);
    } catch (err) {
      addToast({ message: `Failed to update status: ${(err as Error).message}` });
    }
  }, [pollId, hostToken, addToast]);

  const openBigScreen = () => {
    if (pollId) window.open(`/display/${pollId}`, '_blank', 'noopener');
  };

  const toggleAudio = () => {
    const m = toggleMuted();
    setMuted(m);
  };

  const joinUrl = `${window.location.origin}/join/${poll?.joinCode ?? ''}`;
  const hostUrl = `${window.location.origin}/host/${pollId ?? ''}?token=${hostToken}`;

  if (!pollId) return <div style={{ color: 'var(--blood)', padding: 32 }}>Invalid poll ID.</div>;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--void)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash)' }}>LOADING POLL…</p>
      </div>
    );
  }

  if (!poll) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--void)' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--blood)' }}>POLL NOT FOUND</p>
          <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>HOME</button>
        </div>
      </div>
    );
  }

  const voteCount = votes.length;
  const joinCount = participants.length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--void)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ borderBottom: '3px solid var(--bone)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--bone)', margin: 0, flex: 1 }}>
          {poll.title}
        </h1>
        <StatusChip status={poll.status} />
        <button className="btn-ghost" onClick={toggleAudio} aria-label={muted ? 'Unmute sound' : 'Mute sound'} title={muted ? 'Sound off' : 'Sound on'}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="btn-secondary" onClick={openBigScreen} aria-label="Open big screen">
          OPEN BIG SCREEN ↗
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', overflow: 'hidden' }}>

        {/* Left — Join panel */}
        <div style={{ borderRight: '3px solid var(--bone)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ash)', margin: 0 }}>JOIN INFO</h2>

          {/* QR */}
          {(poll.status === 'lobby' || poll.status === 'live') && (
            <div className="qr-container" style={{ display: 'inline-flex', padding: 8 }}>
              <QRCodeSVG
                value={joinUrl}
                size={180}
                level="M"
                bgColor="var(--bone)"
                fgColor="var(--void)"
              />
            </div>
          )}

          {/* Join code */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', margin: '0 0 4px', textTransform: 'uppercase' }}>Join code</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 32, color: 'var(--bone)', margin: 0, letterSpacing: '0.12em' }}>{poll.joinCode}</p>
          </div>

          {/* URL */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', margin: '0 0 4px', textTransform: 'uppercase' }}>Join URL</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bone)', wordBreak: 'break-all', margin: 0 }}>{joinUrl}</p>
          </div>
          <button
            className="btn-ghost"
            onClick={() => { navigator.clipboard.writeText(joinUrl); addToast({ message: 'Join link copied!' }); }}
            aria-label="Copy join link"
          >
            COPY LINK
          </button>

          {/* Joined count */}
          <div style={{ borderTop: '2px solid var(--ash)', paddingTop: 12 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', margin: '0 0 4px', textTransform: 'uppercase' }}>Participants</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 40, color: 'var(--toxic)', margin: 0 }}>
              {joinCount}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', margin: '4px 0 0' }}>JOINED</p>
          </div>

          {/* Activity strip */}
          {poll.status === 'live' && joinCount > 0 && (
            <div style={{ borderTop: '2px solid var(--ash)', paddingTop: 12 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', margin: '0 0 8px', textTransform: 'uppercase' }}>
                Votes in: {voteCount} / {joinCount} joined
              </p>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: joinCount > 0 ? `${(voteCount / joinCount) * 100}%` : '0%' }} />
              </div>
            </div>
          )}

          {/* Host link copy */}
          <div style={{ borderTop: '2px solid var(--ash)', paddingTop: 12 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', margin: '0 0 4px', textTransform: 'uppercase' }}>Your host link</p>
            <button
              className="btn-ghost"
              onClick={() => { navigator.clipboard.writeText(hostUrl); addToast({ message: 'Host link copied!' }); }}
            >
              COPY HOST LINK
            </button>
          </div>
        </div>

        {/* Right — Options panel + action bar */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Options */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ash)', marginBottom: 16 }}>OPTIONS</h2>
            {options.length === 0 ? (
              <p style={{ color: 'var(--ash)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>No options yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                {options.map((opt) => {
                  const tally = result?.tallies.find((t) => t.optionId === opt.id);
                  return (
                    <OptionCard
                      key={opt.id}
                      option={opt}
                      disabled
                      voteCount={poll.settings.showLiveCountsHost && poll.status === 'live' ? (tally?.count ?? 0) : undefined}
                      votePercent={poll.settings.showLiveCountsHost && poll.status === 'live' ? (tally?.percentage ?? 0) : undefined}
                    />
                  );
                })}
              </div>
            )}

            {/* Results summary if revealed */}
            {poll.status === 'revealed' && result && (
              <div style={{ marginTop: 32, borderTop: '3px solid var(--pumpkin)', paddingTop: 16 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--pumpkin)', marginBottom: 16 }}>RESULTS</h2>
                {result.tallies.map((tally) => {
                  const opt = options.find((o) => o.id === tally.optionId);
                  const isWinner = result.winners.includes(tally.optionId);
                  return (
                    <div key={tally.optionId} className="result-bar">
                      <div className={`result-bar-fill ${isWinner ? '' : 'secondary'}`} style={{ width: `${tally.percentage}%`, background: isWinner ? 'var(--pumpkin)' : 'var(--bone)' }} />
                      <span className="result-bar-label">{isWinner && '★ '}{opt?.label} — {opt?.title}</span>
                      <span className="result-bar-pct">{tally.count} ({tally.percentage}%)</span>
                    </div>
                  );
                })}
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', marginTop: 12 }}>
                  Total: {result.totalVotes} votes · {result.totalParticipants} participants · {result.turnoutPercentage}% turnout
                </p>
              </div>
            )}
          </div>

          {/* Action bar */}
          <div style={{ borderTop: '3px solid var(--bone)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'var(--ink)' }}>
            {poll.status === 'lobby' && (
              <button className="btn-primary" style={{ fontSize: 18, padding: '14px 32px' }} onClick={() => changeStatus('live')}>
                ► START POLL
              </button>
            )}
            {poll.status === 'live' && (
              <HoldButton
                label="■ STOP POLL"
                holdingLabel="KEEP HOLDING…"
                onConfirm={() => changeStatus('closed')}
                className="btn-danger"
                style={{ fontSize: 18, padding: '14px 32px' } as React.CSSProperties}
              />
            )}
            {poll.status === 'closed' && (
              <>
                <HoldButton
                  label="▶ SHOW RESULT"
                  holdingLabel="REVEALING…"
                  onConfirm={() => changeStatus('revealed')}
                  className="btn-primary"
                  style={{ fontSize: 18, padding: '14px 32px' } as React.CSSProperties}
                />
                <button className="btn-secondary" onClick={() => changeStatus('live')}>
                  ↩ REOPEN
                </button>
              </>
            )}
            {poll.status === 'revealed' && (
              <>
                <button className="btn-primary" onClick={() => navigate('/create')}>+ NEW POLL</button>
                <button className="btn-secondary" onClick={() => navigate(`/results/${pollId}`)}>VIEW RESULTS PAGE ↗</button>
                {result && (
                  <button className="btn-ghost" onClick={() => exportResultsCSV({ ...poll, options } as Poll, result)}>
                    ⬇ EXPORT CSV
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 280px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HostDashboard;
