import React from 'react';
import { AlertCircle, Check, Search, X } from 'lucide-react';
import { CustomDropdown, CustomDropdownOption, CustomDropdownQuickJump } from './CustomDropdown';

export interface FieldWrapperProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  labelRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const FieldWrapper: React.FC<FieldWrapperProps> = ({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  labelRight,
  children,
  className = ''
}) => {
  return (
    <div className={`w-full space-y-1.5 text-left ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="block text-xs font-medium text-[var(--color-text-primary)]"
        >
          <span>{label}</span>
          {required && (
            <span className="ml-1 text-[var(--color-error)] font-semibold" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {labelRight}
      </div>

      {children}

      {error ? (
        <p className="text-xs text-[var(--color-error)] font-medium flex items-center gap-1.5 pt-0.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
};

const baseFieldClasses = (hasError: boolean) =>
  `w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-[15px] sm:text-sm text-left text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/60 bg-[var(--color-surface-2)] border clay-inset transition duration-150 focus:outline-none ${
    hasError
      ? 'border-[var(--color-error)] ring-2 ring-[var(--color-error)]/25'
      : 'border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20'
  }`;

export interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  labelRight?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  wrapperClassName?: string;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  id,
  required,
  error,
  hint,
  labelRight,
  rightAdornment,
  wrapperClassName = '',
  className = '',
  ...rest
}) => {
  const inputId = id || `input-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <FieldWrapper
      label={label}
      htmlFor={inputId}
      required={required}
      error={error}
      hint={hint}
      labelRight={labelRight}
      className={wrapperClassName}
    >
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          className={`${baseFieldClasses(Boolean(error))} ${rightAdornment ? 'pr-12' : ''} ${className}`}
          {...rest}
        />
        {rightAdornment && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--color-text-secondary)] pointer-events-none">
            {rightAdornment}
          </div>
        )}
      </div>
    </FieldWrapper>
  );
};

export interface NumberInputProps extends Omit<TextInputProps, 'type'> {
  unit?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  unit,
  rightAdornment,
  className = '',
  ...rest
}) => {
  return (
    <TextInput
      type="number"
      inputMode="decimal"
      rightAdornment={rightAdornment ?? (unit ? <span>{unit}</span> : undefined)}
      className={`font-mono tabular-nums ${className}`}
      {...rest}
    />
  );
};

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  id,
  required,
  error,
  hint,
  wrapperClassName = '',
  className = '',
  rows = 3,
  ...rest
}) => {
  const inputId = id || `textarea-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <FieldWrapper
      label={label}
      htmlFor={inputId}
      required={required}
      error={error}
      hint={hint}
      className={wrapperClassName}
    >
      <textarea
        id={inputId}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={`${baseFieldClasses(Boolean(error))} min-h-[88px] resize-y ${className}`}
        {...rest}
      />
    </FieldWrapper>
  );
};

export type SelectOption = CustomDropdownOption;

export interface SelectFieldProps {
  label: string;
  id?: string;
  value?: string | number;
  options?: SelectOption[];
  onChange?: (e: { target: { value: string } }) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  quickJumps?: CustomDropdownQuickJump[];
  wrapperClassName?: string;
  className?: string;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  id,
  value = '',
  options = [],
  onChange,
  onValueChange,
  placeholder,
  required,
  error,
  hint,
  disabled,
  searchable,
  searchPlaceholder,
  emptyText,
  quickJumps,
  wrapperClassName = '',
  className = ''
}) => {
  const handleValueChange = (nextValue: string) => {
    onValueChange?.(nextValue);
    onChange?.({ target: { value: nextValue } });
  };

  return (
    <CustomDropdown
      id={id}
      label={label}
      value={String(value)}
      options={options}
      onValueChange={handleValueChange}
      placeholder={placeholder}
      required={required}
      error={error}
      hint={hint}
      disabled={disabled}
      searchable={searchable}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      quickJumps={quickJumps}
      wrapperClassName={wrapperClassName}
      triggerClassName={className}
    />
  );
};

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  ariaLabel = 'Search'
}) => {
  return (
    <div className={`relative w-full ${className}`}>
      <Search className="w-4 h-4 text-[var(--color-text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full min-h-[44px] bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset rounded-xl pl-10 pr-9 py-2.5 text-[15px] sm:text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/60 focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition duration-150"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export interface SelectableChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  size?: 'sm' | 'md';
}

export const SelectableChip: React.FC<SelectableChipProps> = ({
  selected = false,
  size = 'md',
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  const sizeClass = size === 'sm' ? 'min-h-[34px] px-3 py-1 text-xs rounded-xl' : 'min-h-[38px] px-4 py-1.5 text-xs rounded-xl';
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={`inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap transition duration-150 active:scale-[0.98] border shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${sizeClass} ${
        selected
          ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-white/10 clay-btn-primary'
          : 'bg-[var(--color-surface-1)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] clay-btn-secondary'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = ''
}) => {
  return (
    <label
      className={`flex items-start gap-3 cursor-pointer select-none ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      } ${className}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
          checked
            ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-accent-fg)] clay-btn-primary'
            : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-transparent clay-inset'
        }`}
      >
        <Check className="w-3.5 h-3.5 stroke-[3]" />
      </button>
      <div className="text-left">
        <span className="text-xs font-medium text-[var(--color-text-primary)] block">{label}</span>
        {description && (
          <span className="text-[11px] text-[var(--color-text-secondary)] block mt-0.5">{description}</span>
        )}
      </div>
    </label>
  );
};

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      {(label || description) && (
        <div className="min-w-0 text-left">
          {label && <span className="text-xs font-medium text-[var(--color-text-primary)] block">{label}</span>}
          {description && <span className="text-[11px] text-[var(--color-text-secondary)] block mt-0.5">{description}</span>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border clay-inset transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50 ${
          checked
            ? 'bg-[var(--color-accent)] border-white/10'
            : 'bg-[var(--color-surface-2)] border-[var(--color-border)]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#F2F4F5] clay-raised-sm transition duration-150 ease-in-out mt-[1px] ${
            checked ? 'translate-x-5' : 'translate-x-[1px]'
          }`}
        />
      </button>
    </div>
  );
};
