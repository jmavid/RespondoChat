import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

export function TicketPriority({ priority }) {
  const { t } = useTranslation();

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low':
        return 'text-gray-500';
      case 'medium':
        return 'text-blue-500';
      case 'high':
        return 'text-orange-500';
      case 'critical':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className={`flex items-center gap-1 ${getPriorityColor(priority)}`}>
      <AlertTriangle className="w-4 h-4" />
      <span className="text-sm">
        {t(`tickets.priority.${priority}`)}
      </span>
    </div>
  );
}