import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Volume2,
  VolumeX,
  ExternalLink,
  Copy,
  Pencil,
  RotateCcw,
  Plus,
  Download,
  FileImage,
  Trash2,
  ChevronUp,
  ChevronDown,
  Crown,
  Flame,
} from 'lucide-react';
import StatusChip from '../components/ui/StatusChip';
import HoldButton from '../components/ui/HoldButton';
import OptionCard from '../components/ui/OptionCard';
import ConfirmModal from '../components/ui/ConfirmModal';
import { useToast } from '../components/ui/ToastContext';
import {
  subscribeToPoll,
  subscribeToOptions,
  subscribeToParticipants,
  subscribeToVotes,
  updatePollStatus,
  purgePoll,
  computeResults,
  exportResultsCSV,
  resolveTieWinner,
} from '../firebase/pollService';
import { exportResultPNG } from '../utils/canvasExport';
import type { Poll, PollOption, Participant, Vote } from '../types/poll';
import { isMuted, toggleMuted } from '../utils/audio';
import { formatJoinCode } from '../utils/code';
import { getRecentPolls } from '../utils/device';

const HostDashboard: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const [searchParams] = useSearchParams();
  const queryToken = searchParams.get('token') ?? '';
  const hostToken = queryToken || (pollId ? (getRecentPolls().find((p) => p.pollId === pollId)?.hostToken ?? '') : '');
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [poll, setPoll]               = useState<Omit<Poll, 'options'> | null>(null);
  const [options, setOptions]         = useState<PollOption[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [votes, setVotes]             = useState<Vote[]>([]);
  const [muted, setMuted]             = useState(isMuted());
  const [loading, setLoading]         = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Real-time subscriptions
  useEffect(() => {
    if (!pollId) return;
    const unsub1 = subscribeToPoll(
      pollId,
      (p) => { setPoll(p); setLoading(false); },
      undefined,
      () => {
        addToast({ message: 'This poll was purged.' });
        navigate('/');
      }
    );
    const unsub2 = subscribeToOptions(pollId, setOptions);
    const unsub3 = subscribeToParticipants(pollId, setParticipants);
    const unsub4 = subscribeToVotes(pollId, setVotes);
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [pollId, navigate, addToast]);

  // Compute results when votes change
  const result = useMemo(() => {
    if (options.length === 0) return null;
    return computeResults(votes, options, participants.length, poll?.decidedWinnerId);
  }, [votes, options, participants.length, poll?.decidedWinnerId]);

  const changeStatus = useCallback(async (status: Poll['status']) => {
    if (!pollId) return;
    const token = hostToken || poll?.hostToken || '';
    // Optimistically update poll state so button and badges change immediately
    setPoll((prev) => (prev ? { ...prev, status } : null));
    try {
      await updatePollStatus(pollId, token, status);
      addToast({ message: `Poll is now ${status.toUpperCase()}!` });
    } catch (err) {
      addToast({ message: `Failed to update status: ${(err as Error).message}` });
    }
  }, [pollId, hostToken, poll?.hostToken, addToast]);

  const handlePickWinner = async (optionId: string) => {
    if (!pollId) return;
    try {
      await resolveTieWinner(pollId, hostToken, optionId);
      setPoll((prev) => (prev ? { ...prev, decidedWinnerId: optionId } : null));
      addToast({ message: optionId ? 'Decisive champion crowned!' : 'Tie reset to co-winners.' });
    } catch (err) {
      addToast({ message: `Failed to resolve tie: ${(err as Error).message}` });
    }
  };

  const handlePurge = () => {
    if (!pollId) return;
    setConfirmModal({
      isOpen: true,
      title: `PURGE "${poll?.title?.toUpperCase() || 'THIS POLL'}"?`,
      message:
        'This will permanently destroy this poll, all options, and all cast votes from Cloud Firestore and this device. This cannot be undone.',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await purgePoll(pollId, hostToken);
          addToast({ message: 'Poll permanently purged from existence.' });
          navigate('/');
        } catch (err) {
          addToast({ message: `Failed to purge poll: ${(err as Error).message}` });
        }
      },
    });
  };

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
  const joinCount = Math.max(participants.length, votes.length);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--void)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ borderBottom: '3px solid var(--bone)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--bone)', margin: 0, flex: 1 }}>
          {poll.title}
        </h1>
        <StatusChip status={poll.status} />
        <button
          className="btn-ghost"
          onClick={toggleAudio}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          title={muted ? 'Sound off' : 'Sound on'}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button
          className="btn-secondary"
          onClick={openBigScreen}
          aria-label="Open big screen"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          OPEN BIG SCREEN <ExternalLink size={16} />
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
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 32, color: 'var(--bone)', margin: 0, letterSpacing: '0.12em' }}>
              {formatJoinCode(poll.joinCode)}
            </p>
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
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Copy size={14} /> COPY LINK
          </button>

          {/* Joined count */}
          <div style={{ borderTop: '2px solid var(--ash)', paddingTop: 12 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', margin: '0 0 4px', textTransform: 'uppercase' }}>Participants</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 40, color: 'var(--toxic)', margin: 0 }}>
              {joinCount}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', margin: '4px 0 0' }}>JOINED</p>
            {joinCount > 0 && (
              <button
                className="btn-ghost"
                onClick={() => setShowParticipants((v) => !v)}
                style={{ marginTop: 8, fontSize: 11, padding: '4px 8px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>AUDIENCE LIST</span>
                {showParticipants ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            {showParticipants && (
              <div style={{ marginTop: 8, maxHeight: 160, overflowY: 'auto', border: '2px solid var(--ash)', padding: 8, background: 'var(--ink)' }}>
                {participants.map((p, idx) => (
                  <div key={p.id || idx} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone)', padding: '3px 0', borderBottom: '1px solid rgba(244,238,223,0.1)' }}>
                    {p.nickname ? `👻 ${p.nickname}` : `🎃 Guest #${idx + 1}`}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity strip */}
          {(poll.status === 'live' || poll.status === 'closed') && joinCount > 0 && (
            <div style={{ borderTop: '2px solid var(--ash)', paddingTop: 12 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', margin: '0 0 8px', textTransform: 'uppercase' }}>
                Votes in: {voteCount} / {joinCount} joined {poll.status === 'closed' ? '(FINAL TALLY)' : ''}
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
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}
            >
              <Copy size={14} /> COPY HOST LINK
            </button>
          </div>
        </div>

        {/* Right — Options panel + action bar */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Options */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {/* Confidential Host Leader Preview (visible during closed status before Reveal) */}
            {poll.status === 'closed' && result && (
              <div style={{ marginBottom: 20, border: '3px solid var(--pumpkin)', background: 'var(--ink)', padding: '14px 18px', boxShadow: '6px 6px 0 var(--pumpkin)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Crown size={24} color="var(--pumpkin)" />
                  <div>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--pumpkin)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      CONFIDENTIAL HOST PREVIEW · RESULTS FROZEN
                    </p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', margin: '4px 0 0' }}>
                      {result.totalVotes === 0 ? (
                        'NO VOTES RECORDED'
                      ) : result.winners.length === 1 ? (
                        <>
                          LEADER: <strong>{options.find((o) => o.id === result.winners[0])?.label} — {options.find((o) => o.id === result.winners[0])?.title}</strong> ({result.tallies.find((t) => t.optionId === result.winners[0])?.count || 0} votes · {result.tallies.find((t) => t.optionId === result.winners[0])?.percentage || 0}%)
                        </>
                      ) : (
                        <>
                          DEADLOCK TIE: {result.winners.length} CONTESTANTS TIED ({result.tallies[0]?.count || 0} votes each)
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', background: 'var(--void)', padding: '4px 10px', border: '1px solid var(--ash)' }}>
                  HIDDEN FROM AUDIENCE UNTIL YOU REVEAL
                </span>
              </div>
            )}

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ash)', marginBottom: 16 }}>OPTIONS</h2>
            {options.length === 0 ? (
              <p style={{ color: 'var(--ash)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>No options yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                {options.map((opt) => {
                  const tally = result?.tallies.find((t) => t.optionId === opt.id);
                  const showCounts = poll.settings.showLiveCountsHost && (poll.status === 'live' || poll.status === 'closed');
                  return (
                    <OptionCard
                      key={opt.id}
                      option={opt}
                      disabled
                      voteCount={showCounts ? (tally?.count ?? 0) : undefined}
                      votePercent={showCounts ? (tally?.percentage ?? 0) : undefined}
                    />
                  );
                })}
              </div>
            )}

            {/* Tie resolution controls (when poll is closed or revealed) */}
            {(poll.status === 'closed' || poll.status === 'revealed') && result && result.totalVotes > 0 && (
              <>
                {result.isTie && (
                  <div style={{ marginTop: 24, border: '3px solid var(--pumpkin)', background: 'var(--ink)', padding: 18, boxShadow: '6px 6px 0 var(--pumpkin)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--pumpkin)', marginBottom: 8 }}>
                      <Flame size={20} />
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, textTransform: 'uppercase', margin: 0 }}>
                        DEADLOCK: TIE BETWEEN CO-WINNERS
                      </h3>
                    </div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', margin: '0 0 14px' }}>
                      {poll.settings.tieRule === 'host-picks'
                        ? 'Host tie-breaker rule is active. Select the single champion below:'
                        : 'Multiple contestants share the lead. You can designate a single winner or keep co-winners:'}
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {result.winners.map((wId) => {
                        const opt = options.find((o) => o.id === wId);
                        if (!opt) return null;
                        return (
                          <button
                            key={wId}
                            className="btn-primary"
                            onClick={() => handlePickWinner(wId)}
                            style={{ fontSize: 13, padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          >
                            <Crown size={15} /> CROWN {opt.label}: {opt.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {result.isTieResolved && (
                  <div style={{ marginTop: 24, border: '2px solid var(--toxic)', background: 'var(--ink)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--toxic)', flexWrap: 'wrap' }}>
                    <Crown size={20} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>
                      HOST DECIDED WINNER: {options.find((o) => o.id === result.decidedWinnerId)?.title}
                    </span>
                    <button
                      className="btn-ghost"
                      onClick={() => handlePickWinner('')}
                      style={{ fontSize: 11, padding: '4px 10px' }}
                    >
                      RESET TO CO-WINNERS
                    </button>
                  </div>
                )}
              </>
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
              <>
                <HoldButton
                  label="► PUSH & HOLD TO START"
                  holdingLabel="STARTING HAUNT…"
                  onConfirm={() => changeStatus('live')}
                  className="btn-hold-primary"
                  style={{ fontSize: 18, padding: '14px 32px' } as React.CSSProperties}
                />
                <button
                  className="btn-secondary"
                  style={{ fontSize: 18, padding: '14px 24px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  onClick={() => navigate(`/create?edit=${pollId}&token=${hostToken}`)}
                >
                  <Pencil size={18} /> EDIT OPTIONS
                </button>
              </>
            )}
            {poll.status === 'live' && (
              <HoldButton
                label="■ PUSH & HOLD TO END"
                holdingLabel="STOPPING POLL…"
                onConfirm={() => changeStatus('closed')}
                className="btn-hold-danger"
                style={{ fontSize: 18, padding: '14px 32px' } as React.CSSProperties}
              />
            )}
            {poll.status === 'closed' && (
              <>
                <HoldButton
                  label="▶ PUSH & HOLD TO REVEAL"
                  holdingLabel="REVEALING RESULTS…"
                  onConfirm={() => changeStatus('revealed')}
                  className="btn-hold-primary"
                  style={{ fontSize: 18, padding: '14px 32px' } as React.CSSProperties}
                />
                <button
                  className="btn-secondary"
                  onClick={() => changeStatus('live')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <RotateCcw size={16} /> REOPEN
                </button>
              </>
            )}
            {poll.status === 'revealed' && (
              <>
                <button
                  className="btn-primary"
                  onClick={() => navigate('/create')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={16} /> NEW POLL
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => navigate(`/results/${pollId}`)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  VIEW RESULTS PAGE <ExternalLink size={16} />
                </button>
                {result && (
                  <>
                    <button
                      className="btn-ghost"
                      onClick={() => exportResultsCSV({ ...poll, options } as Poll, result)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Download size={14} /> EXPORT CSV
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => exportResultPNG({ ...poll, options } as Poll, result)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <FileImage size={14} /> SHAREABLE PNG
                    </button>
                  </>
                )}
                {result?.totalVotes === 0 && (
                  <button
                    className="btn-secondary"
                    onClick={() => changeStatus('live')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <RotateCcw size={14} /> REOPEN VOTING
                  </button>
                )}
              </>
            )}
            <button
              className="btn-ghost"
              onClick={handlePurge}
              style={{ marginLeft: 'auto', borderColor: 'var(--blood)', color: 'var(--blood)', fontSize: 13, padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title="Permanently delete this poll from existence"
            >
              <Trash2 size={14} /> PURGE POLL
            </button>
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

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel="PURGE POLL"
        cancelLabel="CANCEL"
        variant="danger"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default HostDashboard;
