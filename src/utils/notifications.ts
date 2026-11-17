import { db } from '../db/db';
import { AppSettings, Bike, DocumentItem, RenewalRecord, ServiceRecord } from '../types';
import { calculateNepalTaxStatus, getEstimatedBaseTax } from './nepalTax';
import {
  diffDays,
  formatAdDate,
  formatBsDisplayDate,
  parseLocalCalendarDate
} from './nepaliCalendar';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface DueNotificationItem {
  dedupeKey: string;
  kind: 'service' | 'tax' | 'document';
  bikeId: number;
  recordId?: number;
  targetTab: 'services' | 'tax' | 'vault';
  title: string;
  body: string;
  severity: 'warning' | 'error';
}

export const NOTIFICATION_LOG_STORAGE_KEY = 'merobike_notification_log';
export const NOTIFICATION_LOG_DB_KEY = 'notification_dispatch_log';
const MAX_LOG_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_LOG_ENTRIES = 250;

const inFlightDedupeKeys = new Set<string>();
let dispatchQueue: Promise<DueNotificationItem[]> = Promise.resolve([]);

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermissionState(): NotificationPermissionState {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    return window.Notification.permission as NotificationPermissionState;
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const current = window.Notification.permission;
    if (current === 'granted' || current === 'denied') {
      return current;
    }
    const result = await window.Notification.requestPermission();
    return (result as NotificationPermissionState) || getNotificationPermissionState();
  } catch {
    return getNotificationPermissionState();
  }
}

export function reminderIntervalToDays(
  interval?: 'today' | '1_week' | '2_weeks' | '4_weeks'
): number {
  switch (interval) {
    case 'today':
      return 0;
    case '2_weeks':
      return 14;
    case '4_weeks':
      return 28;
    case '1_week':
    default:
      return 7;
  }
}

function getDocumentCategoryLabel(category: string, language: 'en' | 'ne'): string {
  if (category === 'insurance') return language === 'ne' ? 'बीमा' : 'Insurance';
  if (category === 'bluebook' || category === 'bluebook_front' || category === 'bluebook_tax') {
    return language === 'ne' ? 'ब्लुबुक' : 'Blue Book';
  }
  if (category === 'license' || category === 'license_front' || category === 'license_back') {
    return language === 'ne' ? 'लाइसेन्स' : 'Driving Licence';
  }
  if (category === 'pollution') return language === 'ne' ? 'प्रदूषण पास' : 'Pollution';
  return language === 'ne' ? 'कागजात' : 'Document';
}

