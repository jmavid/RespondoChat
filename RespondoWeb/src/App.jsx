import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import './i18n';

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return session ? <Dashboard /> : <LandingPage />;
}

export default App;