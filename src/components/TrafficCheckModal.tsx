import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  FileText,
  Sun,
  Copy,
  Check,
  Info
} from 'lucide-react';
import { Bike, RenewalRecord, DocumentItem, TaxStatusResult } from '../types';
import { formatBsDisplayDate, formatAdDisplayDate } from '../utils/nepaliCalendar';
import {
  Card,
  FullScreenSheet,
  IconButton,
  SelectableChip,
  StatusBadge,
  StatusIndicator
} from './ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bike: Bike;
  taxStatus: TaxStatusResult;
  latestRenewal?: RenewalRecord;
  documents: DocumentItem[];
  language: 'en' | 'ne';
}

export const TrafficCheckModal: React.FC<Props> = ({
  isOpen,
  onClose,
  bike,
  taxStatus,
  latestRenewal,
  documents,
  language
}) => {
  const [selectedDocCategory, setSelectedDocCategory] = useState<string>('bluebook_tax');
  const [flashlightMode, setFlashlightMode] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const relevantDoc = documents.find(d => d.category === selectedDocCategory) || documents[0];
  const notRecordedLabel = language === 'ne' ? 'दर्ता नभएको' : 'Not recorded';

  const handleCopyDetails = () => {
    const text = `Mero Bike Vehicle Details:
Plate: ${bike.registrationNumber}
Model: ${bike.name} (${bike.cc}cc)
Tax Expiry: ${latestRenewal ? `${latestRenewal.validUntilBS} BS (${latestRenewal.validUntilAD} AD)` : 'Not recorded'}
Engine No: ${bike.engineNo || 'Not recorded'}
Chassis No: ${bike.chassisNo || 'Not recorded'}
Office: ${latestRenewal?.officeLocation || 'Not recorded'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (flashlightMode) {
    return (
      <div
        onClick={() => setFlashlightMode(false)}
        className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-black cursor-pointer text-center select-none"
      >
        <Sun className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-2xl font-bold uppercase tracking-wider font-mono">
          {bike.registrationNumber}
        </h2>
        <p className="text-sm font-semibold mt-2">
          {language === 'ne'
            ? 'रात्रिकालीन जाँच सेतो बत्ती (फर्कन जहाँ पनि थिच्नुहोस्)'
            : 'Night Inspection White Light (Tap anywhere to return)'}
        </p>
      </div>
    );
  }

  const taxSemanticStatus = !latestRenewal
    ? 'neutral'
    : taxStatus.status === 'VALID'
    ? 'success'
    : taxStatus.status === 'GRACE_PERIOD'
    ? 'warning'
    : 'error';

  return (
    <FullScreenSheet
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'ne' ? 'ट्राफिक चेकिङ कार्ड' : 'Traffic Spot-Check Card'}
      subtitle={
        language === 'ne'
          ? 'आधिकारिक सवारी तथा कर विवरण'
          : 'DoTM Vehicle & Tax Record'
      }
      leadingIcon={<ShieldCheck className="w-4 h-4 text-[var(--color-accent)]" />}
      maxWidthClass="max-w-lg"
      rightAction={
        <IconButton
          size="sm"
          onClick={() => setFlashlightMode(true)}
          title={language === 'ne' ? 'रात्रिकालीन उज्यालो स्क्रिन' : 'Night Inspection Light'}
          aria-label="Night Inspection Light"
        >
          <Sun className="w-4 h-4 text-[var(--color-warning)]" />
        </IconButton>
      }
    >
      <div className="space-y-4">
        {/* Official High-Contrast Plate Card */}
        <Card variant="primary" padding="md" className="border-[var(--color-warning)]/50 text-center space-y-2.5">
          <div className="text-[11px] uppercase font-semibold tracking-wider text-[var(--color-warning)]">
            {language === 'ne' ? 'सवारी दर्ता नम्बर' : 'Vehicle Registration Number'}
          </div>

          {bike.platePhotoUrl ? (
            <div className="space-y-2">
              <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] max-h-36 mx-auto flex items-center justify-center bg-[var(--color-surface-2)]">
                <img
                  src={bike.platePhotoUrl}
                  alt={bike.registrationNumber}
                  className="w-full h-auto max-h-36 object-contain"
                />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-wider text-[var(--color-text-primary)]">
                {bike.registrationNumber}
              </div>
            </div>
          ) : (
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-wider text-[var(--color-warning)]">
              {bike.registrationNumber}
            </div>
          )}

          <div className="text-xs font-medium text-[var(--color-text-secondary)]">
            {bike.name} · <span className="font-mono tabular-nums text-[var(--color-accent)] font-semibold">{bike.cc}cc</span>
          </div>
        </Card>

        {/* Real-Time Tax Status Card */}
        <Card
          variant="primary"
          padding="md"
          className={`text-center space-y-2 ${
            taxSemanticStatus === 'success'
              ? 'border-[var(--color-success)]/45'
              : taxSemanticStatus === 'warning'
              ? 'border-[var(--color-warning)]/45'
              : taxSemanticStatus === 'error'
              ? 'border-[var(--color-error)]/45'
              : ''
          }`}
        >
          <div className="flex justify-center">
            <StatusIndicator
              size="md"
              status={taxSemanticStatus}
              icon={
                !latestRenewal ? (
                  <Info className="w-5 h-5" />
                ) : taxStatus.status === 'VALID' ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : taxStatus.status === 'GRACE_PERIOD' ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <AlertOctagon className="w-5 h-5" />
                )
              }
            />
          </div>

          <div className="flex justify-center">
            <StatusBadge status={taxSemanticStatus}>
              <span>
                {!latestRenewal
                  ? (language === 'ne' ? 'कर विवरण दर्ता छैन' : 'Tax Not Recorded')
                  : taxStatus.status === 'VALID'
                  ? (language === 'ne' ? 'कर वैध' : 'Tax Valid')
                  : taxStatus.status === 'GRACE_PERIOD'
                  ? (language === 'ne' ? '९०-दिने ग्रेस अवधि' : '90-Day Grace Period')
                  : (language === 'ne' ? 'कर म्याद नाघेको' : 'Tax Expired')}
              </span>
            </StatusBadge>
          </div>

          <div className="text-lg sm:text-xl font-semibold font-mono tabular-nums text-[var(--color-text-primary)]">
            {latestRenewal?.validUntilAD
              ? `${formatBsDisplayDate(latestRenewal.validUntilAD, language)} BS`
              : (language === 'ne' ? 'मिति दर्ता गरिएको छैन' : 'Not Recorded')}
          </div>

          {latestRenewal ? (
            <div className="text-xs text-[var(--color-text-secondary)] font-mono tabular-nums">
              {formatAdDisplayDate(latestRenewal.validUntilAD)} ·{' '}
              {taxStatus.daysRemaining > 0
                ? `${taxStatus.daysRemaining} ${language === 'ne' ? 'दिन बाँकी' : 'days left'}`
                : taxStatus.message}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-secondary)]">
              {language === 'ne'
                ? 'चेकिङ कार्डमा म्याद देखाउन कर ट्याबमा ब्लुबुक नवीकरण थप्नुहोस्।'
                : 'Log a Blue Book renewal in the Tax tab to display expiry verification here.'}
            </p>
          )}
        </Card>

        {/* Technical Specs Checklist */}
        <Card variant="secondary" padding="md" className="text-xs space-y-2 font-mono">
          <div className="flex justify-between gap-3">
            <span className="text-[var(--color-text-secondary)]">
              {language === 'ne' ? 'इन्जिन नम्बर:' : 'Engine No:'}
            </span>
            <span className="font-semibold text-[var(--color-text-primary)] text-right truncate">
              {bike.engineNo || notRecordedLabel}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[var(--color-text-secondary)]">
              {language === 'ne' ? 'चेसिस नम्बर:' : 'Chassis No:'}
            </span>
            <span className="font-semibold text-[var(--color-text-primary)] text-right truncate">
              {bike.chassisNo || notRecordedLabel}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[var(--color-text-secondary)]">
              {language === 'ne' ? 'नवीकरण कार्यालय:' : 'Renewed Office:'}
            </span>
            <span className="font-semibold text-[var(--color-text-primary)] text-right truncate max-w-[200px]">
              {latestRenewal?.officeLocation || notRecordedLabel}
            </span>
          </div>
        </Card>

        {/* Blue Book Page Quick Viewer */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--color-text-primary)]">
              {language === 'ne' ? 'संलग्न कागजपत्रहरू' : 'Attached Documents'}
            </span>
            <button
              type="button"
              onClick={handleCopyDetails}
              className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1 font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>
                {copied
                  ? (language === 'ne' ? 'कपी भयो!' : 'Copied!')
                  : (language === 'ne' ? 'विवरण कपी गर्नुहोस्' : 'Copy Info')}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <SelectableChip
              selected={selectedDocCategory === 'bluebook_tax'}
              onClick={() => setSelectedDocCategory('bluebook_tax')}
              className="justify-center text-xs px-2"
            >
              {language === 'ne' ? 'कर दाखिला' : 'Tax Stamps'}
            </SelectableChip>
            <SelectableChip
              selected={selectedDocCategory === 'bluebook_front'}
              onClick={() => setSelectedDocCategory('bluebook_front')}
              className="justify-center text-xs px-2"
            >
              {language === 'ne' ? 'ब्लुबुक १-२' : 'Blue Book P.1-2'}
            </SelectableChip>
            <SelectableChip
              selected={selectedDocCategory === 'pollution'}
              onClick={() => setSelectedDocCategory('pollution')}
              className="justify-center text-xs px-2"
            >
              {language === 'ne' ? 'प्रदूषण' : 'Pollution'}
            </SelectableChip>
          </div>

          <div className="h-48 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] clay-inset overflow-hidden flex items-center justify-center">
            {relevantDoc ? (
              <img
                src={relevantDoc.imageBase64}
                alt={relevantDoc.title}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center p-4 space-y-1">
                <FileText className="w-8 h-8 text-[var(--color-text-secondary)] mx-auto opacity-60" />
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">
                  {language === 'ne'
                    ? 'यस वर्गमा फोटो अपलोड गरिएको छैन'
                    : 'No photo uploaded in this category'}
                </p>
                <p className="text-[11px] text-[var(--color-text-secondary)] opacity-75">
                  {language === 'ne'
                    ? 'कागजात ट्याबबाट फोटो थप्नुहोस्'
                    : 'Upload photos in the Documents tab'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </FullScreenSheet>
  );
};