export function evaluateDueNotifications(params: {
  bikes: Bike[];
  services: ServiceRecord[];
  renewals: RenewalRecord[];
  documents: DocumentItem[];
  settings: Partial<AppSettings>;
  language: 'en' | 'ne';
  now?: Date | string;
}): DueNotificationItem[] {
  const { bikes, services, renewals, documents, settings, language, now } = params;

  if (settings.notificationsEnabled === false) {
    return [];
  }

  const serviceEnabled = settings.serviceRemindersEnabled !== false;
  const taxEnabled = settings.taxRemindersEnabled !== false;
  const docsEnabled = settings.documentExpiryRemindersEnabled !== false;

  const today = parseLocalCalendarDate(now ?? new Date());
  if (isNaN(today.getTime())) return [];

  const alerts: DueNotificationItem[] = [];
  const bikeById = new Map<number, Bike>();
  for (const bike of bikes) {
    if (typeof bike.id === 'number') {
      bikeById.set(bike.id, bike);
    }
  }

  // 1. Maintenance Reminders (per vehicle, latest service record)
  if (serviceEnabled) {
    for (const bike of bikes) {
      if (typeof bike.id !== 'number') continue;
      const bikeServices = services
        .filter((s) => s.bikeId === bike.id)
        .sort((a, b) => new Date(b.serviceDateAD).getTime() - new Date(a.serviceDateAD).getTime());

      const latestService = bikeServices[0];
      if (!latestService || latestService.enableReminder === false) continue;

      const leadDays = reminderIntervalToDays(latestService.reminderInterval);

      if (latestService.nextServiceDateAD) {
        const baseDate = parseLocalCalendarDate(latestService.nextServiceDateAD);
        if (!isNaN(baseDate.getTime())) {
          const snooze = Number(latestService.snoozeDays || 0);
          const effectiveDate = new Date(
            baseDate.getFullYear(),
            baseDate.getMonth(),
            baseDate.getDate() + snooze,
            12,
            0,
            0
          );
          const effectiveIso = formatAdDate(effectiveDate);
          const daysUntil = diffDays(effectiveDate, today);

          let stage: string | null = null;
          let severity: 'warning' | 'error' = 'warning';
          if (daysUntil < 0) {
            stage = 'overdue';
            severity = 'error';
          } else if (daysUntil === 0) {
            stage = 'due_today';
            severity = 'error';
          } else if (daysUntil <= leadDays) {
            stage = `within_${leadDays}d`;
            severity = 'warning';
          }

          if (stage) {
            const bsLabel = formatBsDisplayDate(effectiveDate, language);
            alerts.push({
              dedupeKey: `maint:date:${bike.id}:${latestService.id || 0}:${effectiveIso}:${stage}`,
              kind: 'service',
              bikeId: bike.id,
              recordId: latestService.id,
              targetTab: 'services',
              severity,
              title:
                language === 'ne'
                  ? `${bike.name}: मर्मत ${daysUntil <= 0 ? 'म्याद' : 'रिमाइन्डर'}`
                  : `${bike.name}: Maintenance ${daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Due Today' : 'Due Soon'}`,
              body:
                daysUntil < 0
                  ? language === 'ne'
                    ? `सर्भिस मिति (${bsLabel}) ${Math.abs(daysUntil)} दिन नाघेको छ।`
                    : `Service due date (${bsLabel}) passed ${Math.abs(daysUntil)} day(s) ago.`
                  : daysUntil === 0
                  ? language === 'ne'
                    ? `आज (${bsLabel}) सवारी मर्मत गर्ने दिन हो।`
                    : `Scheduled maintenance is due today (${bsLabel}).`
                  : language === 'ne'
                  ? `अर्को मर्मत मिति ${bsLabel} (${daysUntil} दिन बाँकी)।`
                  : `Next service due in ${daysUntil} day(s) on ${bsLabel}.`
            });
          }
        }
      }

      if (
        typeof latestService.nextServiceKm === 'number' &&
        latestService.nextServiceKm > 0 &&
        typeof bike.odometerKm === 'number'
      ) {
        const kmLeft = latestService.nextServiceKm - bike.odometerKm;
        let kmStage: string | null = null;
        let severity: 'warning' | 'error' = 'warning';
        if (kmLeft <= 0) {
          kmStage = 'km_overdue';
          severity = 'error';
        } else if (kmLeft <= 500) {
          kmStage = 'km_due_soon';
          severity = 'warning';
        }

        if (kmStage) {
          alerts.push({
            dedupeKey: `maint:km:${bike.id}:${latestService.id || 0}:${latestService.nextServiceKm}:${kmStage}`,
            kind: 'service',
            bikeId: bike.id,
            recordId: latestService.id,
            targetTab: 'services',
            severity,
            title:
              language === 'ne'
                ? `${bike.name}: ओडोमिटर मर्मत अलर्ट`
                : `${bike.name}: Service Mileage ${kmLeft <= 0 ? 'Reached' : 'Approaching'}`,
            body:
              kmLeft <= 0
                ? language === 'ne'
                  ? `लक्षित ${latestService.nextServiceKm.toLocaleString()} km पूरा भयो (हाल ${bike.odometerKm.toLocaleString()} km)।`
                  : `Target ${latestService.nextServiceKm.toLocaleString()} km reached (current: ${bike.odometerKm.toLocaleString()} km).`
                : language === 'ne'
                ? `अर्को मर्मत आउन मात्र ${kmLeft.toLocaleString()} km बाँकी छ (${latestService.nextServiceKm.toLocaleString()} km लक्ष्य)।`
                : `Only ${kmLeft.toLocaleString()} km left until ${latestService.nextServiceKm.toLocaleString()} km service.`
          });
        }
      }
    }
  }

  // 2. Tax Renewal Reminders (per vehicle, latest renewal record)
  if (taxEnabled) {
    for (const bike of bikes) {
      if (typeof bike.id !== 'number') continue;
      const bikeRenewals = renewals
        .filter((r) => r.bikeId === bike.id)
        .sort((a, b) => new Date(b.validUntilAD).getTime() - new Date(a.validUntilAD).getTime());

      const latestRenewal = bikeRenewals[0];
      if (!latestRenewal || latestRenewal.enableReminder === false || !latestRenewal.validUntilAD) {
        continue;
      }

      const leadDays = reminderIntervalToDays(latestRenewal.reminderInterval);
      const baseTax = getEstimatedBaseTax(bike.cc, bike.category);
      const taxStatus = calculateNepalTaxStatus(latestRenewal.validUntilAD, baseTax, today);

      let stage: string | null = null;
      let severity: 'warning' | 'error' = 'warning';
      if (taxStatus.status === 'VALID') {
        if (taxStatus.daysRemaining === 0) {
          stage = 'due_today';
          severity = 'error';
        } else if (taxStatus.daysRemaining === 1) {
          stage = '1_day';
          severity = 'warning';
        } else if (leadDays >= 5 && taxStatus.daysRemaining <= 5) {
          stage = '5_days';
          severity = 'warning';
        } else if (leadDays > 0 && taxStatus.daysRemaining <= leadDays) {
          stage = `within_${leadDays}d`;
          severity = 'warning';
        }
      } else if (taxStatus.status === 'GRACE_PERIOD') {
        stage = taxStatus.daysLeftInGrace <= 7 ? 'grace_ending' : 'grace_period';
        severity = taxStatus.daysLeftInGrace <= 7 ? 'error' : 'warning';
      } else {
        stage = 'fined';
        severity = 'error';
      }

      if (stage) {
        const bsDate = formatBsDisplayDate(latestRenewal.validUntilAD, language);
        alerts.push({
          dedupeKey: `tax:${bike.id}:${latestRenewal.id || 0}:${latestRenewal.validUntilAD}:${stage}`,
          kind: 'tax',
          bikeId: bike.id,
          recordId: latestRenewal.id,
          targetTab: 'tax',
          severity,
          title:
            language === 'ne'
              ? `${bike.name}: ब्लुबुक कर अलर्ट`
              : `${bike.name}: Blue Book Tax ${
                  taxStatus.status === 'VALID'
                    ? taxStatus.daysRemaining === 0
                      ? 'Expires Today'
                      : 'Renewal Due Soon'
                    : taxStatus.status === 'GRACE_PERIOD'
                    ? 'Grace Period'
                    : 'Overdue'
                }`,
          body:
            taxStatus.status === 'VALID'
              ? language === 'ne'
                ? `कर म्याद ${bsDate} मा समाप्त हुँदैछ (${taxStatus.daysRemaining} दिन बाँकी)।`
                : `Tax expires on ${bsDate} (${taxStatus.daysRemaining} day(s) remaining).`
              : taxStatus.status === 'GRACE_PERIOD'
              ? language === 'ne'
                ? `९०-दिने ग्रेस अवधिमा ${taxStatus.daysLeftInGrace} दिन बाँकी छन् (${bsDate} मा म्याद सकिएको)।`
                : `Within 90-day fine-free grace period: ${taxStatus.daysLeftInGrace} day(s) left before penalty.`
              : language === 'ne'
              ? `कर म्याद ${taxStatus.daysOverdue} दिन नाघेको छ (अनुमानित जरिवाना रु. ${taxStatus.estimatedFineAmount.toLocaleString()})।`
              : `Tax overdue by ${taxStatus.daysOverdue} day(s). Estimated fine: Rs. ${taxStatus.estimatedFineAmount.toLocaleString()}.`
        });
      }
    }
  }

  // 3. Document Expiry Warnings (Insurance, Blue Book, Licence, Pollution, etc.)
  if (docsEnabled) {
    for (const doc of documents) {
      if (!doc.expiryDate) continue;
      const expiry = parseLocalCalendarDate(doc.expiryDate);
      if (isNaN(expiry.getTime())) continue;

      const daysLeft = diffDays(expiry, today);
      let stage: string | null = null;
      let severity: 'warning' | 'error' = 'warning';

      if (daysLeft < 0) {
        stage = 'expired';
        severity = 'error';
      } else if (daysLeft === 0) {
        stage = 'due_today';
        severity = 'error';
      } else if (daysLeft <= 7) {
        stage = '7_days';
        severity = 'warning';
      } else if (daysLeft <= 30) {
        stage = '30_days';
        severity = 'warning';
      }

      if (stage) {
        const bike = bikeById.get(doc.bikeId);
        const catLabel = getDocumentCategoryLabel(doc.category, language);
        const bsDate = formatBsDisplayDate(doc.expiryDate, language);
        const prefix = bike ? `${bike.name} · ` : '';

        alerts.push({
          dedupeKey: `doc:${doc.bikeId}:${doc.id || doc.title}:${doc.expiryDate}:${stage}`,
          kind: 'document',
          bikeId: doc.bikeId,
          recordId: doc.id,
          targetTab: 'vault',
          severity,
          title:
            language === 'ne'
              ? `${prefix}${doc.title} (${catLabel})`
              : `${prefix}${doc.title} (${catLabel}) ${
                  daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Expires Today' : 'Expiring Soon'
                }`,
          body:
            daysLeft < 0
              ? language === 'ne'
                ? `म्याद ${bsDate} मा समाप्त भइसकेको छ (${Math.abs(daysLeft)} दिन पहिले)।`
                : `Expired on ${bsDate} (${Math.abs(daysLeft)} day(s) ago). Renew to stay compliant.`
              : daysLeft === 0
              ? language === 'ne'
                ? `आज (${bsDate}) म्याद समाप्त हुँदैछ।`
                : `Document expires today (${bsDate}).`
              : language === 'ne'
              ? `म्याद ${bsDate} मा समाप्त हुँदैछ (${daysLeft} दिन बाँकी)।`
              : `Expires in ${daysLeft} day(s) on ${bsDate}.`
        });
      }
    }
  }

  return alerts;
}

