import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Wrench,
  ShieldCheck,
  FileText,
  Calendar,
  Settings as SettingsIcon,
  Plus,
  Bike as BikeIcon,
  ChevronRight,
  Shield,
  Gauge,
  Save,
  Edit2,
  Smartphone,
  LifeBuoy,
  X,
  Receipt,
  Activity,
  PhoneCall
} from 'lucide-react';
import { Bike, ServiceRecord, RenewalRecord, DocumentItem, AppSettings, TaxStatusResult, AppTheme } from './types';
import { db, seedInitialDataIfEmpty } from './db/db';
import { calculateNepalTaxStatus, getEstimatedBaseTax } from './utils/nepalTax';
import { formatBsDisplayDate, formatAdDisplayDate, diffDays, parseLocalCalendarDate } from './utils/nepaliCalendar';
import { dispatchDueNotifications, getMsUntilNextScheduledCheck } from './utils/notifications';
import { translations, formatMessage, Language } from './utils/translations';
import { THEMES, applyThemeTokens } from './utils/theme';
import { ServiceTracker } from './components/ServiceTracker';
import { TaxRenewalSystem } from './components/TaxRenewalSystem';
import { DocumentVault, getExpiringDocuments } from './components/DocumentVault';
import { BikeManagementModal } from './components/BikeManagementModal';
import { SettingsModal } from './components/SettingsModal';
import { PinLockModal } from './components/PinLockModal';
import { TrafficCheckModal } from './components/TrafficCheckModal';
import { EmergencyDirectoryModal } from './components/EmergencyDirectoryModal';
import { HomeWidgetCard } from './components/HomeWidgetCard';
import { SplashScreen } from './components/SplashScreen';
import { MyGarageSheet } from './components/MyGarageSheet';
import { MeroBikeMark, MeroBikeWordmark } from './components/MeroBikeLogo';
import { DashboardHeroCard } from './components/DashboardHeroCard';
import {
  FirstTimeSetup,
  ONBOARDING_DRAFT_KEY,
  ONBOARDING_STATUS_KEY
} from './components/FirstTimeSetup';
import {
  Button,
  Card,
  EmptyState,
  FullScreenSheet,
  IconButton,
  LoadingIndicator,
  StatusBadge
} from './components/ui';

function readCachedLanguage(): Language {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('sawaari_language') === 'ne'
      ? 'ne'
      : 'en';
  } catch {
    return 'en';
  }
}

