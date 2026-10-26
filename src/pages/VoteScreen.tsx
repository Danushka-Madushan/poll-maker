import React, { useState } from 'react';
import { Check, Maximize2, X } from 'lucide-react';
import type { PollOption } from '../../types/poll';

interface OptionCardProps {
  option: PollOption;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  voteCount?: number;
  votePercentage?: number;
  showStats?: boolean;
}

/**
 * Square brutalist option card (Design Guide §4.6 & §5.6).
 * UX Priority: Tapping ANYWHERE on the card selects it.
 * A dedicated corner zoom button opens the full-screen image preview.
 */
const OptionCard: React.FC<OptionCardProps> = ({
  option,
  selected = false,
  onClick,
  disabled = false,
  voteCount,
  votePercentage,
  showStats = false,
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleCardClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  const handleZoomClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling selection when voter just wants to inspect the photo
    setPreviewOpen(true);
  };

  return (
    <>
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick && !disabled ? 0 : undefined}
        aria-pressed={onClick ? selected : undefined}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && onClick) {
            e.preventDefault();
            onClick();
          }
        }}
        style={{
          border: selected ? '4px solid var(--pumpkin)' : '3px solid var(--bone)',
          background: 'var(--ink)',
          boxShadow: selected ? '6px 6px 0 var(--pumpkin)' : '4px 4px 0 var(--bone)',
          display: 'flex',
          flexDirection: 'column',
          cursor: disabled ? 'default' : onClick ? 'pointer' : 'default',
          position: 'relative',
          overflow: 'hidden',
          transition: 'transform 80ms steps(2, end), box-shadow 80ms steps(2, end)',
          transform: selected ? 'translate(-2px, -2px)' : 'none',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Square 1:1 Image Container — Tapping the image now selects the card! */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            background: 'var(--void)',
            overflow: 'hidden',
          }}
        >
          <img
            src={option.imageUrl}
            alt={option.title}
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              pointerEvents: 'none', // Ensures tap goes straight to the card's selection handler
            }}
          />

          {/* Top-Left Option Label Block (A, B, C...) — Design Guide §5.6 */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              background: selected ? 'var(--pumpkin)' : 'var(--bone)',
              color: 'var(--void)',
              borderRight: '3px solid var(--void)',
              borderBottom: '3px solid var(--void)',
              padding: '3px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              fontWeight: 900,
              letterSpacing: '0.04em',
              zIndex: 2,
            }}
          >
            {option.label}
          </div>

          {/* Top-Right Selected Check Block — Design Guide §4.6 & §5.6 */}
          {selected && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                background: 'var(--pumpkin)',
                color: 'var(--void)',
                borderLeft: '3px solid var(--void)',
                borderBottom: '3px solid var(--void)',
                padding: '5px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
              }}
            >
              <Check size={18} strokeWidth={3.5} />
            </div>
          )}

          {/* Dedicated Bottom-Right Zoom Button (Only this opens the full-screen preview) */}
          <button
            type="button"
            onClick={handleZoomClick}
            title={`Enlarge photo for ${option.title}`}
            aria-label={`Enlarge photo for ${option.title}`}
            style={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              background: 'var(--void)',
              color: 'var(--bone)',
              border: '2px solid var(--bone)',
              boxShadow: '2px 2px 0 var(--void)',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              zIndex: 3,
              opacity: 0.9,
            }}
          >
            <Maximize2 size={15} />
          </button>
        </div>

        {/* Title Bar Below Image */}
        <div
          style={{
            padding: '10px 10px',
            borderTop: selected ? '3px solid var(--pumpkin)' : '3px solid var(--bone)',
            background: selected ? 'var(--pumpkin)' : 'var(--ink)',
            color: selected ? 'var(--void)' : 'var(--bone)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(14px, 3.6vw, 17px)',
                textTransform: 'uppercase',
                lineHeight: 1.1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {option.title}
            </span>
            {selected && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 900,
                  background: 'var(--void)',
                  color: 'var(--pumpkin)',
                  padding: '2px 5px',
                  letterSpacing: '0.06em',
                  flexShrink: 0,
                }}
              >
                PICKED
              </span>
            )}
          </div>

          {/* Host Live Stats Bar (Shown on Host Dashboard when enabled) */}
          {showStats && typeof voteCount === 'number' && typeof votePercentage === 'number' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: selected ? 'var(--void)' : 'var(--pumpkin)',
                }}
              >
                <span>{voteCount} VOTES</span>
                <span>{votePercentage}%</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 8,
                  background: 'var(--void)',
                  border: '1px solid var(--bone)',
                }}
              >
                <div
                  style={{
                    width: `${votePercentage}%`,
                    height: '100%',
                    background: 'var(--pumpkin)',
                    transition: 'width 240ms linear',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Photo Lightbox Modal (Only opens when tapping the corner Maximize icon) */}
      {previewOpen && (
        <div
          onClick={() => setPreviewOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(13, 11, 16, 0.94)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            gap: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 460,
              width: '100%',
              background: 'var(--ink)',
              border: '4px solid var(--bone)',
              boxShadow: '8px 8px 0 var(--pumpkin)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                background: 'var(--bone)',
                color: 'var(--void)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 16,
                  textTransform: 'uppercase',
                }}
              >
                OPTION {option.label} — {option.title}
              </span>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                style={{
                  background: 'var(--void)',
                  color: 'var(--bone)',
                  border: '2px solid var(--void)',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Full-Resolution Image */}
            <img
              src={option.imageUrl}
              alt={option.title}
              style={{
                width: '100%',
                maxHeight: '65vh',
                objectFit: 'contain',
                background: 'var(--void)',
                display: 'block',
              }}
            />

            {/* Direct Select CTA inside the preview modal for even faster UX */}
            <div
              style={{
                padding: 12,
                borderTop: '3px solid var(--bone)',
                display: 'flex',
                gap: 10,
                background: 'var(--ink)',
              }}
            >
              {onClick && !disabled && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (!selected) onClick();
                    setPreviewOpen(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    fontSize: 15,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Check size={18} strokeWidth={3} />
                  {selected ? 'SELECTED (CLOSE)' : `SELECT OPTION ${option.label}`}
                </button>
              )}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setPreviewOpen(false)}
                style={{
                  padding: '12px 16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 700,
                  border: '2px solid var(--bone)',
                  background: 'var(--void)',
                }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OptionCard;
