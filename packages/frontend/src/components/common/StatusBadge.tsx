import React from 'react';
import type { SalesInvoiceStatus } from '@wizqueue/shared';

interface StatusBadgeProps {
  status: SalesInvoiceStatus;
}

const CONFIG: Record<SalesInvoiceStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  sent: { label: 'Sent', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { label, className } = CONFIG[status] || CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
};
