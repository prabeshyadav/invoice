"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Icon from "./Icon";
import { Spinner, btnDanger, btnPrimary, btnSecondary } from "./ui";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  tone = "danger",
  busy = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus cancel button by default to prevent accidental confirmations
    cancelBtnRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl transition-all animate-fade-in">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              tone === "danger"
                ? "bg-rose-50 text-rose-600"
                : "bg-accent-soft text-accent"
            }`}
          >
            <Icon
              name={tone === "danger" ? "warning" : "help"}
              className="text-[22px]"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-modal-title"
              className="text-base font-semibold tracking-tight text-ink"
            >
              {title}
            </h2>
            <div
              id="confirm-modal-description"
              className="mt-1.5 text-sm leading-relaxed text-muted"
            >
              {description}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={busy}
            onClick={onClose}
            className={btnSecondary}
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={tone === "danger" ? btnDanger : btnPrimary}
          >
            {busy ? (
              <Spinner inline />
            ) : (
              <Icon
                name={tone === "danger" ? "delete" : "check"}
                className="text-[18px]"
              />
            )}
            {busy ? "Processing…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
