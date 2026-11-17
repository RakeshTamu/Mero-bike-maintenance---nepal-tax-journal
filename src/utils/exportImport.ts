import { db } from '../db/db';
import { AppSettings, AppTheme, VehicleCategory } from '../types';
import { THEMES, applyThemeTokens } from './theme';

export interface BackupTableCounts {
  bikes: number;
  services: number;
  renewals: number;
  expenses: number;
  documents: number;
  components: number;
  settings: number;
}

export interface BackupImportResult {
  success: boolean;
  message: string;
  counts?: BackupTableCounts;
}

export interface BackupMeta {
  ownerName?: string;
  selectedBikeId?: number;
  theme?: AppTheme;
  language?: 'en' | 'ne';
}

const VALID_VEHICLE_CATEGORIES: VehicleCategory[] = ['Bike', 'Scooter', 'Car', 'Electric', 'Other'];

const LOCAL_STORAGE_KEYS = [
  'sawaari_owner_name',
  'sawaari_theme',
  'sawaari_language',
  'sawaari_selected_bike_id',
  'sawaari_onboarding_status',
  'sawaari_onboarding_draft',
  'merobike_notification_log'
] as const;

function toPositiveInt(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return undefined;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

function toNonNegativeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function readLocalStorageSafe(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeLocalStorageSafe(key: string, value: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore storage errors
  }
}

function dedupeRecords<T extends Record<string, any>>(
  items: unknown,
  normalizeRecord: (raw: Record<string, any>) => T | null,
  naturalKeyFn: (item: T) => string
): T[] {
  if (!Array.isArray(items)) return [];
  const seenIds = new Set<number>();
  const seenNaturalKeys = new Set<string>();
  const result: T[] = [];

  for (const raw of items) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const normalized = normalizeRecord(raw as Record<string, any>);
    if (!normalized) continue;

    const record = normalized as Record<string, any>;
    const coercedId = toPositiveInt(record.id);
    if (coercedId !== undefined) {
      record.id = coercedId;
      if (seenIds.has(coercedId)) continue;
      seenIds.add(coercedId);
    } else {
      delete record.id;
    }

    const natKey = naturalKeyFn(normalized);
    if (natKey && seenNaturalKeys.has(natKey)) {
      continue;
    }
    if (natKey) {
      seenNaturalKeys.add(natKey);
    }

    result.push(normalized);
  }
  return result;
}

function dedupeSettingsEntries(items: unknown): { key: string; value: any }[] {
  const map = new Map<string, { key: string; value: any }>();

  if (Array.isArray(items)) {
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as { key?: unknown; value?: unknown };
      if (typeof entry.key === 'string' && entry.key.trim().length > 0) {
        const cleanKey = entry.key.trim();
        map.set(cleanKey, { key: cleanKey, value: entry.value });
      }
    }
  } else if (items && typeof items === 'object') {
    for (const [k, v] of Object.entries(items as Record<string, unknown>)) {
      if (typeof k === 'string' && k.trim().length > 0) {
        const cleanKey = k.trim();
        map.set(cleanKey, { key: cleanKey, value: v });
      }
    }
  }

  return Array.from(map.values());
}

export async function getBackupTableCounts(): Promise<BackupTableCounts> {
  const [bikes, services, renewals, expenses, documents, components, settings] = await Promise.all([
    db.bikes.count(),
    db.services.count(),
    db.renewals.count(),
    db.expenses.count(),
    db.documents.count(),
    db.components ? db.components.count() : Promise.resolve(0),
    db.settings.count()
  ]);

  return { bikes, services, renewals, expenses, documents, components, settings };
}

