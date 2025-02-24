import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, User, Bot, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';

export function AssistantChat({ conversation }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    subscribeToMessages();
    scrollToBottom();
  }, [conversation.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel(`conversation-${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${conversation.id}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        scrollToBottom();
      })
      .subscribe();

    return () => subscription.unsubscribe();
  };

  const getMessageIcon = (role) => {
    switch (role) {
      case 'user':
        return <User className="w-6 h-6 text-blue-600" />;
      case 'assistant':
        return <Bot className="w-6 h-6 text-green-600" />;
      case 'whatsapp':
        return <Phone className="w-6 h-6 text-purple-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-medium text-gray-900">
              {conversation.contact_name || conversation.phone}
            </h2>
            <p className="text-sm text-gray-500">
              {conversation.phone}
            </p>
          </div>
          <div className="text-sm text-gray-500">
            {t('assistant.status')}: {conversation.status}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {loading ? (
          <div className="text-center text-gray-500">
            {t('common.loading')}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500">
            {t('assistant.noMessages')}
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 mb-4 ${
                message.role === 'user' ? 'justify-end' : ''
              }`}
            >
              {message.role !== 'user' && (
                <div className="flex-shrink-0">
                  {getMessageIcon(message.role)}
                </div>
              )}
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <div
                  className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                  }`}
                >
                  {formatDistanceToNow(new Date(message.created_at), {
                    addSuffix: true
                  })}
                </div>
              </div>
              {message.role === 'user' && (
                <div className="flex-shrink-0">
                  {getMessageIcon(message.role)}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}