import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import {
  adToBs,
  bsToAd,
  formatAdDate,
  formatAdDisplayDate,
  formatBsDisplayDate,
  getDaysInBsMonth,
  toDevanagariNumerals,
  NEPALI_MONTHS_EN,
  NEPALI_MONTHS_NE
} from '../utils/nepaliCalendar';
import { translations } from '../utils/translations';
import { CustomDropdown } from './ui/CustomDropdown';

export interface NepaliDatePickerProps {
  label: string;
  valueAD: string; // YYYY-MM-DD
  onChange: (valueAD: string, valueBS: string) => void;
  required?: boolean;
  error?: boolean;
  errorMessage?: string;
  language?: 'en' | 'ne';
  minYearBS?: number;
  maxYearBS?: number;
  showQuickPresets?: boolean;
  helperText?: string;
  className?: string;
}

export const NepaliDatePicker: React.FC<NepaliDatePickerProps> = ({
  label,
  valueAD,
  onChange,
  required = false,
  error = false,
  errorMessage,
  language = 'en',
  minYearBS = 2070,
  maxYearBS = 2095,
  showQuickPresets = true,
  helperText,
  className = ''
}) => {
  const t = translations[language];
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const initialBs = adToBs(valueAD || formatAdDate(new Date()));
  const [currentBsYear, setCurrentBsYear] = useState<number>(initialBs.year);
  const [currentBsMonth, setCurrentBsMonth] = useState<number>(initialBs.month);
  const [selectedBsDay, setSelectedBsDay] = useState<number>(initialBs.day);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (valueAD) {
      const bs = adToBs(valueAD);
      setCurrentBsYear(bs.year);
      setCurrentBsMonth(bs.month);
      setSelectedBsDay(bs.day);
    }
  }, [valueAD]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('[data-custom-dropdown-portal="true"]')) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(target as Node)) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen]);

  const handleSelectBsDate = (y: number, m: number, d: number) => {
    const validMax = getDaysInBsMonth(y, m);
    const validDay = Math.min(d, validMax);
    setCurrentBsYear(y);
    setCurrentBsMonth(m);
    setSelectedBsDay(validDay);

    const convertedAd = bsToAd(y, m, validDay);
    const adStr = formatAdDate(convertedAd);
    const mm = String(m).padStart(2, '0');
    const dd = String(validDay).padStart(2, '0');
    const bsStr = `${y}-${mm}-${dd}`;

    onChange(adStr, bsStr);
    setIsCalendarOpen(false);
  };

  const handlePrevMonth = () => {
    if (currentBsMonth === 1) {
      if (currentBsYear > minYearBS) {
        setCurrentBsYear(prev => prev - 1);
        setCurrentBsMonth(12);
      }
    } else {
      setCurrentBsMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentBsMonth === 12) {
      if (currentBsYear < maxYearBS) {
        setCurrentBsYear(prev => prev + 1);
        setCurrentBsMonth(1);
      }
    } else {
      setCurrentBsMonth(prev => prev + 1);
    }
  };

  const handleSetToday = () => {
    const today = new Date();
    const adStr = formatAdDate(today);
    const bs = adToBs(today);
    setCurrentBsYear(bs.year);
    setCurrentBsMonth(bs.month);
    setSelectedBsDay(bs.day);
    onChange(adStr, bs.formatted);
    setIsCalendarOpen(false);
  };

  const handleAddOneYear = () => {
    const nextYear = Math.min(maxYearBS, currentBsYear + 1);
    handleSelectBsDate(nextYear, currentBsMonth, selectedBsDay);
  };

  const firstDayAd = bsToAd(currentBsYear, currentBsMonth, 1);
  const startingDayOfWeek = firstDayAd.getDay();
  const totalDaysInMonth = getDaysInBsMonth(currentBsYear, currentBsMonth);

  const currentDisplayBs = formatBsDisplayDate(valueAD, language);
  const currentDisplayAd = formatAdDisplayDate(valueAD);
  const todayBs = adToBs(new Date());

  return (
    <div ref={containerRef} className={`w-full space-y-1.5 relative text-left ${className}`}>
      {/* Label */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-[var(--color-text-primary)] flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-[var(--color-error)] font-semibold">*</span>}
        </label>
        <span className="text-[10px] font-mono text-[var(--color-accent)] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30">
          वि.सं. (BS)
        </span>
      </div>

      {/* Strict Nepali (BS) Date Picker Field */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setIsCalendarOpen(!isCalendarOpen)}
          className={`w-full min-h-[46px] bg-[var(--color-surface-2)] border clay-inset rounded-xl px-3.5 py-2.5 text-left text-[15px] sm:text-sm text-[var(--color-text-primary)] flex items-center justify-between gap-2 transition-colors duration-150 group focus:outline-none ${
            error
              ? 'border-[var(--color-error)] ring-2 ring-[var(--color-error)]/25'
              : isCalendarOpen
              ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20'
              : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/60'
          }`}
        >
          <span className="font-mono font-semibold text-[var(--color-text-primary)] tracking-wide truncate tabular-nums">
            {currentDisplayBs} ({t.bsBadgeLabel})
          </span>
          <CalendarIcon className="w-4 h-4 text-[var(--color-accent)] group-hover:scale-105 transition-transform duration-150 shrink-0" />
        </button>

        {/* Passive Converted English (AD) Date Preview & Quick Presets */}
        <div className="flex items-center justify-between gap-2 text-[11px] px-1 text-[var(--color-text-secondary)]">
          <span className="font-mono font-medium truncate tabular-nums">
            {currentDisplayAd} AD
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleSetToday}
              className="px-2.5 py-1 rounded-lg bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] clay-btn-secondary text-[var(--color-text-primary)] text-[11px] font-medium transition-all duration-150 active:scale-[0.98]"
            >
              {t.todayBtn}
            </button>
            {showQuickPresets && (
              <button
                type="button"
                onClick={handleAddOneYear}
                className="px-2.5 py-1 rounded-lg bg-[var(--color-accent-subtle)] hover:opacity-90 border border-[var(--color-accent)]/35 clay-raised-sm text-[var(--color-accent)] text-[11px] font-semibold transition-all duration-150 active:scale-[0.98]"
              >
                {t.addOneYearBtn}
              </button>
            )}
          </div>
        </div>

        {/* Interactive Popover Nepali Calendar Grid */}
        {isCalendarOpen && (
          <div className="absolute left-0 right-0 z-50 mt-1 p-3.5 bg-[var(--color-surface-1)] border border-[var(--color-border)] clay-raised rounded-2xl animate-in fade-in duration-150 space-y-3">
            {/* Month & Year Navigation Row */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-9 h-9 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] clay-btn-secondary text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center justify-center transition"
                title="Previous Month"
                aria-label="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 flex-1 justify-center min-w-0">
                <div className="w-[120px] sm:w-[132px]">
                  <CustomDropdown
                    size="compact"
                    searchable={false}
                    ariaLabel={t.selectBsMonthAria}
                    menuTitle={t.selectMonthMenu}
                    minMenuWidth={160}
                    value={String(currentBsMonth)}
                    onValueChange={(val) => setCurrentBsMonth(Number(val))}
                    options={Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
                      value: String(m),
                      label: language === 'ne' ? NEPALI_MONTHS_NE[m - 1] : NEPALI_MONTHS_EN[m - 1]
                    }))}
                  />
                </div>

                <div className="w-[96px] sm:w-[104px]">
                  <CustomDropdown
                    size="compact"
                    ariaLabel={t.selectBsYearAria}
                    menuTitle={t.selectYearMenu}
                    searchPlaceholder={t.searchYearPlaceholder}
                    minMenuWidth={140}
                    value={String(currentBsYear)}
                    onValueChange={(val) => setCurrentBsYear(Number(val))}
                    options={Array.from({ length: maxYearBS - minYearBS + 1 }, (_, i) => maxYearBS - i).map((y) => ({
                      value: String(y),
                      label: language === 'ne' ? `${toDevanagariNumerals(y)} BS` : `${y} BS`
                    }))}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-9 h-9 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] clay-btn-secondary text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center justify-center transition"
                title="Next Month"
                aria-label="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-[var(--color-text-secondary)]">
              {(language === 'ne'
                ? ['आइत', 'सोम', 'मंग', 'बुध', 'बिही', 'शुक्र', 'शनि']
                : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
              ).map((dayName, idx) => (
                <div
                  key={dayName}
                  className={`py-1 ${idx === 6 ? 'text-[var(--color-error)] font-semibold' : ''}`}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Monthly Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-xs font-mono tabular-nums">
              {Array.from({ length: startingDayOfWeek }, (_, idx) => (
                <div key={`empty-${idx}`} className="h-9" />
              ))}

              {Array.from({ length: totalDaysInMonth }, (_, idx) => {
                const dayNum = idx + 1;
                const isSelected =
                  currentBsYear === initialBs.year &&
                  currentBsMonth === initialBs.month &&
                  dayNum === selectedBsDay;

                const isToday =
                  currentBsYear === todayBs.year &&
                  currentBsMonth === todayBs.month &&
                  dayNum === todayBs.day;

                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => handleSelectBsDate(currentBsYear, currentBsMonth, dayNum)}
                    className={`h-9 rounded-xl font-semibold flex items-center justify-center transition-all duration-150 active:scale-[0.95] text-xs ${
                      isSelected
                        ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] clay-btn-primary'
                        : isToday
                        ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border border-[var(--color-accent)]/50'
                        : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]'
                    }`}
                  >
                    {language === 'ne' ? toDevanagariNumerals(dayNum) : dayNum}
                  </button>
                );
              })}
            </div>

            {/* Calendar Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)] text-xs">
              <button
                type="button"
                onClick={handleSetToday}
                className="text-xs text-[var(--color-accent)] hover:underline font-semibold py-1"
              >
                {t.todayBtn}
              </button>
              <button
                type="button"
                onClick={() => setIsCalendarOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] text-xs font-medium border border-[var(--color-border)]"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Validation Error Message */}
      {error && errorMessage && (
        <p className="text-xs text-[var(--color-error)] font-medium flex items-center gap-1.5 px-1 animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </p>
      )}

      {helperText && !error && (
        <p className="text-[11px] text-[var(--color-text-secondary)] px-1">{helperText}</p>
      )}
    </div>
  );
};
