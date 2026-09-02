"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UILang } from "@/lib/optimizer";

type LanguageContextValue = {
  lang: UILang;
  setLang: (lang: UILang) => void;
  t: (fil: string, en: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UILang>("fil");

  useEffect(() => {
    const stored = window.localStorage.getItem("virello-lang");
    if (stored === "en" || stored === "fil") setLangState(stored);
  }, []);

  const setLang = (next: UILang) => {
    setLangState(next);
    window.localStorage.setItem("virello-lang", next);
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang,
      t: (fil, en) => (lang === "fil" ? fil : en),
    }),
    [lang]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
