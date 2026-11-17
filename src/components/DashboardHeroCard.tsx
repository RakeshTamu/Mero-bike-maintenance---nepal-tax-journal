import React from 'react';
import { ChevronRight, UserRound } from 'lucide-react';
import { Bike } from '../types';
import { Language, translations } from '../utils/translations';
import { VehicleImage } from './VehicleImage';

interface DashboardHeroCardProps {
  bike: Bike;
  language: Language;
  onOpenGarage: () => void;
  onViewProfile: () => void;
}

function splitVehicleTitle(name: string, explicitModel?: string): { brandLine: string; modelLine: string } {
  const cleanName = name.trim();
  const cleanModel = explicitModel?.trim();
  if (cleanModel) {
    return { brandLine: cleanName, modelLine: cleanModel };
  }
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      brandLine: parts[0],
      modelLine: parts.slice(1).join(' ')
    };
  }
  return {
    brandLine: '',
    modelLine: cleanName
  };
}

export const DashboardHeroCard: React.FC<DashboardHeroCardProps> = ({
  bike,
  language,
  onOpenGarage,
  onViewProfile
}) => {
  const t = translations[language];
  const { brandLine, modelLine } = splitVehicleTitle(bike.name, bike.model);

  const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button')) return;
    onOpenGarage();
  };

  return (
    <section
      aria-label={`${bike.name} — ${t.openGarageHint}`}
      onClick={handleCardClick}
      className="group relative overflow-hidden rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/45 clay-raised p-3.5 sm:p-4 cursor-pointer transition-[border-color,transform] duration-150 active:scale-[0.995]"
    >
      <div className="relative min-h-[146px] sm:min-h-[172px] flex items-stretch justify-between gap-2">
        {/* Left Side: Active Vehicle Indicator, Make & Model, Registration Number, Compact View Profile */}
        <div className="relative z-10 flex flex-col justify-between flex-1 min-w-0 max-w-[58%] sm:max-w-[54%] py-0.5 space-y-2.5">
          {/* Top Block: Subtle Active Vehicle Indicator + Make & Model + Reg No */}
          <div className="space-y-1.5 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--color-success-subtle)] border border-[var(--color-success)]/30 text-[11px] font-semibold text-[var(--color-success)] leading-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] shrink-0" aria-hidden="true" />
              <span className="truncate">{t.activeVehicleLabel}</span>
            </div>

            <div className="space-y-0.5 min-w-0 pt-0.5">
              {brandLine && (
                <div className="text-sm sm:text-lg font-bold text-[var(--color-text-primary)] leading-tight truncate">
                  {brandLine}
                </div>
              )}
              <h2 className="text-lg sm:text-[25px] font-extrabold text-[var(--color-accent)] tracking-tight leading-[1.08] break-words">
                {modelLine}
              </h2>
            </div>

            <div className="text-xs sm:text-sm font-mono tabular-nums font-medium text-[var(--color-text-secondary)] truncate">
              {bike.registrationNumber || t.notRecordedLower}
            </div>
          </div>

          {/* Bottom Block: Compact View Profile Action + Subtle My Garage Entry Cue */}
          <div className="flex items-center flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewProfile();
              }}
              className="inline-flex items-center gap-1.5 min-h-[34px] px-2.5 sm:px-3 py-1 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] clay-btn-secondary text-[11px] sm:text-xs font-semibold text-[var(--color-text-primary)] transition duration-150 active:translate-y-[1px] active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              <UserRound className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
              <span>{t.viewProfile}</span>
            </button>

            <button
              type="button"
              onClick={onOpenGarage}
              className="inline-flex items-center gap-0.5 min-h-[34px] px-1.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold text-[var(--color-accent)] group-hover:translate-x-0.5 transition-transform duration-150 whitespace-nowrap shrink-0"
            >
              <span>{t.openGarageHint}</span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>

        {/* Right Side: Prominent Vehicle Photo or Model-Neutral Fallback Blended into Dark Card */}
        <div
          className="absolute -right-3.5 -top-3.5 -bottom-3.5 sm:-right-4 sm:-top-4 sm:-bottom-4 w-[47%] sm:w-[49%] pointer-events-none select-none overflow-hidden rounded-r-2xl"
          aria-hidden="true"
        >
          <VehicleImage
            photoUrl={bike.photoUrl}
            name={bike.name}
            variant="hero"
            blendToSurface="var(--color-surface-1)"
            showBackdropMountains
            className="w-full h-full"
          />
        </div>
      </div>
    </section>
  );
};
