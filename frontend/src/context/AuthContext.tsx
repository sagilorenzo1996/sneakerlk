"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface AuthContextType {
  token: string | null;
  email: string | null;
  initialized: boolean;
  login: (token: string, email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("auth_token");
    const e = localStorage.getItem("auth_email");
    if (t && e) {
      setToken(t);
      setEmail(e);
    }
    setInitialized(true);
  }, []);

  function login(t: string, e: string) {
    localStorage.setItem("auth_token", t);
    localStorage.setItem("auth_email", e);
    setToken(t);
    setEmail(e);
  }

  function logout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_email");
    setToken(null);
    setEmail(null);
  }

  return (
    <AuthContext.Provider value={{ token, email, initialized, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