function readCachedBikeId(): number {
  try {
    if (typeof localStorage === 'undefined') return 1;
    const raw = Number(localStorage.getItem('sawaari_selected_bike_id'));
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  } catch {
    return 1;
  }
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [language, setLanguage] = useState<Language>(readCachedLanguage);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'services' | 'tax' | 'vault' | 'settings'>('dashboard');

  // Database State
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [selectedBikeId, setSelectedBikeId] = useState<number>(readCachedBikeId);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [renewals, setRenewals] = useState<RenewalRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const cachedTheme = (typeof localStorage !== 'undefined' ? localStorage.getItem('sawaari_theme') : null) as AppTheme | null;
    return {
      isPinEnabled: false,
      isBiometricEnabled: false,
      language: readCachedLanguage(),
      theme: cachedTheme && THEMES[cachedTheme] ? cachedTheme : 'oled',
      autoLockMinutes: 0,
      notificationsEnabled: true,
      serviceRemindersEnabled: true,
      taxRemindersEnabled: true,
      documentExpiryRemindersEnabled: true
    };
  });

  // Security Lock
  const [isLocked, setIsLocked] = useState(false);

  // Slide-In Views & Sheets
  const [showBikeManager, setShowBikeManager] = useState(false);
  const [bikeManagerMode, setBikeManagerMode] = useState<'list' | 'add' | 'edit'>('list');
  const [bikeManagerEditId, setBikeManagerEditId] = useState<number | null>(null);
  const [showTrafficCheck, setShowTrafficCheck] = useState(false);
  const [showEmergencyDirectory, setShowEmergencyDirectory] = useState(false);
  const [showWidgetPreview, setShowWidgetPreview] = useState(false);

  const openDirectAddVehicle = () => {
    setBikeManagerEditId(null);
    setBikeManagerMode('add');
    setShowBikeManager(true);
  };

  const openVehicleProfile = (bike: Bike) => {
    setBikeManagerEditId(bike.id ?? null);
    setBikeManagerMode('edit');
    setShowBikeManager(true);
  };

  // Quick Inline Odometer State & Pending Increment Workflow
  const [isEditingOdoInline, setIsEditingOdoInline] = useState(false);
  const [inlineOdoInput, setInlineOdoInput] = useState<string>('');
  const [pendingOdoTotal, setPendingOdoTotal] = useState<number | null>(null);

  // Track whether user has entered/completed onboarding (persists across reloads when all vehicles are deleted)
  const [hasEnteredApp, setHasEnteredApp] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    const status = localStorage.getItem(ONBOARDING_STATUS_KEY);
    return status === 'completed' || status === 'skipped';
  });
  const [showMyGarage, setShowMyGarage] = useState(false);
  const hasInitializedBikeRef = useRef(false);
  const hasCheckedBootPinRef = useRef(false);
  const hiddenAtRef = useRef<number | null>(null);

  // Deep-Link Triggers from Dashboard Recent Activity
  const [selectedServiceTrigger, setSelectedServiceTrigger] = useState<{ id: number; ts: number } | null>(null);
  const [selectedRenewalTrigger, setSelectedRenewalTrigger] = useState<{ id: number; ts: number } | null>(null);

  // Apply semantic CSS tokens whenever active theme changes
  useEffect(() => {
    applyThemeTokens(settings.theme || 'oled');
  }, [settings.theme]);

  // Load database
  const loadData = async () => {
    try {
      await seedInitialDataIfEmpty().catch(() => {});

      const loadedBikes = await db.bikes.toArray().catch(() => []);
      setBikes(loadedBikes || []);

      if (loadedBikes && loadedBikes.length > 0) {
        setHasEnteredApp(true);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(ONBOARDING_STATUS_KEY, 'completed');
          localStorage.removeItem(ONBOARDING_DRAFT_KEY);
        }
      }

      // Select cached or primary bike on initial boot, or preserve valid user selection
      let currentId = selectedBikeId;
      if (loadedBikes && loadedBikes.length > 0) {
        if (!hasInitializedBikeRef.current || !loadedBikes.some(b => b.id === currentId)) {
          const cachedId = readCachedBikeId();
          const preferred =
            loadedBikes.find(b => b.id === cachedId) ||
            loadedBikes.find(b => b.isPrimary) ||
            loadedBikes[0];
          currentId = preferred?.id ?? 1;
          hasInitializedBikeRef.current = true;
          try {
            localStorage.setItem('sawaari_selected_bike_id', String(currentId));
          } catch {
            // ignore storage errors
          }
          if (currentId !== selectedBikeId) {
            setSelectedBikeId(currentId);
          }
        }
      } else {
        hasInitializedBikeRef.current = false;
        try {
          localStorage.removeItem('sawaari_selected_bike_id');
        } catch {
          // ignore storage errors
        }
      }

      // Load records for selected bike & settings
      let loadedServices: ServiceRecord[] = [];
      let loadedRenewals: RenewalRecord[] = [];
      let loadedDocs: DocumentItem[] = [];
      if (loadedBikes && loadedBikes.length > 0 && currentId) {
        loadedServices = await db.services.where('bikeId').equals(currentId).toArray().catch(() => []);
        setServices(loadedServices || []);

        loadedRenewals = await db.renewals.where('bikeId').equals(currentId).toArray().catch(() => []);
        setRenewals(loadedRenewals || []);

        loadedDocs = await db.documents.where('bikeId').equals(currentId).toArray().catch(() => []);
        setDocuments(loadedDocs || []);
      } else {
        setServices([]);
        setRenewals([]);
        setDocuments([]);
      }

      // Settings
      let resolvedSettings: AppSettings;
      const savedSettings = await db.settings.get('app_settings').catch(() => null);
      if (savedSettings && savedSettings.value) {
        const nextLang: Language = savedSettings.value.language === 'ne' ? 'ne' : 'en';
        const nextTheme: AppTheme =
          savedSettings.value.theme && THEMES[savedSettings.value.theme as AppTheme]
            ? savedSettings.value.theme
            : 'oled';
        resolvedSettings = {
          isPinEnabled: Boolean(savedSettings.value.isPinEnabled),
          pinHash: savedSettings.value.pinHash,
          isBiometricEnabled: false,
          language: nextLang,
          theme: nextTheme,
          autoLockMinutes: typeof savedSettings.value.autoLockMinutes === 'number' ? savedSettings.value.autoLockMinutes : 0,
          notificationsEnabled: savedSettings.value.notificationsEnabled !== false,
          serviceRemindersEnabled: savedSettings.value.serviceRemindersEnabled !== false,
          taxRemindersEnabled: savedSettings.value.taxRemindersEnabled !== false,
          documentExpiryRemindersEnabled: savedSettings.value.documentExpiryRemindersEnabled !== false
        };
        setSettings(resolvedSettings);
        setLanguage(nextLang);
        try {
          localStorage.setItem('sawaari_language', nextLang);
          localStorage.setItem('sawaari_theme', nextTheme);
        } catch {
          // ignore storage errors
        }
        if (!hasCheckedBootPinRef.current) {
          hasCheckedBootPinRef.current = true;
          if (resolvedSettings.isPinEnabled && resolvedSettings.pinHash) {
            setIsLocked(true);
          }
        }
      } else {
        // Fresh or post-reset defaults (preserves any cached onboarding language selection, resets cleanly when cleared)
        const cachedLang = readCachedLanguage();
        const cachedThemeRaw = (
          typeof localStorage !== 'undefined' ? localStorage.getItem('sawaari_theme') : null
        ) as AppTheme | null;
        const nextTheme: AppTheme = cachedThemeRaw && THEMES[cachedThemeRaw] ? cachedThemeRaw : 'oled';
        resolvedSettings = {
          isPinEnabled: false,
          isBiometricEnabled: false,
          language: cachedLang,
          theme: nextTheme,
          autoLockMinutes: 0,
          notificationsEnabled: true,
          serviceRemindersEnabled: true,
          taxRemindersEnabled: true,
          documentExpiryRemindersEnabled: true
        };
        setSettings(resolvedSettings);
        setLanguage(cachedLang);
        setIsLocked(false);
        hasCheckedBootPinRef.current = true;
      }

      // Evaluate & dispatch due maintenance, tax & document expiry notifications across all vehicles
      if (loadedBikes && loadedBikes.length > 0 && resolvedSettings.notificationsEnabled !== false) {
        const [allServices, allRenewals, allDocs] = await Promise.all([
          db.services.toArray().catch(() => loadedServices),
          db.renewals.toArray().catch(() => loadedRenewals),
          db.documents.toArray().catch(() => loadedDocs)
        ]);
        void dispatchDueNotifications({
          bikes: loadedBikes,
          services: allServices,
          renewals: allRenewals,
          documents: allDocs,
          settings: resolvedSettings,
          language: resolvedSettings.language
        });
      }
    } catch (err) {
      console.error('Database load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBikeId]);

  // Schedule next foreground/rollover reminder evaluation & re-evaluate when app resumes
  useEffect(() => {
    if (bikes.length === 0 || settings.notificationsEnabled === false) return;

    let timerId: number | null = null;

    const runCheck = async () => {
      try {
        const [allBikes, allServices, allRenewals, allDocs] = await Promise.all([
          db.bikes.toArray(),
          db.services.toArray(),
          db.renewals.toArray(),
          db.documents.toArray()
        ]);
        await dispatchDueNotifications({
          bikes: allBikes,
          services: allServices,
          renewals: allRenewals,
          documents: allDocs,
          settings,
          language
        });
      } catch {
        // ignore evaluation errors
      }
    };

    const scheduleNext = () => {
      if (timerId !== null) window.clearTimeout(timerId);
      const delay = getMsUntilNextScheduledCheck();
      timerId = window.setTimeout(() => {
        void runCheck().finally(scheduleNext);
      }, delay);
    };

    scheduleNext();

    const handleResumeCheck = () => {
      if (document.visibilityState === 'visible') {
        void runCheck();
      }
    };

    document.addEventListener('visibilitychange', handleResumeCheck);
    return () => {
      if (timerId !== null) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleResumeCheck);
    };
  }, [bikes.length, settings, language]);

  // Enforce Auto-Lock Timeout when returning from background
  useEffect(() => {
    if (!settings.isPinEnabled || !settings.pinHash) {
      hiddenAtRef.current = null;
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
      } else if (document.visibilityState === 'visible' && hiddenAtRef.current !== null) {
        const elapsedMs = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        const limitMs = (settings.autoLockMinutes ?? 0) * 60 * 1000;
        if (elapsedMs >= limitMs) {
          setIsLocked(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [settings.isPinEnabled, settings.pinHash, settings.autoLockMinutes]);

  // Reset transient inline odometer states when active vehicle changes
  useEffect(() => {
    setPendingOdoTotal(null);
    setIsEditingOdoInline(false);
  }, [selectedBikeId]);

  const activeBike = bikes.find(b => b.id === selectedBikeId) || bikes[0];
  const t = translations[language];
  const currentTheme = THEMES[settings.theme || 'oled'] || THEMES.oled;

  // Sync inline odo input when active bike changes
  useEffect(() => {
    if (activeBike) {
      setInlineOdoInput(
        typeof activeBike.odometerKm === 'number' && Number.isFinite(activeBike.odometerKm)
          ? String(activeBike.odometerKm)
          : ''
      );
    }
  }, [activeBike?.id, activeBike?.odometerKm]);

  // Real Tax Calculations (no invented fallback dates)
  const sortedRenewals = [...renewals].sort(
    (a, b) => new Date(b.validUntilAD).getTime() - new Date(a.validUntilAD).getTime()
  );
  const latestRenewal = sortedRenewals[0];
  const baseTax = activeBike ? getEstimatedBaseTax(activeBike.cc, activeBike.category) : 6500;
  const taxStatus: TaxStatusResult = latestRenewal
    ? calculateNepalTaxStatus(latestRenewal.validUntilAD, baseTax)
    : {
        status: 'EXPIRED',
        badgeLabel: 'NOT RECORDED',
        badgeColor: 'rose',
        daysRemaining: 0,
        daysOverdue: 0,
        daysLeftInGrace: 0,
        fineMultiplierPercent: 0,
        estimatedFineAmount: 0,
        message: t.taxNotRecordedMsg,
        reminderAlert: 'none'
      };

  // Real Next Service Calculations (no invented targets if not recorded)
  const sortedServices = [...services].sort(
    (a, b) => new Date(b.serviceDateAD).getTime() - new Date(a.serviceDateAD).getTime()
  );
  const latestService = sortedServices[0];
  const recordedNextKm =
    latestService && typeof latestService.nextServiceKm === 'number' && latestService.nextServiceKm > 0
      ? latestService.nextServiceKm
      : null;
  const kmRemaining =
    recordedNextKm !== null && activeBike && typeof activeBike.odometerKm === 'number'
      ? recordedNextKm - activeBike.odometerKm
      : null;

  const effectiveNextServiceDate = (() => {
    if (!latestService?.nextServiceDateAD) return null;
    const base = parseLocalCalendarDate(latestService.nextServiceDateAD);
    if (isNaN(base.getTime())) return null;
    const snooze = latestService.snoozeDays || 0;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + snooze, 12, 0, 0);
  })();

  const expiringDocuments = getExpiringDocuments(documents, language);

  const daysUntilService = effectiveNextServiceDate
    ? diffDays(effectiveNextServiceDate, new Date())
    : null;

  const hasMaintenanceSchedule = Boolean(
    latestService && (recordedNextKm !== null || effectiveNextServiceDate !== null)
  );
  const isMaintenanceOverdue =
    hasMaintenanceSchedule &&
    ((kmRemaining !== null && kmRemaining <= 0) || (daysUntilService !== null && daysUntilService <= 0));
  const isMaintenanceDueSoon =
    hasMaintenanceSchedule &&
    !isMaintenanceOverdue &&
    ((kmRemaining !== null && kmRemaining <= 500) || (daysUntilService !== null && daysUntilService <= 15));

  // Chronological Merged Recent Activity (Maintenance + Tax Renewals only)
  const recentActivities = [
    ...services.map(s => ({
      id: s.id,
      kind: 'service' as const,
      sortDate: s.serviceDateAD,
      dateBS: s.serviceDateBS,
      dateAD: s.serviceDateAD,
      typeLabel: t.maintenanceTypeLabel,
      description: s.workDone || s.serviceCenter || t.serviceVisitFallback,
      amount: s.cost,
      odometerKm: s.odometerKm
    })),
    ...renewals.map(r => ({
      id: r.id,
      kind: 'tax' as const,
      sortDate: r.renewedDateAD || r.validUntilAD,
      dateBS: r.renewedDateBS || r.validUntilBS,
      dateAD: r.renewedDateAD || r.validUntilAD,
      typeLabel: t.taxRenewalTypeLabel,
      description: r.officeLocation
        ? r.officeLocation
        : formatMessage(t.validUntilPrefix, { date: formatBsDisplayDate(r.validUntilAD, language) }),
      amount: r.totalPaid || r.taxAmount,
      odometerKm: undefined as number | undefined
    }))
  ]
    .sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
    .slice(0, 4);

  // Quick Inline Odometer Pending Workflow (+100, +500, +1000, +3000)
  const handleQuickAddOdo = (deltaKm: number) => {
    if (!activeBike) return;
    const current = pendingOdoTotal !== null ? pendingOdoTotal : (activeBike.odometerKm || 0);
    setPendingOdoTotal(current + deltaKm);
  };

  const handleCommitPendingOdo = async () => {
    if (!activeBike?.id || pendingOdoTotal === null) return;
    await db.bikes.update(activeBike.id, { odometerKm: Number(pendingOdoTotal) });
    setPendingOdoTotal(null);
    loadData();
  };

  const handleCancelPendingOdo = () => {
    setPendingOdoTotal(null);
  };

  const handleSaveInlineOdo = async () => {
    if (!activeBike?.id) return;
    const trimmed = inlineOdoInput.trim();
    if (trimmed === '') {
      const updatedBike = { ...activeBike };
      delete updatedBike.odometerKm;
      await db.bikes.put(updatedBike);
    } else {
      const num = Number(trimmed);
      if (!Number.isFinite(num) || num < 0) return;
      await db.bikes.update(activeBike.id, { odometerKm: num });
    }
    setIsEditingOdoInline(false);
    setPendingOdoTotal(null);
    loadData();
  };

  const handleSelectVehicle = (bikeId: number) => {
    setSelectedBikeId(bikeId);
    hasInitializedBikeRef.current = true;
    try {
      localStorage.setItem('sawaari_selected_bike_id', String(bikeId));
    } catch {
      // ignore storage errors
    }
  };

  const handleLanguageChange = async (nextLang: Language) => {
    const updated: AppSettings = { ...settings, language: nextLang };
    setLanguage(nextLang);
    setSettings(updated);
    try {
      localStorage.setItem('sawaari_language', nextLang);
    } catch {
      // ignore storage errors
    }
    await db.settings.put({ key: 'app_settings', value: updated });
  };

  // 1. Splash Screen Display (holds until local DB/settings/bikes initialize + smooth fade)
  if (showSplash) {
    return (
      <SplashScreen
        isReady={!loading}
        tagline={t.appTagline}
        language={language}
        onFinish={() => setShowSplash(false)}
      />
    );
  }

  // 2. Fallback Loading State (if splash already dismissed while loading)
  if (loading) {
    return (
      <LoadingIndicator
        fullScreen
        brandTitle="Mero Bike (मेरो बाइक)"
        label={t.loadingOfflineJournal}
      />
    );
  }

  // 3. First-Time Setup Flow on fresh installation or interrupted onboarding (never forced on returning users)
  if (bikes.length === 0 && !hasEnteredApp) {
    return (
      <FirstTimeSetup
        onComplete={(newBike) => {
          setHasEnteredApp(true);
          handleSelectVehicle(newBike.id || 1);
          loadData();
        }}
        onSkip={() => {
          setHasEnteredApp(true);
        }}
        language={language}
        onLanguageChange={handleLanguageChange}
      />
    );
  }

  const navItems: {
    id: 'dashboard' | 'services' | 'tax' | 'vault' | 'settings';
    label: string;
    mobileLabel: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    {
      id: 'dashboard',
      label: t.navHome,
      mobileLabel: t.navHome,
      icon: Home
    },
    {
      id: 'services',
      label: t.navMaintenance,
      mobileLabel: language === 'ne' ? t.navMaintenance : 'Service',
      icon: Wrench
    },
    {
      id: 'tax',
      label: t.navTax,
      mobileLabel: t.navTax,
      icon: ShieldCheck
    },
    {
      id: 'vault',
      label: t.navDocuments,
      mobileLabel: language === 'ne' ? t.navDocuments : 'Docs',
      icon: FileText
    },
    {
      id: 'settings',
      label: t.navSettings,
      mobileLabel: t.navSettings,
      icon: SettingsIcon
    }
  ];

  return (
    <div className={`min-h-screen ${currentTheme.bgClass} flex flex-col pb-24 md:pb-8 select-none font-sans transition-colors duration-200 overflow-x-hidden`}>
      
      {/* Optional PIN Lock Overlay */}
      {isLocked && settings.pinHash && (
        <PinLockModal
          storedPinHash={settings.pinHash}
          isBiometricEnabled={settings.isBiometricEnabled}
          onUnlocked={() => setIsLocked(false)}
          language={language}
        />
      )}

      {/* Global Top Application Header with Unified Logo & Compact Language Toggle (Vehicle selector moved to My Garage) */}
      <div className="sticky top-0 z-30">
        <header className="relative z-20 bg-[var(--color-surface-1)] px-3 sm:px-4 py-2 border-b border-[var(--color-border)] clay-topbar pt-safe">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            {/* Left: Brand Symbol & Official Wordmark ("Mero Bike") */}
            <div className="min-w-0 flex items-center gap-2 sm:gap-2.5">
              <MeroBikeMark className="w-7 h-5 sm:w-8 sm:h-6 shrink-0" themeAware />
              <h1 className="leading-none truncate">
                <MeroBikeWordmark sizeClass="text-[17px] sm:text-xl" />
              </h1>
            </div>

            {/* Right: Compact Segmented Language Toggle (EN | ने) */}
            <div className="flex items-center shrink-0">
              <div
                role="group"
                aria-label="Language"
                className="inline-flex items-center p-0.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset shrink-0"
              >
                <button
                  type="button"
                  aria-pressed={language === 'en'}
                  aria-label="Switch to English"
                  onClick={() => void handleLanguageChange('en')}
                  className={`min-h-[34px] min-w-[34px] px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold leading-none transition-all duration-150 flex items-center justify-center active:scale-[0.97] ${
                    language === 'en'
                      ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] clay-btn-primary'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  aria-pressed={language === 'ne'}
                  aria-label="नेपाली भाषा छान्नुहोस्"
                  onClick={() => void handleLanguageChange('ne')}
                  className={`min-h-[34px] min-w-[34px] px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold leading-none transition-all duration-150 flex items-center justify-center active:scale-[0.97] ${
                    language === 'ne'
                      ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] clay-btn-primary'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  ने
                </button>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 sm:p-5 space-y-4">

        {/* Desktop Horizontal Navigation (Exactly 5 Primary Destinations) */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-1.5 p-1.5 bg-[var(--color-surface-1)] rounded-2xl border border-[var(--color-border)] clay-raised-sm"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 min-h-[42px] py-2 px-3 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition duration-150 flex items-center justify-center gap-2 ${
                  isActive
                    ? 'bg-[var(--color-surface-2)] text-[var(--color-accent)] border border-[var(--color-accent)]/45 clay-raised-sm'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]/60 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* EMPTY DASHBOARD (When no vehicle exists and not viewing Settings) */}
        {(!activeBike || bikes.length === 0) && activeTab !== 'settings' && (
          <div className="py-6 animate-in fade-in">
            <EmptyState
              icon={<BikeIcon className="w-6 h-6 text-[var(--color-accent)]" />}
              title={t.emptyDashboardTitle}
              description={t.emptyDashboardDesc}
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="primary"
                    pill
                    size="md"
                    onClick={openDirectAddVehicle}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    {t.addVehicle}
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      if (typeof localStorage !== 'undefined') {
                        localStorage.removeItem(ONBOARDING_STATUS_KEY);
                      }
                      setHasEnteredApp(false);
                    }}
                  >
                    {t.guidedSetup}
                  </Button>
                </div>
              }
            />
          </div>
        )}

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && activeBike && (
          <div className="space-y-3.5 animate-in fade-in duration-150 select-none">

            {/* 1. Split-Layout Vehicle Hero Card (Interactive Entry Point to My Garage & View Profile) */}
            <DashboardHeroCard
              bike={activeBike}
              language={language}
              onOpenGarage={() => setShowMyGarage(true)}
              onViewProfile={() => openVehicleProfile(activeBike)}
            />

            {/* 2. Summary Metric Cards (2 Columns: Next Service & Tax Renewal — Real Data Only) */}
            <div className="grid grid-cols-2 gap-3">
              {/* Next Service Card */}
              <Card
                variant="interactive"
                surface="raised-sm"
                padding="md"
                onClick={() => setActiveTab('services')}
                className="flex flex-col justify-between space-y-2.5 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                    <Wrench className="w-4 h-4 stroke-[2]" />
                  </div>
                  <StatusBadge
                    status={
                      !hasMaintenanceSchedule
                        ? 'neutral'
                        : isMaintenanceOverdue
                        ? 'error'
                        : isMaintenanceDueSoon
                        ? 'warning'
                        : 'success'
                    }
                  >
                    <span>
                      {!hasMaintenanceSchedule
                        ? t.emptyBadge
                        : isMaintenanceOverdue
                        ? t.overdueBadge
                        : isMaintenanceDueSoon
                        ? t.dueSoonBadge
                        : t.onTrackBadge}
                    </span>
                  </StatusBadge>
                </div>

                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {t.nextServiceLabel}
                  </div>

                  {hasMaintenanceSchedule ? (
                    <div className="mt-0.5 space-y-0.5">
                      {recordedNextKm !== null && (
                        <div className="text-base sm:text-lg font-semibold font-mono tabular-nums text-[var(--color-text-primary)] truncate">
                          {recordedNextKm.toLocaleString()} km
                        </div>
                      )}
                      {effectiveNextServiceDate && (
                        <div className="text-xs font-mono tabular-nums font-medium text-[var(--color-text-secondary)] truncate">
                          {formatBsDisplayDate(effectiveNextServiceDate, language)}
                        </div>
                      )}
                      <div className="text-xs font-mono tabular-nums font-medium pt-0.5">
                        {kmRemaining !== null ? (
                          kmRemaining > 0 ? (
                            <span className={isMaintenanceDueSoon ? 'text-[var(--color-warning)]' : 'text-[var(--color-accent)]'}>
                              {kmRemaining.toLocaleString()} {t.kmLeft}
                            </span>
                          ) : (
                            <span className="text-[var(--color-error)]">
                              {formatMessage(t.kmOverdueText, { km: Math.abs(kmRemaining).toLocaleString() })}
                            </span>
                          )
                        ) : daysUntilService !== null ? (
                          daysUntilService > 0 ? (
                            <span className={isMaintenanceDueSoon ? 'text-[var(--color-warning)]' : 'text-[var(--color-accent)]'}>
                              {daysUntilService} {t.daysLeft}
                            </span>
                          ) : (
                            <span className="text-[var(--color-error)]">
                              {t.dueNowText}
                            </span>
                          )
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 space-y-1">
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {t.notRecorded}
                      </div>
                      <div className="text-xs font-semibold text-[var(--color-accent)]">
                        {t.logServiceLink}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Tax Renewal Card */}
              <Card
                variant="interactive"
                surface="raised-sm"
                padding="md"
                onClick={() => setActiveTab('tax')}
                className="flex flex-col justify-between space-y-2.5 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                    <Calendar className="w-4 h-4 stroke-[2]" />
                  </div>
                  <StatusBadge
                    status={
                      !latestRenewal
                        ? 'neutral'
                        : taxStatus.status === 'VALID'
                        ? taxStatus.daysRemaining <= 30
                          ? 'warning'
                          : 'success'
                        : taxStatus.status === 'GRACE_PERIOD'
                        ? 'warning'
                        : 'error'
                    }
                  >
                    <span>
                      {!latestRenewal
                        ? t.emptyBadge
                        : taxStatus.status === 'VALID'
                        ? taxStatus.daysRemaining <= 30
                          ? t.dueSoonBadge
                          : t.validBadge
                        : taxStatus.status === 'GRACE_PERIOD'
                        ? t.graceBadge
                        : t.expiredBadge}
                    </span>
                  </StatusBadge>
                </div>

                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {t.taxRenewalLabel}
                  </div>

                  {latestRenewal ? (
                    <div className="mt-0.5 space-y-0.5">
                      <div className="text-base sm:text-lg font-semibold font-mono tabular-nums text-[var(--color-text-primary)] truncate">
                        {formatBsDisplayDate(latestRenewal.validUntilAD, language)}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-[var(--color-text-secondary)] truncate">
                        {formatAdDisplayDate(latestRenewal.validUntilAD)}
                      </div>
                      <div className="text-xs font-mono tabular-nums font-medium pt-0.5">
                        {taxStatus.status === 'VALID' ? (
                          <span className={taxStatus.daysRemaining <= 30 ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}>
                            {taxStatus.daysRemaining} {t.daysLeft}
                          </span>
                        ) : taxStatus.status === 'GRACE_PERIOD' ? (
                          <span className="text-[var(--color-warning)]">
                            {taxStatus.daysLeftInGrace} {t.graceDaysLeftText}
                          </span>
                        ) : (
                          <span className="text-[var(--color-error)]">
                            {taxStatus.daysOverdue} {t.daysOverdueText}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 space-y-1">
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {t.notRecorded}
                      </div>
                      <div className="text-xs font-semibold text-[var(--color-accent)]">
                        {t.logTaxLink}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Contextual Document Expiry Warning (Shown only when insurance or other docs are expired / expiring within 30 days) */}
            {expiringDocuments.length > 0 && (
              <Card
                variant="interactive"
                padding="md"
                onClick={() => setActiveTab('vault')}
                className={`flex items-center justify-between gap-3 ${
                  expiringDocuments.some((d) => d.expiry.status === 'expired')
                    ? 'border-[var(--color-error)]/45'
                    : 'border-[var(--color-warning)]/45'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      expiringDocuments.some((d) => d.expiry.status === 'expired')
                        ? 'bg-[var(--color-error-subtle)] text-[var(--color-error)]'
                        : 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]'
                    }`}
                  >
                    <FileText className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {expiringDocuments[0].doc.title}
                      </span>
                      <StatusBadge status={expiringDocuments[0].expiry.semantic} className="shrink-0">
                        <span>{expiringDocuments[0].expiry.label}</span>
                      </StatusBadge>
                    </div>
                    <p className="text-[11px] font-mono tabular-nums text-[var(--color-text-secondary)] truncate mt-0.5">
                      {expiringDocuments[0].doc.expiryDate
                        ? `${formatBsDisplayDate(expiringDocuments[0].doc.expiryDate, language)} (${formatAdDisplayDate(expiringDocuments[0].doc.expiryDate)})`
                        : ''}
                      {expiringDocuments.length > 1
                        ? language === 'ne'
                          ? ` · +${expiringDocuments.length - 1} अन्य कागजात`
                          : ` · +${expiringDocuments.length - 1} more document(s)`
                        : ''}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] shrink-0" />
              </Card>
            )}

            {/* 3. Recent Activity (Real Maintenance & Renewal Rows Opening Detail/Edit) */}
            <Card variant="primary" padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {t.recentActivity}
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab(services.length > 0 || renewals.length === 0 ? 'services' : 'tax')}
                  className="text-xs font-semibold text-[var(--color-accent)] hover:underline py-1"
                >
                  {t.viewAllArrow}
                </button>
              </div>

              <div className="space-y-2">
                {recentActivities.length > 0 ? (
                  recentActivities.map(item => (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      onClick={() => {
                        if (item.kind === 'service' && item.id) {
                          setActiveTab('services');
                          setSelectedServiceTrigger({ id: item.id, ts: Date.now() });
                        } else if (item.kind === 'tax' && item.id) {
                          setActiveTab('tax');
                          setSelectedRenewalTrigger({ id: item.id, ts: Date.now() });
                        }
                      }}
                      className="w-full p-3 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] transition duration-150 flex items-center justify-between gap-3 text-left active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent)] shrink-0">
                          {item.kind === 'service' ? (
                            <Wrench className="w-4 h-4 stroke-[2]" />
                          ) : (
                            <Receipt className="w-4 h-4 stroke-[2]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)] shrink-0">
                              {item.typeLabel}
                            </span>
                            <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                              · {item.description}
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--color-text-secondary)] font-mono tabular-nums truncate mt-0.5">
                            {formatBsDisplayDate(item.dateAD, language)}
                            {item.odometerKm !== undefined ? ` · ${item.odometerKm.toLocaleString()} km` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.amount > 0 && (
                          <span className="text-xs font-mono tabular-nums font-semibold text-[var(--color-text-primary)]">
                            Rs. {item.amount.toLocaleString()}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-center text-xs text-[var(--color-text-secondary)]">
                    {t.noRecentActivity}
                  </div>
                )}
              </div>
            </Card>

            {/* 4. Quick Odometer Inline Updater */}
            <Card variant="primary" padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-[var(--color-accent)]" />
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
                    {t.quickOdometer}
                  </span>
                </div>

                <IconButton
                  size="sm"
                  onClick={() => setIsEditingOdoInline(!isEditingOdoInline)}
                  title={t.editOdometer}
                  aria-label={t.editOdometer}
                >
                  {isEditingOdoInline ? <X className="w-4 h-4 text-[var(--color-accent)]" /> : <Edit2 className="w-4 h-4 text-[var(--color-accent)]" />}
                </IconButton>
              </div>

              {isEditingOdoInline ? (
                <div className="flex items-center gap-2 animate-in fade-in">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder={t.enterCurrentOdometer}
                    value={inlineOdoInput}
                    onChange={(e) => setInlineOdoInput(e.target.value)}
                    className="flex-1 min-h-[44px] bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset rounded-xl px-3.5 py-2 text-sm font-mono tabular-nums font-semibold text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/60 placeholder:font-sans focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
                  />
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSaveInlineOdo}
                    title={t.saveKm}
                    aria-label="Save KM"
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    <span>{t.saveShort}</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-2xl font-semibold text-[var(--color-text-primary)] font-mono tabular-nums tracking-tight">
                        {pendingOdoTotal !== null ? (
                          <>
                            {pendingOdoTotal.toLocaleString()}{' '}
                            <span className="text-xs font-medium text-[var(--color-text-secondary)] font-sans">KM</span>
                          </>
                        ) : typeof activeBike.odometerKm === 'number' ? (
                          <>
                            {activeBike.odometerKm.toLocaleString()}{' '}
                            <span className="text-xs font-medium text-[var(--color-text-secondary)] font-sans">KM</span>
                          </>
                        ) : (
                          <span className="text-sm font-sans font-medium text-[var(--color-text-secondary)]">
                            {t.notRecordedLower}
                          </span>
                        )}
                      </div>
                      {pendingOdoTotal !== null && (
                        <StatusBadge status="accent">
                          <span className="font-mono tabular-nums">+{pendingOdoTotal - (activeBike.odometerKm || 0)} KM</span>
                        </StatusBadge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      {[100, 500, 1000, 3000].map(delta => (
                        <button
                          key={delta}
                          type="button"
                          onClick={() => handleQuickAddOdo(delta)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] clay-btn-secondary text-xs font-mono tabular-nums font-semibold text-[var(--color-text-primary)] transition duration-150 active:translate-y-[1px] active:scale-[0.97] shrink-0"
                        >
                          +{delta}
                        </button>
                      ))}
                    </div>
                  </div>

                  {pendingOdoTotal !== null && (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-accent)]/40 animate-in fade-in duration-150">
                      <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                        {t.confirmNewOdo}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <IconButton
                          size="sm"
                          onClick={handleCancelPendingOdo}
                          aria-label={t.cancel}
                        >
                          <X className="w-4 h-4" />
                        </IconButton>
                        <Button
                          size="sm"
                          onClick={handleCommitPendingOdo}
                          leftIcon={<Save className="w-3.5 h-3.5" />}
                        >
                          <span>{t.saveShort}</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* 5. Emergency Hotlines Grid */}
            <Card variant="primary" padding="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LifeBuoy className="w-4 h-4 text-[var(--color-error)]" />
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
                    {t.emergencyHotlinesShort}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmergencyDirectory(true)}
                  className="text-xs text-[var(--color-accent)] font-semibold hover:underline py-1"
                >
                  {t.viewAll}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                <a
                  href="tel:103"
                  className="p-3 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] clay-btn-secondary flex items-center justify-between gap-2 active:translate-y-[1px] active:scale-[0.98] transition duration-150"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-[var(--color-accent)] uppercase truncate">
                      {t.trafficLabel}
                    </div>
                    <div className="text-base font-semibold font-mono tabular-nums text-[var(--color-text-primary)]">103</div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                </a>

                <a
                  href="tel:102"
                  className="p-3 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] clay-btn-secondary flex items-center justify-between gap-2 active:translate-y-[1px] active:scale-[0.98] transition duration-150"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-[var(--color-error)] uppercase truncate">
                      {t.ambulanceLabel}
                    </div>
                    <div className="text-base font-semibold font-mono tabular-nums text-[var(--color-text-primary)]">102</div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-error-subtle)] text-[var(--color-error)] flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4" />
                  </div>
                </a>

                <a
                  href="tel:100"
                  className="p-3 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] clay-btn-secondary flex items-center justify-between gap-2 active:translate-y-[1px] active:scale-[0.98] transition duration-150"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase truncate">
                      {t.policeLabel}
                    </div>
                    <div className="text-base font-semibold font-mono tabular-nums text-[var(--color-text-primary)]">100</div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-3)] text-[var(--color-text-primary)] flex items-center justify-center shrink-0">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                </a>

                <a
                  href="tel:1144"
                  className="p-3 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] clay-btn-secondary flex items-center justify-between gap-2 active:translate-y-[1px] active:scale-[0.98] transition duration-150"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-[var(--color-warning)] uppercase truncate">
                      {t.towingLabel}
                    </div>
                    <div className="text-base font-semibold font-mono tabular-nums text-[var(--color-text-primary)]">1144</div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-warning-subtle)] text-[var(--color-warning)] flex items-center justify-center shrink-0">
                    <Wrench className="w-4 h-4" />
                  </div>
                </a>
              </div>
            </Card>

          </div>
        )}

        {/* TAB 2: MAINTENANCE */}
        {activeTab === 'services' && activeBike && (
          <div className="animate-in fade-in">
            <ServiceTracker
              key={`services-${activeBike.id}`}
              bike={activeBike}
              services={services}
              onRefresh={loadData}
              language={language}
              selectedServiceTrigger={selectedServiceTrigger}
              onOpenGarage={() => setShowMyGarage(true)}
            />
          </div>
        )}

        {/* TAB 3: TAX */}
        {activeTab === 'tax' && activeBike && (
          <div className="animate-in fade-in">
            <TaxRenewalSystem
              key={`tax-${activeBike.id}`}
              bike={activeBike}
              renewals={renewals}
              documents={documents}
              onRefresh={loadData}
              language={language}
              onOpenVault={() => setActiveTab('vault')}
              selectedRenewalTrigger={selectedRenewalTrigger}
              onOpenGarage={() => setShowMyGarage(true)}
            />
          </div>
        )}

        {/* TAB 4: DOCUMENTS */}
        {activeTab === 'vault' && activeBike && (
          <div className="animate-in fade-in">
            <DocumentVault
              key={`vault-${activeBike.id}`}
              bike={activeBike}
              bikeId={activeBike.id!}
              documents={documents}
              onRefresh={loadData}
              language={language}
              onOpenGarage={() => setShowMyGarage(true)}
            />
          </div>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="animate-in fade-in">
            <SettingsModal
              embedded
              isOpen={true}
              onClose={() => setActiveTab('dashboard')}
              settings={settings}
              onSettingsUpdate={(newSettings) => setSettings(newSettings)}
              language={language}
              onLanguageChange={handleLanguageChange}
              onRefreshAll={loadData}
              onOpenVehicleManager={() => setShowMyGarage(true)}
              onOpenWidgetPreview={() => setShowWidgetPreview(true)}
              hasActiveBike={Boolean(activeBike)}
              refreshKey={bikes.length + services.length + renewals.length + documents.length}
            />
          </div>
        )}

      </main>

      {/* Mobile Claymorphism Bottom Navigation (Exactly 5 Primary Destinations) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-surface-1)] border-t border-[var(--color-border)] clay-nav px-1.5 pt-1.5 pb-safe select-none"
      >
        <div className="grid grid-cols-5 items-center max-w-md mx-auto gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveTab(item.id)}
                className={`relative min-h-[50px] w-full flex flex-col items-center justify-center py-1 px-0.5 rounded-xl border transition duration-150 active:scale-[0.97] ${
                  isActive
                    ? 'bg-[var(--color-surface-2)] border-[var(--color-accent)]/40 clay-raised-sm text-[var(--color-accent)]'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <Icon className="w-[19px] h-[19px] shrink-0" />
                <span className="text-[10px] font-semibold mt-1 whitespace-nowrap max-w-full">
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>


      {/* PWA Home Screen Widget Preview - Full-Screen Slide-In Page (Launched from Settings) */}
      {activeBike && (
        <FullScreenSheet
          isOpen={showWidgetPreview}
          onClose={() => setShowWidgetPreview(false)}
          title={t.widgetSheetTitle}
          subtitle={t.widgetSheetSubtitle}
          leadingIcon={<Smartphone className="w-4 h-4" />}
          maxWidthClass="max-w-md"
        >
          <HomeWidgetCard
            bike={activeBike}
            taxStatus={taxStatus}
            latestRenewal={latestRenewal}
            latestService={latestService}
            language={language}
            onClose={() => setShowWidgetPreview(false)}
          />
        </FullScreenSheet>
      )}

      {/* Traffic Check Modal */}
      {activeBike && (
        <TrafficCheckModal
          isOpen={showTrafficCheck}
          onClose={() => setShowTrafficCheck(false)}
          bike={activeBike}
          taxStatus={taxStatus}
          latestRenewal={latestRenewal}
          documents={documents}
          language={language}
        />
      )}

      {/* Emergency Directory Modal */}
      <EmergencyDirectoryModal
        isOpen={showEmergencyDirectory}
        onClose={() => setShowEmergencyDirectory(false)}
        language={language}
      />

      {/* My Garage Interactive Vehicle Hub */}
      <MyGarageSheet
        isOpen={showMyGarage}
        onClose={() => setShowMyGarage(false)}
        bikes={bikes}
        activeBikeId={activeBike?.id ?? selectedBikeId}
        onSelectVehicle={handleSelectVehicle}
        onViewProfile={(bike) => openVehicleProfile(bike)}
        onAddVehicle={openDirectAddVehicle}
        language={language}
      />

      {/* Bike Management Modal (Vehicle Profile & Add/Edit Sheet, stacks cleanly over My Garage) */}
      <BikeManagementModal
        isOpen={showBikeManager}
        onClose={() => setShowBikeManager(false)}
        bikes={bikes}
        selectedBikeId={selectedBikeId}
        onSelectBike={handleSelectVehicle}
        onRefresh={loadData}
        language={language}
        initialMode={bikeManagerMode}
        initialEditBikeId={bikeManagerEditId}
        onOpenTrafficCheck={() => setShowTrafficCheck(true)}
      />

    </div>
  );
}
