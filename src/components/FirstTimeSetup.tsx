import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bike as BikeIcon,
  Car,
  Zap,
  Compass,
  Layers,
  ChevronRight,
  Shield,
  ShieldCheck,
  FileText,
  Wrench,
  Camera,
  X,
  ArrowLeft,
  Check,
  Save,
  Edit2,
  AlertCircle,
  Globe
} from 'lucide-react';
import { Bike, VehicleCategory } from '../types';
import { db } from '../db/db';
import { bsToAd, formatAdDate, getCurrentNepaliDate } from '../utils/nepaliCalendar';
import { translations, formatMessage, Language, TranslationKeys } from '../utils/translations';
import { Button, Card, NumberInput, SelectField, StatusBadge, TextInput } from './ui';
import { MeroBikeMark, MeroBikeWordmark } from './MeroBikeLogo';
import { VehicleImage } from './VehicleImage';

interface Props {
  onComplete: (createdBike: Bike) => void;
  onSkip?: () => void;
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

export const ONBOARDING_DRAFT_KEY = 'sawaari_onboarding_draft';
export const ONBOARDING_STATUS_KEY = 'sawaari_onboarding_status';

interface OnboardingDraft {
  step: number;
  category: VehicleCategory;
  vehicleName: string;
  registrationNumber: string;
  cc: string;
  engineNo: string;
  chassisNo: string;
  boughtYearBS: string;
  odometerKm: string;
  photoUrl: string;
}

const VEHICLE_TYPE_META: {
  id: VehicleCategory;
  labelKey: keyof TranslationKeys;
  descKey: keyof TranslationKeys;
  defaultCc: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: 'Bike',
    labelKey: 'catBike',
    descKey: 'onboardingTypeBikeDesc',
    defaultCc: '150',
    Icon: BikeIcon
  },
  {
    id: 'Scooter',
    labelKey: 'catScooter',
    descKey: 'onboardingTypeScooterDesc',
    defaultCc: '125',
    Icon: Compass
  },
  {
    id: 'Car',
    labelKey: 'catCar',
    descKey: 'onboardingTypeCarDesc',
    defaultCc: '1200',
    Icon: Car
  },
  {
    id: 'Electric',
    labelKey: 'catElectric',
    descKey: 'onboardingTypeElectricDesc',
    defaultCc: '',
    Icon: Zap
  },
  {
    id: 'Other',
    labelKey: 'catOther',
    descKey: 'onboardingTypeOtherDesc',
    defaultCc: '150',
    Icon: Layers
  }
];

function computeAdYearFromBs(bsYearStr: string): string {
  const bsYear = Number(bsYearStr);
  if (!Number.isFinite(bsYear) || bsYear < 2000 || bsYear > 2095) {
    return String(new Date().getFullYear());
  }
  try {
    // Month 4 (Shrawan) sits safely mid-Gregorian year for clean BS->AD year correspondence
    const adDate = bsToAd(bsYear, 4, 1);
    return String(adDate.getFullYear());
  } catch {
    return String(bsYear - 57);
  }
}

function readDraft(defaultBsYear: string): OnboardingDraft {
  const fallback: OnboardingDraft = {
    step: 1,
    category: 'Bike',
    vehicleName: '',
    registrationNumber: '',
    cc: '150',
    engineNo: '',
    chassisNo: '',
    boughtYearBS: defaultBsYear,
    odometerKm: '',
    photoUrl: ''
  };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    const validCat = VEHICLE_TYPE_META.some((v) => v.id === parsed.category)
      ? (parsed.category as VehicleCategory)
      : 'Bike';
    return {
      step: typeof parsed.step === 'number' && parsed.step >= 1 && parsed.step <= 7 ? parsed.step : 1,
      category: validCat,
      vehicleName: typeof parsed.vehicleName === 'string' ? parsed.vehicleName : '',
      registrationNumber: typeof parsed.registrationNumber === 'string' ? parsed.registrationNumber : '',
      cc: typeof parsed.cc === 'string' ? parsed.cc : '150',
      engineNo: typeof parsed.engineNo === 'string' ? parsed.engineNo : '',
      chassisNo: typeof parsed.chassisNo === 'string' ? parsed.chassisNo : '',
      boughtYearBS: typeof parsed.boughtYearBS === 'string' && parsed.boughtYearBS ? parsed.boughtYearBS : defaultBsYear,
      odometerKm: typeof parsed.odometerKm === 'string' ? parsed.odometerKm : '',
      photoUrl: typeof parsed.photoUrl === 'string' ? parsed.photoUrl : ''
    };
  } catch {
    return fallback;
  }
}

