import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  KeyRound,
  Download,
  Upload,
  FileCode,
  Check,
  Save,
  AlertCircle,
  Palette,
  Trash2,
  Clock,
  Shield,
  Layers,
  Plus,
  Edit2,
  ChevronRight,
  Bike as BikeIcon,
  Bell,
  Info,
  User,
  X,
  Database,
  ArrowLeft,
  Globe,
  Smartphone
} from 'lucide-react';
import { MeroBikeMark, MeroBikeWordmark } from './MeroBikeLogo';
import { AppSettings, AppTheme } from '../types';
import { db } from '../db/db';
import { hashPin, verifyPin } from '../utils/security';
import {
  exportJsonBackup,
  importJsonBackup,
  exportStandaloneHtmlFile,
  getBackupTableCounts,
  resetAllLocalData,
  BackupTableCounts
} from '../utils/exportImport';
import { THEMES } from '../utils/theme';
import {
  getNotificationPermissionState,
  NotificationPermissionState,
  requestNotificationPermission
} from '../utils/notifications';
import { PWAInstallButton } from './PWAInstallButton';
import { INITIAL_DEFAULT_CATEGORIES } from './ServiceTracker';
import {
  Button,
  Card,
  ConfirmDialog,
  FullScreenSheet,
  IconButton,
  SelectableChip,
  StatusBadge,
  Switch,
  TextInput
} from './ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsUpdate: (newSettings: AppSettings) => void;
  language: 'en' | 'ne';
  onLanguageChange: (lang: 'en' | 'ne') => void;
  onRefreshAll: () => Promise<void> | void;
  onOpenVehicleManager?: () => void;
  embedded?: boolean;
  onOpenWidgetPreview?: () => void;
  hasActiveBike?: boolean;
  refreshKey?: number;
}

type SettingsSubview =
  | 'main'
  | 'security'
  | 'theme'
  | 'notifications'
  | 'categories'
  | 'backup'
  | 'about';

