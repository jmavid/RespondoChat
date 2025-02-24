import React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Globe, Shield } from 'lucide-react';
import { LanguageSelector } from './LanguageSelector';
import { Auth } from './Auth';

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-600">Respondo</h1>
            <LanguageSelector />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              {t('welcome')}
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              {t('description')}
            </p>
            
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold text-gray-900">
                {t('features.title')}
              </h3>
              
              <div className="grid gap-6">
                <div className="flex items-start gap-4">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                  <div>
                    <h4 className="font-semibold">{t('features.realtime')}</h4>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <Globe className="w-6 h-6 text-blue-600" />
                  <div>
                    <h4 className="font-semibold">{t('features.multilingual')}</h4>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <Shield className="w-6 h-6 text-blue-600" />
                  <div>
                    <h4 className="font-semibold">{t('features.secure')}</h4>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Auth />
          </div>
        </div>
      </main>
    </div>
  );
}