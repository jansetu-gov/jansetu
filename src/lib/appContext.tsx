import React, { createContext, useCallback, useContext, useState } from "react";
import type { LangCode } from "./constants";

interface AppContextType {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  largeFonts: boolean;
  setLargeFonts: (v: boolean) => void;
  selectedRole: "citizen" | "officer" | "public" | null;
  setSelectedRole: (r: "citizen" | "officer" | "public" | null) => void;
}

const AppContext = createContext<AppContextType>({
  lang: "en",
  setLang: () => {},
  largeFonts: false,
  setLargeFonts: () => {},
  selectedRole: null,
  setSelectedRole: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");
  const [largeFonts, setLargeFonts] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"citizen" | "officer" | "public" | null>(null);

  const setLang = useCallback((l: LangCode) => setLangState(l), []);

  return (
    <AppContext.Provider value={{ lang, setLang, largeFonts, setLargeFonts, selectedRole, setSelectedRole }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
