import React from 'react';
import { PhoneCall, ShieldAlert, LifeBuoy } from 'lucide-react';
import { Card, FullScreenSheet, StatusIndicator } from './ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  language: 'en' | 'ne';
}

const EMERGENCY_CONTACTS = [
  {
    number: '103',
    titleEn: 'Nepal Traffic Police Hotline',
    titleNe: 'ट्राफिक प्रहरी हटलाइन',
    descEn: '24/7 traffic control, accident reports & vehicle verification',
    descNe: '२४ सै घण्टा ट्राफिक नियन्त्रण, दुर्घटना रिपोर्ट र जाँच सहायता',
    status: 'accent' as const
  },
  {
    number: '100',
    titleEn: 'Nepal Police Emergency Control',
    titleNe: 'नेपाल प्रहरी आपतकालीन नियन्त्रण कक्ष',
    descEn: 'Immediate emergency police dispatch anywhere in Nepal',
    descNe: 'नेपालभरि तुरुन्त प्रहरी सहायता र आपतकालीन नियन्त्रण',
    status: 'accent' as const
  },
  {
    number: '102',
    titleEn: 'Nepal Ambulance Service (NAS)',
    titleNe: 'नेपाल एम्बुलेन्स सेवा',
    descEn: 'Emergency medical assistance and hospital transit',
    descNe: 'आपतकालीन स्वास्थ्य सहायता तथा एम्बुलेन्स सेवा',
    status: 'error' as const
  },
  {
    number: '1144',
    titleEn: 'Highway Traffic Accident Control',
    titleNe: 'दुर्घटना उद्धार तथा ट्राफिक व्यवस्थापन',
    descEn: 'Highway breakdown, obstruction & towing support',
    descNe: 'राजमार्ग दुर्घटना, बाटो अवरोध तथा सवारी उद्धार सहायता',
    status: 'warning' as const
  }
];

export const EmergencyDirectoryModal: React.FC<Props> = ({ isOpen, onClose, language }) => {
  return (
    <FullScreenSheet
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'ne' ? 'आपतकालीन सेवा तथा हटलाइन' : 'Emergency & Traffic Hotlines'}
      subtitle={language === 'ne' ? 'सिधै फोन सम्पर्क गर्नुहोस्' : 'Direct emergency dialers for riders in Nepal'}
      leadingIcon={<LifeBuoy className="w-4 h-4 text-[var(--color-error)]" />}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        <div className="space-y-2.5">
          {EMERGENCY_CONTACTS.map(contact => (
            <a
              key={contact.number}
              href={`tel:${contact.number}`}
              className="block p-4 rounded-2xl bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-raised-sm hover:border-[var(--color-accent)]/50 transition-all duration-150 group active:scale-[0.99]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                    {language === 'ne' ? contact.titleNe : contact.titleEn}
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                    {language === 'ne' ? contact.descNe : contact.descEn}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono tabular-nums font-semibold text-sm text-[var(--color-text-primary)] px-2.5 py-1 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset">
                    {contact.number}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-fg)] clay-btn-primary flex items-center justify-center group-hover:scale-105 transition-transform duration-150">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        <Card variant="secondary" padding="md" className="space-y-2">
          <div className="flex items-center gap-2.5">
            <StatusIndicator
              size="sm"
              status="warning"
              icon={<ShieldAlert className="w-4 h-4" />}
            />
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">
              {language === 'ne' ? 'ट्राफिक जाँचमा काम लाग्ने नियमहरू' : 'Rider Rights at Traffic Checkpoints'}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {language === 'ne'
              ? 'सवारी तथा यातायात व्यवस्था ऐन अनुसार कर म्याद नाघेको ९० दिनसम्म कुनै जरिवाना लाग्दैन। चेकिङमा परेमा आफ्नो सवारीको "ट्राफिक चेकिङ कार्ड" र ब्लुबुक देखाउनुहोस्।'
              : 'Under the Nepal Motor Vehicle Act, you have a statutory 90-day grace period with zero fines after tax expiry. If questioned, open the "Traffic Spot-Check Card" in Mero Bike.'}
          </p>
        </Card>
      </div>
    </FullScreenSheet>
  );
};
