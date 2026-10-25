import React, { useEffect } from 'react';
import { Skull, AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'CONFIRM',
  cancelLabel = 'CANCEL',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  const accentColor = variant === 'danger' ? 'var(--blood)' : 'var(--pumpkin)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(13, 11, 16, 0.88)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--ink)',
          border: `4px solid ${accentColor}`,
          boxShadow: `8px 8px 0 ${accentColor}`,
          width: '100%',
          maxWidth: 440,
          position: 'relative',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top hazard stripes */}
        <div className="hazard-stripes" style={{ height: 6, width: '100%' }} />

        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '2px solid var(--bone)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--void)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {variant === 'danger' ? (
              <Skull size={22} color="var(--blood)" />
            ) : (
              <AlertTriangle size={22} color="var(--pumpkin)" />
            )}
            <h2
              id="confirm-modal-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                color: 'var(--bone)',
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
              }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="btn-micro"
            style={{ width: 28, height: 28, padding: 0 }}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--bone)',
              lineHeight: 1.5,
              margin: '0 0 20px',
              whiteSpace: 'pre-line',
            }}
          >
            {message}
          </p>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
            <button
              className="btn-secondary"
              onClick={onCancel}
              style={{ height: 44, padding: '0 20px', fontSize: 13 }}
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              style={{
                background: accentColor,
                color: 'var(--bone)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 900,
                height: 44,
                padding: '0 22px',
                border: '3px solid var(--void)',
                boxShadow: '4px 4px 0 var(--void)',
                cursor: 'pointer',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
