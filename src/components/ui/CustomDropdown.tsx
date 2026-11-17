import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { FieldWrapper } from './FormControls';

export interface CustomDropdownQuickJump {
  label: string;
  targetValue: string;
}

export interface CustomDropdownOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface CustomDropdownProps {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: CustomDropdownOption[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  quickJumps?: CustomDropdownQuickJump[];
  size?: 'md' | 'compact';
  menuTitle?: string;
  minMenuWidth?: number;
  wrapperClassName?: string;
  triggerClassName?: string;
  id?: string;
  ariaLabel?: string;
}

interface PopoverCoords {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'bottom' | 'top';
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  value,
  onValueChange,
  options,
  placeholder = 'Select an option',
  required = false,
  error,
  hint,
  disabled = false,
  searchable,
  searchPlaceholder = 'Search options...',
  emptyText = 'No matching options',
  quickJumps,
  size = 'md',
  menuTitle,
  minMenuWidth,
  wrapperClassName = '',
  triggerClassName = '',
  id,
  ariaLabel
}) => {
  const reactId = useId();
  const triggerId = id || `dropdown-trigger-${reactId}`;
  const listboxId = `dropdown-listbox-${reactId}`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const [popoverCoords, setPopoverCoords] = useState<PopoverCoords>({
    top: 0,
    left: 0,
    width: 240,
    maxHeight: 280,
    placement: 'bottom'
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalPanelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingJumpTargetRef = useRef<string | null>(null);

  const showSearch = searchable ?? options.length > 8;

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const rawQuery = searchQuery.trim().toLowerCase();
    if (!rawQuery) return options;
    const normalizedQuery = rawQuery.replace(/[०-९]/g, (ch) =>
      String('०१२३४५६७८९'.indexOf(ch))
    );
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(normalizedQuery) ||
        opt.value.toLowerCase().includes(normalizedQuery) ||
        (opt.description && opt.description.toLowerCase().includes(normalizedQuery))
    );
  }, [options, searchQuery]);

  const updatePosition = () => {
    if (typeof window === 'undefined') return;
    const mobile = window.innerWidth < 640;
    setIsMobileViewport(mobile);
    if (mobile || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const gap = 6;
    const margin = 12;

    const desiredWidth = Math.max(rect.width, minMenuWidth || 0);
    const maxAllowedWidth = Math.max(180, viewportW - margin * 2);
    const width = Math.min(desiredWidth, maxAllowedWidth);
    const left = Math.max(margin, Math.min(rect.left, viewportW - width - margin));

    const spaceBelow = viewportH - rect.bottom - margin - gap;
    const spaceAbove = rect.top - margin - gap;
    const preferredMax = 300;

    const openUpward = spaceBelow < 200 && spaceAbove > spaceBelow;
    if (openUpward) {
      const maxHeight = Math.max(150, Math.min(preferredMax, spaceAbove));
      setPopoverCoords({
        top: rect.top - gap,
        left,
        width,
        maxHeight,
        placement: 'top'
      });
    } else {
      const maxHeight = Math.max(150, Math.min(preferredMax, spaceBelow));
      setPopoverCoords({
        top: rect.bottom + gap,
        left,
        width,
        maxHeight,
        placement: 'bottom'
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const selectedIdx = filteredOptions.findIndex((opt) => opt.value === value && !opt.disabled);
    const firstEnabledIdx = filteredOptions.findIndex((opt) => !opt.disabled);
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : firstEnabledIdx);

    const handleResizeOrScroll = (e: Event) => {
      if (
        portalPanelRef.current &&
        e.target instanceof Node &&
        portalPanelRef.current.contains(e.target)
      ) {
        return;
      }
      updatePosition();
    };

    const handleOutsidePointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (portalPanelRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);
    document.addEventListener('mousedown', handleOutsidePointer);
    document.addEventListener('touchstart', handleOutsidePointer);

    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
      document.removeEventListener('mousedown', handleOutsidePointer);
      document.removeEventListener('touchstart', handleOutsidePointer);
    };
  }, [isOpen]);

  // Reset search when closed; focus search on desktop when opened
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }
    if (showSearch && !isMobileViewport) {
      const idTimer = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 20);
      return () => window.clearTimeout(idTimer);
    }
  }, [isOpen, showSearch, isMobileViewport]);

  // Keep highlighted option scrolled into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    const el = optionRefs.current[highlightedIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  // Execute deferred jump after clearing search filter
  useEffect(() => {
    if (!isOpen || !pendingJumpTargetRef.current) return;
    const target = pendingJumpTargetRef.current;
    pendingJumpTargetRef.current = null;
    const idx = filteredOptions.findIndex((opt) => opt.value === target && !opt.disabled);
    if (idx >= 0) {
      setHighlightedIndex(idx);
      optionRefs.current[idx]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [isOpen, filteredOptions]);

  const handleQuickJump = (targetValue: string) => {
    if (searchQuery) {
      pendingJumpTargetRef.current = targetValue;
      setSearchQuery('');
      return;
    }
    const idx = filteredOptions.findIndex((opt) => opt.value === targetValue && !opt.disabled);
    if (idx >= 0) {
      setHighlightedIndex(idx);
      optionRefs.current[idx]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) {
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    }
  };

  const selectOption = (opt: CustomDropdownOption) => {
    if (opt.disabled) return;
    onValueChange(opt.value);
    closeMenu(true);
  };

  const moveHighlight = (step: 1 | -1) => {
    if (filteredOptions.length === 0) return;
    const total = filteredOptions.length;
    let next = highlightedIndex;
    for (let i = 0; i < total; i++) {
      next = (next + step + total) % total;
      if (!filteredOptions[next]?.disabled) {
        setHighlightedIndex(next);
        return;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeMenu(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      const first = filteredOptions.findIndex((o) => !o.disabled);
      if (first >= 0) setHighlightedIndex(first);
    } else if (e.key === 'End') {
      e.preventDefault();
      for (let i = filteredOptions.length - 1; i >= 0; i--) {
        if (!filteredOptions[i]?.disabled) {
          setHighlightedIndex(i);
          break;
        }
      }
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        e.preventDefault();
        selectOption(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const triggerSizeClass =
    size === 'compact'
      ? 'min-h-[38px] rounded-xl px-2.5 py-1.5 text-xs'
      : 'min-h-[44px] rounded-xl px-3.5 py-2.5 text-[15px] sm:text-sm';

  const triggerElement = (
    <button
      ref={triggerRef}
      id={triggerId}
      type="button"
      disabled={disabled}
      role="combobox"
      aria-label={ariaLabel || label}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-controls={isOpen ? listboxId : undefined}
      aria-invalid={Boolean(error)}
      onClick={() => !disabled && setIsOpen((prev) => !prev)}
      onKeyDown={handleKeyDown}
      className={`w-full ${triggerSizeClass} bg-[var(--color-surface-2)] border clay-inset text-left flex items-center justify-between gap-2 transition cursor-pointer focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
        error
          ? 'border-[var(--color-error)] ring-2 ring-[var(--color-error)]/25'
          : isOpen
          ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20'
          : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/60'
      } ${triggerClassName}`}
    >
      <span className="flex items-center gap-2 min-w-0 flex-1">
        {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
        <span
          className={`truncate font-medium ${
            selectedOption
              ? 'text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-secondary)]/70'
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
      </span>
      <ChevronDown
        className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
          isOpen
            ? 'rotate-180 text-[var(--color-accent)]'
            : 'text-[var(--color-text-secondary)]'
        }`}
      />
    </button>
  );

  const renderOptionsList = () => (
    <div
      id={listboxId}
      role="listbox"
      aria-label={ariaLabel || label || menuTitle || 'Options'}
      className="overflow-y-auto overscroll-contain p-1.5 space-y-1 flex-1"
    >
      {filteredOptions.length === 0 ? (
        <div className="py-6 px-3 text-center text-xs text-[var(--color-text-secondary)]">
          {emptyText}
        </div>
      ) : (
        filteredOptions.map((opt, idx) => {
          const isSelected = opt.value === value;
          const isHighlighted = idx === highlightedIndex;
          return (
            <button
              key={opt.value}
              ref={(el) => {
                optionRefs.current[idx] = el;
              }}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={opt.disabled}
              onMouseEnter={() => setHighlightedIndex(idx)}
              onClick={() => selectOption(opt)}
              className={`w-full min-h-[42px] sm:min-h-[38px] px-3 py-2 rounded-xl text-left flex items-center justify-between gap-2.5 transition focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                isSelected
                  ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border border-[var(--color-accent)]/40 font-semibold'
                  : isHighlighted
                  ? 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-transparent'
                  : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0 flex-1">
                {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm sm:text-xs truncate">{opt.label}</span>
                  {opt.description && (
                    <span className="block text-[11px] text-[var(--color-text-secondary)] truncate mt-0.5 font-normal">
                      {opt.description}
                    </span>
                  )}
                </span>
              </span>
              {isSelected && (
                <Check className="w-4 h-4 text-[var(--color-accent)] shrink-0 stroke-[2.5]" />
              )}
            </button>
          );
        })
      )}
    </div>
  );

  const renderSearchBar = () =>
    showSearch && (
      <div className="p-2 border-b border-[var(--color-border)] shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--color-text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full min-h-[38px] bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset rounded-xl pl-8 pr-8 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/60 focus:outline-none focus:border-[var(--color-accent)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear filter"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );

  const renderQuickJumps = () =>
    quickJumps && quickJumps.length > 0 ? (
      <div
        className="flex items-center gap-1.5 px-2.5 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-x-auto no-scrollbar shrink-0"
        role="group"
        aria-label="Quick year jump"
      >
        {quickJumps.map((jump) => {
          const isCurrentTarget =
            filteredOptions[highlightedIndex]?.value === jump.targetValue ||
            value === jump.targetValue;
          return (
            <button
              key={jump.targetValue}
              type="button"
              onClick={() => handleQuickJump(jump.targetValue)}
              className={`min-h-[34px] sm:min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-mono tabular-nums font-medium whitespace-nowrap shrink-0 border transition active:scale-[0.97] ${
                isCurrentTarget
                  ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[var(--color-accent)]/40'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)]/50'
              }`}
            >
              {jump.label}
            </button>
          );
        })}
      </div>
    ) : null;

  const portalMenu =
    isOpen && typeof document !== 'undefined'
      ? createPortal(
          isMobileViewport ? (
            <div
              data-custom-dropdown-portal="true"
              className="fixed inset-0 z-[70] bg-black/80 flex items-end justify-center animate-in fade-in duration-150"
              onClick={() => closeMenu(true)}
            >
              <div
                ref={portalPanelRef}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
                className="w-full bg-[var(--color-surface-1)] border-t border-[var(--color-border)] clay-raised rounded-t-2xl pb-safe max-h-[72dvh] flex flex-col animate-in slide-in-from-bottom-5 duration-150"
              >
                <div className="w-10 h-1 rounded-full bg-[var(--color-border)] mx-auto mt-3 mb-2 shrink-0" />
                <div className="flex items-center justify-between gap-3 px-4 pb-2.5 border-b border-[var(--color-border)] shrink-0">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                    {menuTitle || label || ariaLabel || placeholder}
                  </span>
                  <button
                    type="button"
                    onClick={() => closeMenu(true)}
                    aria-label="Close"
                    className="w-8 h-8 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-btn-secondary text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center justify-center shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {renderSearchBar()}
                {renderQuickJumps()}
                {renderOptionsList()}
              </div>
            </div>
          ) : (
            <div
              ref={portalPanelRef}
              data-custom-dropdown-portal="true"
              onKeyDown={handleKeyDown}
              style={{
                position: 'fixed',
                left: popoverCoords.left,
                width: popoverCoords.width,
                top: popoverCoords.placement === 'bottom' ? popoverCoords.top : undefined,
                bottom:
                  popoverCoords.placement === 'top'
                    ? window.innerHeight - popoverCoords.top
                    : undefined,
                maxHeight: popoverCoords.maxHeight
              }}
              className="z-[70] bg-[var(--color-surface-1)] border border-[var(--color-border)] clay-raised rounded-2xl flex flex-col overflow-hidden animate-in fade-in duration-150"
            >
              {renderSearchBar()}
              {renderQuickJumps()}
              {renderOptionsList()}
            </div>
          ),
          document.body
        )
      : null;

  return (
    <>
      {label ? (
        <FieldWrapper
          label={label}
          htmlFor={triggerId}
          required={required}
          error={error}
          hint={hint}
          className={wrapperClassName}
        >
          {triggerElement}
        </FieldWrapper>
      ) : (
        <div className={`w-full ${wrapperClassName}`}>{triggerElement}</div>
      )}
      {portalMenu}
    </>
  );
};
