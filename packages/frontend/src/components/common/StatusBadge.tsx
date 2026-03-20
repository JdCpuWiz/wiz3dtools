import React from 'react';
import type { SalesInvoiceStatus } from '@wizqueue/shared';

type DisplayStatus = SalesInvoiceStatus | 'shipped';

interface StatusBadgeProps {
  status: DisplayStatus;
}

const CONFIG: Record<DisplayStatus, { label: string; style: React.CSSProperties }> = {
  draft:     { label: 'Draft',     style: { background: '#3a3a3a',  color: '#9ca3af' } },
  sent:      { label: 'Sent',      style: { background: '#1e3a5f',  color: '#93c5fd' } },
  paid:      { label: 'Paid',      style: { background: '#14532d',  color: '#86efac' } },
  shipped:   { label: 'Shipped',   style: { background: '#3b1a6b',  color: '#c4b5fd' } },
  cancelled: { label: 'Cancelled', style: { background: '#450a0a',  color: '#fca5a5' } },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { label, style } = CONFIG[status] || CONFIG.draft;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={style}
    >
      {label}
    </span>
  );
};
