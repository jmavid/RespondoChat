import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function TicketForm({ ticket, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'software',
    assigned_to: '',
    ...ticket
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email');
      
      if (error) {
        console.error('Error fetching users:', error);
        setError('Error loading users. Please try again.');
        return;
      }
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Error loading users. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ticketData = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        category: formData.category,
        assigned_to: formData.assigned_to || null,
        created_by: user.id,
      };

      if (ticket?.id) {
        const { error: updateError } = await supabase
          .from('tickets')
          .update(ticketData)
          .eq('id', ticket.id);
        if (updateError) {
          console.error('Error updating ticket:', updateError);
          setError('Error updating ticket. Please try again.');
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from('tickets')
          .insert([ticketData]);
        if (insertError) {
          console.error('Error creating ticket:', insertError);
          setError('Error creating ticket. Please try again.');
          return;
        }
      }

      onSuccess?.();
      onClose?.();
    } catch (error) {
      console.error('Error saving ticket:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded" role="alert">
              {error}
            </div>
          )}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              {ticket ? t('tickets.edit') : t('tickets.create')}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('tickets.fields.title')}
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                required
                minLength={3}
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('tickets.fields.description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                rows={4}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('tickets.fields.priority')}
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="low">{t('tickets.priority.low')}</option>
                  <option value="medium">{t('tickets.priority.medium')}</option>
                  <option value="high">{t('tickets.priority.high')}</option>
                  <option value="critical">{t('tickets.priority.critical')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('tickets.fields.category')}
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="hardware">{t('tickets.category.hardware')}</option>
                  <option value="software">{t('tickets.category.software')}</option>
                  <option value="billing">{t('tickets.category.billing')}</option>
                  <option value="network">{t('tickets.category.network')}</option>
                  <option value="security">{t('tickets.category.security')}</option>
                  <option value="other">{t('tickets.category.other')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('tickets.fields.assignedTo')}
                </label>
                <select
                  value={formData.assigned_to || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">{t('tickets.unassigned')}</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
              </div>

              {ticket && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('tickets.fields.status')}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="open">{t('tickets.status.open')}</option>
                    <option value="in_progress">{t('tickets.status.in_progress')}</option>
                    <option value="waiting_client">{t('tickets.status.waiting_client')}</option>
                    <option value="resolved">{t('tickets.status.resolved')}</option>
                    <option value="closed">{t('tickets.status.closed')}</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}