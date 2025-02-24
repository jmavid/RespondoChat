import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { 
  User, 
  Settings, 
  LogOut, 
  MessageSquare, 
  Ticket,
  FileText,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Menu
} from 'lucide-react';
import { Chat } from './Chat';
import { TicketList } from './Tickets/TicketList';
import { DocumentList } from './Documents/DocumentList';
import { AssistantList } from './Assistant/AssistantList';

export function Dashboard() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('chat');
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    getProfile();
  }, []);

  const getProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.full_name) {
        setName(user.user_metadata.full_name);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const updateProfile = async () => {
    try {
      setLoading(true);
      await supabase.auth.updateUser({
        data: { full_name: name }
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'chat':
        return <Chat />;
      case 'tickets':
        return <TicketList />;
      case 'assistant':
        return <AssistantList />;
      case 'documents':
        return <DocumentList />;
      case 'profile':
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">{t('profile.title')}</h2>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('profile.name')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <button
                  onClick={updateProfile}
                  disabled={loading}
                  className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  {loading ? 'Saving...' : t('profile.save')}
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const menuItems = [
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
    { id: 'tickets', icon: Ticket, label: t('tickets.title') },
    { id: 'assistant', icon: MessageCircle, label: t('assistant.title') },
    { id: 'documents', icon: FileText, label: t('documents.title') },
    { id: 'profile', icon: User, label: t('profile.title') },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div 
          className={`bg-white shadow-md transition-all duration-300 ease-in-out flex flex-col relative ${
            isCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          {/* Toggle button - Now positioned absolutely */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-4 bg-white p-1.5 rounded-full shadow-md hover:bg-gray-50 z-50"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            )}
          </button>

          {/* Logo section */}
          <div className="p-4">
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
              <Menu className="w-6 h-6 text-blue-600" />
              <h1 className={`ml-2 text-xl font-bold text-blue-600 transition-all duration-300 ${
                isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
              }`}>
                Respondo
              </h1>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="mt-8 flex-1">
            {menuItems.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors ${
                  activeSection === id ? 'bg-blue-50 text-blue-600' : ''
                } ${isCollapsed ? 'justify-center' : ''}`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${activeSection === id ? 'text-blue-600' : ''}`} />
                <span className={`transition-all duration-300 ${
                  isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
                }`}>
                  {label}
                </span>
              </button>
            ))}
          </nav>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className={`mb-4 flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className={`transition-all duration-300 ${
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
            }`}>
              {t('auth.logout')}
            </span>
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}