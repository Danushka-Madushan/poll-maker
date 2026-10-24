import React, { useCallback, useRef, useState } from 'react';

interface HoldButtonProps {
  label: string;
  holdingLabel?: string;
  onConfirm: () => void;
  duration?: number; // ms, default 1000
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

/**
 * Press-and-hold confirmation button.
 * Fill sweeps left-to-right over `duration` ms.
 * Triggers onConfirm only after full hold.
 */
const HoldButton: React.FC<HoldButtonProps> = ({
  label,
  holdingLabel = 'KEEP HOLDING',
  onConfirm,
  duration = 1000,
  className = '',
  style,
  disabled = false,
}) => {
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    if (disabled) return;
    setHolding(true);
    timerRef.current = setTimeout(() => {
      setHolding(false);
      onConfirm();
    }, duration);
  }, [disabled, duration, onConfirm]);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHolding(false);
  }, []);

  return (
    <button
      className={`btn-hold ${holding ? 'holding' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}
      style={style}
      onMouseDown={start}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      onTouchStart={(e) => { e.preventDefault(); start(); }}
      onTouchEnd={cancel}
      onTouchCancel={cancel}
      disabled={disabled}
      aria-label={holding ? holdingLabel : label}
    >
      <span
        className="btn-hold-fill"
        style={{ transition: holding ? `transform ${duration}ms linear` : 'none' }}
      />
      <span className="btn-hold-label">
        {holding ? holdingLabel : label}
      </span>
    </button>
  );
};

export default HoldButton;
