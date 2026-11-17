import React, { useEffect, useRef } from 'react';
import { Check, Plus, Star, UserRound, Warehouse } from 'lucide-react';
import { Bike } from '../types';
import { formatMessage, Language, translations } from '../utils/translations';
import { Button, EmptyState, FullScreenSheet } from './ui';
import { VehicleImage } from './VehicleImage';

interface MyGarageSheetProps {
  isOpen: boolean;
  onClose: () => void;
  bikes: Bike[];
  activeBikeId: number;
  onSelectVehicle: (bikeId: number) => void;
  onViewProfile: (bike: Bike) => void;
  onAddVehicle: () => void;
  language: Language;
}

export const MyGarageSheet: React.FC<MyGarageSheetProps> = ({
  isOpen,
  onClose,
  bikes,
  activeBikeId,
  onSelectVehicle,
  onViewProfile,
  onAddVehicle,
  language
}) => {
  const t = translations[language];
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeCardRef = useRef<HTMLDivElement | null>(null);

  // Gently scroll active vehicle card into view on mobile when opening
  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      if (activeCardRef.current && scrollContainerRef.current) {
        activeCardRef.current.scrollIntoView({
          behavior: 'auto',
          inline: 'center',
          block: 'nearest'
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, activeBikeId]);

  const countLabel = formatMessage(
    bikes.length === 1 ? t.vehicleCountSingle : t.vehicleCountPlural,
    { count: bikes.length }
  );

  return (
    <FullScreenSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t.myGarageTitle}
      subtitle={bikes.length > 0 ? countLabel : t.myGarageSubtitle}
      leadingIcon={<Warehouse className="w-4 h-4" />}
      backLabel={t.backToApp}
      maxWidthClass="max-w-3xl"
      rightAction={
        bikes.length > 0 ? (
          <Button
            type="button"
            variant="primary"
            pill
            size="sm"
            onClick={onAddVehicle}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            <span className="whitespace-nowrap">{t.addVehicle}</span>
          </Button>
        ) : undefined
      }
    >
      {bikes.length === 0 ? (
        <div className="py-6">
          <EmptyState
            icon={<Warehouse className="w-6 h-6 text-[var(--color-accent)]" />}
            title={t.yourGarageEmpty}
            description={t.yourGarageEmptyDesc}
            action={
              <Button
                type="button"
                variant="primary"
                pill
                size="md"
                onClick={onAddVehicle}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                {t.addVehicle}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile Horizontal Swipeable Carousel + Desktop Responsive 2-Column Grid */}
          <div
            ref={scrollContainerRef}
            className="flex md:grid md:grid-cols-2 gap-3.5 sm:gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0 no-scrollbar"
          >
            {bikes.map((bike) => {
              const isActive = bike.id === activeBikeId;
              const reg = bike.registrationNumber?.trim();
              const hasCc = typeof bike.cc === 'number' && Number.isFinite(bike.cc) && bike.cc > 0;
              const hasOdo = typeof bike.odometerKm === 'number' && Number.isFinite(bike.odometerKm);

              return (
                <article
                  key={bike.id ?? `${bike.name}-${reg}`}
                  ref={isActive ? activeCardRef : undefined}
                  className={`w-[84%] max-w-[330px] md:w-auto md:max-w-none shrink-0 snap-center rounded-2xl bg-[var(--color-surface-1)] border clay-raised flex flex-col overflow-hidden transition-[border-color] duration-150 ${
                    isActive
                      ? 'border-[var(--color-accent)]/70 ring-1 ring-[var(--color-accent)]/25'
                      : 'border-[var(--color-border)]'
                  }`}
                >
                  {/* Visual Vehicle Showcase Stage */}
                  <div className="relative h-36 sm:h-40 bg-[var(--color-surface-2)] overflow-hidden">
                    <VehicleImage
                      photoUrl={bike.photoUrl}
                      name={bike.name}
                      variant="card"
                      blendToSurface="var(--color-surface-1)"
                      showBackdropMountains
                      className="w-full h-full"
                    />

                    {/* Top Overlay Badges */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 z-[3] flex items-center justify-between gap-2 pointer-events-none">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-surface-1)]/90 border border-[var(--color-success)]/45 text-[11px] font-semibold text-[var(--color-success)] backdrop-blur-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] shrink-0" />
                          <span>{t.activeVehicleLabel}</span>
                        </span>
                      ) : (
                        <span />
                      )}

                      {bike.isPrimary && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-surface-1)]/90 border border-[var(--color-border)] text-[10px] font-semibold text-[var(--color-accent)] backdrop-blur-sm">
                          <Star className="w-3 h-3 fill-current shrink-0" />
                          <span>{t.primaryBike}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vehicle Identity & Specs */}
                  <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3.5">
                    <div className="space-y-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] leading-tight truncate">
                        {bike.name}
                      </h3>

                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] flex-wrap">
                        {reg && (
                          <span className="font-mono tabular-nums font-semibold text-[var(--color-accent)]">
                            {reg}
                          </span>
                        )}
                        {reg && hasCc && <span aria-hidden="true">·</span>}
                        {hasCc && (
                          <span className="font-mono tabular-nums">{bike.cc}cc</span>
                        )}
                        {hasOdo && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {bike.odometerKm!.toLocaleString()} km
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Clear Switch & View Profile Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {isActive ? (
                        <button
                          type="button"
                          onClick={onClose}
                          className="min-h-[42px] px-3 py-2 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/40 text-xs font-semibold text-[var(--color-accent)] flex items-center justify-center gap-1.5 whitespace-nowrap transition active:scale-[0.98]"
                        >
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{t.activeBadge}</span>
                        </button>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            if (bike.id) {
                              onSelectVehicle(bike.id);
                              onClose();
                            }
                          }}
                          className="min-h-[42px] whitespace-nowrap"
                        >
                          <span className="truncate">{t.switchToThisVehicle}</span>
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onViewProfile(bike)}
                        leftIcon={<UserRound className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />}
                        className="min-h-[42px] whitespace-nowrap"
                      >
                        <span className="truncate">{t.viewProfile}</span>
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </FullScreenSheet>
  );
};
