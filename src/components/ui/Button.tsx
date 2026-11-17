import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-fg)] border border-white/10 font-semibold clay-btn-primary',
  secondary:
    'bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] border border-[var(--color-border)] font-medium clay-btn-secondary',
  outline:
    'bg-transparent hover:bg-[var(--color-surface-2)] text-[var(--color-accent)] border border-[var(--color-accent)]/50 font-semibold',
  ghost:
    'bg-transparent hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-transparent font-medium',
  danger:
    'bg-[var(--color-error)] hover:opacity-95 text-white border border-white/10 font-semibold clay-btn-primary'
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-3.5 py-1.5 text-xs gap-1.5',
  md: 'min-h-[44px] px-4 py-2.5 text-sm gap-2',
  lg: 'min-h-[48px] px-5 py-3 text-sm gap-2'
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  pill = false,
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  children,
  type = 'button',
  ...rest
}) => {
  const radiusClass = pill ? 'rounded-full' : 'rounded-xl';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center transition-[background-color,border-color,color,transform,opacity,box-shadow] duration-150 active:translate-y-[1px] active:scale-[0.985] disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
        VARIANT_CLASSES[variant]
      } ${SIZE_CLASSES[size]} ${radiusClass} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'surface' | 'ghost' | 'accent' | 'danger';
  size?: 'sm' | 'md';
}

const ICON_VARIANT_CLASSES: Record<NonNullable<IconButtonProps['variant']>, string> = {
  surface:
    'bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] clay-btn-secondary',
  ghost:
    'bg-transparent hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-transparent',
  accent:
    'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-fg)] border border-white/10 clay-btn-primary',
  danger:
    'bg-[var(--color-error-subtle)] hover:opacity-90 text-[var(--color-error)] border border-[var(--color-error)]/30'
};

export const IconButton: React.FC<IconButtonProps> = ({
  variant = 'surface',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}) => {
  const sizeClass = size === 'sm' ? 'w-9 h-9 rounded-xl' : 'w-10 h-10 rounded-xl';
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center shrink-0 transition-[background-color,border-color,color,transform,box-shadow] duration-150 active:translate-y-[1px] active:scale-[0.97] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${ICON_VARIANT_CLASSES[variant]} ${sizeClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};
