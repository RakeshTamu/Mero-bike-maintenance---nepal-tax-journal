import React from 'react';

interface MeroBikeMarkProps {
  className?: string;
  /** When true, adapts peak bright fill to active light/dark theme text color */
  themeAware?: boolean;
}

/**
 * Geometric Mero Bike brand symbol:
 * Faceted Himalayan mountain peaks paired with a winding #22B8CF cyan road forming an abstract M.
 */
export const MeroBikeMark: React.FC<MeroBikeMarkProps> = ({
  className = 'w-8 h-6',
  themeAware = false
}) => {
  const peakBright = themeAware ? 'var(--color-text-primary, #F2F4F5)' : '#F2F4F5';
  const peakShadow = themeAware ? 'var(--color-text-secondary, #929BA3)' : '#929BA3';
  const roadAccent = themeAware ? 'var(--color-accent, #22B8CF)' : '#22B8CF';

  return (
    <svg
      viewBox="0 0 64 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Left Himalayan Peak - Lit Left Ridge */}
      <path
        d="M5 32 L21 11 L26 19 L19 25 L12 31 Z"
        fill={peakBright}
      />
      {/* Left Himalayan Peak - Shaded Right Facet */}
      <path
        d="M21 11 L29 24 L23 24.5 L19 20 Z"
        fill={peakShadow}
        fillOpacity="0.65"
      />

      {/* Right Main Himalayan Peak - Lit Left Slope */}
      <path
        d="M26 26 L41 6 L45 14 L38 23 L32 28 Z"
        fill={peakBright}
      />
      {/* Right Main Himalayan Peak - Metallic Shaded Right Face */}
      <path
        d="M41 6 L58 31 L50 31 L42.5 21.5 L38 23 Z"
        fill={peakShadow}
        fillOpacity="0.82"
      />

      {/* Restrained Cyan Winding Road Forming Abstract 'M' */}
      <path
        d="M6 38 L21.5 24.5 L32 31.5 L42.5 24 L58 38 L50.5 38 L42.2 30.2 L32 37.2 L21.8 30.6 L13 38 Z"
        fill={roadAccent}
      />
    </svg>
  );
};

interface MeroBikeWordmarkProps {
  className?: string;
  sizeClass?: string;
  /** Force dark-surface high-contrast colors (e.g. dark splash backdrop regardless of active theme) */
  onDark?: boolean;
}

/**
 * Official Mero Bike wordmark: always two separate words ("Mero" + space + cyan "Bike").
 */
export const MeroBikeWordmark: React.FC<MeroBikeWordmarkProps> = ({
  className = '',
  sizeClass = 'text-lg sm:text-xl',
  onDark = false
}) => {
  return (
    <span
      className={`inline-flex items-baseline font-bold tracking-tight leading-none whitespace-nowrap select-none ${sizeClass} ${className}`}
    >
      <span className={onDark ? 'text-[#F2F4F5]' : 'text-[var(--color-text-primary)]'}>Mero</span>
      <span className={onDark ? 'text-[#22B8CF]' : 'text-[var(--color-accent)]'}>&nbsp;Bike</span>
    </span>
  );
};

