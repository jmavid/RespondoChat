import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, XCircle, User, Bot } from 'lucide-react';
import { marked } from 'marked';
import { supabase } from '../../lib/supabase';
import { ChatGPTClient } from '../../lib/chatgpt';

const chatClient = new ChatGPTClient(import.meta.env.VITE_OPENAI_API_KEY);

export function ChatInterface({ userId, onNewMessage }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamedMessage, setCurrentStreamedMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const messageHistoryRef = useRef([]);
  const streamedMessageRef = useRef('');

  useEffect(() => {
    loadChatHistory();
    subscribeToMessages();
    inputRef.current?.focus();
  }, [userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamedMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel(`chat-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        scrollToBottom();
      })
      .subscribe();

    return () => subscription.unsubscribe();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setCurrentStreamedMessage('');
    streamedMessageRef.current = '';

    try {
      await chatClient.streamChat(
        [...messageHistoryRef.current, userMessage],
        (chunk) => {
          streamedMessageRef.current += chunk;
          setCurrentStreamedMessage(streamedMessageRef.current);
        },
        (error) => {
          console.error('Chat error:', error);
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: 'Sorry, there was an error processing your request.',
            },
          ]);
          setIsStreaming(false);
          setCurrentStreamedMessage('');
          streamedMessageRef.current = '';
        },
        () => {
          const finalMessage = streamedMessageRef.current;
          const newMessage = {
            role: 'assistant',
            content: finalMessage,
          };
          setMessages(prev => [...prev, newMessage]);
          setCurrentStreamedMessage('');
          streamedMessageRef.current = '';
          setIsStreaming(false);
          onNewMessage?.(newMessage);
        }
      );
    } catch (error) {
      console.error('Chat error:', error);
      setIsStreaming(false);
      streamedMessageRef.current = '';
    }
  };

  const handleCancel = () => {
    chatClient.cancelStream();
    setIsStreaming(false);
    if (streamedMessageRef.current) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: streamedMessageRef.current,
        },
      ]);
      setCurrentStreamedMessage('');
      streamedMessageRef.current = '';
    }
  };

  const renderMessage = (message, index) => {
    const isUser = message.role === 'user';
    const html = marked.parse(message.content);

    return (
      <div
        key={index}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div className="flex items-start gap-3">
          {!isUser && (
            <div className="flex-shrink-0">
              <Bot className="w-6 h-6 text-blue-600" />
            </div>
          )}
          <div
            className={`max-w-[80%] rounded-lg p-4 ${
              isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
            }`}
          >
            <div
              className="prose prose-sm max-w-none prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-code:text-red-500"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
          {isUser && (
            <div className="flex-shrink-0">
              <User className="w-6 h-6 text-blue-600" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message, index) => renderMessage(message, index))}
        {isStreaming && currentStreamedMessage && (
          <div className="flex justify-start mb-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Bot className="w-6 h-6 text-blue-600" />
              </div>
              <div className="bg-gray-100 rounded-lg p-4 max-w-[80%]">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: marked.parse(currentStreamedMessage),
                  }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 p-4"
      >
        <div className="flex gap-4">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('chat.placeholder')}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={handleCancel}
              className="bg-red-600 text-white rounded-lg px-4 py-2 hover:bg-red-700 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}