export function pruneNotificationLog(
  rawLog: Record<string, number>,
  nowMs: number = Date.now()
): Record<string, number> {
  const entries = Object.entries(rawLog || {})
    .filter(([, ts]) => typeof ts === 'number' && Number.isFinite(ts) && nowMs - ts <= MAX_LOG_AGE_MS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_LOG_ENTRIES);

  return Object.fromEntries(entries);
}

export async function readNotificationDispatchLog(): Promise<Record<string, number>> {
  let merged: Record<string, number> = {};

  try {
    const dbEntry = await db.settings.get(NOTIFICATION_LOG_DB_KEY).catch(() => null);
    if (dbEntry && dbEntry.value && typeof dbEntry.value === 'object') {
      merged = { ...merged, ...(dbEntry.value as Record<string, number>) };
    }
  } catch {
    // ignore IndexedDB errors
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(NOTIFICATION_LOG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          merged = { ...merged, ...(parsed as Record<string, number>) };
        }
      }
    }
  } catch {
    // ignore storage errors
  }

  return pruneNotificationLog(merged);
}

export async function writeNotificationDispatchLog(log: Record<string, number>): Promise<void> {
  const pruned = pruneNotificationLog(log);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(NOTIFICATION_LOG_STORAGE_KEY, JSON.stringify(pruned));
    }
  } catch {
    // ignore storage errors
  }
  try {
    await db.settings.put({ key: NOTIFICATION_LOG_DB_KEY, value: pruned });
  } catch {
    // ignore IndexedDB errors
  }
}