export const FirstTimeSetup: React.FC<Props> = ({
  onComplete,
  onSkip,
  language,
  onLanguageChange
}) => {
  const t = translations[language];
  const todayBs = useMemo(() => getCurrentNepaliDate(), []);
  const initialDraft = useMemo(() => readDraft(String(todayBs.year)), [todayBs.year]);

  // Step 1: Language Selection -> Step 2: Welcome -> Steps 3..6: 4 Setup Steps -> Step 7: Review
  const [step, setStep] = useState<number>(initialDraft.step);
  const totalSteps = 7;
  const setupTotalSteps = 5; // Steps 3..7 (4 setup steps + 1 review step)

  // Form Fields (preserved across Back/Next & interrupted onboarding)
  const [category, setCategory] = useState<VehicleCategory>(initialDraft.category);
  const [vehicleName, setVehicleName] = useState<string>(initialDraft.vehicleName);
  const [registrationNumber, setRegistrationNumber] = useState<string>(initialDraft.registrationNumber);
  const [cc, setCc] = useState<string>(initialDraft.cc);
  const [engineNo, setEngineNo] = useState<string>(initialDraft.engineNo);
  const [chassisNo, setChassisNo] = useState<string>(initialDraft.chassisNo);
  const [boughtYearBS, setBoughtYearBS] = useState<string>(initialDraft.boughtYearBS);
  const [odometerKm, setOdometerKm] = useState<string>(initialDraft.odometerKm);
  const [photoUrl, setPhotoUrl] = useState<string>(initialDraft.photoUrl);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prevents duplicate vehicle creation if user retries Finish Setup
  const createdBikeIdRef = useRef<number | null>(null);

  // Persist interrupted onboarding draft offline in localStorage
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      const draft: OnboardingDraft = {
        step,
        category,
        vehicleName,
        registrationNumber,
        cc,
        engineNo,
        chassisNo,
        boughtYearBS,
        odometerKm,
        photoUrl
      };
      localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      try {
        localStorage.setItem(
          ONBOARDING_DRAFT_KEY,
          JSON.stringify({
            step,
            category,
            vehicleName,
            registrationNumber,
            cc,
            engineNo,
            chassisNo,
            boughtYearBS,
            odometerKm,
            photoUrl: ''
          })
        );
      } catch {
        // ignore
      }
    }
  }, [step, category, vehicleName, registrationNumber, cc, engineNo, chassisNo, boughtYearBS, odometerKm, photoUrl]);

  const purchaseYearOptions = useMemo(() => {
    const maxYear = Math.max(todayBs.year + 1, 2085);
    const minYear = 2055;
    const opts: { value: string; label: string }[] = [];
    for (let yr = maxYear; yr >= minYear; yr--) {
      const adYr = computeAdYearFromBs(String(yr));
      opts.push({
        value: String(yr),
        label: `${yr} BS (${adYr} AD)`
      });
    }
    return opts;
  }, [todayBs.year]);

  const handleSelectLanguageOption = (nextLang: Language) => {
    setError(null);
    onLanguageChange?.(nextLang);
  };

  const handleSelectCategory = (nextCat: VehicleCategory) => {
    setCategory(nextCat);
    setError(null);
    const opt = VEHICLE_TYPE_META.find((v) => v.id === nextCat);
    if (opt) {
      if (nextCat === 'Electric' && (cc === '150' || cc === '125' || cc === '1200')) {
        setCc('');
      } else if (nextCat !== 'Electric' && (!cc || cc === '150' || cc === '125' || cc === '1200')) {
        setCc(opt.defaultCc);
      }
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        setPhotoUrl(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const validateStep = (targetStep: number): boolean => {
    setError(null);
    if (targetStep === 3) {
      if (!category) {
        setError(t.onboardingErrSelectType);
        return false;
      }
    } else if (targetStep === 4) {
      if (!vehicleName.trim()) {
        setError(t.errVehicleNameRequired);
        return false;
      }
      if (!registrationNumber.trim()) {
        setError(t.errRegNumberRequired);
        return false;
      }
      if (category !== 'Electric') {
        const ccNum = Number(cc);
        if (!cc.trim() || !Number.isFinite(ccNum) || ccNum <= 0) {
          setError(t.onboardingErrInvalidCc);
          return false;
        }
      } else if (cc.trim() && (!Number.isFinite(Number(cc)) || Number(cc) < 0)) {
        setError(t.onboardingErrNegativeCc);
        return false;
      }
    } else if (targetStep === 6) {
      if (odometerKm.trim() !== '') {
        const odoNum = Number(odometerKm);
        if (!Number.isFinite(odoNum) || odoNum < 0) {
          setError(t.errOdometerNonNegative);
          return false;
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(totalSteps, prev + 1));
  };

  const handleSkipIntro = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ONBOARDING_STATUS_KEY, 'skipped');
      localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    }
    if (onSkip) {
      onSkip();
    }
  };

  const handleFinish = async () => {
    if (isSubmitting) return;
    if (!validateStep(4) || !validateStep(6)) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const normalizedPlate = registrationNumber.trim().toUpperCase();
      const normalizedBsYear = boughtYearBS.trim() || String(todayBs.year);
      const normalizedAdYear = computeAdYearFromBs(normalizedBsYear);
      const parsedCc = cc.trim() ? Math.max(0, Number(cc)) : 0;
      const parsedOdo = odometerKm.trim() !== '' ? Math.max(0, Number(odometerKm)) : undefined;

      const bikePayload: Bike = {
        name: vehicleName.trim(),
        category,
        registrationNumber: normalizedPlate,
        boughtYearBS: normalizedBsYear,
        boughtYearAD: normalizedAdYear,
        cc: parsedCc,
        engineNo: engineNo.trim() ? engineNo.trim().toUpperCase() : '',
        chassisNo: chassisNo.trim() ? chassisNo.trim().toUpperCase() : '',
        photoUrl: photoUrl || undefined,
        isPrimary: true,
        createdDate: formatAdDate(new Date())
      };
      if (parsedOdo !== undefined) {
        bikePayload.odometerKm = parsedOdo;
      }

      const savedBike = await db.transaction('rw', db.bikes, async () => {
        const existingBikes = await db.bikes.toArray();

        // Guard against duplicate creation if user retries Finish Setup
        let targetId = createdBikeIdRef.current;
        if (targetId === null) {
          const match = existingBikes.find(
            (b) => b.registrationNumber.trim().toUpperCase() === normalizedPlate && b.name.trim() === bikePayload.name
          );
          if (match?.id) {
            targetId = match.id;
          }
        }

        // Demote any other existing primary flags cleanly
        for (const existing of existingBikes) {
          if (existing.id && existing.id !== targetId && existing.isPrimary) {
            await db.bikes.update(existing.id, { isPrimary: false });
          }
        }

        if (targetId !== null) {
          const updatedRecord: Bike = { ...bikePayload, id: targetId };
          await db.bikes.put(updatedRecord);
          return updatedRecord;
        }

        const newId = await db.bikes.add(bikePayload);
        createdBikeIdRef.current = newId;
        return { ...bikePayload, id: newId };
      });

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ONBOARDING_STATUS_KEY, 'completed');
        localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      }

      onComplete(savedBike);
    } catch (err: any) {
      setError(err?.message || t.onboardingErrSaveFailed);
      setIsSubmitting(false);
    }
  };

  const selectedTypeObj = VEHICLE_TYPE_META.find((v) => v.id === category) || VEHICLE_TYPE_META[0];
  const computedAdYear = computeAdYearFromBs(boughtYearBS);
  const setupStepNum = Math.max(1, step - 2);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] flex flex-col justify-between px-4 py-4 sm:p-6 pt-safe pb-safe max-w-md mx-auto">
      {/* Top Brand Bar & Progress Header (matches Dashboard Header branding) */}
      <header className="flex items-center justify-between gap-2 pt-1 pb-2 min-h-[44px] border-b border-[var(--color-border)]/70">
        <div className="flex items-center gap-2 min-w-0">
          {step > 1 && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep((prev) => prev - 1);
              }}
              aria-label={t.onboardingBack}
              className="w-9 h-9 rounded-xl bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-btn-secondary text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center justify-center transition active:translate-y-[1px] active:scale-[0.97] shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="min-w-0 flex items-center gap-2 sm:gap-2.5">
            <MeroBikeMark className="w-7 h-5 sm:w-8 sm:h-6 shrink-0" themeAware />
            <span className="leading-none truncate">
              <MeroBikeWordmark sizeClass="text-[17px] sm:text-xl" />
            </span>
          </div>
        </div>

        {/* Right: Step Progress (Steps 3..7) or Skip (Steps 1..2) */}
        {step >= 3 ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-[var(--color-surface-1)] border border-[var(--color-border)] clay-inset"
              aria-label={`Step ${setupStepNum} of ${setupTotalSteps}`}
            >
              {Array.from({ length: setupTotalSteps }).map((_, idx) => {
                const targetIdx = idx + 3;
                const isCompleted = targetIdx < step;
                const isCurrent = targetIdx === step;
                return (
                  <span
                    key={targetIdx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isCurrent
                        ? 'w-5 bg-[var(--color-accent)]'
                        : isCompleted
                        ? 'w-3 bg-[var(--color-accent)]/60'
                        : 'w-1.5 bg-[var(--color-surface-3)]'
                    }`}
                  />
                );
              })}
            </div>
            <span className="text-[11px] font-mono tabular-nums text-[var(--color-text-secondary)]">
              {setupStepNum}/{setupTotalSteps}
            </span>
          </div>
        ) : onSkip ? (
          <button
            type="button"
            onClick={handleSkipIntro}
            className="min-h-[36px] px-3 rounded-xl text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-1)] transition shrink-0"
          >
            {t.onboardingSkip}
          </button>
        ) : (
          <div />
        )}
      </header>

      {/* Main Step Viewport */}
      <main className="flex-1 flex flex-col justify-center py-4">
        {/* STEP 1 — LANGUAGE SELECTION */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-accent)]/40 clay-raised flex items-center justify-center text-[var(--color-accent)]">
                <Globe className="w-8 h-8 stroke-[1.9]" />
              </div>

              <div className="space-y-1.5">
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
                  {t.onboardingLangTitle}
                </h1>
                <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-xs mx-auto leading-relaxed">
                  {t.onboardingLangSubtitle}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {(
                [
                  {
                    id: 'en' as Language,
                    code: 'EN',
                    title: 'English',
                    desc: t.onboardingLangEnDesc
                  },
                  {
                    id: 'ne' as Language,
                    code: 'ने',
                    title: 'नेपाली',
                    desc: t.onboardingLangNeDesc
                  }
                ] as const
              ).map((langOpt) => {
                const isSelected = language === langOpt.id;
                return (
                  <button
                    key={langOpt.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectLanguageOption(langOpt.id)}
                    className={`w-full p-4 rounded-2xl border clay-raised-sm text-left transition-all flex items-center justify-between gap-3 active:translate-y-[1px] active:scale-[0.985] ${
                      isSelected
                        ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40'
                        : 'bg-[var(--color-surface-1)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0 ${
                          isSelected
                            ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-transparent clay-btn-primary'
                            : 'bg-[var(--color-surface-2)] text-[var(--color-accent)] border-[var(--color-border)] clay-inset'
                        }`}
                      >
                        {langOpt.code}
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-[var(--color-text-primary)]">
                          {langOpt.title}
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
                          {langOpt.desc}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="w-6 h-6 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2 — WELCOME */}
        {step === 2 && (
          <div className="space-y-6 text-center animate-in fade-in">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-accent)]/40 clay-raised flex items-center justify-center text-[var(--color-accent)]">
              <ShieldCheck className="w-9 h-9 stroke-[1.9]" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
                {t.onboardingWelcomeTitle}
              </h1>
              <p className="text-xs font-semibold tracking-wide text-[var(--color-accent)]">
                {t.appTagline}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] max-w-xs mx-auto leading-relaxed pt-0.5">
                {t.onboardingWelcomeDesc}
              </p>
            </div>

            <div className="space-y-2.5 text-left">
              <Card surface="raised-sm" padding="sm" className="flex items-center gap-3.5 p-3.5">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                  <Wrench className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)]">
                    {t.onboardingFeature1Title}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-secondary)]">
                    {t.onboardingFeature1Desc}
                  </div>
                </div>
              </Card>

              <Card surface="raised-sm" padding="sm" className="flex items-center gap-3.5 p-3.5">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)]">
                    {t.onboardingFeature2Title}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-secondary)]">
                    {t.onboardingFeature2Desc}
                  </div>
                </div>
              </Card>

              <Card surface="raised-sm" padding="sm" className="flex items-center gap-3.5 p-3.5">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)]">
                    {t.onboardingFeature3Title}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-secondary)]">
                    {t.onboardingFeature3Desc}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* STEP 3 — VEHICLE TYPE (Setup Step 1 of 4) */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                {formatMessage(t.onboardingStepOf, { current: 1, total: setupTotalSteps })}
              </span>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mt-0.5">
                {t.onboardingTypeTitle}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                {t.onboardingTypeSubtitle}
              </p>
            </div>

            <div className="space-y-2.5">
              {VEHICLE_TYPE_META.map((vt) => {
                const Icon = vt.Icon;
                const isSelected = category === vt.id;
                return (
                  <button
                    key={vt.id}
                    type="button"
                    onClick={() => handleSelectCategory(vt.id)}
                    className={`w-full p-3.5 rounded-2xl border clay-raised-sm text-left transition flex items-center justify-between gap-3 active:translate-y-[1px] active:scale-[0.985] ${
                      isSelected
                        ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40'
                        : 'bg-[var(--color-surface-1)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-transparent clay-btn-primary'
                            : 'bg-[var(--color-surface-2)] text-[var(--color-accent)] border-[var(--color-border)] clay-inset'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          {t[vt.labelKey]}
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] truncate">
                          {t[vt.descKey]}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="w-6 h-6 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4 — VEHICLE INFORMATION (Setup Step 2 of 4) */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                {formatMessage(t.onboardingStepOf, { current: 2, total: setupTotalSteps })}
              </span>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mt-0.5">
                {t.onboardingInfoTitle}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                {t.onboardingInfoSubtitle}
              </p>
            </div>

            <div className="space-y-3.5">
              <TextInput
                label={t.vehicleNameLabel}
                required
                placeholder={t.vehicleNamePlaceholder}
                value={vehicleName}
                onChange={(e) => {
                  setVehicleName(e.target.value);
                  if (error) setError(null);
                }}
              />

              <TextInput
                label={t.regNumberLabel}
                required
                placeholder={t.regNumberPlaceholder}
                value={registrationNumber}
                onChange={(e) => {
                  setRegistrationNumber(e.target.value);
                  if (error) setError(null);
                }}
                className="font-mono uppercase"
              />

              <SelectField
                label={t.vehicleCategoryLabel}
                searchable={false}
                value={category}
                onValueChange={(val) => handleSelectCategory(val as VehicleCategory)}
                options={VEHICLE_TYPE_META.map((v) => ({
                  value: v.id,
                  label: t[v.labelKey]
                }))}
              />

              <NumberInput
                label={
                  category === 'Electric'
                    ? t.engineMotorOptionalLabel
                    : t.engineCapacityRequiredLabel
                }
                required={category !== 'Electric'}
                unit="cc"
                min={0}
                placeholder={category === 'Electric' ? '0' : '150'}
                value={cc}
                onChange={(e) => {
                  setCc(e.target.value);
                  if (error) setError(null);
                }}
                hint={category === 'Electric' ? t.onboardingElectricHint : undefined}
              />
            </div>
          </div>
        )}

        {/* STEP 5 — REGISTRATION DETAILS (Setup Step 3 of 4) */}
        {step === 5 && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                {formatMessage(t.onboardingStepOf, { current: 3, total: setupTotalSteps })}
              </span>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mt-0.5">
                {t.onboardingRegDetailsTitle}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                {t.onboardingRegDetailsSubtitle}
              </p>
            </div>

            <div className="space-y-3.5">
              <TextInput
                label={t.engineNoOptional}
                placeholder="e.g. G3K4E098213"
                value={engineNo}
                onChange={(e) => setEngineNo(e.target.value)}
                className="font-mono uppercase"
              />

              <TextInput
                label={t.chassisNoOptional}
                placeholder="e.g. ME4RG4618N0014298"
                value={chassisNo}
                onChange={(e) => setChassisNo(e.target.value)}
                className="font-mono uppercase"
              />

              <SelectField
                label={t.onboardingPurchaseYearOptional}
                searchable
                searchPlaceholder={t.searchYearPlaceholder}
                value={boughtYearBS}
                onValueChange={(val) => setBoughtYearBS(val)}
                options={purchaseYearOptions}
                hint={formatMessage(t.onboardingSyncedTo, {
                  bs: boughtYearBS,
                  ad: computedAdYear
                })}
              />
            </div>
          </div>
        )}

        {/* STEP 6 — CURRENT VEHICLE STATUS (Setup Step 4 of 4) */}
        {step === 6 && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                {formatMessage(t.onboardingStepOf, { current: 4, total: setupTotalSteps })}
              </span>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mt-0.5">
                {t.onboardingStatusTitle}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                {t.onboardingStatusSubtitle}
              </p>
            </div>

            <div className="space-y-4">
              <NumberInput
                label={t.onboardingCurrentOdoLabel}
                unit="km"
                min={0}
                inputMode="numeric"
                placeholder={t.enterCurrentOdometer}
                value={odometerKm}
                onChange={(e) => {
                  setOdometerKm(e.target.value);
                  if (error) setError(null);
                }}
              />

              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-[var(--color-text-primary)]">
                  {t.onboardingVehiclePhotoOptional}
                </span>

                {photoUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-[var(--color-border)] clay-raised-sm h-40 bg-[var(--color-surface-1)]">
                    <VehicleImage
                      photoUrl={photoUrl}
                      name={vehicleName || 'Vehicle preview'}
                      variant="card"
                      blendToSurface="var(--color-surface-1)"
                      className="w-full h-full"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      aria-label={t.onboardingRemovePhoto}
                      className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-xl bg-black/75 text-white hover:text-[var(--color-error)] flex items-center justify-center transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[var(--color-surface-2)] border border-dashed border-[var(--color-border)] clay-inset hover:border-[var(--color-accent)] cursor-pointer transition group">
                    <Camera className="w-7 h-7 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition mb-2" />
                    <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                      {t.onboardingAddPhotoOptional}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                      {t.onboardingAddPhotoHint}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 7 — REVIEW & SAVE */}
        {step === 7 && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                {formatMessage(t.onboardingStepReview, { current: 5, total: setupTotalSteps })}
              </span>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mt-0.5">
                {t.onboardingReviewTitle}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                {t.onboardingReviewSubtitle}
              </p>
            </div>

            <Card padding="md" className="space-y-4">
              {/* Identity Header */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3 min-w-0">
                  <VehicleImage
                    photoUrl={photoUrl}
                    name={vehicleName}
                    variant="thumb"
                    className="w-12 h-12 rounded-2xl"
                  />
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                      {vehicleName.trim()}
                    </h3>
                    <div className="text-xs font-mono font-medium text-[var(--color-accent)] truncate">
                      {registrationNumber.trim().toUpperCase()}
                    </div>
                  </div>
                </div>
                <StatusBadge status="accent">{t.onboardingPrimaryVehicle}</StatusBadge>
              </div>

              {/* Section 1: Vehicle Info */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    {t.onboardingInfoTitle}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{t.onboardingEdit}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                    <span className="text-[10px] text-[var(--color-text-secondary)] block">
                      {t.onboardingCategoryLabel}
                    </span>
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {t[selectedTypeObj.labelKey]}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                    <span className="text-[10px] text-[var(--color-text-secondary)] block">
                      {t.onboardingCapacityLabel}
                    </span>
                    <span className="font-semibold font-mono tabular-nums text-[var(--color-text-primary)]">
                      {cc.trim() ? `${cc} cc` : category === 'Electric' ? 'EV' : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Registration Details */}
              <div className="space-y-1.5 pt-1 border-t border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    {t.onboardingRegDetailsTitle}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{t.onboardingEdit}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--color-text-secondary)]">{t.purchaseYear}:</span>
                    <span className="font-mono tabular-nums font-medium text-[var(--color-text-primary)]">
                      {boughtYearBS} BS ({computedAdYear} AD)
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--color-text-secondary)]">{t.engineNoOptional}:</span>
                    <span className="font-mono text-[var(--color-text-primary)]">
                      {engineNo.trim() ? engineNo.trim().toUpperCase() : t.onboardingNotProvided}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--color-text-secondary)]">{t.chassisNoOptional}:</span>
                    <span className="font-mono text-[var(--color-text-primary)]">
                      {chassisNo.trim() ? chassisNo.trim().toUpperCase() : t.onboardingNotProvided}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Status & Photo */}
              <div className="space-y-1.5 pt-1 border-t border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    {t.onboardingStatusTitle}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(6)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{t.onboardingEdit}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                    <span className="text-[10px] text-[var(--color-text-secondary)] block">
                      {t.odometerLabel}
                    </span>
                    <span className="font-semibold font-mono tabular-nums text-[var(--color-text-primary)]">
                      {odometerKm.trim() !== ''
                        ? `${Number(odometerKm).toLocaleString()} km`
                        : t.notRecorded}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                    <span className="text-[10px] text-[var(--color-text-secondary)] block">
                      {t.onboardingPhotoLabel}
                    </span>
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {photoUrl ? t.onboardingAttached : t.onboardingPhotoNone}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* Validation Error Banner */}
      {error && (
        <div className="p-3 mb-3 rounded-xl bg-[var(--color-error-subtle)] border border-[var(--color-error)]/40 text-[var(--color-error)] text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bottom Sticky Actions */}
      <footer className="pt-2 pb-2">
        {step === 1 ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => setStep(2)}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            {t.onboardingContinue}
          </Button>
        ) : step === 2 ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => setStep(3)}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            {t.onboardingGetStarted}
          </Button>
        ) : step < totalSteps ? (
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setError(null);
                setStep((prev) => prev - 1);
              }}
            >
              {t.onboardingBack}
            </Button>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleNext}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              {t.onboardingNext}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="lg"
              disabled={isSubmitting}
              onClick={() => {
                setError(null);
                setStep((prev) => prev - 1);
              }}
            >
              {t.onboardingBack}
            </Button>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmitting}
              onClick={handleFinish}
              leftIcon={<Save className="w-4 h-4" />}
            >
              {t.onboardingFinishSetup}
            </Button>
          </div>
        )}
      </footer>
    </div>
  );
};
