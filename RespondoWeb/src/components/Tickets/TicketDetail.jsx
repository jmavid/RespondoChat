import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Send, Edit2, Clock, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TicketStatus } from './TicketStatus';
import { TicketPriority } from './TicketPriority';
import { TicketForm } from './TicketForm';

export function TicketDetail({ ticketId, onClose }) {
  const { t } = useTranslation();
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingComment, setSendingComment] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    fetchTicketDetails();
    const subscription = subscribeToComments();
    return () => {
      subscription.unsubscribe();
    };
  }, [ticketId]);

  const fetchTicketDetails = async () => {
    try {
      const [ticketResponse, commentsResponse] = await Promise.all([
        supabase
          .from('tickets')
          .select(`
            *,
            created_by (email),
            assigned_to (email)
          `)
          .eq('id', ticketId)
          .single(),
        supabase
          .from('ticket_comments')
          .select(`
            *,
            created_by (email)
          `)
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true })
      ]);

      if (ticketResponse.error) throw ticketResponse.error;
      if (commentsResponse.error) throw commentsResponse.error;

      setTicket(ticketResponse.data);
      setComments(commentsResponse.data);
    } catch (error) {
      console.error('Error fetching ticket details:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToComments = () => {
    return supabase
      .channel(`ticket-${ticketId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_comments',
        filter: `ticket_id=eq.${ticketId}`
      }, (payload) => {
        setComments(prev => [...prev, payload.new]);
      })
      .subscribe();
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || sendingComment) return;

    setSendingComment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('ticket_comments')
        .insert([{
          ticket_id: ticketId,
          content: newComment,
          created_by: user.id
        }]);

      if (error) throw error;
      setNewComment('');
    } catch (error) {
      console.error('Error sending comment:', error);
    } finally {
      setSendingComment(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p>{t('tickets.notFound')}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[90vh] flex flex-col">
        {showEditForm ? (
          <TicketForm
            ticket={ticket}
            onClose={() => setShowEditForm(false)}
            onSuccess={() => {
              setShowEditForm(false);
              fetchTicketDetails();
            }}
          />
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <h2 className="text-2xl font-bold">#{ticket.id} {ticket.title}</h2>
                    <button
                      onClick={() => setShowEditForm(true)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(ticket.created_at)}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {ticket.created_by.email}
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-4">
                <TicketStatus status={ticket.status} />
                <TicketPriority priority={ticket.priority} />
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {t(`tickets.category.${ticket.category}`)}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {ticket.assigned_to?.email || t('tickets.unassigned')}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose max-w-none mb-8">
                <p>{ticket.description}</p>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-semibold">{t('tickets.comments')}</h3>
                
                {comments.length === 0 ? (
                  <p className="text-gray-500">{t('tickets.noComments')}</p>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-gray-50 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">
                          {comment.created_by.email}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-gray-700">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Comment form */}
            <div className="p-6 border-t border-gray-200">
              <form onSubmit={handleSubmitComment} className="flex gap-4">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t('tickets.addComment')}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={sendingComment || !newComment.trim()}
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}