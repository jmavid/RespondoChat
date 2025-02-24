import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, ToggleLeft as Google } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Auth() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });
      } else {
        await supabase.auth.signInWithPassword({
          email,
          password
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const showError = useCallback((errorKey, duration = 5000) => {
    setError(t(`auth.errors.${errorKey}`));
    setTimeout(() => setError(null), duration);
  }, [t]);

  const checkConnectivity = useCallback(async () => {
    try {
      const response = await fetch(import.meta.env.VITE_SUPABASE_URL, {
        method: 'HEAD',
        mode: 'no-cors'
      });
      return true;
    } catch (error) {
      return false;
    }
  }, []);

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!navigator.onLine) {
        showError('offline');
        return;
      }

      const isConnected = await checkConnectivity();
      if (!isConnected) {
        showError('connectionRejected');
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline',
            response_type: 'code'
          }
        }
      });
      
      if (error) {
        showError('googleAuth');
        console.error('Auth error:', error);
      }
    } catch (error) {
      console.error('Auth error:', error);
      showError('googleAuth');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
      {error && (
        <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          {error}
        </div>
      )}

      <h2 className="text-2xl font-bold text-center mb-6">
        {isSignUp ? t('auth.signup') : t('auth.signin')}
      </h2>
      
      <form onSubmit={handleEmailAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('auth.email')}
          </label>
          <div className="mt-1 relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 w-full rounded-md border border-gray-300 px-3 py-2"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('auth.password')}
          </label>
          <div className="mt-1 relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 w-full rounded-md border border-gray-300 px-3 py-2"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          {loading ? 'Loading...' : isSignUp ? t('auth.signup') : t('auth.signin')}
        </button>
      </form>

      <div className="mt-4 text-center">
        <span className="text-gray-500">{t('auth.or')}</span>
      </div>

      <button
        onClick={handleGoogleAuth}
        disabled={loading}
        className="mt-4 w-full flex items-center justify-center gap-2 border border-gray-300 py-2 px-4 rounded-md hover:bg-gray-50 transition-colors"
      >
        <Google className="w-5 h-5" />
        {loading ? t('common.loading') : t('auth.googleSignIn')}
      </button>

      <p className="mt-4 text-center text-sm">
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-blue-600 hover:underline"
        >
          {isSignUp ? t('auth.signin') : t('auth.signup')}
        </button>
      </p>
    </div>
  );
}