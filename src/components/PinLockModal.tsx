import React, { useState, useEffect } from 'react';
import { Lock, Fingerprint, Delete, ShieldCheck, AlertCircle } from 'lucide-react';
import { verifyPin, authenticateWithBiometrics, isBiometricAvailable } from '../utils/security';

interface Props {
  storedPinHash: string;
  isBiometricEnabled: boolean;
  onUnlocked: () => void;
  language: 'en' | 'ne';
}

export const PinLockModal: React.FC<Props> = ({
  storedPinHash,
  isBiometricEnabled,
  onUnlocked,
  language
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [canUseBio, setCanUseBio] = useState(false);

  useEffect(() => {
    const bioAvailable = isBiometricAvailable() && isBiometricEnabled;
    setCanUseBio(bioAvailable);
    if (bioAvailable) {
      handleBiometricUnlock();
    }
  }, [isBiometricEnabled]);

  const handleBiometricUnlock = async () => {
    const success = await authenticateWithBiometrics();
    if (success) {
      onUnlocked();
    }
  };

  const handleDigit = async (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError(false);

    if (newPin.length === 4) {
      const isValid = await verifyPin(newPin, storedPinHash);
      if (isValid) {
        if (navigator.vibrate) navigator.vibrate(50);
        onUnlocked();
      } else {
        if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
        setError(true);
        setErrorMessage(language === 'ne' ? 'गलत पिन! पुनः प्रयास गर्नुहोस्।' : 'Incorrect PIN. Try again.');
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 800);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)] p-4">
      <div className="w-full max-w-xs flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] clay-raised flex items-center justify-center text-[var(--color-accent)] mb-4">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
          {language === 'ne' ? 'मेरो बाइक लक गरिएको छ' : 'Mero Bike is Locked'}
        </h2>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1 mb-6">
          {language === 'ne' ? 'कृपया ४-अंकको पिन प्रविष्ट गर्नुहोस्' : 'Enter 4-digit PIN to access your bike data'}
        </p>

        {/* PIN Dots */}
        <div className={`flex items-center justify-center gap-4 mb-8 transition-transform duration-150 ${error ? 'translate-x-1' : ''}`}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-150 ${
                  isFilled
                    ? error
                      ? 'bg-[var(--color-error)] clay-raised-sm scale-125'
                      : 'bg-[var(--color-accent)] clay-raised-sm scale-125'
                    : 'bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset'
                }`}
              />
            );
          })}
        </div>

        {errorMessage && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-error)] mb-4 animate-in fade-in font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tactile Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-btn-secondary active:bg-[var(--color-accent-subtle)] active:border-[var(--color-accent)] text-lg font-mono tabular-nums font-semibold text-[var(--color-text-primary)] transition-all duration-150 active:translate-y-[1px] active:scale-[0.98] flex items-center justify-center"
            >
              {digit}
            </button>
          ))}

          {canUseBio ? (
            <button
              type="button"
              onClick={handleBiometricUnlock}
              title="Unlock with Fingerprint"
              className="h-14 rounded-2xl bg-[var(--color-accent-subtle)] hover:opacity-90 border border-[var(--color-accent)]/40 clay-btn-secondary text-[var(--color-accent)] transition-all duration-150 active:translate-y-[1px] active:scale-[0.98] flex items-center justify-center"
            >
              <Fingerprint className="w-6 h-6" />
            </button>
          ) : (
            <div className="h-14" />
          )}

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-btn-secondary active:bg-[var(--color-accent-subtle)] text-lg font-mono tabular-nums font-semibold text-[var(--color-text-primary)] transition-all duration-150 active:translate-y-[1px] active:scale-[0.98] flex items-center justify-center"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDelete}
            title="Delete"
            className="h-14 rounded-2xl bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-btn-secondary text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all duration-150 active:translate-y-[1px] active:scale-[0.98] flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-8 text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-success)]" />
          <span>Local IndexedDB Encrypted Session</span>
        </div>
      </div>
    </div>
  );
};
