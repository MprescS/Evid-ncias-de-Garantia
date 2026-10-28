import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isDestructive = true,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-[#18181C] border border-[#2E2E38] shadow-2xl p-6 relative text-white">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`p-2.5 rounded-full shrink-0 ${
              isDestructive ? 'bg-red-950/50 text-[#D5001C] border border-red-500/30' : 'bg-amber-950/50 text-amber-400 border border-amber-500/30'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="flex-1">
            <h3 className="text-base font-bold text-white leading-snug">
              {title}
            </h3>
            <p className="text-sm text-neutral-300 mt-2 leading-relaxed">
              {message}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-[#363644] text-xs font-semibold uppercase tracking-wider text-neutral-300 hover:text-white hover:bg-[#252530] transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors shadow-xs ${
                  isDestructive
                    ? 'bg-[#D5001C] hover:bg-[#b00017]'
                    : 'bg-white hover:bg-neutral-200 text-neutral-900'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
