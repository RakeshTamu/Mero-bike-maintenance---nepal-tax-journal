import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone } from 'lucide-react';
import { BottomSheet, Button } from './ui';

interface Props {
  language?: 'en' | 'ne';
}

export const PWAInstallButton: React.FC<Props> = ({ language = 'en' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <Button
        variant="outline"
        size="sm"
        fullWidth
        onClick={install}
        leftIcon={<Download className="w-4 h-4" />}
      >
        <span>{language === 'ne' ? 'एप इन्स्टल' : 'Install PWA'}</span>
      </Button>
    );
  }

  if (isIOS) {
    return (
      <>
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          onClick={() => setShowIOSGuide(true)}
          leftIcon={<Smartphone className="w-4 h-4 text-[var(--color-accent)]" />}
        >
          <span>{language === 'ne' ? 'iOS मा इन्स्टल' : 'Install on iOS'}</span>
        </Button>

        <BottomSheet
          isOpen={showIOSGuide}
          onClose={() => setShowIOSGuide(false)}
          title={language === 'ne' ? 'iPhone / iPad मा इन्स्टल गर्नुहोस्' : 'Install on iPhone / iPad'}
        >
          <div className="space-y-3 text-xs text-[var(--color-text-secondary)]">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
              <div className="w-6 h-6 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center font-semibold shrink-0">
                1
              </div>
              <p>
                {language === 'ne'
                  ? 'Safari को तल रहेको शेयर (Share) बटन थिच्नुहोस्।'
                  : 'Tap the Share icon at the bottom of Safari.'}
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
              <div className="w-6 h-6 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center font-semibold shrink-0">
                2
              </div>
              <p>
                {language === 'ne'
                  ? 'तल स्क्रोल गरी "Add to Home Screen" मा थिच्नुहोस्।'
                  : 'Scroll down and tap "Add to Home Screen".'}
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
              <div className="w-6 h-6 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center font-semibold shrink-0">
                3
              </div>
              <p>
                {language === 'ne'
                  ? 'माथि दायाँपट्टि रहेको "Add" थिची सुरक्षित गर्नुहोस्। मेरो बाइक एप जस्तै खुल्नेछ!'
                  : 'Tap "Add" in the top right. Mero Bike will open like a native app!'}
              </p>
            </div>

            <div className="pt-2">
              <Button variant="primary" fullWidth onClick={() => setShowIOSGuide(false)}>
                {language === 'ne' ? 'बुझें' : 'Got it'}
              </Button>
            </div>
          </div>
        </BottomSheet>
      </>
    );
  }

  return null;
};
