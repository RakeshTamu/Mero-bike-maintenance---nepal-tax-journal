import React, { useState } from 'react';
import {
  Compass,
  RotateCcw,
  ShieldAlert
} from 'lucide-react';
import { Bike } from '../types';
import { BottomSheet, Button, NumberInput } from './ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bike: Bike;
  language: 'en' | 'ne';
}

interface DestinationPreset {
  nameEn: string;
  nameNe: string;
  oneWayKm: number;
  terrain: 'Highway' | 'Hilly' | 'Valley';
}

const PRESETS: DestinationPreset[] = [
  { nameEn: 'Kathmandu ↔ Pokhara', nameNe: 'काठमाडौं ↔ पोखरा (पृथ्वी लोकमार्ग)', oneWayKm: 200, terrain: 'Highway' },
  { nameEn: 'Kathmandu ↔ Chitwan/Narayangarh', nameNe: 'काठमाडौं ↔ नारायणगढ / चितवन', oneWayKm: 150, terrain: 'Highway' },
  { nameEn: 'Kathmandu ↔ Nagarkot Viewpoint', nameNe: 'काठमाडौं ↔ नगरकोट भ्युपोइन्ट', oneWayKm: 32, terrain: 'Hilly' },
  { nameEn: 'Kathmandu ↔ Dhulikhel / Namobuddha', nameNe: 'काठमाडौं ↔ धुलिखेल / नमोबुद्ध', oneWayKm: 40, terrain: 'Hilly' },
  { nameEn: 'Kathmandu ↔ Butwal', nameNe: 'काठमाडौं ↔ बुटवल', oneWayKm: 260, terrain: 'Highway' },
  { nameEn: 'Kathmandu ↔ Dharan', nameNe: 'काठमाडौं ↔ धरान', oneWayKm: 380, terrain: 'Highway' },
  { nameEn: 'Kathmandu Valley Ring Road Round', nameNe: 'काठमाडौं चक्रपथ १ फन्को', oneWayKm: 28, terrain: 'Valley' }
];

