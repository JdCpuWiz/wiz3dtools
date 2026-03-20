import React from 'react';
import type { SalesInvoiceStatus } from '@wizqueue/shared';

type DisplayStatus = SalesInvoiceStatus | 'shipped';

interface StatusBadgeProps {
  status: DisplayStatus;
}

const CONFIG: Record<DisplayStatus, { label: string; style: React.CSSProperties }> = {
  draft:     { label: 'Draft',     style: { background: '#6b7280',  color: '#ffffff' } },
  sent:      { label: 'Sent',      style: { background: '#1d4ed8',  color: '#ffffff' } },
  paid:      { label: 'Paid',      style: { background: '#15803d',  color: '#ffffff' } },
  shipped:   { label: 'Shipped',   style: { background: '#6d28d9',  color: '#ffffff' } },
  cancelled: { label: 'Cancelled', style: { background: '#b91c1c',  color: '#ffffff' } },
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
