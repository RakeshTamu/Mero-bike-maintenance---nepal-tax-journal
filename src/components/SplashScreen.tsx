import React, { useEffect, useState } from 'react';
import { translations, Language } from '../utils/translations';
import { MeroBikeMark, MeroBikeWordmark } from './MeroBikeLogo';

interface Props {
  onFinish: () => void;
  isReady?: boolean;
  brandName?: string;
  tagline?: string;
  language?: Language;
}

export const SplashScreen: React.FC<Props> = ({
  onFinish,
  isReady = true,
  brandName = 'Mero Bike',
  tagline = 'Your Bike. Your Records. One Place.',
  language = 'en'
}) => {
  const [entered, setEntered] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [bgError, setBgError] = useState(false);
  const t = translations[language];

  // Trigger gentle mount fade-in without blocking readiness
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setEntered(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Dismiss immediately once existing app initialization completes (no artificial delay)
  useEffect(() => {
    if (!isReady) return;
    setFadingOut(true);
    const doneTimer = setTimeout(() => {
      onFinish();
    }, 220);
    return () => clearTimeout(doneTimer);
  }, [isReady, onFinish]);

  const brandLower = brandName.toLowerCase().trim();
  const isDefaultBrand = brandLower === 'mero bike' || brandLower === 'merobike';

  return (
    <div
      role="region"
      aria-label={brandName}
      className={`fixed inset-0 z-50 bg-[#06090D] text-[#F5F8FA] flex flex-col justify-between overflow-hidden select-none transition-opacity duration-200 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Cinematic Himalayan & Honda XR 190L Background Layer */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ease-out ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      >
        {/* Dark atmospheric fallback surface */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#070B10] via-[#0B1219] to-[#05070A]" />

        {!bgError && (
          <div className="relative w-full h-full mx-auto md:max-w-[540px] lg:max-w-[600px]">
            <picture className="block w-full h-full">
              <source srcSet="/assets/splash-bg.webp" type="image/webp" />
              <img
                src="/assets/splash-bg.jpg"
                alt=""
                decoding="async"
                fetchPriority="high"
                referrerPolicy="no-referrer"
                onError={() => setBgError(true)}
                className="w-full h-full object-cover object-[50%_54%]"
              />
            </picture>

            {/* Side edge blending on wider tablet/desktop screens */}
            <div className="hidden md:block absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#06090D] to-transparent" />
            <div className="hidden md:block absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#06090D] to-transparent" />
          </div>
        )}

        {/* Measured top & bottom contrast scrims keeping the bike & peaks unobstructed */}
        <div className="absolute inset-x-0 top-0 h-[36%] bg-gradient-to-b from-[#06090D]/90 via-[#06090D]/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-[#05070A]/95 via-[#05070A]/60 to-transparent" />
      </div>

      {/* Upper Section: Unified Mero Bike Emblem, Wordmark & Tagline */}
      <header
        className={`relative z-10 w-full max-w-md mx-auto pt-safe px-6 transition-all duration-300 ease-out ${
          entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1.5'
        }`}
      >
        <div className="pt-6 sm:pt-9 flex flex-col items-center text-center">
          {/* Unified Himalayan Peaks & Cyan Road 'M' Brand Emblem */}
          <MeroBikeMark className="w-20 h-14 sm:w-24 sm:h-16 mb-2.5 drop-shadow-[0_4px_14px_rgba(0,0,0,0.45)]" />

          {/* Wordmark Row */}
          <div className="relative inline-flex items-center justify-center">
            <h1 className="leading-none">
              {isDefaultBrand ? (
                <MeroBikeWordmark sizeClass="text-[34px] sm:text-[40px]" onDark />
              ) : (
                <span className="text-[34px] sm:text-[40px] leading-none font-bold tracking-tight text-[#F2F4F5]">
                  {brandName}
                </span>
              )}
            </h1>
          </div>

          {/* Crisp Hairline Divider */}
          <div
            className="w-full max-w-[260px] sm:max-w-[300px] h-px mt-3 mb-2 bg-gradient-to-r from-transparent via-white/35 to-transparent"
            aria-hidden="true"
          />

          {/* Tagline */}
          <p className="text-xs sm:text-[13px] font-medium tracking-wide text-[#CBD5E1] text-balance">
            {tagline}
          </p>
        </div>
      </header>

      {/* Middle Section: Open Focal Window for Honda XR 190L & Himalayan Scenery */}
      <div className="relative z-10 flex-1 min-h-[36vh]" aria-hidden="true" />

      {/* Bottom Section: Minimal Loading Ring, Status Text & Grounding Crest */}
      <footer
        className={`relative z-10 w-full max-w-md mx-auto pb-safe px-6 transition-opacity duration-300 ease-out ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="pb-5 sm:pb-8 flex flex-col items-center text-center gap-2.5">
          {/* Subtle Ring Spinner */}
          <div className="relative w-7 h-7 flex items-center justify-center" role="status" aria-label={t.splashLoadingGarage}>
            <svg viewBox="0 0 36 36" className="w-7 h-7 animate-spin">
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="rgba(148, 163, 184, 0.22)"
                strokeWidth="3"
              />
              <path
                d="M18 4 A14 14 0 0 1 32 18"
                fill="none"
                stroke="#22B8CF"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Subtle Loading Text */}
          <span className="text-xs font-medium tracking-wide text-[#CBD5E1]">
            {t.splashLoadingGarage}
          </span>

          {/* Minimal Grounding Brand Mark */}
          <div className="w-full max-w-[240px] flex items-center gap-3 pt-1 opacity-85" aria-hidden="true">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/30" />
            <MeroBikeMark className="w-8 h-5" />
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/30" />
          </div>
        </div>
      </footer>
    </div>
  );
};