export async function buildBackupPayload() {
  const [bikes, services, renewals, expenses, documents, components, rawSettings] = await Promise.all([
    db.bikes.toArray(),
    db.services.toArray(),
    db.renewals.toArray(),
    db.expenses.toArray(),
    db.documents.toArray(),
    db.components ? db.components.toArray() : Promise.resolve([]),
    db.settings.toArray()
  ]);

  const rawOwner = readLocalStorageSafe('sawaari_owner_name')?.trim() || '';
  const ownerName = rawOwner && rawOwner !== 'Kiran Thapa' ? rawOwner : undefined;
  const cachedBikeId = toPositiveInt(readLocalStorageSafe('sawaari_selected_bike_id'));
  const cachedThemeRaw = readLocalStorageSafe('sawaari_theme') as AppTheme | null;
  const cachedTheme: AppTheme | undefined = cachedThemeRaw && THEMES[cachedThemeRaw] ? cachedThemeRaw : undefined;
  const cachedLangRaw = readLocalStorageSafe('sawaari_language');
  const cachedLang: 'en' | 'ne' | undefined = cachedLangRaw === 'ne' || cachedLangRaw === 'en' ? cachedLangRaw : undefined;

  // Ensure app_settings is always included if user customized theme/language even before toggling PIN
  const settings = [...rawSettings];
  const appSettingsIdx = settings.findIndex((s) => s.key === 'app_settings');
  if (appSettingsIdx === -1 && (cachedTheme || cachedLang)) {
    const synthesized: AppSettings = {
      isPinEnabled: false,
      isBiometricEnabled: false,
      language: cachedLang || 'en',
      theme: cachedTheme || 'oled',
      autoLockMinutes: 0
    };
    settings.push({ key: 'app_settings', value: synthesized });
  }

  const savedAppSettings = settings.find((s) => s.key === 'app_settings')?.value as Partial<AppSettings> | undefined;
  const meta: BackupMeta = {};
  if (ownerName) meta.ownerName = ownerName;
  if (cachedBikeId) meta.selectedBikeId = cachedBikeId;
  if (savedAppSettings?.theme && THEMES[savedAppSettings.theme]) {
    meta.theme = savedAppSettings.theme;
  } else if (cachedTheme) {
    meta.theme = cachedTheme;
  }
  if (savedAppSettings?.language === 'ne' || savedAppSettings?.language === 'en') {
    meta.language = savedAppSettings.language;
  } else if (cachedLang) {
    meta.language = cachedLang;
  }

  return {
    app: 'Mero Bike - Bike & Nepal Tax Journal',
    version: '1.1.0',
    exportDate: new Date().toISOString(),
    meta: Object.keys(meta).length > 0 ? meta : undefined,
    data: {
      bikes,
      services,
      renewals,
      expenses,
      documents,
      components,
      settings
    }
  };
}

/**
 * Exports all IndexedDB data (including vehicles, services, renewals, expenses, documents, components, and settings)
 * into a portable JSON backup file.
 */
