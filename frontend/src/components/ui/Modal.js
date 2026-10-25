'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}) {
  const modalRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    }

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        ref={modalRef}
        className={cn(
          'relative w-full rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl text-left',
          'flex flex-col max-h-[90vh] overflow-hidden z-10 transition-all',
          SIZES[size] || SIZES.md,
          className
        )}
      >
        {/* Header */}
        {(title || onClose) && (
          <div className="flex items-start justify-between p-6 pb-4 border-b border-zinc-800/80">
            <div>
              {title && (
                <h3
                  id="modal-title"
                  className="text-lg font-semibold text-zinc-100 leading-snug"
                >
                  {title}
                </h3>
              )}
              {description && (
                <p
                  id="modal-description"
                  className="text-xs text-zinc-400 mt-1"
                >
                  {description}
                </p>
              )}
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="text-zinc-400 hover:text-zinc-100 p-1 rounded-lg hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content body */}
        <div className="p-6 overflow-y-auto flex-1 text-zinc-300 text-sm space-y-4">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="p-4 px-6 bg-zinc-950/40 border-t border-zinc-800/80 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
