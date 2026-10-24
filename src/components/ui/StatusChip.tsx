import React from 'react';
import type { PollStatus } from '../../types/poll';

interface StatusChipProps {
  status: PollStatus;
}

const STATUS_CONFIG: Record<PollStatus, { label: string; cls: string; blink?: boolean }> = {
  draft:    { label: 'DRAFT',    cls: 'chip chip-closed' },
  lobby:    { label: 'LOBBY',    cls: 'chip chip-lobby' },
  live:     { label: 'LIVE',     cls: 'chip chip-live',   blink: true },
  closed:   { label: 'CLOSED',   cls: 'chip chip-closed' },
  revealed: { label: 'REVEALED', cls: 'chip chip-revealed' },
};

const StatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cfg.cls} role="status" aria-label={`Poll status: ${cfg.label}`}>
      {cfg.blink && <span className="blink-dot" aria-hidden="true" />}
      {cfg.label}
    </span>
  );
};

export default StatusChip;
