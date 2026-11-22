"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import Icon from "@/components/Icon";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, message }]);

      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  const value: ToastContextValue = {
    toast: addToast,
    success: (msg: string) => addToast(msg, "success"),
    error: (msg: string) => addToast(msg, "error"),
    info: (msg: string) => addToast(msg, "info"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:bottom-4 sm:right-4 sm:left-auto sm:items-end"
      >
        {toasts.map((t) => {
          const tone = {
            success: "border-emerald-200 bg-white text-emerald-800 shadow-emerald-500/10",
            error: "border-rose-200 bg-white text-rose-800 shadow-rose-500/10",
            info: "border-slate-200 bg-white text-slate-800 shadow-slate-500/10",
          }[t.type];

          const icon = {
            success: "check_circle",
            error: "error",
            info: "info",
          }[t.type];

          const iconColor = {
            success: "text-emerald-600",
            error: "text-rose-600",
            info: "text-accent",
          }[t.type];

          return (
            <div
              key={t.id}
              role={t.type === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border p-3.5 shadow-lg transition-all animate-fade-in ${tone}`}
            >
              <Icon name={icon} className={`text-[20px] shrink-0 ${iconColor}`} />
              <p className="flex-1 text-sm font-medium text-ink">{t.message}</p>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss toast"
                className="shrink-0 rounded-lg p-1 text-faint transition hover:bg-slate-100 hover:text-ink"
              >
                <Icon name="close" className="text-[16px]" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
