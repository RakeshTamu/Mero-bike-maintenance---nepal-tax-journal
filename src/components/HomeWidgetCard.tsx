import React, { useState } from 'react';
import {
  Wrench,
  Gauge,
  Calendar,
  Sparkles,
  Smartphone,
  Share2,
  Check
} from 'lucide-react';
import { Bike, RenewalRecord, TaxStatusResult, ServiceRecord } from '../types';
import { getCurrentNepaliDate, toDevanagariNumerals, NEPALI_MONTHS_NE, NEPALI_DAYS_NE } from '../utils/nepaliCalendar';
import { SelectableChip } from './ui';
import { MeroBikeMark, MeroBikeWordmark } from './MeroBikeLogo';
import { VehicleImage } from './VehicleImage';

interface Props {
  bike: Bike;
  taxStatus: TaxStatusResult;
  latestRenewal?: RenewalRecord;
  latestService?: ServiceRecord;
  language: 'en' | 'ne';
  onClose?: () => void;
  isStandalone?: boolean;
}

export const HomeWidgetCard: React.FC<Props> = ({
  bike,
  taxStatus,
  latestRenewal,
  latestService,
  language,
  isStandalone = false
}) => {
  const [widgetSize, setWidgetSize] = useState<'compact' | 'wide'>('wide');
  const [copied, setCopied] = useState(false);
  const todayBs = getCurrentNepaliDate();

  const nextServiceKm =
    latestService && typeof latestService.nextServiceKm === 'number' && latestService.nextServiceKm > 0
      ? latestService.nextServiceKm
      : null;
  const kmToService = nextServiceKm !== null ? nextServiceKm - (bike.odometerKm || 0) : null;

  const dayOfWeek = new Date().getDay();
  const nepaliDateStr = `${toDevanagariNumerals(todayBs.day)} ${NEPALI_MONTHS_NE[todayBs.month - 1]} ${toDevanagariNumerals(todayBs.year)}, ${NEPALI_DAYS_NE[dayOfWeek]}`;

  const handleShareWidget = () => {
    const text = `Mero Bike Status Widget:
${bike.name} (${bike.registrationNumber})
• Odometer: ${bike.odometerKm?.toLocaleString()} KM
• Tax Status: ${latestRenewal ? `${taxStatus.badgeLabel} (${taxStatus.daysRemaining} days left)` : 'Not Recorded'}
• Next Service: ${nextServiceKm !== null && kmToService !== null ? `${nextServiceKm.toLocaleString()} KM (${kmToService} KM left)` : 'Not Recorded'}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const statusBorderColor = !latestRenewal
    ? 'border-[var(--color-border)]'
    : taxStatus.status === 'VALID'
    ? 'border-[var(--color-success)]/45'
    : taxStatus.status === 'GRACE_PERIOD'
    ? 'border-[var(--color-warning)]/45'
    : 'border-[var(--color-error)]/45';

  const statusPillClass = !latestRenewal
    ? 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
    : taxStatus.status === 'VALID'
    ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)] border-[var(--color-success)]/40'
    : taxStatus.status === 'GRACE_PERIOD'
    ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)] border-[var(--color-warning)]/40'
    : 'bg-[var(--color-error-subtle)] text-[var(--color-error)] border-[var(--color-error)]/40';

  return (
    <div className={`space-y-4 ${isStandalone ? 'p-4 max-w-md mx-auto min-h-screen flex flex-col justify-center' : ''}`}>
      {!isStandalone && (
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] font-semibold">
            <Smartphone className="w-4 h-4 text-[var(--color-accent)]" />
            <span>{language === 'ne' ? 'हाम्रो पात्रो शैलीको विजेट' : 'Hamro Patro Style Widget'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <SelectableChip
              size="sm"
              selected={widgetSize === 'compact'}
              onClick={() => setWidgetSize('compact')}
            >
              2x2
            </SelectableChip>
            <SelectableChip
              size="sm"
              selected={widgetSize === 'wide'}
              onClick={() => setWidgetSize('wide')}
            >
              4x2 Wide
            </SelectableChip>
          </div>
        </div>
      )}

      {/* THE WIDGET CONTAINER */}
      <div
        className={`relative overflow-hidden rounded-2xl border clay-raised transition-all duration-150 bg-[var(--color-surface-1)] ${statusBorderColor} ${
          widgetSize === 'compact' ? 'max-w-[290px] p-4 mx-auto' : 'w-full p-4 sm:p-5'
        }`}
      >
        <div className="flex items-center justify-between pb-2.5 border-b border-[var(--color-border)] text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--color-warning)] font-mono tabular-nums truncate">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{nepaliDateStr}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <MeroBikeMark className="w-5 h-3.5 shrink-0" themeAware />
            <MeroBikeWordmark sizeClass="text-xs" />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <VehicleImage
              photoUrl={bike.photoUrl}
              name={bike.name}
              variant="thumb"
              className="w-10 h-10 rounded-xl"
            />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{bike.name}</h3>
              <div className="inline-block px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] font-mono tabular-nums text-[10px] font-semibold text-[var(--color-warning)] tracking-wider mt-0.5">
                {bike.registrationNumber}
              </div>
            </div>
          </div>

          <div
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border shrink-0 ${statusPillClass}`}
          >
            {!latestRenewal
              ? (language === 'ne' ? 'दर्ता छैन' : 'Not Recorded')
              : taxStatus.status === 'VALID'
              ? (language === 'ne' ? 'कर वैध' : 'Tax Valid')
              : taxStatus.status === 'GRACE_PERIOD'
              ? (language === 'ne' ? '९०-दिने ग्रेस' : '90-Day Grace')
              : (language === 'ne' ? 'कर म्याद नाघेको' : 'Tax Overdue')}
          </div>
        </div>

        <div className={`mt-3.5 gap-2.5 ${widgetSize === 'compact' ? 'grid grid-cols-1' : 'grid grid-cols-2'}`}>
          <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1 font-medium">
                <Gauge className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span>{language === 'ne' ? 'ओडोमिटर' : 'Odometer'}</span>
              </span>
              <span className="font-mono tabular-nums font-semibold text-[var(--color-text-primary)]">
                {bike.odometerKm?.toLocaleString()} KM
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)] pt-1.5 border-t border-[var(--color-border)]">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[var(--color-warning)]" />
                <span>{language === 'ne' ? 'कर म्याद' : 'Tax Expiry'}</span>
              </span>
              <span className="font-mono tabular-nums text-[var(--color-text-primary)] font-semibold">
                {latestRenewal ? `${latestRenewal.validUntilBS} BS` : (language === 'ne' ? 'दर्ता छैन' : 'Not Recorded')}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1 font-medium">
                <Wrench className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span>{language === 'ne' ? 'अर्को सर्भिस' : 'Next Due'}</span>
              </span>
              <span className="font-mono tabular-nums font-semibold text-[var(--color-accent)]">
                {nextServiceKm !== null ? `${nextServiceKm.toLocaleString()} KM` : (language === 'ne' ? 'दर्ता छैन' : 'Not Recorded')}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)] pt-1.5 border-t border-[var(--color-border)]">
              <span>{language === 'ne' ? 'बाँकी दूरी' : 'Remaining'}</span>
              <span className="font-mono tabular-nums font-semibold text-[var(--color-success)]">
                {kmToService === null
                  ? '—'
                  : kmToService > 0
                  ? `${kmToService.toLocaleString()} KM`
                  : (language === 'ne' ? 'समय भयो' : 'Due Now!')}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-secondary)]">
          <span className="flex items-center gap-1.5 font-medium truncate">
            <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
            <span className="truncate">{taxStatus.message}</span>
          </span>

          <button
            type="button"
            onClick={handleShareWidget}
            className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition active:scale-95 shrink-0"
            title="Copy Widget Status"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Share2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
