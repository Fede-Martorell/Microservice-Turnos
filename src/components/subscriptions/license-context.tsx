"use client";
import { createContext, useContext } from "react";
const LicenseContext = createContext<string[] | null>(null);
export function LicenseProvider({
  modules,
  children,
}: {
  modules: string[];
  children: React.ReactNode;
}) {
  return (
    <LicenseContext.Provider value={modules}>
      {children}
    </LicenseContext.Provider>
  );
}
export function useModuleAccess(module: string | false) {
  const modules = useContext(LicenseContext);
  return module === false || modules === null || modules.includes(module);
}
