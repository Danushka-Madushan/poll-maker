import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { ToastContext, type ToastItem } from './ToastContext';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [exiting, setExiting] = useState<Set<string>>(new Set());

  const removeToast = useCallback((id: string) => {
    setExiting((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setExiting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 250);
  }, []);

  const addToast = useCallback((item: Omit<ToastItem, 'id'>): string => {
    const id = String(Date.now() + Math.random());
    const duration = item.duration ?? 5000;
    setToasts((prev) => [...prev, { ...item, id }]);
    setTimeout(() => removeToast(id), duration);
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {createPortal(
        <div className="toast-container" aria-live="polite" aria-atomic="false">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${exiting.has(t.id) ? 'toast-exit' : ''}`} role="alert">
              <span>{t.message}</span>
              {t.actionLabel && (
                <button
                  className="toast-action"
                  onClick={() => { t.onAction?.(); removeToast(t.id); }}
                >
                  {t.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};
