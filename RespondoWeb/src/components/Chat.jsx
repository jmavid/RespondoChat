import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, XCircle } from 'lucide-react';
import { marked } from 'marked';
import { ChatGPTClient } from '../lib/chatgpt';

const chatClient = new ChatGPTClient(import.meta.env.VITE_OPENAI_API_KEY);

export function Chat() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamedMessage, setCurrentStreamedMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const messageHistoryRef = useRef([]);
  const streamedMessageRef = useRef('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamedMessage]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messageHistoryRef.current = messages;
  }, [messages]);

  // Nuevo efecto para enfocar el input cuando termina el streaming
  useEffect(() => {
    if (!isStreaming) {
      inputRef.current?.focus();
    }
  }, [isStreaming]);

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
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: finalMessage,
            },
          ]);
          setCurrentStreamedMessage('');
          streamedMessageRef.current = '';
          setIsStreaming(false);
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
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        {messages.map((message, index) => renderMessage(message, index))}
        {isStreaming && currentStreamedMessage && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-100 rounded-lg p-4 max-w-[80%]">
              <div
                className="prose prose-sm max-w-none prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-code:text-red-500"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(currentStreamedMessage),
                }}
              />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 p-4 bg-white"
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