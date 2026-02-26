import React from 'react';
import type { SalesInvoiceStatus } from '@wizqueue/shared';

interface StatusBadgeProps {
  status: SalesInvoiceStatus;
}

const CONFIG: Record<SalesInvoiceStatus, { label: string; style: React.CSSProperties }> = {
  draft:     { label: 'Draft',     style: { background: 'rgba(74,74,74,0.6)',    color: '#9a9a9a' } },
  sent:      { label: 'Sent',      style: { background: 'rgba(59,130,246,0.2)', color: '#60a5fa' } },
  paid:      { label: 'Paid',      style: { background: 'rgba(34,197,94,0.2)',  color: '#4ade80' } },
  cancelled: { label: 'Cancelled', style: { background: 'rgba(239,68,68,0.2)',  color: '#f87171' } },
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
