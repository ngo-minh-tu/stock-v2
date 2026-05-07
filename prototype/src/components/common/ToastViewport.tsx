'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

import { useToast, type Toast, type ToastKind } from '@/contexts/ToastContext';

const COLORS: Record<ToastKind, string> = {
  success: '#3fa885',
  error: '#d32f2f',
  info: '#009bde',
  warning: '#f49f3b',
};

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = ICONS[toast.kind];
  return (
    <div
      role="alert"
      className="flex items-start gap-3 px-4 py-3 rounded text-sm shadow-md min-w-[280px] max-w-md"
      style={{ backgroundColor: COLORS[toast.kind], color: '#ffffff' }}
    >
      <Icon size={18} aria-hidden="true" className="shrink-0 mt-0.5" />
      <div className="flex-1 leading-snug">
        <div className="font-medium">{toast.title}</div>
        {toast.message && <div className="text-xs mt-0.5 opacity-90">{toast.message}</div>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 opacity-80 hover:opacity-100"
        aria-label="Đóng thông báo"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}
