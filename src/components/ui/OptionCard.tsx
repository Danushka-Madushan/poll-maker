import React, { useEffect, useState } from 'react';
import { Check, Maximize2, X } from 'lucide-react';
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

  const handleZoomClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Only open preview when tapping the corner zoom button
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
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        className={`option-card ${selected ? 'selected' : ''} ${disabled ? 'cursor-default' : ''}`}
        style={{
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          aspectRatio: 'auto', // Override CSS aspect-ratio on the outer card so the inner image is strictly 1:1
          height: 'auto',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Bulletproof 1:1 Square Image Box (100% padding-bottom works on every browser) */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 0,
            paddingBottom: '100%',
            background: 'var(--void)',
            overflow: 'hidden',
          }}
        >
          {showLabel && (
            <span className="option-label-chip" aria-hidden="true" style={{ zIndex: 3 }}>
              {option.label}
            </span>
          )}

          {option.imageUrl ? (
            <>
              <img
                src={option.imageUrl}
                alt={option.title}
                draggable={false}
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
              <button
                type="button"
                onClick={handleZoomClick}
                title={`Zoom image for ${option.title}`}
                aria-label={`Zoom image for ${option.title}`}
                style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  width: 32,
                  height: 32,
                  background: 'var(--void)',
                  color: 'var(--bone)',
                  border: '2px solid var(--bone)',
                  boxShadow: '2px 2px 0 var(--void)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'zoom-in',
                  padding: 0,
                  zIndex: 3,
                  opacity: 0.9,
                }}
              >
                <Maximize2 size={15} />
              </button>
            </>
          ) : (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ash)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
              }}
            >
              NO IMAGE
            </div>
          )}

          {selected && (
            <div className="check-block" aria-hidden="true" style={{ zIndex: 3 }}>
              <Check size={16} strokeWidth={3.5} />
            </div>
          )}

          {/* Host-only vote count overlay */}
          {voteCount !== undefined && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                background: 'var(--pumpkin)',
                color: 'var(--void)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 700,
                padding: '3px 7px',
                zIndex: 3,
              }}
            >
              {voteCount}
              {votePercent !== undefined ? ` · ${votePercent}%` : ''}
            </div>
          )}
        </div>

        <div className="option-title-bar" style={{ position: 'relative', flexShrink: 0 }}>
          {option.title}
        </div>
      </div>

      {/* Full-screen preview overlay */}
      {preview && (
        <div
          onClick={() => setPreview(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${option.title}`}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            background: 'rgba(13, 11, 16, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 10000,
            cursor: 'zoom-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              maxWidth: '92vw',
              cursor: 'default',
            }}
          >
            <div style={{ position: 'relative' }}>
              <img
                src={option.imageUrl}
                alt={option.title}
                style={{
                  maxWidth: '90vw',
                  maxHeight: '72vh',
                  objectFit: 'contain',
                  border: '3px solid var(--bone)',
                  boxShadow: '8px 8px 0 var(--pumpkin)',
                  display: 'block',
                  background: 'var(--void)',
                }}
              />
              <button
                type="button"
                onClick={() => setPreview(false)}
                aria-label="Close preview"
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 34,
                  height: 34,
                  background: 'var(--void)',
                  color: 'var(--bone)',
                  border: '2px solid var(--bone)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                color: 'var(--bone)',
                marginTop: 18,
                marginBottom: 12,
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              {option.label} — {option.title}
            </p>

            {!disabled && onClick && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (!selected) handleClick();
                  setPreview(false);
                }}
                style={{
                  padding: '10px 24px',
                  fontSize: 15,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <Check size={18} strokeWidth={3} />
                {selected ? 'ALREADY SELECTED · CLOSE' : `SELECT OPTION ${option.label}`}
              </button>
            )}

            <p
              onClick={() => setPreview(false)}
              style={{
                color: 'var(--ash)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                margin: 0,
                cursor: 'pointer',
              }}
            >
              TAP OUTSIDE OR PRESS ESC TO CLOSE
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default OptionCard;
