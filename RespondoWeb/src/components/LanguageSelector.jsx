import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

export function LanguageSelector() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="flex items-center gap-2">
      <Languages className="w-5 h-5" />
      <select
        onChange={(e) => changeLanguage(e.target.value)}
        value={i18n.language}
        className="bg-transparent border border-gray-300 rounded-md px-2 py-1"
      >
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
    </div>
  );
}