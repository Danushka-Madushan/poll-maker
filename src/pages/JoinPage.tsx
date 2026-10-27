import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getPollByJoinCode, joinPoll } from '../firebase/pollService';
import type { Poll } from '../types/poll';
import { getDeviceToken } from '../utils/device';

const JoinPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate  = useNavigate();
  const [poll, setPoll]         = useState<Poll | null>(null);
  const [nickname, setNickname] = useState('');
  const [error, setError]       = useState(() => !code ? 'Invalid join code.' : '');
  const [loading, setLoading]   = useState(() => Boolean(code));

  const doJoin = useCallback(async (p: Poll, nick: string | undefined) => {
    const deviceToken = getDeviceToken();
    await joinPoll(p.id, deviceToken, nick);

    // Route based on current poll status
    if (p.status === 'lobby') {
      navigate(`/vote/${p.id}?waiting=1`);
    } else if (p.status === 'live') {
      navigate(`/vote/${p.id}`);
    } else if (p.status === 'revealed') {
      navigate(`/results/${p.id}`);
    } else if (p.status === 'special_voting') {
      navigate(`/vote/${p.id}`);
    } else {
      // Closed
      navigate(`/vote/${p.id}?closed=1`);
    }
  }, [navigate]);

  useEffect(() => {
    if (!code) return;

    let active = true;
    getPollByJoinCode(code)
      .then((p) => {
        if (!active) return;
        if (!p) { setError('Poll not found or has expired.'); return; }
        setPoll(p);

        // Auto-join if nickname not required
        if (!p.settings.requireNickname) {
          doJoin(p, undefined);
        }
      })
      .catch(() => {
        if (active) setError('Could not connect. Check your connection and try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [code, doJoin]);

  const handleJoin = async () => {
    if (!poll) return;
    if (poll.settings.requireNickname && !nickname.trim()) {
      setError('Please enter a nickname to join.');
      return;
    }
    setLoading(true);
    try {
      await doJoin(poll, nickname.trim() || undefined);
    } catch {
      setError('Failed to join. Please try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--void)', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--pumpkin)' }}>JOINING…</p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ash)' }}>THE SPIRITS AWAIT</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--void)', flexDirection: 'column', gap: 16, padding: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--blood)', textAlign: 'center' }}>OOPS</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 18, color: 'var(--bone)', textAlign: 'center' }}>{error}</p>
        <button className="btn-secondary" onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> BACK
        </button>
      </div>
    );
  }

  // Show nickname entry if required
  if (poll?.settings.requireNickname) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--void)', flexDirection: 'column', gap: 24, padding: 24 }}>
        <div className="join-card" style={{ border: '3px solid var(--bone)', padding: 32, maxWidth: 400, width: '100%', textAlign: 'center', background: 'var(--ink)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', marginBottom: 8 }}>JOINING</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--bone)', marginBottom: 24 }}>{poll.title}</h1>
          <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            YOUR NICKNAME
          </label>
          <input
            className={`input ${error ? 'input-error' : ''}`}
            value={nickname}
            maxLength={30}
            onChange={(e) => { setNickname(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
            placeholder="Spooky McSpookface…"
            autoFocus
          />
          {error && <p style={{ color: 'var(--blood)', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 8 }}>{error}</p>}
          <button className="btn-primary" onClick={handleJoin} style={{ marginTop: 20, width: '100%', fontSize: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            JOIN THE HAUNTING <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default JoinPage;
