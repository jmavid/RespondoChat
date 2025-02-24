import React from 'react';
import { useTranslation } from 'react-i18next';

export function TicketStatus({ status }) {
  const { t } = useTranslation();

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'waiting_client':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-purple-100 text-purple-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {t(`tickets.status.${status}`)}
    </span>
  );
}