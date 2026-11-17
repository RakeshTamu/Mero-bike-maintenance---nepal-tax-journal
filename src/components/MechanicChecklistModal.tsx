import React, { useState } from 'react';
import {
  Wrench,
  CheckSquare,
  Square,
  Copy,
  Check
} from 'lucide-react';
import { Bike } from '../types';
import { Button, FullScreenSheet, TextInput } from './ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bike: Bike;
  language: 'en' | 'ne';
}

const DEFAULT_ITEMS = [
  { id: 'oil', labelEn: 'Engine Oil Replacement (Full Synthetic 10W40 / 20W50)', labelNe: 'इन्जिन आयल फेर्ने (फुल सिन्थेटिक)', checked: true },
  { id: 'filter', labelEn: 'Oil Filter & O-Ring Replacement', labelNe: 'आयल फिल्टर फेर्ने', checked: true },
  { id: 'chain', labelEn: 'Chain Deep Cleaning, Lube & Slack Adjustment (20–30mm)', labelNe: 'चेन सफा, ल्युब र टाइट गर्ने', checked: true },
  { id: 'brakes', labelEn: 'Front & Rear Brake Pads inspection & bleed', labelNe: 'अगाडि/पछाडि ब्रेक प्याड जाँच', checked: true },
  { id: 'air', labelEn: 'Air Filter Cleaning or Replacement', labelNe: 'एयर फिल्टर सफा वा फेर्ने', checked: false },
  { id: 'plug', labelEn: 'Spark Plug Cleaning & Gap check', labelNe: 'स्पार्क प्लग सफा गर्ने', checked: false },
  { id: 'tire', labelEn: 'Tire Pressure Inspection (Front: 28 PSI, Rear: 32 PSI)', labelNe: 'टायर हावा प्रेसर जाँच (२८/३२ PSI)', checked: true },
  { id: 'cables', labelEn: 'Clutch & Throttle cable freeplay adjustment', labelNe: 'क्लच र थ्रोटल तार समायोजन', checked: false },
  { id: 'coolant', labelEn: 'Coolant & Battery electrolyte level inspection', labelNe: 'कुल्यान्ट वा ब्याट्री जाँच', checked: false },
  { id: 'lights', labelEn: 'Brake lights, indicators and horn inspection', labelNe: 'बत्ती, इन्डिकेटर र हर्न जाँच', checked: false }
];

export const MechanicChecklistModal: React.FC<Props> = ({
  isOpen,
  onClose,
  bike,
  language
}) => {
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [customNote, setCustomNote] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const toggleItem = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)));
  };

  const handleCopy = () => {
    const selected = items.filter((i) => i.checked);
    const text = `Service Checklist for ${bike.name} (${bike.registrationNumber}):
Odometer: ${bike.odometerKm?.toLocaleString() || '---'} KM
Tasks Requested:
${selected.map((item, idx) => `${idx + 1}. ${item.labelEn}`).join('\n')}
${customNote ? `\nSpecial Instructions: ${customNote}` : ''}
Generated via Mero Bike Journal`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <FullScreenSheet
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'ne' ? 'सर्भिस जब कार्ड तथा चेकलिस्ट' : 'Mechanic Service Job Card'}
      subtitle={`${bike.name} · ${bike.registrationNumber}`}
      leadingIcon={<Wrench className="w-4 h-4 text-[var(--color-accent)]" />}
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
          >
            {language === 'ne' ? 'सकियो' : 'Done'}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            onClick={handleCopy}
          >
            {copied
              ? language === 'ne'
                ? 'कपी भयो!'
                : 'Copied!'
              : language === 'ne'
              ? 'ह्वाट्सएप / भाइबरमा पठाउन कपी'
              : 'Copy for WhatsApp'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Checklist Items */}
        <div className="space-y-2">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`w-full text-left p-3 rounded-xl border cursor-pointer transition-colors duration-150 flex items-center gap-2.5 select-none ${
                item.checked
                  ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)]/40 text-[var(--color-text-primary)]'
                  : 'bg-[var(--color-surface-1)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              {item.checked ? (
                <CheckSquare className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-[var(--color-text-secondary)] shrink-0 opacity-60" />
              )}
              <span className="text-xs font-medium">
                {language === 'ne' ? item.labelNe : item.labelEn}
              </span>
            </button>
          ))}
        </div>

        {/* Custom Mechanic Note */}
        <TextInput
          label={language === 'ne' ? 'विशेष निर्देशन / समस्या (ऐच्छिक)' : 'Special Instructions for Mechanic (Optional)'}
          placeholder="e.g. Front suspension squeak, handle pull slightly left"
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
        />
      </div>
    </FullScreenSheet>
  );
};
