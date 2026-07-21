import React from 'react';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';

export function CustomConfirmModal({
  isOpen,
  title = 'Confirmation Required',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning', // 'warning' | 'danger' | 'info'
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  const typeStyles = {
    warning: {
      icon: <AlertTriangle className="size-6 text-amber-500" />,
      badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
      btnBg: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20',
    },
    danger: {
      icon: <AlertTriangle className="size-6 text-rose-500" />,
      badgeBg: 'bg-rose-500/10 border-rose-500/20 text-rose-500',
      btnBg: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20',
    },
    info: {
      icon: <Info className="size-6 text-indigo-500" />,
      badgeBg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500',
      btnBg: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20',
    },
  };

  const currentType = typeStyles[type] || typeStyles.warning;

  return (
    <div
      className="fixed inset-0 z-[999] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={onCancel}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl animate-scale-in text-slate-900 dark:text-slate-100 relative overflow-hidden"
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 -left-12 size-40 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 blur-3xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className={`grid size-11 place-items-center rounded-2xl border ${currentType.badgeBg}`}>
              {currentType.icon}
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">{title}</h3>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                Action Warning
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 my-4 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-200/80 dark:border-white/5 font-medium">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          {cancelText && (
            <button
              onClick={onCancel}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`rounded-xl px-5 py-2.5 text-xs font-bold shadow-lg transition cursor-pointer ${currentType.btnBg}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
