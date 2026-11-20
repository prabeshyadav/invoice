"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ApiError, setUnauthorizedHandler } from "./api";

interface AuthState {
  ready: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<RegisterResult>;
  logout: () => void;
}

/* verificationRequired: the account exists but stays inactive until the emailed link is opened. */
export interface RegisterResult {
  verificationRequired: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

async function post(path: string, body: unknown) {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  const logout = useCallback(() => {
    // Cookies are httpOnly, so only the server can clear them.
    fetch("/api/session/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    setUsername(null);
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    // Tokens used to live in localStorage; drop any left from older builds.
    for (const key of ["invoicepro.access", "invoicepro.refresh", "invoicepro.user"]) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
    fetch("/api/session", { credentials: "same-origin" })
      .then((res) => res.json() as Promise<{ authenticated: boolean; username: string | null }>)
      .then((s) => setUsername(s.authenticated ? s.username : null))
      .catch(() => setUsername(null))
      .finally(() => setReady(true));
  }, [logout]);

  const login = useCallback(async (user: string, password: string) => {
    // Sets httpOnly session cookies; no token is returned to the browser.
    const data = await post("/session/login", { username: user, password });
    setUsername(data.username);
  }, []);

  const register = useCallback(
    async (user: string, email: string, password: string): Promise<RegisterResult> => {
      const data = await post("/auth/register/", { username: user, email, password });
      if (data?.verification_required) return { verificationRequired: true };
      await login(user, password);
      return { verificationRequired: false };
    },
    [login]
  );

  const value = useMemo(
    () => ({ ready, username, login, register, logout }),
    [ready, username, login, register, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, username } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !username) router.replace("/login");
  }, [ready, username, router]);

  if (!ready || !username) return null;
  return <>{children}</>;
}
