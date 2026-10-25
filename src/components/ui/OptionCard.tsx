import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { PollOption } from '../../types/poll';

interface OptionCardProps {
  option: PollOption;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  showLabel?: boolean; // show A/B/C chip
  voteCount?: number;  // show on host dashboard
  votePercent?: number;
}

const OptionCard: React.FC<OptionCardProps> = ({
  option,
  selected = false,
  onClick,
  disabled = false,
  showLabel = true,
  voteCount,
  votePercent,
}) => {
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!preview) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [preview]);

  const handleClick = () => {
    if (!disabled && onClick) onClick();
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(true);
  };

  return (
    <>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-pressed={selected}
        aria-label={`Option ${option.label}: ${option.title}`}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        className={`option-card ${selected ? 'selected' : ''} ${disabled ? 'cursor-default' : ''}`}
        style={{ cursor: disabled ? 'default' : 'pointer' }}
      >
        {showLabel && (
          <span className="option-label-chip" aria-hidden="true">{option.label}</span>
        )}

        {option.imageUrl ? (
          <img
            src={option.imageUrl}
            alt={option.title}
            onClick={handleImageClick}
            style={{ cursor: 'zoom-in' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ash)', fontFamily: 'var(--font-mono)', fontSize: 13
          }}>
            NO IMAGE
          </div>
        )}

        <div className="option-title-bar">{option.title}</div>

        {selected && (
          <div className="check-block" aria-hidden="true">
            <Check size={16} strokeWidth={3.5} />
          </div>
        )}

        {/* Host-only vote count overlay */}
        {voteCount !== undefined && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: 'var(--pumpkin)',
            color: 'var(--void)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            padding: '3px 7px',
            zIndex: 3,
          }}>
            {voteCount}{votePercent !== undefined ? ` · ${votePercent}%` : ''}
          </div>
        )}
      </div>

      {/* Full-screen preview overlay */}
      {preview && (
        <div
          onClick={() => setPreview(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${option.title}`}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(13, 11, 16, 0.95)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 10000,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={option.imageUrl}
            alt={option.title}
            style={{
              maxWidth: '90vw', maxHeight: '80vh',
              objectFit: 'contain',
              border: '3px solid var(--bone)',
              boxShadow: '8px 8px 0 var(--pumpkin)',
            }}
          />
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 20,
            color: 'var(--bone)', marginTop: 16, textTransform: 'uppercase'
          }}>
            {option.label} — {option.title}
          </p>
          <p style={{ color: 'var(--ash)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
            TAP ANYWHERE TO CLOSE
          </p>
        </div>
      )}
    </>
  );
};

export default OptionCard;