async function deliverBrowserNotification(item: DueNotificationItem): Promise<boolean> {
  if (!isNotificationSupported() || getNotificationPermissionState() !== 'granted') {
    return false;
  }

  const options: NotificationOptions = {
    body: item.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: item.dedupeKey,
    data: { targetTab: item.targetTab, bikeId: item.bikeId }
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
      if (reg && reg.active && typeof reg.showNotification === 'function') {
        await reg.showNotification(item.title, options);
        return true;
      }
    }
  } catch {
    // Fall back to Window Notification API below
  }

  try {
    new window.Notification(item.title, options);
    return true;
  } catch {
    return false;
  }
}

export function dispatchDueNotifications(params: {
  bikes: Bike[];
  services: ServiceRecord[];
  renewals: RenewalRecord[];
  documents: DocumentItem[];
  settings: Partial<AppSettings>;
  language: 'en' | 'ne';
  now?: Date | string;
}): Promise<DueNotificationItem[]> {
  const run = async (): Promise<DueNotificationItem[]> => {
    if (params.settings.notificationsEnabled === false) return [];
    if (getNotificationPermissionState() !== 'granted') return [];

    const dueItems = evaluateDueNotifications(params);
    if (dueItems.length === 0) return [];

    const log = await readNotificationDispatchLog();
    const dispatched: DueNotificationItem[] = [];
    let logChanged = false;
    const nowMs = Date.now();

    for (const item of dueItems) {
      if (log[item.dedupeKey] || inFlightDedupeKeys.has(item.dedupeKey)) {
        continue;
      }
      inFlightDedupeKeys.add(item.dedupeKey);
      try {
        const sent = await deliverBrowserNotification(item);
        if (sent) {
          log[item.dedupeKey] = nowMs;
          dispatched.push(item);
          logChanged = true;
        }
      } finally {
        inFlightDedupeKeys.delete(item.dedupeKey);
      }
    }

    if (logChanged) {
      await writeNotificationDispatchLog(log);
    }

    return dispatched;
  };

  dispatchQueue = dispatchQueue.then(run, run);
  return dispatchQueue;
}

/**
 * Returns milliseconds until the next scheduled morning/rollover reminder evaluation (default 08:00 AM local).
 */
export function getMsUntilNextScheduledCheck(now: Date = new Date()): number {
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return Math.max(60_000, target.getTime() - now.getTime());
}
