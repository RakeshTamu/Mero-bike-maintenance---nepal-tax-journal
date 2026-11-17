import React, { useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { Button, IconButton } from './Button';

export interface SlideOverHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  backLabel?: string;
  leadingIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
}

export const SlideOverHeader: React.FC<SlideOverHeaderProps> = ({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  leadingIcon,
  rightAction
}) => {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-[var(--color-surface-1)] border-b border-[var(--color-border)] clay-topbar pt-safe shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <IconButton onClick={onBack} aria-label={backLabel} title={backLabel}>
          <ArrowLeft className="w-5 h-5" />
        </IconButton>

        {leadingIcon && (
          <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent)] shrink-0">
            {leadingIcon}
          </div>
        )}

        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] truncate leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {rightAction && <div className="shrink-0">{rightAction}</div>}
    </header>
  );
};

export interface FullScreenSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  leadingIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
  minimalHeader?: boolean;
  backLabel?: string;
  children: React.ReactNode;
}

export const FullScreenSheet: React.FC<FullScreenSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  leadingIcon,
  rightAction,
  footer,
  maxWidthClass = 'max-w-2xl',
  minimalHeader = false,
  backLabel = 'Back',
  children
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-[var(--color-bg)] text-[var(--color-text-primary)] flex flex-col animate-in slide-in-from-right duration-150"
    >
      {minimalHeader ? (
        <header className="sticky top-0 z-10 bg-[var(--color-surface-1)] border-b border-[var(--color-border)] clay-topbar pt-safe shrink-0">
          <div className={`${maxWidthClass} w-full mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3`}>
            <button
              type="button"
              onClick={onClose}
              aria-label={backLabel}
              className="inline-flex items-center gap-2 min-h-[40px] pr-3 rounded-xl text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition duration-150 active:scale-[0.98]"
            >
              <span className="w-9 h-9 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-btn-secondary flex items-center justify-center text-[var(--color-text-primary)]">
                <ArrowLeft className="w-4 h-4" />
              </span>
              <span>{backLabel}</span>
            </button>
            {rightAction && <div className="shrink-0">{rightAction}</div>}
          </div>
        </header>
      ) : (
        <SlideOverHeader
          title={title}
          subtitle={subtitle}
          onBack={onClose}
          backLabel={backLabel}
          leadingIcon={leadingIcon}
          rightAction={rightAction}
        />
      )}
      <div className={`flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 ${footer ? 'pb-4' : 'pb-safe'} ${maxWidthClass} w-full mx-auto`}>
        {children}
      </div>
      {footer && (
        <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface-1)] clay-nav pb-safe">
          <div className={`${maxWidthClass} w-full mx-auto px-4 sm:px-6 py-3`}>
            {footer}
          </div>
        </div>
      )}
    </div>
  );
};

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  leadingIcon?: React.ReactNode;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  leadingIcon,
  maxWidthClass = 'sm:max-w-md',
  children
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidthClass} bg-[var(--color-surface-1)] border-t sm:border border-[var(--color-border)] clay-raised rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 pb-safe max-h-[88vh] flex flex-col animate-in slide-in-from-bottom-5 duration-150`}
      >
        {/* Drag handle indicator on mobile */}
        <div className="w-10 h-1 rounded-full bg-[var(--color-border)] mx-auto mb-3 sm:hidden shrink-0" />

        <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {leadingIcon && (
              <div className="w-8 h-8 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                {leadingIcon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <IconButton size="sm" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4 stroke-[2.2]" />
          </IconButton>
        </div>

        <div className="pt-4 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
};

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  subtitle?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: React.ReactNode;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  children?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  icon,
  variant = 'danger',
  loading = false,
  children
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      onClick={() => !loading && onClose()}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] clay-raised p-5 space-y-4 text-[var(--color-text-primary)]"
      >
        <IconButton
          size="sm"
          onClick={onClose}
          disabled={loading}
          aria-label="Close"
          className="absolute top-4 right-4"
        >
          <X className="w-4 h-4 stroke-[2.2]" />
        </IconButton>

        <div className="flex items-center gap-3 pr-10">
          {icon && (
            <div
              className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
                variant === 'danger'
                  ? 'bg-[var(--color-error-subtle)] border-[var(--color-error)]/40 text-[var(--color-error)]'
                  : 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)]/40 text-[var(--color-accent)]'
              }`}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)] truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{message}</p>

        {children}

        <div className="flex items-center gap-2.5 pt-2">
          <Button
            variant="secondary"
            size="md"
            disabled={loading}
            onClick={onClose}
            className="px-4"
            aria-label={cancelLabel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="md"
            fullWidth
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
