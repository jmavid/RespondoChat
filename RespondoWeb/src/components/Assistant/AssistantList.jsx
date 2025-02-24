import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Archive, Search, Clock, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AssistantChat } from './AssistantChat';
import { formatDistanceToNow } from 'date-fns';

export function AssistantList() {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('active'); // active, archived
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();
    subscribeToNewMessages();
  }, [filter, searchQuery]);

  const fetchConversations = async () => {
    try {
      let query = supabase
        .from('whatsapp_conversations')
        .select(`
          *,
          messages:whatsapp_messages(
            id,
            content,
            role,
            created_at
          )
        `)
        .order('last_message_at', { ascending: false });

      if (filter === 'active') {
        query = query.eq('status', 'active');
      } else if (filter === 'archived') {
        query = query.eq('status', 'archived');
      }

      if (searchQuery) {
        query = query.or(`phone.ilike.%${searchQuery}%,contact_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      setConversations(data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNewMessages = () => {
    const subscription = supabase
      .channel('whatsapp_messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'whatsapp_messages'
      }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => subscription.unsubscribe();
  };

  const handleExport = async (conversation) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const exportData = {
        conversation: {
          id: conversation.id,
          phone: conversation.phone,
          contact_name: conversation.contact_name,
          started_at: conversation.created_at,
          status: conversation.status
        },
        messages: data
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whatsapp-chat-${conversation.phone}-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting conversation:', error);
    }
  };

  const handleArchive = async (conversation) => {
    try {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ status: 'archived' })
        .eq('id', conversation.id);

      if (error) throw error;
      fetchConversations();
    } catch (error) {
      console.error('Error archiving conversation:', error);
    }
  };

  return (
    <div className="flex h-full">
      {/* Conversation List */}
      <div className="w-80 border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('assistant.searchConversations')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setFilter('active')}
              className={`flex-1 py-2 px-4 rounded-lg ${
                filter === 'active'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('assistant.active')}
            </button>
            <button
              onClick={() => setFilter('archived')}
              className={`flex-1 py-2 px-4 rounded-lg ${
                filter === 'archived'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('assistant.archived')}
            </button>
          </div>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-10rem)]">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              {t('common.loading')}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {t('assistant.noConversations')}
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => setSelectedChat(conversation)}
                className={`p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer ${
                  selectedChat?.id === conversation.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {conversation.contact_name || conversation.phone}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {conversation.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(conversation);
                      }}
                      className="p-1 hover:bg-gray-100 rounded-full"
                      title={t('assistant.export')}
                    >
                      <Download className="w-4 h-4 text-gray-500" />
                    </button>
                    {filter === 'active' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchive(conversation);
                        }}
                        className="p-1 hover:bg-gray-100 rounded-full"
                        title={t('assistant.archive')}
                      >
                        <Archive className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>
                    {formatDistanceToNow(new Date(conversation.last_message_at), {
                      addSuffix: true
                    })}
                  </span>
                </div>
                {conversation.messages?.[0] && (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                    {conversation.messages[0].content}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat View */}
      <div className="flex-1">
        {selectedChat ? (
          <AssistantChat conversation={selectedChat} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('assistant.selectConversation')}
              </h3>
              <p className="text-gray-500">
                {t('assistant.selectConversationDescription')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}