import React from 'react';
import { MeroBikeMark, MeroBikeWordmark } from '../MeroBikeLogo';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'secondary' | 'elevated' | 'interactive';
  surface?: 'raised' | 'raised-sm' | 'inset' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const CARD_VARIANT_CLASSES: Record<NonNullable<CardProps['variant']>, string> = {
  primary: 'bg-[var(--color-surface-1)] border border-[var(--color-border)] clay-raised',
  secondary: 'bg-[var(--color-surface-2)] border border-[var(--color-border)]',
  elevated: 'bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-raised-sm',
  interactive:
    'bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-raised-sm cursor-pointer transition-[background-color,border-color,transform,box-shadow] duration-150 active:scale-[0.99]'
};

const SURFACE_OVERRIDE_CLASSES: Record<NonNullable<CardProps['surface']>, string> = {
  raised: 'clay-raised',
  'raised-sm': 'clay-raised-sm',
  inset: 'clay-inset',
  flat: 'shadow-none'
};

const CARD_PADDING_CLASSES: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-4 sm:p-5'
};

export const Card: React.FC<CardProps> = ({
  variant = 'primary',
  surface,
  padding = 'md',
  className = '',
  children,
  ...rest
}) => {
  const surfaceClass = surface ? SURFACE_OVERRIDE_CLASSES[surface] : '';
  return (
    <div
      className={`rounded-2xl text-[var(--color-text-primary)] ${CARD_VARIANT_CLASSES[variant]} ${surfaceClass} ${CARD_PADDING_CLASSES[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};

export type SemanticStatus = 'success' | 'warning' | 'error' | 'accent' | 'neutral';

const STATUS_BADGE_STYLES: Record<SemanticStatus, string> = {
  success: 'bg-[var(--color-success-subtle)] text-[var(--color-success)] border-[var(--color-success)]/35',
  warning: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)] border-[var(--color-warning)]/35',
  error: 'bg-[var(--color-error-subtle)] text-[var(--color-error)] border-[var(--color-error)]/35',
  accent: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[var(--color-accent)]/35',
  neutral: 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
};

export interface StatusBadgeProps {
  status: SemanticStatus;
  children: React.ReactNode;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, children, className = '' }) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold tracking-wide ${STATUS_BADGE_STYLES[status]} ${className}`}
    >
      {children}
    </span>
  );
};

export interface StatusIndicatorProps {
  status: SemanticStatus;
  icon: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  icon,
  size = 'md'
}) => {
  const sizeClass =
    size === 'sm' ? 'w-10 h-10 border-2' : size === 'lg' ? 'w-16 h-16 border-[3px]' : 'w-12 h-12 border-2';
  const colorClass =
    status === 'success'
      ? 'bg-[var(--color-success-subtle)] border-[var(--color-success)] text-[var(--color-success)]'
      : status === 'warning'
      ? 'bg-[var(--color-warning-subtle)] border-[var(--color-warning)] text-[var(--color-warning)]'
      : status === 'error'
      ? 'bg-[var(--color-error-subtle)] border-[var(--color-error)] text-[var(--color-error)]'
      : status === 'accent'
      ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)] text-[var(--color-accent)]'
      : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-secondary)]';

  return (
    <div className={`rounded-full flex items-center justify-center shrink-0 clay-raised-sm transition ${sizeClass} ${colorClass}`}>
      {icon}
    </div>
  );
};

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div
      className={`p-6 sm:p-7 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] clay-raised text-center space-y-3 ${className}`}
    >
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset flex items-center justify-center mx-auto text-[var(--color-text-secondary)]">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
        {description && (
          <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-1 flex justify-center">{action}</div>}
    </div>
  );
};

export interface LoadingIndicatorProps {
  label?: string;
  brandTitle?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  label = 'Loading...',
  brandTitle,
  fullScreen = false,
  size = 'md'
}) => {
  const spinnerSize = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] flex flex-col items-center justify-center p-6 select-none">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] clay-raised flex items-center justify-center mb-4">
          <MeroBikeMark className="w-10 h-7" themeAware />
        </div>
        {brandTitle && (
          <div className="mb-2 flex items-center gap-1.5">
            <MeroBikeWordmark sizeClass="text-lg" />
          </div>
        )}
        <div className="flex items-center gap-2.5 text-xs text-[var(--color-text-secondary)]">
          <div
            className={`${spinnerSize} rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-accent)] animate-spin`}
          />
          <span>{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2.5 py-6 text-xs text-[var(--color-text-secondary)]">
      <div
        className={`${spinnerSize} rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-accent)] animate-spin`}
      />
      {label && <span>{label}</span>}
    </div>
  );
};
