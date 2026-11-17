import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Bike } from '../types';
import { Language, translations } from '../utils/translations';
import { VehicleImage } from './VehicleImage';

interface ContextualVehicleBarProps {
  bike: Bike;
  language: Language;
  onOpenGarage: () => void;
  /** Optional trailing metadata text (e.g., odometer or CC) shown cleanly with a middot */
  secondaryMeta?: string;
}

/**
 * Compact contextual active-vehicle selector displayed on Maintenance, Tax, and Documents.
 * Keeps the top app bar uncluttered while letting users view & switch the active vehicle
 * via the unified My Garage experience.
 */
export const ContextualVehicleBar: React.FC<ContextualVehicleBarProps> = ({
  bike,
  language,
  onOpenGarage,
  secondaryMeta
}) => {
  const t = translations[language];
  const reg = bike.registrationNumber?.trim();

  return (
    <button
      type="button"
      onClick={onOpenGarage}
      aria-label={`${t.activeVehicleLabel}: ${bike.name}. ${t.switchBike}`}
      className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/40 clay-raised-sm flex items-center justify-between gap-2.5 text-left transition duration-150 active:scale-[0.99]"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <VehicleImage
          photoUrl={bike.photoUrl}
          name={bike.name}
          variant="avatar"
          className="w-8 h-8 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate leading-tight">
            {bike.name}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-[var(--color-text-secondary)] truncate mt-0.5">
            {reg && <span className="text-[var(--color-accent)] font-medium truncate">{reg}</span>}
            {reg && secondaryMeta && <span aria-hidden="true">·</span>}
            {secondaryMeta && <span className="truncate">{secondaryMeta}</span>}
          </div>
        </div>
      </div>

      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-accent)] whitespace-nowrap shrink-0">
        <span>{t.switchShort}</span>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
      </span>
    </button>
  );
};
