import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { translations, Language, setGlobalLanguage } from "../game/i18n/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations["en"], params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Try to load saved language or default to 'en'
  const savedLang = localStorage.getItem("tibia-react-lang") as Language;
  const [language, setLanguageState] = useState<Language>(savedLang || "en");

  // Sync global state on mount
  useEffect(() => {
      setGlobalLanguage(language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    setGlobalLanguage(lang); // Sync global
    localStorage.setItem("tibia-react-lang", lang);
  };

  const t = (key: keyof typeof translations["en"], params?: Record<string, string>) => {
    let str = translations[language][key] || key;
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            str = str.replace(`{${k}}`, v);
        });
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
