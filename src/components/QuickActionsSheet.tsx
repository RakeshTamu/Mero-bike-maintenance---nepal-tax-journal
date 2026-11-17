import React from 'react';
import {
  Wrench,
  Calendar,
  FileText,
  Gauge,
  ChevronRight
} from 'lucide-react';
import { BottomSheet } from './ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddMaintenance: () => void;
  onAddTaxPayment: () => void;
  onUploadDocument: () => void;
  onAddOdometer: () => void;
  language: 'en' | 'ne';
}

export const QuickActionsSheet: React.FC<Props> = ({
  isOpen,
  onClose,
  onAddMaintenance,
  onAddTaxPayment,
  onUploadDocument,
  onAddOdometer,
  language
}) => {
  const actions = [
    {
      id: 'maintenance',
      icon: Wrench,
      title: language === 'ne' ? 'मर्मत दर्ता गर्नुहोस्' : 'Add Maintenance',
      desc: language === 'ne' ? 'सर्भिस रेकर्ड तथा पार्टपुर्जा' : 'Log service record & parts',
      action: onAddMaintenance
    },
    {
      id: 'tax',
      icon: Calendar,
      title: language === 'ne' ? 'कर नवीकरण दर्ता' : 'Add Tax Renewal',
      desc: language === 'ne' ? 'ब्लुबुक कर तथा म्याद अपडेट' : 'Record Blue Book tax cycle',
      action: onAddTaxPayment
    },
    {
      id: 'document',
      icon: FileText,
      title: language === 'ne' ? 'कागजात अपलोड गर्नुहोस्' : 'Upload Document',
      desc: language === 'ne' ? 'रसिद, ब्लुबुक वा लाइसेन्स' : 'Store receipts, Blue Book or license',
      action: onUploadDocument
    },
    {
      id: 'odometer',
      icon: Gauge,
      title: language === 'ne' ? 'ओडोमिटर अपडेट' : 'Update Odometer',
      desc: language === 'ne' ? 'हालको कि.मी. प्रविष्ट गर्नुहोस्' : 'Update current KM reading',
      action: onAddOdometer
    }
  ];

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'ne' ? 'द्रुत कार्यहरू' : 'Quick Actions'}
      subtitle={language === 'ne' ? 'तुरुन्त नयाँ रेकर्ड थप्नुहोस्' : 'Jump straight to an existing workflow'}
    >
      <div className="space-y-2.5">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.id}
              type="button"
              onClick={() => {
                onClose();
                act.action();
              }}
              className="w-full min-h-[56px] p-3.5 rounded-2xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 transition flex items-center gap-3.5 text-left group active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent)] shrink-0">
                <Icon className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition truncate">
                  {act.title}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] truncate">
                  {act.desc}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] shrink-0" />
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
};