export const TripCostCalculatorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  bike,
  language
}) => {
  const [distanceKm, setDistanceKm] = useState<number>(200);
  const [isRoundTrip, setIsRoundTrip] = useState<boolean>(true);
  const [mileageKmpl, setMileageKmpl] = useState<number>(35);
  const [petrolRate, setPetrolRate] = useState<number>(170.5);
  const [selectedPreset, setSelectedPreset] = useState<string>('Kathmandu ↔ Pokhara');

  if (!isOpen) return null;

  const totalDistance = isRoundTrip ? distanceKm * 2 : distanceKm;
  const fuelNeededLiters = mileageKmpl > 0 ? parseFloat((totalDistance / mileageKmpl).toFixed(2)) : 0;
  const estimatedCost = Math.round(fuelNeededLiters * petrolRate);
  const recommendedReserveLiters = parseFloat((fuelNeededLiters * 1.15).toFixed(2));
  const reserveCost = Math.round(recommendedReserveLiters * petrolRate);

  const handleSelectPreset = (preset: DestinationPreset) => {
    setSelectedPreset(preset.nameEn);
    setDistanceKm(preset.oneWayKm);
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'ne' ? 'हाइवे यात्रा पेट्रोल खर्च क्यालकुलेटर' : 'Highway Fuel & Trip Estimator'}
      subtitle={`${bike.name} · ${bike.registrationNumber}`}
      leadingIcon={<Compass className="w-4 h-4 text-[var(--color-warning)]" />}
    >
      <div className="space-y-4">
        {/* Quick Destination Route Buttons */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
            {language === 'ne' ? 'रुट छान्नुहोस्' : 'Popular Highway Routes'}
          </label>
          <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
            {PRESETS.map((p) => {
              const isSelected = selectedPreset === p.nameEn;
              return (
                <button
                  type="button"
                  key={p.nameEn}
                  onClick={() => handleSelectPreset(p)}
                  className={`p-2.5 rounded-xl text-left border transition-colors duration-150 text-xs flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[var(--color-warning-subtle)] border-[var(--color-warning)]/60 text-[var(--color-text-primary)]'
                      : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <span className="font-semibold truncate">
                    {language === 'ne' ? p.nameNe : p.nameEn}
                  </span>
                  <span className="text-[10px] text-[var(--color-warning)] font-mono tabular-nums mt-1">
                    {p.oneWayKm} KM ({p.terrain})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Trip Distance & Round Trip Toggle */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <NumberInput
            label={language === 'ne' ? 'एकतर्फी दुरी (KM)' : 'One-Way Distance (KM)'}
            unit="km"
            value={distanceKm}
            onChange={(e) => {
              setDistanceKm(Math.max(1, Number(e.target.value)));
              setSelectedPreset('Custom');
            }}
          />

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              {language === 'ne' ? 'यात्रा प्रकार' : 'Trip Type'}
            </label>
            <button
              type="button"
              onClick={() => setIsRoundTrip(!isRoundTrip)}
              className={`w-full min-h-[46px] px-3 rounded-xl border text-xs font-semibold transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5 ${
                isRoundTrip
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-primary)]'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>
                {isRoundTrip
                  ? language === 'ne'
                    ? 'दोहोरो (Round Trip)'
                    : 'Round Trip (2x)'
                  : language === 'ne'
                  ? 'एकतर्फी (One Way)'
                  : 'One Way'}
              </span>
            </button>
          </div>
        </div>

        {/* Bike Mileage & NOC Petrol Rate */}
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label={language === 'ne' ? 'माइलेज (KM/L)' : 'Bike Mileage (KM/L)'}
            unit="km/L"
            value={mileageKmpl}
            onChange={(e) => setMileageKmpl(Math.max(5, Number(e.target.value)))}
          />
          <NumberInput
            label={language === 'ne' ? 'पेट्रोल दर (रु./लिटर)' : 'Petrol Rate (NPR/L)'}
            unit="Rs"
            step="0.5"
            value={petrolRate}
            onChange={(e) => setPetrolRate(Math.max(10, Number(e.target.value)))}
          />
        </div>

        {/* Calculated Result Box */}
        <div className="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-warning)]/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-secondary)]">
              {language === 'ne' ? 'कुल यात्रा दुरी' : 'Total Trip Distance'}:
            </span>
            <span className="text-sm font-bold font-mono tabular-nums text-[var(--color-text-primary)]">
              {totalDistance.toLocaleString()} KM
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-2 border-t border-[var(--color-border)]">
            <div>
              <span className="text-[11px] text-[var(--color-warning)] font-semibold uppercase tracking-wider block">
                {language === 'ne' ? 'अनुमानित पेट्रोल खर्च' : 'Estimated Petrol Cost'}
              </span>
              <span className="text-2xl font-bold font-mono tabular-nums text-[var(--color-warning)]">
                Rs. {estimatedCost.toLocaleString()}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-[var(--color-text-secondary)] block">
                {language === 'ne' ? 'इन्धन परिमाण' : 'Fuel Required'}
              </span>
              <span className="text-xl font-bold font-mono tabular-nums text-[var(--color-text-primary)]">
                {fuelNeededLiters}{' '}
                <span className="text-xs font-normal text-[var(--color-text-secondary)] font-sans">Liters</span>
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex items-start gap-2 text-[11px] text-[var(--color-text-secondary)]">
            <ShieldAlert className="w-4 h-4 text-[var(--color-warning)] shrink-0 mt-0.5" />
            <p className="tabular-nums">
              {language === 'ne'
                ? `उकालो र जामका लागि १५% अतिरिक्त इन्धन (करिब ${recommendedReserveLiters} लिटर / रु. ${reserveCost}) ट्याङ्कीमा राख्न सुझाव दिइन्छ।`
                : `For hilly terrain and traffic delays, a 15% safety reserve (${recommendedReserveLiters} L / Rs. ${reserveCost}) is recommended.`}
            </p>
          </div>
        </div>

        <Button type="button" variant="secondary" fullWidth onClick={onClose}>
          {language === 'ne' ? 'बन्द गर्नुहोस्' : 'Close Estimator'}
        </Button>
      </div>
    </BottomSheet>
  );
};
