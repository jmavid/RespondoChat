import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Filter, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TicketStatus } from './TicketStatus';
import { TicketPriority } from './TicketPriority';
import { TicketForm } from './TicketForm';
import { TicketDetail } from './TicketDetail';

export function TicketList() {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  useEffect(() => {
    fetchTickets();
  }, [filters, searchQuery]);

  const fetchTickets = async () => {
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Authentication required');
        return;
      }

      let query = supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data: ticketsData, error: ticketsError } = await query;
      
      if (ticketsError) {
        console.error('Error fetching tickets:', ticketsError);
        setError('Error loading tickets. Please try again.');
        return;
      }

      // Obtener los IDs únicos de usuarios
      const userIds = [...new Set([
        ...ticketsData.map(t => t.created_by),
        ...ticketsData.filter(t => t.assigned_to).map(t => t.assigned_to)
      ])];

      // Obtener los datos de los usuarios
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        setError('Error loading user information. Please try again.');
        return;
      }

      // Crear un mapa de usuarios para fácil acceso
      const userMap = Object.fromEntries(
        profilesData.map(profile => [profile.id, profile])
      );

      // Combinar los datos
      const ticketsWithUsers = ticketsData.map(ticket => ({
        ...ticket,
        created_by: userMap[ticket.created_by] || { email: 'Unknown' },
        assigned_to: ticket.assigned_to ? userMap[ticket.assigned_to] || { email: 'Unknown' } : null
      }));

      setTickets(ticketsWithUsers);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('tickets.title')}</h1>
        <button
          onClick={() => setShowNewTicketForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t('tickets.new')}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        {error && (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700" role="alert">
            {error}
          </div>
        )}
        {/* Filters */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('tickets.search')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">{t('tickets.allStatuses')}</option>
              <option value="open">{t('tickets.status.open')}</option>
              <option value="in_progress">{t('tickets.status.inProgress')}</option>
              <option value="waiting_client">{t('tickets.status.waitingClient')}</option>
              <option value="resolved">{t('tickets.status.resolved')}</option>
              <option value="closed">{t('tickets.status.closed')}</option>
            </select>

            <select
              value={filters.priority}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">{t('tickets.allPriorities')}</option>
              <option value="low">{t('tickets.priority.low')}</option>
              <option value="medium">{t('tickets.priority.medium')}</option>
              <option value="high">{t('tickets.priority.high')}</option>
              <option value="critical">{t('tickets.priority.critical')}</option>
            </select>

            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">{t('tickets.allCategories')}</option>
              <option value="hardware">{t('tickets.category.hardware')}</option>
              <option value="software">{t('tickets.category.software')}</option>
              <option value="billing">{t('tickets.category.billing')}</option>
              <option value="network">{t('tickets.category.network')}</option>
              <option value="security">{t('tickets.category.security')}</option>
              <option value="other">{t('tickets.category.other')}</option>
            </select>
          </div>
        </div>

        {/* Ticket List */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tickets.id')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tickets.title')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tickets.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tickets.priority')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tickets.category')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tickets.assignedTo')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tickets.createdAt')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center">
                    {t('loading')}
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center">
                    {t('tickets.noTickets')}
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      #{ticket.id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {ticket.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <TicketStatus status={ticket.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <TicketPriority priority={ticket.priority} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {t(`tickets.category.${ticket.category}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {ticket.assigned_to?.email || t('tickets.unassigned')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNewTicketForm && (
        <TicketForm
          onClose={() => setShowNewTicketForm(false)}
          onSuccess={() => {
            setShowNewTicketForm(false);
            fetchTickets();
          }}
        />
      )}

      {selectedTicketId && (
        <TicketDetail
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
        />
      )}
    </div>
  );
}