function readStoredOwnerName(): string {
  if (typeof localStorage === 'undefined') return '';
  const raw = localStorage.getItem('sawaari_owner_name') || '';
  const trimmed = raw.trim();
  // Never surface sample persona placeholder
  if (!trimmed || trimmed === 'Kiran Thapa') return '';
  return trimmed;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  settings,
  onSettingsUpdate,
  language,
  onLanguageChange,
  onRefreshAll,
  onOpenVehicleManager,
  embedded = false,
  onOpenWidgetPreview,
  hasActiveBike = false,
  refreshKey = 0
}) => {
  const [activeSubview, setActiveSubview] = useState<SettingsSubview>('main');

  // Security PIN State
  const [pinMode, setPinMode] = useState<'none' | 'set' | 'change'>('none');
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [showDisablePinConfirm, setShowDisablePinConfirm] = useState(false);

  // Feedback banners
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Reset confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Dynamic Maintenance Categories State
  const [categories, setCategories] = useState<string[]>(INITIAL_DEFAULT_CATEGORIES);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<{ original: string; current: string } | null>(null);

  // Owner Profile State (no hardcoded sample name)
  const [ownerName, setOwnerName] = useState<string>(() => readStoredOwnerName());
  const [ownerDraft, setOwnerDraft] = useState<string>(() => readStoredOwnerName());
  const [isEditingOwner, setIsEditingOwner] = useState(false);

  // Real DB counts & active reminder stats
  const [tableCounts, setTableCounts] = useState<BackupTableCounts>({
    bikes: 0,
    services: 0,
    renewals: 0,
    expenses: 0,
    documents: 0,
    components: 0,
    settings: 0
  });
  const [reminderCounts, setReminderCounts] = useState<{
    service: number;
    renewal: number;
    documentsWithExpiry: number;
  }>({
    service: 0,
    renewal: 0,
    documentsWithExpiry: 0
  });
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermissionState()
  );
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const loadMetadata = useCallback(async () => {
    setNotifPermission(getNotificationPermissionState());
    try {
      const [storedCats, counts, allServices, allRenewals, allDocuments] = await Promise.all([
        db.settings.get('maintenance_categories').catch(() => null),
        getBackupTableCounts().catch(() => ({
          bikes: 0,
          services: 0,
          renewals: 0,
          expenses: 0,
          documents: 0,
          components: 0,
          settings: 0
        })),
        db.services.toArray().catch(() => []),
        db.renewals.toArray().catch(() => []),
        db.documents.toArray().catch(() => [])
      ]);

      if (storedCats && Array.isArray(storedCats.value) && storedCats.value.length > 0) {
        setCategories(storedCats.value);
      } else {
        setCategories(INITIAL_DEFAULT_CATEGORIES);
      }

      setTableCounts(counts);
      setReminderCounts({
        service: allServices.filter((s) => s.enableReminder !== false && Boolean(s.nextServiceDateAD || s.nextServiceKm)).length,
        renewal: allRenewals.filter((r) => r.enableReminder !== false && Boolean(r.validUntilAD)).length,
        documentsWithExpiry: allDocuments.filter((d) => Boolean(d.expiryDate)).length
      });
    } catch {
      setCategories(INITIAL_DEFAULT_CATEGORIES);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveSubview('main');
      setPinMode('none');
      setCurrentPinInput('');
      setPinInput('');
      setPinConfirm('');
      setErrorMsg('');
      setSuccessMsg('');
      setShowResetConfirm(false);
      setShowDisablePinConfirm(false);
      setIsEditingOwner(false);
      const savedOwner = readStoredOwnerName();
      setOwnerName(savedOwner);
      setOwnerDraft(savedOwner);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadMetadata();
    }
  }, [isOpen, refreshKey, loadMetadata]);

  const showSuccess = (msg: string) => {
    setErrorMsg('');
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3200);
  };

  const showError = (msg: string) => {
    setSuccessMsg('');
    setErrorMsg(msg);
  };

  const handleSavePin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (pinMode === 'change') {
      if (!settings.pinHash || !(await verifyPin(currentPinInput, settings.pinHash))) {
        showError(language === 'ne' ? 'हालको पिन मिलेन।' : 'Current PIN is incorrect.');
        return;
      }
    }

    if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
      showError(language === 'ne' ? 'पिन ठ्याक्कै ४ अंकको हुनुपर्छ।' : 'PIN must be exactly 4 digits.');
      return;
    }
    if (pinInput !== pinConfirm) {
      showError(language === 'ne' ? 'पिन मिलेन।' : 'PINs do not match.');
      return;
    }

    const hash = await hashPin(pinInput);
    const updated: AppSettings = {
      ...settings,
      isPinEnabled: true,
      isBiometricEnabled: false,
      pinHash: hash
    };
    await db.settings.put({ key: 'app_settings', value: updated });
    onSettingsUpdate(updated);
    setPinMode('none');
    setCurrentPinInput('');
    setPinInput('');
    setPinConfirm('');
    showSuccess(
      pinMode === 'change'
        ? language === 'ne'
          ? 'पिन सफलतापूर्वक परिवर्तन भयो!'
          : 'PIN updated successfully!'
        : language === 'ne'
        ? 'पिन सफलतापूर्वक सक्रिय भयो!'
        : 'PIN successfully activated!'
    );
  };

  const handleDisablePin = async () => {
    const updated: AppSettings = {
      ...settings,
      isPinEnabled: false,
      pinHash: undefined,
      isBiometricEnabled: false
    };
    await db.settings.put({ key: 'app_settings', value: updated });
    onSettingsUpdate(updated);
    setShowDisablePinConfirm(false);
    setPinMode('none');
    setCurrentPinInput('');
    setPinInput('');
    setPinConfirm('');
    showSuccess(language === 'ne' ? 'पिन लक हटाइयो।' : 'PIN Lock disabled.');
  };

  const handleAutoLockChange = async (minutes: number) => {
    const updated: AppSettings = { ...settings, autoLockMinutes: minutes };
    await db.settings.put({ key: 'app_settings', value: updated });
    onSettingsUpdate(updated);
    showSuccess(language === 'ne' ? 'अटो-लक समय अपडेट भयो।' : 'Auto-lock timeout updated.');
  };

  const handleUpdateNotificationSetting = async (
    patch: Partial<
      Pick<
        AppSettings,
        | 'notificationsEnabled'
        | 'serviceRemindersEnabled'
        | 'taxRemindersEnabled'
        | 'documentExpiryRemindersEnabled'
      >
    >
  ) => {
    const updated: AppSettings = { ...settings, ...patch };
    await db.settings.put({ key: 'app_settings', value: updated });
    onSettingsUpdate(updated);
    await onRefreshAll();
  };

  const handleRequestNotificationPermission = async () => {
    setIsRequestingPermission(true);
    try {
      const nextPerm = await requestNotificationPermission();
      setNotifPermission(nextPerm);
      if (nextPerm === 'granted') {
        const updated: AppSettings = { ...settings, notificationsEnabled: true };
        await db.settings.put({ key: 'app_settings', value: updated });
        onSettingsUpdate(updated);
        await onRefreshAll();
        showSuccess(
          language === 'ne'
            ? 'सूचना अनुमति सक्रिय गरियो।'
            : 'Browser notifications enabled.'
        );
      } else if (nextPerm === 'denied') {
        showError(
          language === 'ne'
            ? 'ब्राउजरमा सूचना अनुमति अस्वीकार गरिएको छ। इन-एप अलर्ट सक्रिय रहनेछन्।'
            : 'Notifications are blocked by your browser. In-app alerts & calendar export remain active.'
        );
      }
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      showError(language === 'ne' ? 'यो वर्ग पहिले नै छ।' : 'Category already exists.');
      return;
    }
    const updated = [...categories, trimmed];
    setCategories(updated);
    setNewCategoryName('');
    await db.settings.put({ key: 'maintenance_categories', value: updated });
    showSuccess(language === 'ne' ? 'नयाँ वर्ग थपियो!' : 'Category added successfully!');
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    const trimmed = editingCategory.current.trim();
    if (!trimmed) return;
    if (
      categories.some(
        (c) => c !== editingCategory.original && c.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      showError(language === 'ne' ? 'यो वर्ग पहिले नै छ।' : 'Category already exists.');
      return;
    }

    const updated = categories.map((c) => (c === editingCategory.original ? trimmed : c));
    setCategories(updated);
    setEditingCategory(null);
    await db.settings.put({ key: 'maintenance_categories', value: updated });
    showSuccess(language === 'ne' ? 'वर्ग सम्पादन भयो!' : 'Category updated successfully!');
  };

  const handleDeleteCategory = async (catToDelete: string) => {
    const updated = categories.filter((c) => c !== catToDelete);
    setCategories(updated);
    await db.settings.put({ key: 'maintenance_categories', value: updated });
  };

  const handleResetCategoriesToDefault = async () => {
    setCategories(INITIAL_DEFAULT_CATEGORIES);
    await db.settings.put({
      key: 'maintenance_categories',
      value: INITIAL_DEFAULT_CATEGORIES
    });
    showSuccess(language === 'ne' ? 'पूर्वनिर्धारित वर्गहरू पुनर्स्थापित!' : 'Categories reset to defaults!');
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsImporting(true);
    setErrorMsg('');
    try {
      const res = await importJsonBackup(file);
      if (res.success) {
        const savedOwner = readStoredOwnerName();
        setOwnerName(savedOwner);
        setOwnerDraft(savedOwner);
        await loadMetadata();
        await onRefreshAll();
        const c = res.counts;
        showSuccess(
          c
            ? language === 'ne'
              ? `रिस्टोर सफल: ${c.bikes} सवारी, ${c.services} सर्भिस, ${c.renewals} कर, ${c.components} पार्टपुर्जा।`
              : `Restored ${c.bikes} vehicle(s), ${c.services} service(s), ${c.renewals} renewal(s), ${c.components} component(s).`
            : language === 'ne'
            ? 'ब्याकअप सफलतापूर्वक रिस्टोर भयो!'
            : 'Journal data restored successfully!'
        );
      } else {
        showError(res.message || (language === 'ne' ? 'रिस्टोर असफल भयो।' : 'Restore failed.'));
      }
    } catch {
      showError(language === 'ne' ? 'ब्याकअप JSON फाइल पढ्न सकिएन।' : 'Failed to parse backup JSON.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleResetAllData = async () => {
    setIsResetting(true);
    try {
      await resetAllLocalData();

      setOwnerName('');
      setOwnerDraft('');
      setCategories(INITIAL_DEFAULT_CATEGORIES);
      setShowResetConfirm(false);
      await loadMetadata();
      await onRefreshAll();
      onClose();
    } catch (err) {
      console.error(err);
      showError(language === 'ne' ? 'डाटा मेटाउन असफल भयो।' : 'Failed to reset database.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSaveOwnerName = () => {
    const trimmed = ownerDraft.trim();
    setOwnerName(trimmed);
    setOwnerDraft(trimmed);
    try {
      if (trimmed) {
        localStorage.setItem('sawaari_owner_name', trimmed);
      } else {
        localStorage.removeItem('sawaari_owner_name');
      }
    } catch {
      // ignore storage errors
    }
    setIsEditingOwner(false);
  };

  const activeTheme = THEMES[settings.theme || 'oled'] || THEMES.oled;
  const activeThemeLabel = language === 'ne' ? activeTheme.nameNe : activeTheme.nameEn;
  const displayOwnerLabel = ownerName || (language === 'ne' ? 'मेरो बाइक प्रयोगकर्ता' : 'Rider Profile');
  const totalStoredRecords =
    tableCounts.bikes +
    tableCounts.services +
    tableCounts.renewals +
    tableCounts.expenses +
    tableCounts.documents +
    tableCounts.components;

  const sheetTitle =
    activeSubview === 'main'
      ? language === 'ne'
        ? 'सेटिङहरू'
        : 'Settings'
      : activeSubview === 'theme'
      ? language === 'ne'
        ? 'थिम छान्नुहोस्'
        : 'Theme'
      : activeSubview === 'notifications'
      ? language === 'ne'
        ? 'सूचना तथा अलर्ट'
        : 'Notifications'
      : activeSubview === 'security'
      ? language === 'ne'
        ? 'सुरक्षा र पिन'
        : 'Security'
      : activeSubview === 'backup'
      ? language === 'ne'
        ? 'ब्याकअप तथा रिस्टोर'
        : 'Backup & Restore'
      : activeSubview === 'categories'
      ? language === 'ne'
        ? 'मर्मत वर्गहरू'
        : 'Maintenance Categories'
      : language === 'ne'
      ? 'मेरो बाइक बारे'
      : 'About Mero Bike';

  const sheetSubtitle =
    activeSubview === 'main'
      ? language === 'ne'
        ? 'एप तथा व्यक्तिगत प्राथमिकता'
        : 'Personalize your app'
      : activeSubview === 'about'
      ? language === 'ne'
        ? 'तपाईंको सवारी, सम्पूर्ण रेकर्ड, एकै स्थानमा।'
        : 'Your Bike. Your Records. One Place.'
      : language === 'ne'
      ? 'मेरो बाइक सेटिङ'
      : 'Mero Bike Settings';

  const handleSheetBack = () => {
    if (activeSubview === 'main') {
      onClose();
    } else {
      setActiveSubview('main');
      setErrorMsg('');
      setSuccessMsg('');
      setPinMode('none');
    }
  };

  const settingsBody = (
    <div className="space-y-4">
          {/* Status Alerts */}
          {successMsg && (
            <div className="p-3 rounded-2xl bg-[var(--color-success-subtle)] border border-[var(--color-success)]/40 text-[var(--color-success)] text-xs flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-[var(--color-error-subtle)] border border-[var(--color-error)]/40 text-[var(--color-error)] text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {/* 1. MAIN SETTINGS OVERVIEW (Screen 10) */}
          {activeSubview === 'main' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Owner & Language Card */}
              <Card padding="md" className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] clay-btn-primary font-bold text-lg flex items-center justify-center shrink-0">
                    {ownerName ? ownerName.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    {isEditingOwner ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={ownerDraft}
                          onChange={(e) => setOwnerDraft(e.target.value)}
                          placeholder={language === 'ne' ? 'तपाईंको नाम...' : 'Enter your name...'}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveOwnerName();
                            }
                          }}
                          className="w-full min-w-0 bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset rounded-xl px-2.5 py-1.5 text-sm font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                          autoFocus
                        />
                        <IconButton
                          size="sm"
                          variant="accent"
                          onClick={handleSaveOwnerName}
                          aria-label={language === 'ne' ? 'नाम सुरक्षित गर्नुहोस्' : 'Save Name'}
                          title={language === 'ne' ? 'सुरक्षित गर्नुहोस्' : 'Save'}
                        >
                          <Save className="w-3.5 h-3.5" />
                        </IconButton>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)] truncate">
                            {displayOwnerLabel}
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setOwnerDraft(ownerName);
                              setIsEditingOwner(true);
                            }}
                            aria-label={language === 'ne' ? 'नाम सम्पादन' : 'Edit owner name'}
                            className="p-1 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition shrink-0"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] truncate">
                          {ownerName
                            ? language === 'ne'
                              ? 'सवारी धनी'
                              : 'Vehicle Owner'
                            : language === 'ne'
                            ? 'आफ्नो नाम थप्न ट्याप गर्नुहोस्'
                            : 'Tap pencil to set rider name'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Current Language Badge */}
                <StatusBadge status="accent">
                  {language === 'ne' ? 'नेपाली' : 'English'}
                </StatusBadge>
              </Card>

              {/* Grouped Settings Menu Rows */}
              <div className="space-y-2">
                {/* Language Preference */}
                <div className="w-full p-3.5 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] clay-raised-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {language === 'ne' ? 'भाषा (Language)' : 'Language'}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        {language === 'ne' ? 'हाल: नेपाली' : 'Current: English'}
                      </div>
                    </div>
                  </div>
                  <div className="inline-flex items-center p-0.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset shrink-0">
                    <button
                      type="button"
                      onClick={() => onLanguageChange('en')}
                      className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold transition duration-150 ${
                        language === 'en'
                          ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] clay-btn-primary'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      onClick={() => onLanguageChange('ne')}
                      className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold transition duration-150 ${
                        language === 'ne'
                          ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] clay-btn-primary'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      नेपाली
                    </button>
                  </div>
                </div>

                {/* My Vehicles */}
                <button
                  type="button"
                  onClick={() => {
                    if (!embedded) onClose();
                    if (onOpenVehicleManager) {
                      onOpenVehicleManager();
                    }
                  }}
                  className="w-full p-3.5 rounded-2xl bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-raised-sm transition flex items-center justify-between gap-3 group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                      <BikeIcon className="w-5 h-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition truncate">
                        {language === 'ne' ? 'मेरा सवारी साधनहरू' : 'My Vehicles'}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        {tableCounts.bikes > 0
                          ? language === 'ne'
                            ? `${tableCounts.bikes} सवारी दर्ता`
                            : `${tableCounts.bikes} vehicle${tableCounts.bikes === 1 ? '' : 's'} · Manage garage`
                          : language === 'ne'
                          ? 'सवारी थप्नुहोस् वा बदल्नुहोस्'
                          : 'Manage your vehicles'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] shrink-0 transition" />
                </button>

                {/* Theme */}
                <button
                  type="button"
                  onClick={() => setActiveSubview('theme')}
                  className="w-full p-3.5 rounded-2xl bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-raised-sm transition flex items-center justify-between gap-3 group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                      <Palette className="w-5 h-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition truncate">
                        {language === 'ne' ? 'थिम' : 'Theme'}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        {activeThemeLabel}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] shrink-0 transition" />
                </button>

                {/* Home Screen Widget Preferences */}
                {hasActiveBike && onOpenWidgetPreview && (
                  <button
                    type="button"
                    onClick={onOpenWidgetPreview}
                    className="w-full p-3.5 rounded-2xl bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-raised-sm transition flex items-center justify-between gap-3 group active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition truncate">
                          {language === 'ne' ? 'गृह स्क्रिन विजेट' : 'Home Screen Widget'}
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] truncate">
                          {language === 'ne'
                            ? '२x२ वा ४x२ सवारी स्थिति कार्ड प्राथमिकता'
                            : 'Configure 2x2 or 4x2 widget card'}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] shrink-0 transition" />
                  </button>
                )}

                {/* Notifications & Reminders */}
                <button
                  type="button"
                  onClick={() => setActiveSubview('notifications')}
                  className="w-full p-3.5 rounded-2xl bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-raised-sm transition flex items-center justify-between gap-3 group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition truncate">
                        {language === 'ne' ? 'सूचना तथा रिमाइन्डर' : 'Notifications'}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        {reminderCounts.service + reminderCounts.renewal + reminderCounts.documentsWithExpiry > 0
                          ? language === 'ne'
                            ? `${reminderCounts.service + reminderCounts.renewal + reminderCounts.documentsWithExpiry} ट्र्याक गरिएको रिमाइन्डर`
                            : `${reminderCounts.service + reminderCounts.renewal + reminderCounts.documentsWithExpiry} tracked reminder(s)`
                          : language === 'ne'
                          ? 'कर, मर्मत तथा कागजात म्याद अलर्ट'
                          : 'Maintenance, tax & document expiry alerts'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] shrink-0 transition" />
                </button>

                {/* Security (PIN only — no false biometric claims) */}
                <button
                  type="button"
                  onClick={() => setActiveSubview('security')}
                  className="w-full p-3.5 rounded-2xl bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-raised-sm transition flex items-center justify-between gap-3 group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition truncate">
                        {language === 'ne' ? 'सुरक्षा' : 'Security'}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        {settings.isPinEnabled
                          ? language === 'ne'
                            ? `४-अंकको पिन सक्रिय`
                            : `4-Digit PIN Active`
                          : language === 'ne'
                          ? '४-अंकको पिन लक (बन्द)'
                          : '4-Digit App PIN · Off'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] shrink-0 transition" />
                </button>

                {/* Backup & Restore */}
                <button
                  type="button"
                  onClick={() => setActiveSubview('backup')}
                  className="w-full p-3.5 rounded-2xl bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-raised-sm transition flex items-center justify-between gap-3 group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                      <Download className="w-5 h-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition truncate">
                        {language === 'ne' ? 'ब्याकअप तथा रिस्टोर' : 'Backup & Restore'}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        {language === 'ne'
                          ? `${totalStoredRecords} रेकर्डहरू · निर्यात, रिस्टोर र रिसेट`
                          : `${totalStoredRecords} record(s) · Export, restore & reset`}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] shrink-0 transition" />
                </button>

                {/* Maintenance Categories */}
                <button
                  type="button"
                  onClick={() => setActiveSubview('categories')}
                  className="w-full p-3.5 rounded-2xl bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-raised-sm transition flex items-center justify-between gap-3 group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition truncate">
                        {language === 'ne' ? 'मर्मत वर्गहरू' : 'Maintenance Categories'}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        {categories.length} {language === 'ne' ? 'वर्गहरू' : 'categories'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] shrink-0 transition" />
                </button>

                {/* About Mero Bike */}
                <button
                  type="button"
                  onClick={() => setActiveSubview('about')}
                  className="w-full p-3.5 rounded-2xl bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-raised-sm transition flex items-center justify-between gap-3 group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                      <Info className="w-5 h-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition truncate">
                        {language === 'ne' ? 'मेरो बाइक बारे' : 'About Mero Bike'}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        Version 1.0.0 • 100% Offline
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] shrink-0 transition" />
                </button>
              </div>

              {/* Install PWA Button (shown only when installable/iOS) */}
              <PWAInstallButton language={language} />
            </div>
          )}

          {/* 2. SUBVIEW: THEME SELECTOR WITH VISUAL PREVIEWS */}
          {activeSubview === 'theme' && (
            <div className="space-y-3 animate-in fade-in">
              <p className="text-xs text-[var(--color-text-secondary)]">
                {language === 'ne'
                  ? 'आफ्नो मनपर्ने रंग र डिस्प्ले थिम छान्नुहोस्। परिवर्तन तुरुन्तै पूरै एपमा लागू हुन्छ।'
                  : 'Choose a visual theme. Selection updates the entire app immediately.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(THEMES) as AppTheme[]).map((tKey) => {
                  const th = THEMES[tKey];
                  const isSelected = (settings.theme || 'oled') === tKey;
                  const tk = th.tokens;
                  return (
                    <button
                      key={tKey}
                      type="button"
                      onClick={async () => {
                        const updated: AppSettings = { ...settings, theme: tKey };
                        await db.settings.put({ key: 'app_settings', value: updated });
                        onSettingsUpdate(updated);
                      }}
                      className={`p-3 rounded-2xl border clay-raised-sm text-left transition duration-150 flex flex-col gap-2.5 active:scale-[0.99] ${
                        isSelected
                          ? 'bg-[var(--color-surface-2)] border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40'
                          : 'bg-[var(--color-surface-1)] border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                      }`}
                    >
                      {/* Authentic Mini-UI Theme Preview */}
                      <div
                        className="w-full rounded-xl p-2.5 border space-y-2"
                        style={{
                          backgroundColor: tk.bg,
                          borderColor: tk.border
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: tk.accent }}
                            />
                            <span
                              className="h-2 w-12 rounded-full"
                              style={{ backgroundColor: tk.textPrimary, opacity: 0.85 }}
                            />
                          </div>
                          <span
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: tk.accentSubtle,
                              color: tk.accent
                            }}
                          >
                            {th.badge}
                          </span>
                        </div>

                        <div
                          className="rounded-lg p-2 border flex items-center justify-between gap-2"
                          style={{
                            backgroundColor: tk.surface1,
                            borderColor: tk.border
                          }}
                        >
                          <div className="space-y-1">
                            <div
                              className="h-1.5 w-14 rounded-full"
                              style={{ backgroundColor: tk.textPrimary, opacity: 0.75 }}
                            />
                            <div
                              className="h-1.5 w-9 rounded-full"
                              style={{ backgroundColor: tk.textSecondary, opacity: 0.6 }}
                            />
                          </div>
                          <div
                            className="h-5 w-10 rounded-md flex items-center justify-center text-[8px] font-bold"
                            style={{
                              backgroundColor: tk.accent,
                              color: tk.accentFg
                            }}
                          >
                            OK
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                            {language === 'ne' ? th.nameNe : th.nameEn}
                          </div>
                          <div className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                            {th.badge}
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                        ) : (
                          <div
                            className="w-5 h-5 rounded-full border shrink-0"
                            style={{ backgroundColor: tk.accent, borderColor: tk.border }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. SUBVIEW: NOTIFICATIONS & REMINDERS */}
          {activeSubview === 'notifications' && (() => {
            const masterEnabled = settings.notificationsEnabled !== false;
            const serviceEnabled = settings.serviceRemindersEnabled !== false;
            const taxEnabled = settings.taxRemindersEnabled !== false;
            const docsEnabled = settings.documentExpiryRemindersEnabled !== false;

            const permBadge =
              notifPermission === 'granted'
                ? { status: 'success' as const, label: language === 'ne' ? 'अनुमति प्राप्त' : 'Allowed' }
                : notifPermission === 'denied'
                ? { status: 'error' as const, label: language === 'ne' ? 'ब्राउजरबाट बन्द' : 'Blocked' }
                : notifPermission === 'unsupported'
                ? { status: 'neutral' as const, label: language === 'ne' ? 'समर्थित छैन' : 'Unsupported' }
                : { status: 'warning' as const, label: language === 'ne' ? 'अनुमति बाँकी' : 'Not Requested' };

            return (
              <div className="space-y-3 animate-in fade-in">
                <Card padding="md" className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          {language === 'ne' ? 'सूचना तथा रिमाइन्डर' : 'Notifications & Reminders'}
                        </h3>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {language === 'ne'
                            ? 'मर्मत, कर म्याद र कागजात नवीकरण अलर्ट'
                            : 'Maintenance, tax grace & document expiry alerts'}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={permBadge.status} className="shrink-0">
                      <span>{permBadge.label}</span>
                    </StatusBadge>
                  </div>

                  {/* Permission status & request/fallback guidance */}
                  {notifPermission === 'default' && (
                    <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] space-y-2.5 text-xs">
                      <p className="text-[var(--color-text-secondary)] leading-relaxed">
                        {language === 'ne'
                          ? 'मर्मत मिति, ब्लुबुक कर म्याद र बीमा समाप्त हुँदा यन्त्रमा सूचना पाउन ब्राउजर अनुमति दिनुहोस्।'
                          : 'Allow browser notifications to receive timely alerts when service, tax renewal, or document expiry is due.'}
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        loading={isRequestingPermission}
                        onClick={handleRequestNotificationPermission}
                        leftIcon={<Bell className="w-3.5 h-3.5" />}
                      >
                        <span>
                          {language === 'ne' ? 'सूचना अनुमति दिनुहोस्' : 'Enable Notifications'}
                        </span>
                      </Button>
                    </div>
                  )}

                  {notifPermission === 'denied' && (
                    <div className="p-3.5 rounded-2xl bg-[var(--color-error-subtle)]/35 border border-[var(--color-error)]/40 space-y-1 text-xs">
                      <div className="font-semibold text-[var(--color-error)]">
                        {language === 'ne'
                          ? 'ब्राउजरमा सूचना अनुमति अस्वीकार गरिएको छ'
                          : 'Browser Notifications Blocked'}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                        {language === 'ne'
                          ? 'तपाईंको ब्राउजर सेटिङबाट अनुमति नदिएसम्म उपकरण सूचना देखिने छैनन्। यद्यपि, ड्यासबोर्ड, कर, कागजात अलर्ट र पात्रो (.ics) पूर्ण रूपमा अफलाइन चल्नेछन्।'
                          : 'System notifications are disabled in your browser site settings. Allow notifications in browser settings to re-enable them; in-app warnings and .ics calendar exports continue working offline.'}
                      </p>
                    </div>
                  )}

                  {notifPermission === 'unsupported' && (
                    <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                      {language === 'ne'
                        ? 'यो यन्त्र वा ब्राउजरले वेब सूचना समर्थन गर्दैन। इन-एप अलर्ट र पात्रो (.ics) निर्यात सक्रिय छन्।'
                        : 'System web notifications are unavailable in this browser environment. In-app due alerts and .ics calendar exports remain active.'}
                    </div>
                  )}

                  {/* Persistent Preference Toggles */}
                  <div className="divide-y divide-[var(--color-border)] rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3.5">
                    <Switch
                      className="py-3"
                      checked={masterEnabled}
                      label={language === 'ne' ? 'यन्त्र सूचनाहरू पठाउनुहोस्' : 'Device Notifications'}
                      description={
                        language === 'ne'
                          ? 'डुप्लिकेट नगरी स्वचालित रिमाइन्डर पठाउनुहोस्'
                          : 'Trigger deduplicated alerts when due'
                      }
                      onChange={async (checked) => {
                        if (checked && notifPermission === 'default') {
                          await handleRequestNotificationPermission();
                        } else {
                          await handleUpdateNotificationSetting({ notificationsEnabled: checked });
                        }
                      }}
                    />

                    <Switch
                      className="py-3"
                      checked={serviceEnabled}
                      disabled={!masterEnabled}
                      label={language === 'ne' ? 'मर्मत रिमाइन्डर' : 'Maintenance Reminders'}
                      description={
                        language === 'ne'
                          ? `${reminderCounts.service} सक्रिय रेकर्ड`
                          : `${reminderCounts.service} active service schedule(s)`
                      }
                      onChange={(checked) =>
                        handleUpdateNotificationSetting({ serviceRemindersEnabled: checked })
                      }
                    />

                    <Switch
                      className="py-3"
                      checked={taxEnabled}
                      disabled={!masterEnabled}
                      label={language === 'ne' ? 'कर तथा ९०-दिने ग्रेस अलर्ट' : 'Tax & 90-Day Grace Alerts'}
                      description={
                        language === 'ne'
                          ? `${reminderCounts.renewal} सक्रिय कर रेकर्ड`
                          : `${reminderCounts.renewal} active renewal schedule(s)`
                      }
                      onChange={(checked) =>
                        handleUpdateNotificationSetting({ taxRemindersEnabled: checked })
                      }
                    />

                    <Switch
                      className="py-3"
                      checked={docsEnabled}
                      disabled={!masterEnabled}
                      label={language === 'ne' ? 'कागजात म्याद चेतावनी' : 'Document Expiry Warnings'}
                      description={
                        language === 'ne'
                          ? `${reminderCounts.documentsWithExpiry} म्याद मिति भएका कागजात`
                          : `${reminderCounts.documentsWithExpiry} document(s) with expiry dates`
                      }
                      onChange={(checked) =>
                        handleUpdateNotificationSetting({ documentExpiryRemindersEnabled: checked })
                      }
                    />
                  </div>

                  <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                    {language === 'ne'
                      ? 'प्रत्येक सर्भिस वा कर नवीकरण फारमभित्र "रिमाइन्डर" र समय अन्तराल (सोही दिन, १ हप्ता, २ हप्ता, ४ हप्ता) छान्न सकिन्छ।'
                      : 'Per-record reminder toggles and lead intervals (On the day, 1 week, 2 weeks, 4 weeks) can be configured inside any Service or Tax Renewal entry.'}
                  </p>
                </Card>
              </div>
            );
          })()}

          {/* 4. SUBVIEW: SECURITY (4-Digit PIN & Auto-Lock) */}
          {activeSubview === 'security' && (
            <div className="space-y-3 animate-in fade-in">
              <Card padding="md" className="space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {language === 'ne' ? '४-अंकको सुरक्षा पिन' : '4-Digit App PIN Lock'}
                        </span>
                        <StatusBadge status={settings.isPinEnabled ? 'success' : 'neutral'}>
                          {settings.isPinEnabled
                            ? language === 'ne'
                              ? 'सक्रिय'
                              : 'Active'
                            : language === 'ne'
                            ? 'बन्द'
                            : 'Off'}
                        </StatusBadge>
                      </div>
                      <span className="text-xs text-[var(--color-text-secondary)] block mt-0.5">
                        {settings.isPinEnabled
                          ? language === 'ne'
                            ? 'एप खोल्दा र निष्क्रिय हुँदा पिन आवश्यक छ'
                            : 'Protects your local garage records with a 4-digit PIN'
                          : language === 'ne'
                          ? 'अहिले पिन लक सेट गरिएको छैन'
                          : 'No PIN lock configured yet'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {settings.isPinEnabled ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setErrorMsg('');
                          setCurrentPinInput('');
                          setPinInput('');
                          setPinConfirm('');
                          setPinMode(pinMode === 'change' ? 'none' : 'change');
                        }}
                      >
                        {pinMode === 'change'
                          ? language === 'ne'
                            ? 'रद्द गर्नुहोस्'
                            : 'Cancel'
                          : language === 'ne'
                          ? 'पिन बदल्नुहोस्'
                          : 'Change PIN'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setShowDisablePinConfirm(true)}
                      >
                        {language === 'ne' ? 'पिन निष्क्रिय' : 'Disable PIN'}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant={pinMode === 'set' ? 'secondary' : 'primary'}
                      size="sm"
                      leftIcon={pinMode === 'set' ? undefined : <Lock className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setErrorMsg('');
                        setPinInput('');
                        setPinConfirm('');
                        setPinMode(pinMode === 'set' ? 'none' : 'set');
                      }}
                    >
                      {pinMode === 'set'
                        ? language === 'ne'
                          ? 'बन्द गर्नुहोस्'
                          : 'Cancel'
                        : language === 'ne'
                        ? 'पिन सेट गर्नुहोस्'
                        : 'Set 4-Digit PIN'}
                    </Button>
                  )}
                </div>

                {pinMode !== 'none' && (
                  <form
                    onSubmit={handleSavePin}
                    className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] space-y-3"
                  >
                    {pinMode === 'change' && (
                      <TextInput
                        label={language === 'ne' ? 'हालको ४-अंकको पिन' : 'Current 4-Digit PIN'}
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="••••"
                        value={currentPinInput}
                        onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                        className="text-center font-mono tracking-widest"
                        required
                      />
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <TextInput
                        label={language === 'ne' ? 'नयाँ पिन (४ अंक)' : 'New 4-Digit PIN'}
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="••••"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                        className="text-center font-mono tracking-widest"
                        required
                      />
                      <TextInput
                        label={language === 'ne' ? 'पिन दोहोर्याउनुहोस्' : 'Confirm PIN'}
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="••••"
                        value={pinConfirm}
                        onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                        className="text-center font-mono tracking-widest"
                        required
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setPinMode('none');
                          setErrorMsg('');
                        }}
                      >
                        {language === 'ne' ? 'रद्द' : 'Cancel'}
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        fullWidth
                        leftIcon={<Save className="w-3.5 h-3.5" />}
                      >
                        {pinMode === 'change'
                          ? language === 'ne'
                            ? 'पिन अपडेट गर्नुहोस्'
                            : 'Save New PIN'
                          : language === 'ne'
                          ? 'पिन सक्रिय गर्नुहोस्'
                          : 'Activate PIN'}
                      </Button>
                    </div>
                  </form>
                )}
              </Card>

              {/* Auto-Lock Timeout */}
              {settings.isPinEnabled && (
                <Card padding="md" className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-primary)]">
                    <Clock className="w-4 h-4 text-[var(--color-accent)]" />
                    <span>{language === 'ne' ? 'अटो-लक समय' : 'Auto-Lock Timeout'}</span>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    {language === 'ne'
                      ? 'एप पृष्ठभूमिमा जाँदा कति समयपछि स्वतः लक गर्ने:'
                      : 'Lock automatically when returning after app stays in background:'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { mins: 0, label: language === 'ne' ? 'तुरुन्तै' : 'Immediate' },
                      { mins: 1, label: '1m' },
                      { mins: 5, label: '5m' },
                      { mins: 15, label: '15m' }
                    ].map((opt) => (
                      <SelectableChip
                        key={opt.mins}
                        size="sm"
                        selected={(settings.autoLockMinutes ?? 0) === opt.mins}
                        onClick={() => handleAutoLockChange(opt.mins)}
                      >
                        {opt.label}
                      </SelectableChip>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* 5. SUBVIEW: BACKUP, RESTORE & RESET */}
          {activeSubview === 'backup' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Record Inventory Included in Backup */}
              <Card padding="md" className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-primary)]">
                    <Database className="w-4 h-4 text-[var(--color-accent)]" />
                    <span>
                      {language === 'ne' ? 'सुरक्षित स्थानीय डाटा सारांश' : 'Included in Backup'}
                    </span>
                  </div>
                  <StatusBadge status="accent">{totalStoredRecords}</StatusBadge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: language === 'ne' ? 'सवारी' : 'Vehicles', count: tableCounts.bikes },
                    { label: language === 'ne' ? 'सर्भिस' : 'Services', count: tableCounts.services },
                    { label: language === 'ne' ? 'कर नवीकरण' : 'Renewals', count: tableCounts.renewals },
                    { label: language === 'ne' ? 'खर्च' : 'Expenses', count: tableCounts.expenses },
                    { label: language === 'ne' ? 'कागजात' : 'Documents', count: tableCounts.documents },
                    { label: language === 'ne' ? 'पार्टपुर्जा' : 'Components', count: tableCounts.components }
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="p-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset"
                    >
                      <div className="text-sm font-semibold font-mono tabular-nums text-[var(--color-text-primary)]">
                        {item.count}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-secondary)] truncate">
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* JSON Export & Import */}
              <Card padding="md" className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                    <Download className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)] block">
                      {language === 'ne' ? 'JSON डाटा ब्याकअप तथा रिस्टोर' : 'JSON Backup & Restore'}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)] block">
                      {language === 'ne'
                        ? 'सवारी, सर्भिस, कर, खर्च, कागजात, पार्टपुर्जा र सेटिङ सुरक्षित गर्नुहोस्'
                        : 'Saves and restores all vehicles, services, renewals, expenses, documents, components & settings'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Download className="w-4 h-4 text-[var(--color-accent)]" />}
                    onClick={async () => {
                      try {
                        const c = await exportJsonBackup();
                        showSuccess(
                          language === 'ne'
                            ? `JSON ब्याकअप डाउनलोड भयो (${c.bikes} सवारी, ${c.components} पार्टपुर्जा)।`
                            : `Exported JSON backup (${c.bikes} vehicle(s), ${c.services} service(s), ${c.components} component(s)).`
                        );
                      } catch {
                        showError(language === 'ne' ? 'JSON निर्यात असफल भयो।' : 'Failed to export JSON backup.');
                      }
                    }}
                  >
                    {language === 'ne' ? 'JSON निर्यात' : 'Export JSON'}
                  </Button>

                  <label
                    className={`min-h-[38px] px-3.5 py-2 rounded-2xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] clay-btn-secondary text-xs font-semibold text-[var(--color-text-primary)] flex items-center justify-center gap-2 cursor-pointer transition active:translate-y-[1px] active:scale-[0.985] ${
                      isImporting ? 'opacity-60 pointer-events-none' : ''
                    }`}
                  >
                    <Upload className="w-4 h-4 text-[var(--color-accent)]" />
                    <span>
                      {isImporting
                        ? language === 'ne'
                          ? 'रिस्टोर हुँदै...'
                          : 'Restoring...'
                        : language === 'ne'
                        ? 'JSON रिस्टोर'
                        : 'Restore JSON'}
                    </span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileImport}
                      className="hidden"
                      disabled={isImporting}
                    />
                  </label>
                </div>
              </Card>

              {/* Standalone HTML Export */}
              <Card padding="md" className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)] block">
                      {language === 'ne' ? 'पोर्टेबल HTML फाइल डाउनलोड' : 'Standalone HTML Export'}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)] block">
                      {language === 'ne'
                        ? 'इन्टरनेट बिना नै कुनै पनि ब्राउजरमा खुल्ने एकल .html फाइल'
                        : 'Single portable .html snapshot that opens in any browser'}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={async () => {
                    try {
                      await exportStandaloneHtmlFile();
                      showSuccess(
                        language === 'ne' ? 'HTML फाइल डाउनलोड भयो!' : 'Standalone HTML backup saved!'
                      );
                    } catch {
                      showError(language === 'ne' ? 'HTML फाइल निर्यात असफल भयो।' : 'Failed to export HTML backup.');
                    }
                  }}
                >
                  {language === 'ne' ? 'अफलाइन .html डाउनलोड' : 'Download Portable .html'}
                </Button>
              </Card>

              {/* Danger Zone: Reset All Data */}
              <div className="p-4 rounded-2xl bg-[var(--color-error-subtle)] border border-[var(--color-error)]/35 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--color-surface-1)]/70 border border-[var(--color-error)]/40 flex items-center justify-center text-[var(--color-error)] shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h4 className="text-sm font-semibold text-[var(--color-error)]">
                      {language === 'ne' ? 'सबै स्थानीय डाटा रिसेट गर्नुहोस्' : 'Reset All Local Data'}
                    </h4>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      {language === 'ne'
                        ? 'यसले सबै सवारी, सर्भिस इतिहास, कर नवीकरण, खर्च, कागजात, पार्टपुर्जा ट्र्याकिङ र एप सेटिङहरू स्थायी रूपमा मेटाउनेछ। मेटाएपछि खाली ग्यारेजमा फर्किनेछ।'
                        : 'Permanently erases all vehicles, service logs, tax renewals, expenses, documents, component records, and app settings. Returns cleanly to an empty garage without demo data.'}
                    </p>
                  </div>
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  fullWidth
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  onClick={() => setShowResetConfirm(true)}
                >
                  {language === 'ne' ? 'सबै डाटा रिसेट गर्नुहोस्' : 'Reset All Data'}
                </Button>
              </div>
            </div>
          )}

          {/* 6. SUBVIEW: MAINTENANCE CATEGORIES */}
          {activeSubview === 'categories' && (
            <div className="space-y-4 animate-in fade-in">
              <Card padding="md" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {language === 'ne' ? 'मर्मत तथा पार्टपुर्जा वर्गहरू' : 'Maintenance Categories'}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={handleResetCategoriesToDefault}>
                    {language === 'ne' ? 'पूर्वनिर्धारित राख्नुहोस्' : 'Reset Defaults'}
                  </Button>
                </div>

                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  {language === 'ne'
                    ? 'वर्ग नाम परिवर्तन वा हटाउँदा पुराना मर्मत इतिहास रेकर्डहरू सुरक्षित रहन्छन्।'
                    : 'Editing or removing categories preserves all existing historical service records.'}
                </p>

                {/* Add New Category */}
                <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                  <input
                    type="text"
                    placeholder={
                      language === 'ne'
                        ? 'नयाँ वर्ग (जस्तै: टायर, ब्याट्री)'
                        : 'New category (e.g. Tyres, Battery)'
                    }
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                    className="flex-1 min-h-[40px] bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/60 focus:outline-none focus:border-[var(--color-accent)]"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={handleAddCategory}
                  >
                    {language === 'ne' ? 'थप्नुहोस्' : 'Add'}
                  </Button>
                </div>

                {/* Categories List */}
                <div className="space-y-2 pt-1 max-h-80 overflow-y-auto pr-1">
                  {categories.map((cat) => {
                    const isDefault = INITIAL_DEFAULT_CATEGORIES.includes(cat);
                    const isEditing = editingCategory?.original === cat;

                    if (isEditing) {
                      return (
                        <div
                          key={cat}
                          className="flex items-center gap-2 p-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-accent)]"
                        >
                          <input
                            type="text"
                            value={editingCategory.current}
                            onChange={(e) =>
                              setEditingCategory({ ...editingCategory, current: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleUpdateCategory();
                              }
                            }}
                            className="flex-1 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none"
                            autoFocus
                          />
                          <IconButton
                            size="sm"
                            variant="accent"
                            onClick={handleUpdateCategory}
                            aria-label="Save category"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </IconButton>
                          <IconButton
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingCategory(null)}
                            aria-label="Cancel edit"
                          >
                            <X className="w-3.5 h-3.5" />
                          </IconButton>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={cat}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0" />
                          <span className="text-[var(--color-text-primary)] font-medium truncate">
                            {cat}
                          </span>
                          {isDefault && (
                            <StatusBadge status="neutral">
                              {language === 'ne' ? 'मुख्य' : 'Default'}
                            </StatusBadge>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <IconButton
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingCategory({ original: cat, current: cat })}
                            aria-label={`Edit ${cat}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </IconButton>
                          {!isDefault && (
                            <IconButton
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteCategory(cat)}
                              aria-label={`Delete ${cat}`}
                              className="hover:text-[var(--color-error)]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </IconButton>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* 7. SUBVIEW: ABOUT MERO BIKE */}
          {activeSubview === 'about' && (
            <div className="space-y-4 animate-in fade-in">
              <Card padding="lg" className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-raised flex items-center justify-center mx-auto">
                  <MeroBikeMark className="w-10 h-7" themeAware />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center justify-center gap-1.5 flex-wrap">
                    <MeroBikeWordmark sizeClass="text-lg" />
                    <span className="text-sm font-semibold text-[var(--color-text-secondary)]">(मेरो बाइक)</span>
                  </h3>
                  <p className="text-xs text-[var(--color-accent)] font-semibold tracking-wide mt-0.5">
                    {language === 'ne'
                      ? 'तपाईंको सवारी, सम्पूर्ण रेकर्ड, एकै स्थानमा।'
                      : 'Your Bike. Your Records. One Place.'}
                  </p>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto leading-relaxed">
                  {language === 'ne'
                    ? 'नेपाली सवारी चालकहरूका लागि विशेष रूपमा बनाइएको गोपनीयता-मैत्री र १००% अफलाइन मर्मत तथा कर जर्नल।'
                    : 'A minimalist, privacy-focused vehicle maintenance and Nepal Blue Book tax journal. 100% offline with zero cloud dependency.'}
                </p>
                <div className="pt-2 text-[11px] font-mono text-[var(--color-text-secondary)]">
                  Version 1.0.0 • Offline IndexedDB Storage
                </div>
              </Card>
            </div>
          )}
        </div>
  );

  return (
    <>
      {embedded ? (
        isOpen ? (
          <div className="space-y-4 pb-4 animate-in fade-in">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {activeSubview !== 'main' && (
                  <IconButton
                    size="sm"
                    onClick={handleSheetBack}
                    aria-label={language === 'ne' ? 'सेटिङमा फर्कनुहोस्' : 'Back to Settings'}
                    title={language === 'ne' ? 'पछाडि' : 'Back'}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </IconButton>
                )}
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight truncate">
                    {sheetTitle}
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)] truncate">
                    {sheetSubtitle}
                  </p>
                </div>
              </div>
            </div>
            {settingsBody}
          </div>
        ) : null
      ) : (
        <FullScreenSheet
          isOpen={isOpen}
          onClose={handleSheetBack}
          title={sheetTitle}
          subtitle={sheetSubtitle}
          maxWidthClass="max-w-lg"
        >
          {settingsBody}
        </FullScreenSheet>
      )}

      {/* Disable PIN Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDisablePinConfirm}
        onClose={() => setShowDisablePinConfirm(false)}
        onConfirm={handleDisablePin}
        title={language === 'ne' ? 'पिन लक हटाउनुहुन्छ?' : 'Disable App PIN Lock?'}
        message={
          language === 'ne'
            ? 'पिन हटाएपछि एप खोल्दा पिन सोधिने छैन। तपाईं पछि जुनसुकै बेला नयाँ पिन राख्न सक्नुहुन्छ।'
            : 'Anyone with access to this device will be able to open Mero Bike without entering a PIN. You can set a new PIN anytime.'
        }
        confirmLabel={language === 'ne' ? 'पिन हटाउनुहोस्' : 'Disable PIN'}
        cancelLabel={language === 'ne' ? 'रद्द गर्नुहोस्' : 'Cancel'}
        icon={<KeyRound className="w-5 h-5" />}
        variant="danger"
      />

      {/* Explicit Reset All Data Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetAllData}
        title={language === 'ne' ? 'सबै स्थानीय डाटा मेटाउनुहुन्छ?' : 'Erase All Local Data?'}
        subtitle={language === 'ne' ? 'यो कार्य पूर्ववत गर्न सकिँदैन' : 'This action cannot be undone'}
        message={
          language === 'ne'
            ? `यसले ${tableCounts.bikes} सवारी, ${tableCounts.services} सर्भिस, ${tableCounts.renewals} कर नवीकरण, ${tableCounts.expenses} खर्च, ${tableCounts.documents} कागजात, ${tableCounts.components} पार्टपुर्जा रेकर्ड र सबै सेटिङहरू स्थायी रूपमा मेटाउनेछ।`
            : `This will permanently delete ${tableCounts.bikes} vehicle(s), ${tableCounts.services} service record(s), ${tableCounts.renewals} tax renewal(s), ${tableCounts.expenses} expense(s), ${tableCounts.documents} document(s), ${tableCounts.components} component record(s), and all settings & PIN data.`
        }
        confirmLabel={language === 'ne' ? 'स्थायी रूपमा मेटाउनुहोस्' : 'Yes, Reset Everything'}
        cancelLabel={language === 'ne' ? 'रद्द गर्नुहोस्' : 'Keep My Data'}
        icon={<Trash2 className="w-5 h-5" />}
        variant="danger"
        loading={isResetting}
      />
    </>
  );
};