export async function exportJsonBackup(): Promise<BackupTableCounts> {
  const backupData = await buildBackupPayload();

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = `merobike_backup_${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    bikes: backupData.data.bikes.length,
    services: backupData.data.services.length,
    renewals: backupData.data.renewals.length,
    expenses: backupData.data.expenses.length,
    documents: backupData.data.documents.length,
    components: backupData.data.components.length,
    settings: backupData.data.settings.length
  };
}

export function validateAndNormalizeBackup(parsed: any): {
  valid: boolean;
  message?: string;
  normalized?: {
    bikes: any[];
    services: any[];
    renewals: any[];
    expenses: any[];
    documents: any[];
    components: any[];
    settings: { key: string; value: any }[];
    meta: BackupMeta;
  };
} {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, message: 'Invalid Mero Bike backup file format.' };
  }

  // Support both wrapped `{ data: { ... } }` and direct `{ bikes: [...] }` formats
  const source =
    parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
      ? parsed.data
      : parsed;

  const rawBikes = source.bikes ?? source.vehicles;
  if (!Array.isArray(rawBikes)) {
    return { valid: false, message: 'Invalid backup file: missing vehicles array.' };
  }

  const bikes = dedupeRecords(
    rawBikes,
    (raw) => {
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      const registrationNumber =
        typeof raw.registrationNumber === 'string' ? raw.registrationNumber.trim() : '';
      if (!name && !registrationNumber) return null;

      const category: VehicleCategory = VALID_VEHICLE_CATEGORIES.includes(raw.category)
        ? raw.category
        : 'Bike';

      const normalizedBike: Record<string, any> = {
        ...raw,
        name: name || registrationNumber || 'Vehicle',
        category,
        registrationNumber,
        boughtYearBS: typeof raw.boughtYearBS === 'string' ? raw.boughtYearBS : '',
        boughtYearAD: typeof raw.boughtYearAD === 'string' ? raw.boughtYearAD : '',
        cc: toNonNegativeNumber(raw.cc, 0),
        createdDate: typeof raw.createdDate === 'string' ? raw.createdDate : new Date().toISOString().slice(0, 10)
      };

      if (raw.odometerKm !== undefined && raw.odometerKm !== null && raw.odometerKm !== '') {
        const odo = Number(raw.odometerKm);
        if (Number.isFinite(odo) && odo >= 0) {
          normalizedBike.odometerKm = odo;
        } else {
          delete normalizedBike.odometerKm;
        }
      }

      if (typeof raw.photoUrl === 'string' && raw.photoUrl.length > 0) {
        normalizedBike.photoUrl = raw.photoUrl;
      } else {
        delete normalizedBike.photoUrl;
      }

      if (typeof raw.platePhotoUrl === 'string' && raw.platePhotoUrl.length > 0) {
        normalizedBike.platePhotoUrl = raw.platePhotoUrl;
      } else {
        delete normalizedBike.platePhotoUrl;
      }

      normalizedBike.showPlateAsPhoto = Boolean(raw.showPlateAsPhoto && normalizedBike.platePhotoUrl);
      normalizedBike.isPrimary = Boolean(raw.isPrimary);

      return normalizedBike;
    },
    (b) =>
      `${String(b.name || '').toLowerCase()}|${String(b.registrationNumber || '').toUpperCase()}|${String(
        b.boughtYearAD || ''
      )}`
  );

  // Determine fallback bikeId for orphan records only if single vehicle or keep valid numeric bikeId
  const fallbackBikeId = bikes.length === 1 && bikes[0].id ? bikes[0].id : 1;

  const services = dedupeRecords(
    source.services,
    (raw) => {
      const bikeId = toPositiveInt(raw.bikeId) ?? fallbackBikeId;
      const serviceDateAD = typeof raw.serviceDateAD === 'string' ? raw.serviceDateAD : '';
      const serviceDateBS = typeof raw.serviceDateBS === 'string' ? raw.serviceDateBS : '';
      const workDone = typeof raw.workDone === 'string' ? raw.workDone : '';
      const serviceCenter = typeof raw.serviceCenter === 'string' ? raw.serviceCenter : '';
      if (!serviceDateAD && !serviceDateBS && !workDone && !serviceCenter) return null;

      const normalized: Record<string, any> = {
        ...raw,
        bikeId,
        serviceDateAD,
        serviceDateBS,
        odometerKm: toNonNegativeNumber(raw.odometerKm, 0),
        cost: toNonNegativeNumber(raw.cost, 0),
        serviceCenter,
        workDone
      };

      if (Array.isArray(raw.categories)) {
        normalized.categories = raw.categories.filter((c: unknown) => typeof c === 'string' && c.trim().length > 0);
      }
      if (Array.isArray(raw.subItems)) {
        normalized.subItems = raw.subItems.filter(
          (item: unknown) => item && typeof item === 'object'
        );
      }
      if (typeof raw.receiptPhoto === 'string' && raw.receiptPhoto.length > 0) {
        normalized.receiptPhoto = raw.receiptPhoto;
      } else {
        delete normalized.receiptPhoto;
      }
      return normalized;
    },
    (s) =>
      `${s.bikeId}|${s.serviceDateAD}|${s.odometerKm}|${s.cost}|${String(s.workDone || '').trim().toLowerCase()}|${String(
        s.serviceCenter || ''
      )
        .trim()
        .toLowerCase()}`
  );

  const renewals = dedupeRecords(
    source.renewals ?? source.taxRenewals,
    (raw) => {
      const bikeId = toPositiveInt(raw.bikeId) ?? fallbackBikeId;
      const validUntilAD = typeof raw.validUntilAD === 'string' ? raw.validUntilAD : '';
      const validUntilBS = typeof raw.validUntilBS === 'string' ? raw.validUntilBS : '';
      const renewedDateAD = typeof raw.renewedDateAD === 'string' ? raw.renewedDateAD : '';
      const renewedDateBS = typeof raw.renewedDateBS === 'string' ? raw.renewedDateBS : '';
      if (!validUntilAD && !validUntilBS && !renewedDateAD && !renewedDateBS) return null;

      const taxAmount = toNonNegativeNumber(raw.taxAmount, 0);
      const fineAmount = toNonNegativeNumber(raw.fineAmount, 0);
      const totalPaid = toNonNegativeNumber(raw.totalPaid, taxAmount + fineAmount);

      const bluebookPages = Array.isArray(raw.bluebookPages)
        ? raw.bluebookPages.filter((p: unknown) => typeof p === 'string' && p.length > 0)
        : typeof raw.bluebookPages === 'string' && raw.bluebookPages.length > 0
        ? [raw.bluebookPages]
        : [];

      const normalized: Record<string, any> = {
        ...raw,
        bikeId,
        renewedDateAD,
        renewedDateBS,
        validUntilAD,
        validUntilBS,
        taxAmount,
        fineAmount,
        totalPaid,
        officeLocation: typeof raw.officeLocation === 'string' ? raw.officeLocation : '',
        bluebookPages
      };

      if (typeof raw.receiptPhoto === 'string' && raw.receiptPhoto.length > 0) {
        normalized.receiptPhoto = raw.receiptPhoto;
      } else {
        delete normalized.receiptPhoto;
      }
      return normalized;
    },
    (r) =>
      `${r.bikeId}|${r.renewedDateAD}|${r.validUntilAD}|${r.totalPaid}|${String(r.officeLocation || '')
        .trim()
        .toLowerCase()}`
  );

  const expenses = dedupeRecords(
    source.expenses,
    (raw) => {
      const bikeId = toPositiveInt(raw.bikeId) ?? fallbackBikeId;
      const dateAD = typeof raw.dateAD === 'string' ? raw.dateAD : '';
      const dateBS = typeof raw.dateBS === 'string' ? raw.dateBS : '';
      const description = typeof raw.description === 'string' ? raw.description : '';
      if (!dateAD && !dateBS && !description) return null;

      return {
        ...raw,
        bikeId,
        dateAD,
        dateBS,
        category: typeof raw.category === 'string' && raw.category ? raw.category : 'accessories',
        amount: toNonNegativeNumber(raw.amount, 0),
        description
      };
    },
    (e) =>
      `${e.bikeId}|${e.dateAD}|${e.category}|${e.amount}|${String(e.description || '').trim().toLowerCase()}`
  );

  const documents = dedupeRecords(
    source.documents,
    (raw) => {
      const bikeId = toPositiveInt(raw.bikeId) ?? fallbackBikeId;
      const title = typeof raw.title === 'string' ? raw.title : '';
      const imageBase64 = typeof raw.imageBase64 === 'string' ? raw.imageBase64 : '';
      if (!title && !imageBase64) return null;

      return {
        ...raw,
        bikeId,
        title: title || 'Document',
        category: typeof raw.category === 'string' && raw.category ? raw.category : 'other',
        imageBase64,
        uploadDate: typeof raw.uploadDate === 'string' ? raw.uploadDate : new Date().toISOString().slice(0, 10)
      };
    },
    (d) =>
      `${d.bikeId}|${d.category}|${String(d.title || '').trim().toLowerCase()}|${d.uploadDate || ''}|${String(
        d.imageBase64 || ''
      ).slice(0, 48)}`
  );

  const components = dedupeRecords(
    source.components ?? source.parts,
    (raw) => {
      const bikeId = toPositiveInt(raw.bikeId) ?? fallbackBikeId;
      const name = typeof raw.name === 'string' ? raw.name : '';
      const type = typeof raw.type === 'string' ? raw.type : '';
      if (!name && !type) return null;

      return {
        ...raw,
        bikeId,
        type: type || 'engine_oil',
        name: name || 'Component',
        lastReplacedKm: toNonNegativeNumber(raw.lastReplacedKm, 0),
        lifespanKm: Math.max(1, toNonNegativeNumber(raw.lifespanKm, 1000)),
        lastReplacedDateAD: typeof raw.lastReplacedDateAD === 'string' ? raw.lastReplacedDateAD : ''
      };
    },
    (c) =>
      `${c.bikeId}|${c.type}|${String(c.name || '').trim().toLowerCase()}|${c.lastReplacedKm}|${c.lastReplacedDateAD}`
  );

  const settings = dedupeSettingsEntries(source.settings);

  const metaOwnerRaw = typeof parsed.meta?.ownerName === 'string' ? parsed.meta.ownerName.trim() : '';
  const metaOwnerName = metaOwnerRaw && metaOwnerRaw !== 'Kiran Thapa' ? metaOwnerRaw : undefined;
  const metaSelectedBikeId = toPositiveInt(parsed.meta?.selectedBikeId);
  const metaTheme =
    typeof parsed.meta?.theme === 'string' && THEMES[parsed.meta.theme as AppTheme]
      ? (parsed.meta.theme as AppTheme)
      : undefined;
  const metaLanguage =
    parsed.meta?.language === 'ne' || parsed.meta?.language === 'en' ? parsed.meta.language : undefined;

  return {
    valid: true,
    normalized: {
      bikes,
      services,
      renewals,
      expenses,
      documents,
      components,
      settings,
      meta: {
        ownerName: metaOwnerName,
        selectedBikeId: metaSelectedBikeId,
        theme: metaTheme,
        language: metaLanguage
      }
    }
  };
}

/**
 * Restores a validated backup payload atomically across all IndexedDB tables and syncs local preferences.
 */
export async function importBackupObject(parsed: unknown): Promise<BackupImportResult> {
  const check = validateAndNormalizeBackup(parsed);
  if (!check.valid || !check.normalized) {
    return { success: false, message: check.message || 'Invalid Mero Bike backup file format.' };
  }

  const { bikes, services, renewals, expenses, documents, components, settings, meta } = check.normalized;

  const tablesToSync = [
    db.bikes,
    db.services,
    db.renewals,
    db.expenses,
    db.documents,
    db.components,
    db.settings
  ];

  const restoredBikes = await db.transaction('rw', tablesToSync, async () => {
    await db.bikes.clear();
    await db.services.clear();
    await db.renewals.clear();
    await db.expenses.clear();
    await db.documents.clear();
    await db.components.clear();
    await db.settings.clear();

    if (bikes.length) await db.bikes.bulkPut(bikes);
    if (services.length) await db.services.bulkPut(services);
    if (renewals.length) await db.renewals.bulkPut(renewals);
    if (expenses.length) await db.expenses.bulkPut(expenses);
    if (documents.length) await db.documents.bulkPut(documents);
    if (components.length) await db.components.bulkPut(components);
    if (settings.length) await db.settings.bulkPut(settings);

    return await db.bikes.toArray();
  });

  // Sync cached preferences to localStorage cleanly
  writeLocalStorageSafe('sawaari_owner_name', meta.ownerName || null);

  const restoredAppSettings = settings.find((s) => s.key === 'app_settings')?.value as
    | Partial<AppSettings>
    | undefined;
  const restoredTheme =
    (restoredAppSettings?.theme && THEMES[restoredAppSettings.theme] ? restoredAppSettings.theme : undefined) ||
    meta.theme ||
    'oled';
  const restoredLang =
    restoredAppSettings?.language === 'ne' || restoredAppSettings?.language === 'en'
      ? restoredAppSettings.language
      : meta.language || 'en';

  writeLocalStorageSafe('sawaari_theme', restoredTheme);
  writeLocalStorageSafe('sawaari_language', restoredLang);
  applyThemeTokens(restoredTheme);

  if (restoredBikes.length > 0) {
    const preferredBike =
      (meta.selectedBikeId && restoredBikes.find((b) => b.id === meta.selectedBikeId)) ||
      restoredBikes.find((b) => b.isPrimary) ||
      restoredBikes[0];
    writeLocalStorageSafe('sawaari_selected_bike_id', preferredBike?.id ? String(preferredBike.id) : null);
    writeLocalStorageSafe('sawaari_onboarding_status', 'completed');
    writeLocalStorageSafe('sawaari_onboarding_draft', null);
  } else {
    writeLocalStorageSafe('sawaari_selected_bike_id', null);
  }

  return {
    success: true,
    message: 'Backup data successfully restored!',
    counts: {
      bikes: restoredBikes.length,
      services: services.length,
      renewals: renewals.length,
      expenses: expenses.length,
      documents: documents.length,
      components: components.length,
      settings: settings.length
    }
  };
}

/**
 * Imports a JSON backup file and restores all supported tables atomically without duplicating records.
 */
export async function importJsonBackup(file: File): Promise<BackupImportResult> {
  try {
    const text =
      typeof file.text === 'function'
        ? await file.text()
        : await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve((e.target?.result as string) || '');
            reader.onerror = () => reject(new Error('Failed to read file.'));
            reader.readAsText(file);
          });

    const parsed = JSON.parse(text);
    return await importBackupObject(parsed);
  } catch (err: any) {
    return {
      success: false,
      message: 'Error parsing backup: ' + (err?.message || 'Unknown error')
    };
  }
}

/**
 * Permanently clears all local IndexedDB tables and cached preferences inside a single transaction,
 * without automatically recreating any demo or sample records.
 */
export async function resetAllLocalData(): Promise<void> {
  const tablesToClear = [
    db.bikes,
    db.services,
    db.renewals,
    db.expenses,
    db.documents,
    db.components,
    db.settings
  ];

  await db.transaction('rw', tablesToClear, async () => {
    await db.bikes.clear();
    await db.services.clear();
    await db.renewals.clear();
    await db.expenses.clear();
    await db.documents.clear();
    await db.components.clear();
    await db.settings.clear();
  });

  for (const key of LOCAL_STORAGE_KEYS) {
    writeLocalStorageSafe(key, null);
  }
}

/**
 * Exports a completely self-contained, standalone single-file HTML version
 * with inline offline service worker and local data (including components & settings).
 */
export async function exportStandaloneHtmlFile() {
  const [bikes, services, renewals, expenses, documents, components, settings] = await Promise.all([
    db.bikes.toArray(),
    db.services.toArray(),
    db.renewals.toArray(),
    db.expenses.toArray(),
    db.documents.toArray(),
    db.components ? db.components.toArray() : Promise.resolve([]),
    db.settings.toArray()
  ]);

  const embeddedData = JSON.stringify({
    bikes,
    services,
    renewals,
    expenses,
    documents,
    components,
    settings
  });

  const htmlContent = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Mero Bike - Standalone Bike & Nepal Tax Journal</title>
  <meta name="theme-color" content="#000000">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/dexie@latest/dist/dexie.js"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background-color: #000000; color: #F5F8FA; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-thumb { background: rgba(167, 178, 190, 0.25); border-radius: 9999px; }
  </style>
</head>
<body class="bg-black text-[#F5F8FA] min-h-screen">
  <div id="standalone-root" class="max-w-md mx-auto p-4 pb-20">
    <header class="py-4 border-b border-[#252B30] flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-white">Mero Bike Standalone</h1>
        <p class="text-xs text-[#9CA3AF]">Your Bike. Your Records. One Place.</p>
      </div>
      <span class="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-1 rounded-md font-mono">100% Offline</span>
    </header>

    <main class="mt-6 space-y-6" id="app-content">
      <div id="bike-summary" class="bg-[#0D0F11] border border-[#252B30] rounded-2xl p-5">
        <div class="flex items-start justify-between">
          <div>
            <h2 id="bike-name" class="text-lg font-bold text-white">No Vehicle Recorded</h2>
            <p id="bike-plate" class="text-sm font-mono text-[#22D3EE] mt-0.5">---</p>
          </div>
          <div id="tax-badge" class="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#15191D] border border-[#252B30] text-[#9CA3AF]">
            Tax Status
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#252B30] text-xs">
          <div>
            <span class="text-[#9CA3AF]">Odometer:</span>
            <p id="bike-odo" class="font-bold font-mono tabular-nums text-white text-sm">-- km</p>
          </div>
          <div>
            <span class="text-[#9CA3AF]">Tax Expiry:</span>
            <p id="tax-expiry" class="font-bold font-mono tabular-nums text-white text-sm">--</p>
          </div>
        </div>
      </div>

      <div>
        <h3 class="text-sm font-semibold text-[#F5F8FA] mb-3">Recent Service Records</h3>
        <div id="service-list" class="space-y-2"></div>
      </div>

      <div class="p-4 bg-[#0D0F11] border border-[#252B30] rounded-xl text-xs space-y-2 text-[#9CA3AF]">
        <div class="font-semibold text-white">Nepal Vehicle Law: 90-Day Grace Period</div>
        <p>Under the Motor Vehicle & Transport Management Act, you have a 90-day grace period after your Blue Book tax expiry date with zero monetary fines.</p>
      </div>
    </main>
  </div>

  <script>
    const INITIAL_DATA = ${embeddedData};
    const sdb = new Dexie('SawaariStandaloneDB');
    sdb.version(1).stores({
      bikes: '++id, name, registrationNumber',
      services: '++id, bikeId, serviceDateAD',
      renewals: '++id, bikeId, validUntilAD',
      expenses: '++id, bikeId, dateAD',
      documents: '++id, bikeId, category',
      components: '++id, bikeId, type',
      settings: 'key'
    });

    async function initStandalone() {
      const count = await sdb.bikes.count();
      if (count === 0 && INITIAL_DATA.bikes && INITIAL_DATA.bikes.length > 0) {
        await sdb.bikes.bulkPut(INITIAL_DATA.bikes);
        if (INITIAL_DATA.services?.length) await sdb.services.bulkPut(INITIAL_DATA.services);
        if (INITIAL_DATA.renewals?.length) await sdb.renewals.bulkPut(INITIAL_DATA.renewals);
        if (INITIAL_DATA.expenses?.length) await sdb.expenses.bulkPut(INITIAL_DATA.expenses);
        if (INITIAL_DATA.documents?.length) await sdb.documents.bulkPut(INITIAL_DATA.documents);
        if (INITIAL_DATA.components?.length) await sdb.components.bulkPut(INITIAL_DATA.components);
        if (INITIAL_DATA.settings?.length) await sdb.settings.bulkPut(INITIAL_DATA.settings);
      }

      const bike = await sdb.bikes.toCollection().first();
      if (bike) {
        document.getElementById('bike-name').textContent = bike.name;
        document.getElementById('bike-plate').textContent = bike.registrationNumber || '---';
        document.getElementById('bike-odo').textContent = (bike.odometerKm || 0).toLocaleString() + ' km';
      }

      const renewals = await sdb.renewals.toArray();
      const renewal = renewals.sort((a, b) => new Date(b.validUntilAD) - new Date(a.validUntilAD))[0];
      if (renewal && renewal.validUntilAD) {
        document.getElementById('tax-expiry').textContent = (renewal.validUntilBS || '') + ' BS (' + renewal.validUntilAD + ')';
        const diff = Math.ceil((new Date(renewal.validUntilAD) - new Date()) / (1000 * 60 * 60 * 24));
        const badge = document.getElementById('tax-badge');
        if (diff >= 0) {
          badge.textContent = diff + ' Days Left (VALID)';
          badge.className = 'px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800';
        } else if (Math.abs(diff) <= 90) {
          const grace = 90 - Math.abs(diff);
          badge.textContent = grace + ' Days Grace Left';
          badge.className = 'px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-950 text-amber-400 border border-amber-800';
        } else {
          badge.textContent = 'TAX OVERDUE';
          badge.className = 'px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-rose-950 text-rose-400 border border-rose-800';
        }
      }

      const services = await sdb.services.toArray();
      const list = document.getElementById('service-list');
      list.innerHTML = '';
      if (services.length === 0) {
        list.innerHTML = '<p class="text-xs text-[#9CA3AF]">No service records yet.</p>';
      } else {
        services.slice(-5).reverse().forEach(s => {
          const div = document.createElement('div');
          div.className = 'p-3 bg-[#0D0F11] border border-[#252B30] rounded-xl flex items-center justify-between text-xs';
          const titleEl = document.createElement('p');
          titleEl.className = 'font-medium text-white';
          titleEl.textContent = s.workDone || 'Service Visit';
          const subEl = document.createElement('p');
          subEl.className = 'text-[#9CA3AF] mt-0.5 font-mono tabular-nums';
          subEl.textContent = (s.serviceCenter || 'Workshop') + ' · ' + (s.odometerKm || 0).toLocaleString() + ' km';
          const leftDiv = document.createElement('div');
          leftDiv.appendChild(titleEl);
          leftDiv.appendChild(subEl);
          const costDiv = document.createElement('div');
          costDiv.className = 'text-right font-mono tabular-nums font-bold text-[#22D3EE]';
          costDiv.textContent = 'NPR ' + (s.cost || 0).toLocaleString();
          div.appendChild(leftDiv);
          div.appendChild(costDiv);
          list.appendChild(div);
        });
      }
    }

    if ('serviceWorker' in navigator) {
      const swCode = "self.addEventListener('install', e => self.skipWaiting()); self.addEventListener('activate', e => clients.claim()); self.addEventListener('fetch', e => {});";
      const blob = new Blob([swCode], { type: 'application/javascript' });
      const swUrl = URL.createObjectURL(blob);
      navigator.serviceWorker.register(swUrl).catch(() => {});
    }

    window.addEventListener('DOMContentLoaded', initStandalone);
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `merobike-bike-journal-standalone.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
