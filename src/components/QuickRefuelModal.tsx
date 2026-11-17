import React, { useState } from 'react';
import {
  Fuel,
  AlertTriangle
} from 'lucide-react';
import { Bike, ExpenseRecord } from '../types';
import { db } from '../db/db';
import { adToBs, formatAdDate } from '../utils/nepaliCalendar';
import { NepaliDatePicker } from './NepaliDatePicker';
import { BottomSheet, Button, NumberInput, SelectableChip } from './ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bike: Bike;
  pastFuelExpenses: ExpenseRecord[];
  onRefresh: () => void;
  language: 'en' | 'ne';
}

export const QuickRefuelModal: React.FC<Props> = ({
  isOpen,
  onClose,
  bike,
  pastFuelExpenses,
  onRefresh,
  language
}) => {
  const [petrolRate] = useState<number>(170.5); // Current standard Nepal NOC rate
  const [amount, setAmount] = useState<number>(1000);
  const [liters, setLiters] = useState<number>(parseFloat((1000 / 170.5).toFixed(2)));
  const [odometerKm, setOdometerKm] = useState<number>(bike.odometerKm || 0);
  const [dateAD, setDateAD] = useState<string>(formatAdDate(new Date()));
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Find last fuel fill to calculate KM/L
  const sortedFuel = [...pastFuelExpenses].sort(
    (a, b) => new Date(b.dateAD).getTime() - new Date(a.dateAD).getTime()
  );
  const lastFill = sortedFuel[0];

  const kmDifference = lastFill && lastFill.odometerKm
    ? Math.max(0, odometerKm - lastFill.odometerKm)
    : 0;

  const estimatedKmpl = kmDifference > 0 && liters > 0
    ? (kmDifference / liters).toFixed(1)
    : null;

  const handleAmountChange = (val: number) => {
    setAmount(val);
    setLiters(parseFloat((val / petrolRate).toFixed(2)));
  };

  const handleLitersChange = (val: number) => {
    setLiters(val);
    setAmount(Math.round(val * petrolRate));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || Number(amount) <= 0) {
      setError(language === 'ne' ? 'कृपया कुल रकम उल्लेख गर्नुहोस्।' : 'Please enter a valid fuel amount.');
      return;
    }

    if (!liters || Number(liters) <= 0) {
      setError(language === 'ne' ? 'कृपया इन्धन परिमाण (लिटर) उल्लेख गर्नुहोस्।' : 'Please enter valid fuel liters.');
      return;
    }

    if (odometerKm === undefined || Number(odometerKm) < 0) {
      setError(language === 'ne' ? 'कृपया हालको ओडोमिटर कि.मी. उल्लेख गर्नुहोस्।' : 'Please enter valid current odometer KM.');
      return;
    }

    const bsDate = adToBs(dateAD).formatted;

    await db.expenses.add({
      bikeId: bike.id!,
      dateAD,
      dateBS: bsDate,
      category: 'fuel',
      amount: Number(amount),
      description: `Petrol Refuel: ${liters}L @ Rs. ${petrolRate}/L${estimatedKmpl ? ` (${estimatedKmpl} KM/L)` : ''}`,
      odometerKm: Number(odometerKm),
      fuelLiters: Number(liters)
    });

    if (Number(odometerKm) > (bike.odometerKm || 0)) {
      await db.bikes.update(bike.id!, { odometerKm: Number(odometerKm) });
    }

    setError(null);
    onRefresh();
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'ne' ? 'इन्धन / पेट्रोल दर्ता' : 'Log Petrol & Mileage'}
      subtitle={language === 'ne' ? 'माइलेज तथा पेट्रोल खर्च हिसाब' : 'Quick pump entry & KM/L calculation'}
      leadingIcon={<Fuel className="w-4 h-4 text-[var(--color-accent)]" />}
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-[var(--color-error-subtle)] border border-[var(--color-error)]/40 text-[var(--color-error)] text-xs flex items-center gap-2 animate-in fade-in duration-150">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Quick Amount Preset Chips */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              {language === 'ne' ? 'रकम छान्नुहोस् (रु.)' : 'Quick Amount (NPR)'}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[500, 1000, 1500, 2000].map((val) => (
                <SelectableChip
                  key={val}
                  selected={amount === val}
                  onClick={() => {
                    handleAmountChange(val);
                    setError(null);
                  }}
                  className="justify-center font-mono tabular-nums"
                >
                  Rs.{val}
                </SelectableChip>
              ))}
            </div>
          </div>

          {/* Amount & Liters Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label={language === 'ne' ? 'कुल रकम (रु.)' : 'Amount (NPR)'}
              required
              unit="Rs"
              value={amount}
              onChange={(e) => {
                handleAmountChange(Number(e.target.value));
                setError(null);
              }}
              error={error && (!amount || amount <= 0) ? error : undefined}
            />
            <NumberInput
              label={language === 'ne' ? 'परिमाण (लिटर)' : 'Fuel (Liters)'}
              required
              unit="L"
              step="0.01"
              value={liters}
              onChange={(e) => {
                handleLitersChange(Number(e.target.value));
                setError(null);
              }}
              error={error && (!liters || liters <= 0) ? error : undefined}
            />
          </div>

          <NepaliDatePicker
            label={language === 'ne' ? 'इन्धन हालेको मिति' : 'Refueling Date'}
            valueAD={dateAD}
            onChange={(ad) => setDateAD(ad)}
            required
            language={language}
          />

          <NumberInput
            label={language === 'ne' ? 'हालको ओडोमिटर कि.मी.' : 'Current Odometer (KM)'}
            required
            unit="km"
            value={odometerKm}
            onChange={(e) => {
              setOdometerKm(Number(e.target.value));
              setError(null);
            }}
            hint={
              lastFill?.odometerKm
                ? `Last fill: ${lastFill.odometerKm.toLocaleString()} KM`
                : undefined
            }
          />

          {estimatedKmpl && (
            <div className="p-3.5 rounded-xl bg-[var(--color-success-subtle)] border border-[var(--color-success)]/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[var(--color-success)] font-semibold uppercase tracking-wider block">
                  Calculated Mileage
                </span>
                <span className="text-xl font-bold font-mono tabular-nums text-[var(--color-success)]">
                  {estimatedKmpl} <span className="text-xs font-normal">KM/L</span>
                </span>
              </div>
              <div className="text-right text-[11px] text-[var(--color-text-secondary)] font-mono tabular-nums">
                {kmDifference} KM travelled
                <br />
                on {liters} Ltrs
              </div>
            </div>
          )}

          <div className="text-[10px] text-[var(--color-text-secondary)] flex items-center justify-between px-1 font-mono tabular-nums">
            <span>NOC Petrol Rate: Rs. {petrolRate}/L</span>
            <span>Date: {dateAD}</span>
          </div>

          <div className="flex gap-2.5 pt-1">
            <Button type="button" variant="secondary" fullWidth onClick={onClose}>
              {language === 'ne' ? 'रद्द' : 'Cancel'}
            </Button>
            <Button type="submit" variant="primary" fullWidth>
              {language === 'ne' ? 'सेभ गर्नुहोस्' : 'Save Refuel'}
            </Button>
          </div>
        </form>
      </div>
    </BottomSheet>
  );
};
