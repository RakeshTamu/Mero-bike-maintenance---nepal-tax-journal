import React, { useState, useEffect, useRef } from 'react';
import {
  Wrench,
  Plus,
  Calendar,
  AlertTriangle,
  Save,
  X,
  RotateCcw,
  MapPin,
  Camera,
  Eye,
  Trash2,
  FileText,
  Bell,
  Tag,
  Layers,
  Edit2,
  Droplet,
  Disc,
  Link2,
  Sparkles,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Gauge,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { ServiceRecord, Bike, ServiceSubItem } from '../types';
import { db } from '../db/db';
import {
  adToBs,
  formatAdDate,
  formatAdDisplayDate,
  formatBsDisplayDate,
  diffDays,
  parseLocalCalendarDate
} from '../utils/nepaliCalendar';
import { NepaliDatePicker } from './NepaliDatePicker';
import { downloadIcsFile, getReminderDaysBefore } from '../utils/calendarExport';
import { translations } from '../utils/translations';
import {
  Button,
  Card,
  ConfirmDialog,
  CustomDropdown,
  EmptyState,
  FullScreenSheet,
  IconButton,
  NumberInput,
  SearchInput,
  SelectField,
  SelectableChip,
  StatusBadge,
  Switch,
  TextArea,
  TextInput
} from './ui';
import { ContextualVehicleBar } from './ContextualVehicleBar';

interface Props {
  bike: Bike;
  services: ServiceRecord[];
  onRefresh: () => void;
  language: 'en' | 'ne';
  openAddTrigger?: number;
  selectedServiceTrigger?: { id: number; ts: number } | null;
  onOpenGarage?: () => void;
}

export const INITIAL_DEFAULT_CATEGORIES = ['Engine Oil', 'Brake Pads', 'Air Filter'];

export function getCategoryIcon(cat: string) {
  const c = cat.toLowerCase();
  if (c.includes('oil') || c.includes('इन्जिन') || c.includes('आयल')) {
    return <Droplet className="w-3.5 h-3.5 text-[var(--color-warning)]" />;
  }
  if (c.includes('brake') || c.includes('प्याड') || c.includes('ब्रेक')) {
    return <Disc className="w-3.5 h-3.5 text-[var(--color-error)]" />;
  }
  if (c.includes('chain') || c.includes('चेन')) {
    return <Link2 className="w-3.5 h-3.5 text-[var(--color-accent)]" />;
  }
  if (c.includes('filter') || c.includes('फिल्टर')) {
    return <Filter className="w-3.5 h-3.5 text-[var(--color-success)]" />;
  }
  return <Sparkles className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />;
}

export interface ServiceItemFormRow {
  id: string;
  name: string;
  category: string;
  costInput: string;
}

export function createEmptyServiceItem(defaultCategory: string = INITIAL_DEFAULT_CATEGORIES[0]): ServiceItemFormRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    category: defaultCategory,
    costInput: ''
  };
}

export function parseServiceItemCost(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function isValidCostInput(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0;
}

export function calculateServiceItemsTotal(rows: ServiceItemFormRow[]): number {
  return rows.reduce((sum, item) => sum + parseServiceItemCost(item.costInput), 0);
}

export function validateServiceItemRows(
  rows: ServiceItemFormRow[],
  language: 'en' | 'ne' = 'en'
): { valid: boolean; error?: string } {
  if (!rows || rows.length === 0) {
    return {
      valid: false,
      error:
        language === 'ne'
          ? 'कम्तिमा एउटा मान्य सेवा वस्तु आवश्यक छ।'
          : 'At least one valid service item is required.'
    };
  }

  const missingName = rows.find((item) => !item.name.trim());
  if (missingName) {
    return {
      valid: false,
      error:
        language === 'ne'
          ? 'कृपया प्रत्येक सेवा वस्तुको विवरण लेख्नुहोस् (कम्तिमा एक वस्तु अनिवार्य छ)।'
          : 'Please enter a description for each service item (at least one valid item is required).'
    };
  }

  const invalidCost = rows.find((item) => !isValidCostInput(item.costInput));
  if (invalidCost) {
    return {
      valid: false,
      error:
        language === 'ne'
          ? 'कृपया ० वा सोभन्दा माथिको मान्य रकम (NPR) लेख्नुहोस्।'
          : 'Please enter a valid non-negative NPR amount for each item.'
    };
  }

  return { valid: true };
}

export function toServiceItemFormRows(
  record: ServiceRecord,
  fallbackCategory: string = INITIAL_DEFAULT_CATEGORIES[0]
): ServiceItemFormRow[] {
  if (record.subItems && record.subItems.length > 0) {
    return record.subItems.map((item, idx) => ({
      id: item.id || `${record.id || 'item'}-${idx}`,
      name: item.name || '',
      category: item.category || fallbackCategory,
      costInput: typeof item.cost === 'number' && Number.isFinite(item.cost) ? String(item.cost) : ''
    }));
  }

  // Legacy service record without itemized rows: preserve description, category & cost into 1 editable item
  return [
    {
      id: `${record.id || Date.now()}-legacy`,
      name: record.workDone || '',
      category: (record.categories && record.categories[0]) || fallbackCategory,
      costInput: typeof record.cost === 'number' && record.cost > 0 ? String(record.cost) : ''
    }
  ];
}

export type ServiceSortBy =
  | 'date_desc'
  | 'date_asc'
  | 'odometer_desc'
  | 'odometer_asc'
  | 'cost_desc'
  | 'cost_asc';

export function getServiceRecordCategories(record: ServiceRecord): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const pushCat = (raw?: string) => {
    const trimmed = (raw || '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  };
  (record.categories || []).forEach(pushCat);
  (record.subItems || []).forEach(item => pushCat(item.category));
  return result;
}

export function collectFilterCategories(
  configuredCategories: string[],
  records: ServiceRecord[]
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  const pushCat = (raw?: string) => {
    const trimmed = (raw || '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(trimmed);
  };
  configuredCategories.forEach(pushCat);
  records.forEach(record => {
    getServiceRecordCategories(record).forEach(pushCat);
  });
  return merged;
}

export function filterAndSortServices(
  records: ServiceRecord[],
  options: {
    searchQuery: string;
    categoryFilter: string;
    sortBy: ServiceSortBy;
    language: 'en' | 'ne';
  }
): ServiceRecord[] {
  const q = options.searchQuery.trim().toLowerCase();
  const filterTarget = options.categoryFilter.trim().toLowerCase();

  const filtered = records.filter(s => {
    if (q) {
      const formattedBs = s.serviceDateAD
        ? formatBsDisplayDate(s.serviceDateAD, options.language).toLowerCase()
        : '';
      const formattedAd = s.serviceDateAD ? formatAdDisplayDate(s.serviceDateAD).toLowerCase() : '';
      const recordCats = getServiceRecordCategories(s);
      const matchesSearch =
        (s.workDone || '').toLowerCase().includes(q) ||
        (s.serviceCenter || '').toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q) ||
        (s.serviceDateAD || '').toLowerCase().includes(q) ||
        (s.serviceDateBS || '').toLowerCase().includes(q) ||
        formattedBs.includes(q) ||
        formattedAd.includes(q) ||
        String(s.odometerKm ?? '').includes(q) ||
        String(s.cost ?? '').includes(q) ||
        recordCats.some(c => c.toLowerCase().includes(q)) ||
        (s.subItems || []).some(
          i =>
            i.name.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q) ||
            String(i.cost ?? '').includes(q)
        );
      if (!matchesSearch) return false;
    }

    if (options.categoryFilter === 'ALL' || !filterTarget) return true;

    const recordCats = getServiceRecordCategories(s);
    if (recordCats.some(c => c.toLowerCase() === filterTarget)) return true;

    // Fallback for legacy uncategorized records whose workDone contains the category label
    return recordCats.length === 0 && (s.workDone || '').toLowerCase().includes(filterTarget);
  });

  return [...filtered].sort((a, b) => {
    const dateA = new Date(a.serviceDateAD).getTime() || 0;
    const dateB = new Date(b.serviceDateAD).getTime() || 0;
    const odoA = Number(a.odometerKm || 0);
    const odoB = Number(b.odometerKm || 0);
    const costA = Number(a.cost || 0);
    const costB = Number(b.cost || 0);

    switch (options.sortBy) {
      case 'date_asc':
        return dateA - dateB || odoA - odoB || (a.id || 0) - (b.id || 0);
      case 'odometer_desc':
        return odoB - odoA || dateB - dateA || (b.id || 0) - (a.id || 0);
      case 'odometer_asc':
        return odoA - odoB || dateA - dateB || (a.id || 0) - (b.id || 0);
      case 'cost_desc':
        return costB - costA || dateB - dateA || (b.id || 0) - (a.id || 0);
      case 'cost_asc':
        return costA - costB || dateB - dateA || (a.id || 0) - (b.id || 0);
      case 'date_desc':
      default:
        return dateB - dateA || odoB - odoA || (b.id || 0) - (a.id || 0);
    }
  });
}

export function isDuplicateServiceSubmission(
  existingServices: ServiceRecord[],
  candidate: Pick<ServiceRecord, 'bikeId' | 'serviceDateAD' | 'odometerKm' | 'cost' | 'workDone' | 'subItems'>,
  editingId: number | null
): boolean {
  const normWork = (candidate.workDone || '').trim().toLowerCase();
  const normItems = (candidate.subItems || [])
    .map(i => `${i.name.trim().toLowerCase()}|${i.category.trim().toLowerCase()}|${Number(i.cost || 0)}`)
    .sort()
    .join(';');

  return existingServices.some(s => {
    if (editingId !== null && s.id === editingId) return false;
    if (s.bikeId !== candidate.bikeId) return false;
    if (s.serviceDateAD !== candidate.serviceDateAD) return false;
    if (Number(s.odometerKm) !== Number(candidate.odometerKm)) return false;
    if (Math.abs(Number(s.cost || 0) - Number(candidate.cost || 0)) > 0.01) return false;

    const existingWork = (s.workDone || '').trim().toLowerCase();
    if (normWork && existingWork === normWork) return true;

    const existingItems = (s.subItems || [])
      .map(i => `${i.name.trim().toLowerCase()}|${i.category.trim().toLowerCase()}|${Number(i.cost || 0)}`)
      .sort()
      .join(';');
    return Boolean(normItems && existingItems === normItems);
  });
}

interface FieldErrors {
  date?: string;
  odometer?: string;
  subItems?: string;
  workDone?: string;
  nextServiceKm?: string;
}

export const ServiceTracker: React.FC<Props> = ({
  bike,
  services,
  onRefresh,
  language,
  openAddTrigger,
  selectedServiceTrigger,
  onOpenGarage
}) => {
  // Segmented View ('history' | 'reminders')
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'reminders'>('history');

  // Detail & Form Full-Screen Sheet states
  const [detailRecord, setDetailRecord] = useState<ServiceRecord | null>(null);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [sheetStep, setSheetStep] = useState<1 | 2 | 3>(1);
  const [savedSuccessRecord, setSavedSuccessRecord] = useState<ServiceRecord | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<ServiceSortBy>('date_desc');
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Dynamic Categories (stored in IndexedDB settings)
  const [categories, setCategories] = useState<string[]>(INITIAL_DEFAULT_CATEGORIES);
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Digital Receipt Viewer & Delete Confirmation
  const [activeReceiptView, setActiveReceiptView] = useState<{ title: string; imageBase64: string } | null>(null);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<ServiceRecord | null>(null);

  // Form State - strictly NO hardcoded default prices
  const [serviceDateAD, setServiceDateAD] = useState(formatAdDate(new Date()));
  const [odometerInput, setOdometerInput] = useState<string>(
    typeof bike.odometerKm === 'number' ? String(bike.odometerKm) : ''
  );
  const [nextServiceKm, setNextServiceKm] = useState<number | ''>(
    typeof bike.odometerKm === 'number' ? bike.odometerKm + 3000 : ''
  );
  const [nextServiceDateAD, setNextServiceDateAD] = useState(
    formatAdDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))
  );
  const [serviceCenter, setServiceCenter] = useState('');
  const [workDone, setWorkDone] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [enableReminder, setEnableReminder] = useState<boolean>(true);
  const [reminderInterval, setReminderInterval] = useState<'today' | '1_week' | '2_weeks' | '4_weeks'>('1_week');
  const [confirmOdometerAnomaly, setConfirmOdometerAnomaly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Itemized Sub-Entries: starts with one empty row ready to type into
  const [subItems, setSubItems] = useState<ServiceItemFormRow[]>(() => [
    createEmptyServiceItem(INITIAL_DEFAULT_CATEGORIES[0])
  ]);

  // Pending Next Service Target Workflow (Reminders view)
  const [pendingTargetKm, setPendingTargetKm] = useState<number | null>(null);
  const [pendingSnoozeDays, setPendingSnoozeDays] = useState<number | null>(null);

  const t = translations[language];

  // Reset staged reminder edits when bike changes
  useEffect(() => {
    setPendingTargetKm(null);
    setPendingSnoozeDays(null);
    setDetailRecord(null);
  }, [bike.id]);

  // Keep detailRecord synced after edits/refreshes
  useEffect(() => {
    if (detailRecord?.id) {
      const updated = services.find(s => s.id === detailRecord.id);
      setDetailRecord(updated || null);
    }
  }, [services]);

  // Load custom categories from IndexedDB
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const stored = await db.settings.get('maintenance_categories');
        if (stored && Array.isArray(stored.value) && stored.value.length > 0) {
          setCategories(stored.value);
        } else {
          setCategories(INITIAL_DEFAULT_CATEGORIES);
          await db.settings.put({
            key: 'maintenance_categories',
            value: INITIAL_DEFAULT_CATEGORIES
          });
        }
      } catch {
        setCategories(INITIAL_DEFAULT_CATEGORIES);
      }
    };
    loadCategories();
  }, []);

  // Listen to external trigger from Quick Actions
  const lastTriggerRef = useRef<number | undefined>(openAddTrigger);
  useEffect(() => {
    if (openAddTrigger !== undefined && openAddTrigger > (lastTriggerRef.current || 0)) {
      handleOpenAddSheet();
    }
    lastTriggerRef.current = openAddTrigger;
  }, [openAddTrigger]);

  // Listen to external record selection from Dashboard Recent Activity -> open Record Details
  const lastSelectedServiceTsRef = useRef<number>(0);
  useEffect(() => {
    if (
      selectedServiceTrigger &&
      selectedServiceTrigger.ts > lastSelectedServiceTsRef.current
    ) {
      const target = services.find(s => s.id === selectedServiceTrigger.id);
      if (target) {
        lastSelectedServiceTsRef.current = selectedServiceTrigger.ts;
        setDetailRecord(target);
      }
    }
  }, [selectedServiceTrigger, services]);

  // Parsed Odometer & Live Total Cost
  const parsedOdometerKm = odometerInput.trim() === '' ? NaN : Number(odometerInput);
  const odometerKm = Number.isFinite(parsedOdometerKm) ? parsedOdometerKm : 0;
  const calculatedItemsTotal = calculateServiceItemsTotal(subItems);

  // Odometer consistency check against saved history & bike's current odometer
  const odometerConsistencyWarning = (() => {
    if (odometerInput.trim() === '' || !Number.isFinite(parsedOdometerKm) || parsedOdometerKm < 0) {
      return null;
    }

    const otherServices = services.filter(s => s.id !== editingServiceId);
    const earlierServices = otherServices
      .filter(s => s.serviceDateAD < serviceDateAD)
      .sort((a, b) => new Date(b.serviceDateAD).getTime() - new Date(a.serviceDateAD).getTime());
    const laterServices = otherServices
      .filter(s => s.serviceDateAD > serviceDateAD)
      .sort((a, b) => new Date(a.serviceDateAD).getTime() - new Date(b.serviceDateAD).getTime());

    if (earlierServices[0] && parsedOdometerKm < earlierServices[0].odometerKm) {
      return language === 'ne'
        ? `यो रिडिङ अघिल्लो मर्मत (${earlierServices[0].odometerKm.toLocaleString()} km) भन्दा कम छ।`
        : `Reading is lower than earlier service (${earlierServices[0].odometerKm.toLocaleString()} km on ${formatBsDisplayDate(earlierServices[0].serviceDateAD, language)}).`;
    }

    if (laterServices[0] && parsedOdometerKm > laterServices[0].odometerKm) {
      return language === 'ne'
        ? `यो रिडिङ पछिल्लो मर्मत (${laterServices[0].odometerKm.toLocaleString()} km) भन्दा बढी छ।`
        : `Reading is higher than later service (${laterServices[0].odometerKm.toLocaleString()} km on ${formatBsDisplayDate(laterServices[0].serviceDateAD, language)}).`;
    }

    const latestSavedDate = otherServices.reduce<string>(
      (max, s) => (s.serviceDateAD > max ? s.serviceDateAD : max),
      ''
    );
    const isLatestOrCurrent = !latestSavedDate || serviceDateAD >= latestSavedDate;
    if (
      isLatestOrCurrent &&
      typeof bike.odometerKm === 'number' &&
      bike.odometerKm > 0 &&
      parsedOdometerKm < bike.odometerKm
    ) {
      return language === 'ne'
        ? `हालको सवारी ओडोमिटर (${bike.odometerKm.toLocaleString()} km) भन्दा कम छ।`
        : `Lower than current vehicle odometer (${bike.odometerKm.toLocaleString()} km).`;
    }

    return null;
  })();

  // Open Log Full-Screen Page with fresh state + 1 initial empty service item
  const handleOpenAddSheet = () => {
    const defaultCat = categories[0] || INITIAL_DEFAULT_CATEGORIES[0];
    setEditingServiceId(null);
    setSheetStep(1);
    setSavedSuccessRecord(null);
    setFieldErrors({});
    setServiceDateAD(formatAdDate(new Date()));
    setOdometerInput(typeof bike.odometerKm === 'number' ? String(bike.odometerKm) : '');
    setNextServiceKm(typeof bike.odometerKm === 'number' ? bike.odometerKm + 3000 : '');
    setNextServiceDateAD(formatAdDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)));
    setServiceCenter('');
    setWorkDone('');
    setReceiptPhoto(undefined);
    setNotes('');
    setSubItems([createEmptyServiceItem(defaultCat)]);
    setShowNewCatInput(false);
    setNewCatName('');
    setEnableReminder(true);
    setReminderInterval('1_week');
    setConfirmOdometerAnomaly(false);
    setIsSubmitting(false);
    setFormError(null);
    setIsAddSheetOpen(true);
  };

  // Open Edit Full-Screen Page pre-populated with existing record data & itemized rows
  const handleEditService = (record: ServiceRecord) => {
    const defaultCat = categories[0] || INITIAL_DEFAULT_CATEGORIES[0];
    setDetailRecord(null);
    setEditingServiceId(record.id || null);
    setSheetStep(1);
    setSavedSuccessRecord(null);
    setFieldErrors({});
    setServiceDateAD(record.serviceDateAD);
    setOdometerInput(typeof record.odometerKm === 'number' ? String(record.odometerKm) : '');
    setNextServiceKm(record.nextServiceKm && record.nextServiceKm > 0 ? record.nextServiceKm : '');
    setNextServiceDateAD(record.nextServiceDateAD || '');
    setServiceCenter(record.serviceCenter || '');
    setWorkDone(record.workDone || '');
    setReceiptPhoto(record.receiptPhoto);
    setNotes(record.notes || '');
    setSubItems(toServiceItemFormRows(record, defaultCat));
    setShowNewCatInput(false);
    setNewCatName('');
    setEnableReminder(record.enableReminder ?? true);
    setReminderInterval(record.reminderInterval || '1_week');
    setConfirmOdometerAnomaly(false);
    setIsSubmitting(false);
    setFormError(null);
    setIsAddSheetOpen(true);
  };

  const handleAddSubItemRow = () => {
    setFieldErrors(prev => ({ ...prev, subItems: undefined }));
    setFormError(null);
    setSubItems(prev => [
      ...prev,
      createEmptyServiceItem(categories[0] || INITIAL_DEFAULT_CATEGORIES[0])
    ]);
  };

  const handleUpdateSubItem = (
    id: string,
    patch: Partial<Pick<ServiceItemFormRow, 'name' | 'category' | 'costInput'>>
  ) => {
    setFieldErrors(prev => ({ ...prev, subItems: undefined }));
    setFormError(null);
    setSubItems(prev =>
      prev.map(item => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const handleRemoveSubItem = (id: string) => {
    setFieldErrors(prev => ({ ...prev, subItems: undefined }));
    setFormError(null);
    setSubItems(prev => {
      if (prev.length <= 1) {
        return [createEmptyServiceItem(categories[0] || INITIAL_DEFAULT_CATEGORIES[0])];
      }
      return prev.filter(item => item.id !== id);
    });
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    const trimmed = newCatName.trim();
    if (!categories.includes(trimmed)) {
      const updated = [...categories, trimmed];
      setCategories(updated);
      await db.settings.put({
        key: 'maintenance_categories',
        value: updated
      });
    }
    // If there is a single blank item row, select the newly created category on it
    setSubItems(prev =>
      prev.length === 1 && !prev[0].name.trim()
        ? [{ ...prev[0], category: trimmed }]
        : prev
    );
    setNewCatName('');
    setShowNewCatInput(false);
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError(language === 'ne' ? 'कृपया तस्बिर फाइल मात्र छान्नुहोस्।' : 'Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        setReceiptPhoto(compressedBase64);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Chronological order (newest first) for Latest-Service & Reminder status calculations
  const sortedServices = [...services].sort(
    (a, b) => new Date(b.serviceDateAD).getTime() - new Date(a.serviceDateAD).getTime()
  );

  // Include historical categories referenced by past service records so edited/deleted categories stay filterable
  const filterCategories = collectFilterCategories(categories, services);

  // Filter & sort service history by search text, category, date, odometer, or amount
  const filteredServices = filterAndSortServices(services, {
    searchQuery,
    categoryFilter: selectedCategoryFilter,
    sortBy,
    language
  });

  // Real Next-Service Calculations (never invent fake distances if unrecorded)
  const latestService = sortedServices[0] || null;
  const recordedTargetKm =
    latestService && typeof latestService.nextServiceKm === 'number' && latestService.nextServiceKm > 0
      ? latestService.nextServiceKm
      : null;
  const activeNextTargetKm =
    pendingTargetKm !== null ? pendingTargetKm : recordedTargetKm;
  const kmRemaining =
    activeNextTargetKm !== null ? activeNextTargetKm - (bike.odometerKm || 0) : null;

  const rawSnoozeDays = latestService?.snoozeDays || 0;
  const activeSnoozeDays = pendingSnoozeDays !== null ? pendingSnoozeDays : rawSnoozeDays;
  const effectiveNextDate = (() => {
    if (!latestService?.nextServiceDateAD) return null;
    const base = parseLocalCalendarDate(latestService.nextServiceDateAD);
    if (isNaN(base.getTime())) return null;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + activeSnoozeDays, 12, 0, 0);
  })();
  const daysUntilService = effectiveNextDate ? diffDays(effectiveNextDate, new Date()) : null;

  const hasNextServiceSchedule = Boolean(activeNextTargetKm !== null || effectiveNextDate !== null);
  const isOverdue =
    hasNextServiceSchedule &&
    ((kmRemaining !== null && kmRemaining <= 0) || (daysUntilService !== null && daysUntilService <= 0));
  const isDueSoon =
    hasNextServiceSchedule &&
    !isOverdue &&
    ((kmRemaining !== null && kmRemaining <= 500) || (daysUntilService !== null && daysUntilService <= 15));

  // Pending Target Increments
  const handleStageTargetKm = (delta: number) => {
    const base =
      pendingTargetKm !== null
        ? pendingTargetKm
        : recordedTargetKm ?? (bike.odometerKm || 0);
    setPendingTargetKm(base + delta);
  };

  const handleStageSnooze = (days: number) => {
    const base = pendingSnoozeDays !== null ? pendingSnoozeDays : rawSnoozeDays;
    setPendingSnoozeDays(base + days);
  };

  const handleCommitPendingServiceDue = async () => {
    if (!latestService?.id) return;
    const updates: Partial<ServiceRecord> = {};
    if (pendingTargetKm !== null) updates.nextServiceKm = pendingTargetKm;
    if (pendingSnoozeDays !== null) updates.snoozeDays = pendingSnoozeDays;
    await db.services.update(latestService.id, updates);
    setPendingTargetKm(null);
    setPendingSnoozeDays(null);
    onRefresh();
  };

  const handleCancelPendingServiceDue = () => {
    setPendingTargetKm(null);
    setPendingSnoozeDays(null);
  };

  const validateStep1 = (): boolean => {
    const nextErrors: FieldErrors = {};
    if (!serviceDateAD) {
      nextErrors.date =
        language === 'ne' ? 'कृपया मर्मत मिति छान्नुहोस्।' : 'Please select a service date.';
    }
    if (
      odometerInput.trim() === '' ||
      !Number.isFinite(parsedOdometerKm) ||
      parsedOdometerKm < 0 ||
      parsedOdometerKm > 9999999
    ) {
      nextErrors.odometer =
        language === 'ne'
          ? 'कृपया ० देखि ९,९९९,९९९ कि.मी. भित्रको मान्य ओडोमिटर रिडिङ प्रविष्ट गर्नुहोस्।'
          : 'Please enter a valid odometer reading (0 to 9,999,999 km).';
    } else if (odometerConsistencyWarning && !confirmOdometerAnomaly) {
      nextErrors.odometer =
        language === 'ne'
          ? 'कृपया ओडोमिटर रिडिङ जाँच गरी तलको पुष्टि बाकसमा टिक लगाउनुहोस्।'
          : 'Please review the odometer warning and confirm below before continuing.';
    }
    setFieldErrors(prev => ({ ...prev, date: nextErrors.date, odometer: nextErrors.odometer }));
    if (nextErrors.date || nextErrors.odometer) {
      setFormError(nextErrors.date || nextErrors.odometer || null);
      return false;
    }
    setFormError(null);
    return true;
  };

  const validateStep2 = (): boolean => {
    const validation = validateServiceItemRows(subItems, language);
    if (!validation.valid) {
      setFieldErrors(prev => ({ ...prev, subItems: validation.error }));
      setFormError(validation.error || null);
      return false;
    }
    setFieldErrors(prev => ({ ...prev, subItems: undefined }));
    setFormError(null);
    return true;
  };

  const validateStep3 = (): boolean => {
    const nextErrors: FieldErrors = {};
    if (nextServiceKm !== '') {
      const parsedTarget = Number(nextServiceKm);
      if (!Number.isFinite(parsedTarget) || parsedTarget < 0) {
        nextErrors.nextServiceKm =
          language === 'ne'
            ? 'कृपया मान्य लक्षित दूरी प्रविष्ट गर्नुहोस्।'
            : 'Please enter a valid target distance.';
      } else if (parsedTarget > 0 && Number.isFinite(parsedOdometerKm) && parsedTarget <= parsedOdometerKm) {
        nextErrors.nextServiceKm =
          language === 'ne'
            ? `अर्को लक्षित कि.मी. हालको रिडिङ (${parsedOdometerKm.toLocaleString()} km) भन्दा बढी हुनुपर्छ।`
            : `Next service target must be greater than current reading (${parsedOdometerKm.toLocaleString()} km).`;
      }
    }

    setFieldErrors(prev => ({
      ...prev,
      workDone: undefined,
      nextServiceKm: nextErrors.nextServiceKm
    }));

    if (nextErrors.nextServiceKm) {
      setFormError(nextErrors.nextServiceKm);
      return false;
    }
    setFormError(null);
    return true;
  };

  const handleGoToStep = (targetStep: 1 | 2 | 3) => {
    if (targetStep === sheetStep) return;
    if (targetStep > sheetStep) {
      if (sheetStep === 1 && !validateStep1()) return;
      if (targetStep === 3 && !validateStep2()) return;
    }
    setFormError(null);
    setSheetStep(targetStep);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    if (!validateStep1()) {
      setSheetStep(1);
      return;
    }
    if (!validateStep2()) {
      setSheetStep(2);
      return;
    }
    if (!validateStep3()) {
      setSheetStep(3);
      return;
    }

    setFormError(null);
    const bsDate = adToBs(serviceDateAD).formatted;

    const cleanSubItems: ServiceSubItem[] = subItems.map(item => ({
      id: item.id,
      name: item.name.trim(),
      category: item.category || categories[0] || INITIAL_DEFAULT_CATEGORIES[0],
      cost: parseServiceItemCost(item.costInput)
    }));

    const uniqueItemCategories = Array.from(
      new Set(cleanSubItems.map(i => i.category).filter(Boolean))
    );
    const itemNames = cleanSubItems.map(i => `${i.name} (${i.category})`);
    const summaryWorkDone = workDone.trim() || itemNames.join(', ') || 'Maintenance Visit';

    const parsedNextKm =
      nextServiceKm !== '' && Number(nextServiceKm) > 0 ? Number(nextServiceKm) : undefined;
    const parsedNextDate = nextServiceDateAD || undefined;

    const existingRecord = editingServiceId
      ? services.find(s => s.id === editingServiceId)
      : undefined;

    const payload: Omit<ServiceRecord, 'id'> = {
      bikeId: bike.id!,
      serviceDateAD,
      serviceDateBS: bsDate,
      odometerKm: Number(parsedOdometerKm),
      nextServiceKm: parsedNextKm,
      nextServiceDateAD: parsedNextDate,
      snoozeDays: existingRecord?.snoozeDays ?? 0,
      cost: Number(calculatedItemsTotal || 0),
      serviceCenter: serviceCenter.trim(),
      workDone: summaryWorkDone,
      categories: uniqueItemCategories,
      subItems: cleanSubItems,
      receiptPhoto,
      notes: notes.trim(),
      enableReminder,
      reminderInterval
    };

    if (isDuplicateServiceSubmission(services, payload, editingServiceId)) {
      setFormError(
        language === 'ne'
          ? 'यो मिति, ओडोमिटर र खर्च भएको समान मर्मत रेकर्ड पहिले नै सुरक्षित छ।'
          : 'A matching service record with the same date, odometer reading, items, and amount already exists.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      let savedId: number;
      if (editingServiceId) {
        await db.services.update(editingServiceId, payload);
        savedId = editingServiceId;
      } else {
        const addedId = await db.services.add(payload);
        savedId = Number(addedId);
      }

      if (Number(parsedOdometerKm) > (bike.odometerKm || 0)) {
        await db.bikes.update(bike.id!, {
          odometerKm: Number(parsedOdometerKm)
        });
      }

      const persistedRecord: ServiceRecord = { ...payload, id: savedId };
      onRefresh();
      setSavedSuccessRecord(persistedRecord);
    } catch {
      setFormError(
        language === 'ne'
          ? 'मर्मत रेकर्ड सेभ गर्न सकिएन। कृपया पुनः प्रयास गर्नुहोस्।'
          : 'Could not save service record. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseAddSheet = () => {
    setIsAddSheetOpen(false);
    setEditingServiceId(null);
    setSavedSuccessRecord(null);
    setFormError(null);
    setFieldErrors({});
    setConfirmOdometerAnomaly(false);
    setIsSubmitting(false);
    setReceiptPhoto(undefined);
  };

  const executeDeleteService = async () => {
    if (!confirmDeleteRecord?.id) return;
    await db.services.delete(confirmDeleteRecord.id);
    if (detailRecord?.id === confirmDeleteRecord.id) {
      setDetailRecord(null);
    }
    setConfirmDeleteRecord(null);
    onRefresh();
  };

  const handleSetTargetKmIncrement = (delta: number) => {
    const base = Number(odometerKm) || (bike.odometerKm || 0);
    setNextServiceKm(base + delta);
    setFieldErrors(prev => ({ ...prev, nextServiceKm: undefined }));
  };

  const handleSetTargetDateIncrement = (days: number) => {
    const baseDate = new Date(serviceDateAD || Date.now());
    const newDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    setNextServiceDateAD(formatAdDate(newDate));
  };

  const hasPendingServiceDue = pendingTargetKm !== null || pendingSnoozeDays !== null;

  const isFilteredEmpty = services.length > 0 && filteredServices.length === 0;
  const hasActiveFilterOrSort =
    Boolean(searchQuery.trim()) || selectedCategoryFilter !== 'ALL' || sortBy !== 'date_desc';
  const visibleServices =
    hasActiveFilterOrSort || showAllHistory
      ? filteredServices
      : filteredServices.slice(0, 2);

  const reminderLabelMap: Record<'today' | '1_week' | '2_weeks' | '4_weeks', string> = {
    today: t.reminderToday,
    '1_week': t.reminder1Week,
    '2_weeks': t.reminder2Weeks,
    '4_weeks': t.reminder4Weeks
  };

  return (
    <div className="space-y-4 pb-4">
      {/* 1. SIMPLIFIED MAINTENANCE HEADER */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight truncate">
            {language === 'ne' ? 'मर्मत' : 'Maintenance'}
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] truncate">
            {language === 'ne' ? 'सर्भिस इतिहास र रिमाइन्डर' : 'Service logs & reminders'}
          </p>
        </div>

        <Button
          variant="primary"
          pill
          size="sm"
          onClick={handleOpenAddSheet}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shrink-0"
        >
          <span>{language === 'ne' ? 'मर्मत थप्नुहोस्' : 'Add Service'}</span>
        </Button>
      </div>

      {/* CONTEXTUAL ACTIVE VEHICLE SELECTOR */}
      {onOpenGarage && (
        <ContextualVehicleBar
          bike={bike}
          language={language}
          onOpenGarage={onOpenGarage}
          secondaryMeta={
            typeof bike.odometerKm === 'number'
              ? `${bike.odometerKm.toLocaleString()} km`
              : undefined
          }
        />
      )}

      {/* 2. SEGMENTED NAVIGATION (History | Reminders — Existing Views Only) */}
      <div
        role="tablist"
        aria-label={language === 'ne' ? 'मर्मत दृश्य' : 'Maintenance Views'}
        className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] clay-inset"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'history'}
          onClick={() => setActiveSubTab('history')}
          className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition duration-150 flex items-center justify-center gap-1.5 ${
            activeSubTab === 'history'
              ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] clay-btn-primary'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Wrench className="w-3.5 h-3.5 shrink-0" />
          <span>{language === 'ne' ? 'इतिहास' : 'History'}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'reminders'}
          onClick={() => setActiveSubTab('reminders')}
          className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition duration-150 flex items-center justify-center gap-1.5 ${
            activeSubTab === 'reminders'
              ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] clay-btn-primary'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Bell className="w-3.5 h-3.5 shrink-0" />
          <span>{language === 'ne' ? 'रिमाइन्डरहरू' : 'Reminders'}</span>
        </button>
      </div>

      {/* SUB-TAB A: HISTORY VIEW (Next-Service Panel + Vertical Timeline) */}
      {activeSubTab === 'history' && (
        <div className="space-y-4 animate-in fade-in">
          {/* 3. NEXT-SERVICE PANEL */}
          <Card
            variant="primary"
            padding="md"
            className={`space-y-3 ${
              isOverdue
                ? 'border-[var(--color-error)]/45'
                : isDueSoon
                ? 'border-[var(--color-warning)]/45'
                : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent)] shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {t.nextServiceDue}
                  </div>
                  <div className="text-lg font-semibold font-mono tabular-nums text-[var(--color-text-primary)] truncate">
                    {activeNextTargetKm !== null
                      ? `${activeNextTargetKm.toLocaleString()} km`
                      : effectiveNextDate
                      ? formatBsDisplayDate(effectiveNextDate, language)
                      : (language === 'ne' ? 'दर्ता गरिएको छैन' : 'Not Recorded')}
                  </div>
                </div>
              </div>

              <StatusBadge
                status={
                  !hasNextServiceSchedule
                    ? 'neutral'
                    : isOverdue
                    ? 'error'
                    : isDueSoon
                    ? 'warning'
                    : 'success'
                }
              >
                <span>
                  {!hasNextServiceSchedule
                    ? (language === 'ne' ? 'खाली' : 'Not Set')
                    : isOverdue
                    ? (language === 'ne' ? 'म्याद नाघेको' : 'Overdue')
                    : isDueSoon
                    ? (language === 'ne' ? 'नजिकिँदै' : 'Due Soon')
                    : (language === 'ne' ? 'ठीक छ' : 'Scheduled')}
                </span>
              </StatusBadge>
            </div>

            {hasNextServiceSchedule ? (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                      {language === 'ne' ? 'हालको ओडोमिटर तुलना' : 'Current vs Target'}
                    </div>
                    <div className="text-xs font-semibold font-mono tabular-nums text-[var(--color-text-primary)] mt-1">
                      {typeof bike.odometerKm === 'number'
                        ? `${bike.odometerKm.toLocaleString()} km`
                        : language === 'ne'
                        ? 'ओडोमिटर दर्ता छैन'
                        : 'Odometer not recorded'}
                      {kmRemaining !== null && (
                        <span
                          className={`block text-[11px] mt-0.5 ${
                            kmRemaining <= 0
                              ? 'text-[var(--color-error)]'
                              : kmRemaining <= 500
                              ? 'text-[var(--color-warning)]'
                              : 'text-[var(--color-accent)]'
                          }`}
                        >
                          {kmRemaining > 0
                            ? `${kmRemaining.toLocaleString()} ${t.kmLeft}`
                            : language === 'ne'
                            ? `${Math.abs(kmRemaining).toLocaleString()} कि.मी. नाघेको`
                            : `${Math.abs(kmRemaining).toLocaleString()} km overdue`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                      {language === 'ne' ? 'अर्को सर्भिस मिति' : 'Target Date'}
                    </div>
                    <div className="text-xs font-mono tabular-nums font-semibold text-[var(--color-text-primary)] mt-1 truncate">
                      {effectiveNextDate
                        ? formatBsDisplayDate(effectiveNextDate, language)
                        : (language === 'ne' ? 'तोकिएको छैन' : 'Not recorded')}
                    </div>
                    {daysUntilService !== null && (
                      <div
                        className={`text-[11px] font-mono tabular-nums font-medium mt-0.5 ${
                          daysUntilService <= 0
                            ? 'text-[var(--color-error)]'
                            : daysUntilService <= 15
                            ? 'text-[var(--color-warning)]'
                            : 'text-[var(--color-text-secondary)]'
                        }`}
                      >
                        {daysUntilService > 0
                          ? `${daysUntilService} ${t.daysLeft}`
                          : language === 'ne'
                          ? `${Math.abs(daysUntilService)} दिन नाघेको`
                          : `${Math.abs(daysUntilService)} days overdue`}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => setActiveSubTab('reminders')}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  <span>{language === 'ne' ? 'रिमाइन्डर विवरण हेर्नुहोस्' : 'View Details'}</span>
                </Button>
              </>
            ) : (
              <div className="pt-2 border-t border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {language === 'ne'
                    ? 'अर्को सर्भिस दूरी वा मिति अझै दर्ता गरिएको छैन।'
                    : 'Log a maintenance entry with a target distance or date to track due intervals.'}
                </p>
              </div>
            )}
          </Card>

          {/* 4. SERVICE HISTORY HEADER, SEARCH & VERTICAL TIMELINE */}
          {services.length === 0 ? (
            <EmptyState
              icon={<Wrench className="w-6 h-6 text-[var(--color-accent)]" />}
              title={language === 'ne' ? 'अझै कुनै मर्मत रेकर्ड छैन' : 'No Service Records Yet'}
              description={
                language === 'ne'
                  ? 'आफ्नो पहिलो मर्मत रेकर्ड थप्न र सर्भिस अन्तराल ट्र्याक गर्न माथि दायाँपट्टिको "मर्मत थप्नुहोस्" थिच्नुहोस्।'
                  : 'Tap "Add Service" at the top right to build a complete service timeline and track intervals.'
              }
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-0.5">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {language === 'ne' ? 'सर्भिस इतिहास' : 'Service History'}
                </h3>
                <span className="text-xs text-[var(--color-text-secondary)] font-mono tabular-nums">
                  {hasActiveFilterOrSort
                    ? `${filteredServices.length}/${services.length}`
                    : services.length}{' '}
                  {language === 'ne' ? 'रेकर्ड' : services.length === 1 ? 'record' : 'records'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_185px] gap-2.5 items-center">
                <SearchInput
                  placeholder={
                    language === 'ne'
                      ? 'मिति, वर्ग, ओडोमिटर, रकम वा वर्कसप खोज्नुहोस्...'
                      : 'Search date, category, km, cost, parts...'
                  }
                  value={searchQuery}
                  onChange={setSearchQuery}
                />

                <CustomDropdown
                  ariaLabel={language === 'ne' ? 'क्रमबद्ध गर्नुहोस्' : 'Sort services'}
                  menuTitle={language === 'ne' ? 'क्रमबद्ध गर्नुहोस्' : 'Sort Services'}
                  searchable={false}
                  value={sortBy}
                  onValueChange={(val) => setSortBy(val as ServiceSortBy)}
                  options={[
                    { value: 'date_desc', label: language === 'ne' ? 'मिति (नयाँ पहिले)' : 'Date: Newest First' },
                    { value: 'date_asc', label: language === 'ne' ? 'मिति (पुरानो पहिले)' : 'Date: Oldest First' },
                    { value: 'odometer_desc', label: language === 'ne' ? 'ओडोमिटर (बढी→कम)' : 'Odometer: High → Low' },
                    { value: 'odometer_asc', label: language === 'ne' ? 'ओडोमिटर (कम→बढी)' : 'Odometer: Low → High' },
                    { value: 'cost_desc', label: language === 'ne' ? 'रकम (बढी→कम)' : 'Amount: High → Low' },
                    { value: 'cost_asc', label: language === 'ne' ? 'रकम (कम→बढी)' : 'Amount: Low → High' }
                  ]}
                />
              </div>

              {/* Category Filter Chips (preserves historical categories on older records) */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <SelectableChip
                  size="sm"
                  selected={selectedCategoryFilter === 'ALL'}
                  onClick={() => setSelectedCategoryFilter('ALL')}
                >
                  {language === 'ne' ? 'सबै' : 'All'}
                </SelectableChip>
                {filterCategories.map(cat => (
                  <SelectableChip
                    key={cat}
                    size="sm"
                    selected={selectedCategoryFilter.toLowerCase() === cat.toLowerCase()}
                    onClick={() => setSelectedCategoryFilter(cat)}
                  >
                    {cat}
                  </SelectableChip>
                ))}
              </div>

              {isFilteredEmpty ? (
                <EmptyState
                  icon={<Wrench className="w-5 h-5" />}
                  title={language === 'ne' ? 'कुनै मिल्दो रेकर्ड भेटिएन' : 'No Matching Service Records'}
                  description={
                    language === 'ne'
                      ? 'खोज शब्द वा वर्ग फिल्टर परिवर्तन गरी पुन: प्रयास गर्नुहोस्।'
                      : 'Try clearing your search or selecting a different category.'
                  }
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategoryFilter('ALL');
                        setSortBy('date_desc');
                      }}
                    >
                      {language === 'ne' ? 'फिल्टर हटाउनुहोस्' : 'Clear Filters'}
                    </Button>
                  }
                />
              ) : (
                <div className="relative pl-5 space-y-3">
                  {/* Vertical Timeline Rail */}
                  <div
                    aria-hidden="true"
                    className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-[var(--color-border)]"
                  />

                  {visibleServices.map((record) => {
                    const recordCats = getServiceRecordCategories(record);
                    const primaryCategory =
                      recordCats[0] || (language === 'ne' ? 'नियमित मर्मत' : 'Maintenance');
                    const extraCategoriesCount = Math.max(0, recordCats.length - 1);
                    const isChronologicalLatest = latestService?.id === record.id;

                    return (
                      <div key={record.id} className="relative">
                        {/* Timeline Node Dot */}
                        <span
                          aria-hidden="true"
                          className={`absolute -left-5 top-5 w-3.5 h-3.5 rounded-full border-2 border-[var(--color-bg)] ${
                            isChronologicalLatest
                              ? 'bg-[var(--color-accent)] ring-4 ring-[var(--color-accent)]/20'
                              : 'bg-[var(--color-surface-3)]'
                          }`}
                        />

                        <Card
                          variant="interactive"
                          padding="md"
                          onClick={() => setDetailRecord(record)}
                          className="flex items-start justify-between gap-3 group"
                        >
                          <div className="min-w-0 flex-1 space-y-1.5">
                            {/* Date + Odometer Row */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-mono tabular-nums font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition duration-150">
                                {formatBsDisplayDate(record.serviceDateAD, language)}
                              </span>
                              <span className="text-xs font-mono tabular-nums font-medium text-[var(--color-accent)]">
                                · {(record.odometerKm || 0).toLocaleString()} km
                              </span>
                            </div>

                            {/* Work Description */}
                            <p className="text-xs text-[var(--color-text-primary)] font-medium line-clamp-2">
                              {record.workDone}
                            </p>

                            {/* Category + Item Count + Workshop + Cost Row */}
                            <div className="flex items-center gap-2 flex-wrap pt-0.5">
                              <StatusBadge status="neutral">
                                {getCategoryIcon(primaryCategory)}
                                <span>{primaryCategory}</span>
                                {extraCategoriesCount > 0 && (
                                  <span className="text-[10px] font-mono opacity-80">+{extraCategoriesCount}</span>
                                )}
                              </StatusBadge>

                              {record.subItems && record.subItems.length > 1 && (
                                <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">
                                  {record.subItems.length} {language === 'ne' ? 'वस्तु' : 'items'}
                                </span>
                              )}

                              {record.serviceCenter && (
                                <span className="text-[11px] text-[var(--color-text-secondary)] inline-flex items-center gap-1 truncate max-w-[150px]">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{record.serviceCenter}</span>
                                </span>
                              )}

                              <span className="text-xs font-mono tabular-nums font-semibold text-[var(--color-accent)] ml-auto">
                                Rs. {(record.cost || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Optional Receipt Thumbnail or Chevron */}
                          <div className="flex items-center gap-2 shrink-0 self-center">
                            {record.receiptPhoto && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveReceiptView({
                                    title: `${record.workDone} — ${language === 'ne' ? 'रसिद' : 'Receipt'}`,
                                    imageBase64: record.receiptPhoto!
                                  });
                                }}
                                aria-label={t.viewReceipt}
                                title={t.viewReceipt}
                                className="w-12 h-14 rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-accent)] transition shrink-0"
                              >
                                <img
                                  src={record.receiptPhoto}
                                  alt="Receipt thumbnail"
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            )}
                            <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)]" />
                          </div>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Expand/Collapse Toggle when showing latest 2 */}
              {!hasActiveFilterOrSort && filteredServices.length > 2 && (
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => setShowAllHistory(prev => !prev)}
                  rightIcon={
                    showAllHistory ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )
                  }
                >
                  <span>
                    {showAllHistory
                      ? (language === 'ne' ? 'कम देखाउनुहोस्' : 'Show Latest 2')
                      : (language === 'ne'
                        ? `सबै इतिहास हेर्नुहोस् (${filteredServices.length})`
                        : `View All History (${filteredServices.length})`)}
                  </span>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB B: REMINDERS & POSTPONE CONTROLS VIEW */}
      {activeSubTab === 'reminders' && (
        <div className="space-y-4 animate-in fade-in">
          {!latestService ? (
            <EmptyState
              icon={<Bell className="w-6 h-6 text-[var(--color-accent)]" />}
              title={language === 'ne' ? 'कुनै मर्मत रिमाइन्डर छैन' : 'No Service Reminders Yet'}
              description={
                language === 'ne'
                  ? 'अर्को सर्भिस दूरी र मिति रिमाइन्डर सक्रिय गर्न माथि दायाँपट्टिको "मर्मत थप्नुहोस्" थिच्नुहोस्।'
                  : 'Tap "Add Service" at the top right with a target odometer or date to manage reminders here.'
              }
            />
          ) : (
            <Card variant="primary" padding="md" className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {t.nextServiceDue}
                  </div>
                  <div className="text-lg font-semibold font-mono tabular-nums text-[var(--color-text-primary)] mt-0.5">
                    {activeNextTargetKm !== null
                      ? `${activeNextTargetKm.toLocaleString()} KM`
                      : (language === 'ne' ? 'दूरी तोकिएको छैन' : 'Distance Not Set')}
                  </div>
                </div>
                {pendingTargetKm !== null && recordedTargetKm !== null && (
                  <StatusBadge status="accent">
                    <span className="font-mono tabular-nums">+{pendingTargetKm - recordedTargetKm} KM</span>
                  </StatusBadge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium uppercase block">
                    {language === 'ne' ? 'बाँकी दूरी' : 'Distance Remaining'}
                  </span>
                  <div className="text-sm font-semibold font-mono tabular-nums mt-1 text-[var(--color-text-primary)]">
                    {kmRemaining === null
                      ? (language === 'ne' ? 'दर्ता छैन' : 'Not Recorded')
                      : kmRemaining > 0
                      ? `${kmRemaining.toLocaleString()} ${t.kmLeft}`
                      : (language === 'ne' ? 'मर्मत समय भयो' : 'Due Now!')}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium uppercase block">
                    {language === 'ne' ? 'लक्षित मिति' : 'Target Date'}
                  </span>
                  <div className="text-sm font-mono tabular-nums font-semibold mt-1 text-[var(--color-text-primary)]">
                    {effectiveNextDate
                      ? formatBsDisplayDate(effectiveNextDate, language)
                      : (language === 'ne' ? 'दर्ता छैन' : 'Not Recorded')}
                  </div>
                  {daysUntilService !== null && (
                    <div className="text-[11px] font-mono tabular-nums text-[var(--color-text-secondary)] mt-0.5">
                      {daysUntilService > 0
                        ? `${daysUntilService} ${t.daysLeft}`
                        : `${Math.abs(daysUntilService)} ${language === 'ne' ? 'दिन नाघेको' : 'days overdue'}`}
                    </div>
                  )}
                </div>
              </div>

              {/* Postpone Target KM */}
              <div className="pt-3 border-t border-[var(--color-border)] space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                    {language === 'ne' ? 'लक्षित कि.मी. सार्नुहोस्:' : 'Postpone Target KM:'}
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {[200, 500, 1000, 3000].map(inc => (
                      <SelectableChip
                        key={inc}
                        size="sm"
                        selected={false}
                        onClick={() => handleStageTargetKm(inc)}
                      >
                        <span className="font-mono tabular-nums">+{inc}</span>
                      </SelectableChip>
                    ))}
                  </div>
                </div>

                {/* Snooze Days & Calendar Export */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)] flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-[var(--color-warning)]" />
                    <span>{t.snoozeReminder}:</span>
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[3, 7, 15].map(d => (
                      <SelectableChip
                        key={d}
                        size="sm"
                        selected={false}
                        onClick={() => handleStageSnooze(d)}
                      >
                        +{d}d
                      </SelectableChip>
                    ))}
                    {effectiveNextDate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          downloadIcsFile({
                            title: `${bike.name} Service Due${activeNextTargetKm ? ` (${activeNextTargetKm} KM)` : ''}`,
                            description: `Maintenance reminder for ${bike.name}.`,
                            startDate: formatAdDate(effectiveNextDate),
                            location: latestService.serviceCenter || 'Workshop',
                            reminderDaysBefore: getReminderDaysBefore(latestService.reminderInterval)
                          })
                        }
                        leftIcon={<Calendar className="w-3.5 h-3.5" />}
                      >
                        <span>{language === 'ne' ? 'पात्रो (.ics)' : 'Add to Calendar'}</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Reminder Config Info + Edit Link */}
                <div className="p-3 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                      <span>
                        {latestService.enableReminder ?? true
                          ? (language === 'ne'
                            ? `सक्रिय (${reminderLabelMap[latestService.reminderInterval || '1_week']})`
                            : `Active (${reminderLabelMap[latestService.reminderInterval || '1_week']})`)
                          : (language === 'ne' ? 'रिमाइन्डर बन्द' : 'Reminder Off')}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] truncate mt-0.5">
                      {language === 'ne' ? 'पछिल्लो सर्भिस:' : 'Based on:'} {latestService.workDone}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleEditService(latestService)}
                    leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                  >
                    {language === 'ne' ? 'सम्पादन' : 'Edit'}
                  </Button>
                </div>

                {/* Staged Save Bar */}
                {hasPendingServiceDue && (
                  <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/40 animate-in fade-in">
                    <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                      {language === 'ne' ? 'परिवर्तन सुरक्षित गर्नुहोस्?' : 'Save staged schedule changes?'}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <IconButton
                        size="sm"
                        onClick={handleCancelPendingServiceDue}
                        aria-label={t.cancel}
                      >
                        <X className="w-4 h-4" />
                      </IconButton>
                      <Button
                        size="sm"
                        onClick={handleCommitPendingServiceDue}
                        leftIcon={<Save className="w-3.5 h-3.5" />}
                      >
                        <span>{language === 'ne' ? 'सेभ' : 'Save'}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* 5. SERVICE RECORD DETAILS FULL-SCREEN SHEET */}
      <FullScreenSheet
        isOpen={Boolean(detailRecord)}
        onClose={() => setDetailRecord(null)}
        title={language === 'ne' ? 'मर्मत विवरण' : 'Service Details'}
        subtitle={detailRecord ? formatBsDisplayDate(detailRecord.serviceDateAD, language) : undefined}
        leadingIcon={<Wrench className="w-4 h-4" />}
        rightAction={
          detailRecord && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleEditService(detailRecord)}
                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              >
                <span>{language === 'ne' ? 'सम्पादन' : 'Edit'}</span>
              </Button>
              <IconButton
                variant="danger"
                size="sm"
                onClick={() => setConfirmDeleteRecord(detailRecord)}
                aria-label={t.delete}
                title={t.delete}
              >
                <Trash2 className="w-4 h-4" />
              </IconButton>
            </div>
          )
        }
      >
        {detailRecord && (() => {
          const detailCats = getServiceRecordCategories(detailRecord);
          const autoSummary = (detailRecord.subItems || [])
            .map(i => `${i.name} (${i.category})`)
            .join(', ');
          const hasAutoGeneratedWorkDone =
            Boolean(detailRecord.subItems?.length) && detailRecord.workDone === autoSummary;

          return (
          <div className="space-y-4">
            {/* Overview & Metadata Card */}
            <Card variant="primary" padding="md" className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {language === 'ne' ? 'मर्मत सारांश' : 'Service Summary'}
                  </div>
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)] mt-0.5">
                    {hasAutoGeneratedWorkDone
                      ? language === 'ne'
                        ? `मर्मत भ्रमण · ${detailRecord.subItems!.length} वस्तु`
                        : `Maintenance Visit · ${detailRecord.subItems!.length} ${
                            detailRecord.subItems!.length === 1 ? 'item' : 'items'
                          }`
                      : detailRecord.workDone}
                  </h3>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {language === 'ne' ? 'कुल खर्च' : 'Total Cost'}
                  </div>
                  <div className="text-lg font-semibold font-mono tabular-nums text-[var(--color-accent)]">
                    Rs. {(detailRecord.cost || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[var(--color-border)] text-xs">
                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] block">
                    {language === 'ne' ? 'मिति (BS र AD)' : 'Date (BS & AD)'}
                  </span>
                  <span className="font-semibold text-[var(--color-text-primary)] block mt-0.5">
                    {formatBsDisplayDate(detailRecord.serviceDateAD, language)} BS
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-[var(--color-text-secondary)]">
                    {formatAdDisplayDate(detailRecord.serviceDateAD)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] block">
                    {language === 'ne' ? 'ओडोमिटर र वर्कसप' : 'Odometer & Service Centre'}
                  </span>
                  <span className="font-semibold font-mono tabular-nums text-[var(--color-text-primary)] flex items-center gap-1 mt-0.5">
                    <Gauge className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    {(detailRecord.odometerKm || 0).toLocaleString()} km
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1 mt-0.5 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {detailRecord.serviceCenter || (language === 'ne' ? 'दर्ता नभएको' : 'Not recorded')}
                    </span>
                  </span>
                </div>
              </div>

              {/* Service Categories */}
              <div className="pt-1 space-y-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)] block">
                  {language === 'ne' ? 'मर्मत वर्गहरू' : 'Service Categories'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {detailCats.length > 0 ? (
                    detailCats.map(cat => (
                      <StatusBadge key={cat} status="accent">
                        {getCategoryIcon(cat)}
                        <span>{cat}</span>
                      </StatusBadge>
                    ))
                  ) : (
                    <StatusBadge status="neutral">
                      <span>{language === 'ne' ? 'कुनै वर्ग छैन' : 'Not categorized'}</span>
                    </StatusBadge>
                  )}
                </div>
              </div>
            </Card>

            {/* Itemized Work & Costs Card */}
            <Card variant="primary" padding="md" className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {language === 'ne' ? 'पार्टपुर्जा तथा व्यक्तिगत खर्च' : 'Itemized Parts & Individual Costs'}
                </span>
                <span className="text-xs font-mono font-semibold text-[var(--color-accent)]">
                  {detailRecord.subItems?.length || 0} {language === 'ne' ? 'सामान' : 'items'}
                </span>
              </div>

              {detailRecord.subItems && detailRecord.subItems.length > 0 ? (
                <div className="space-y-1.5">
                  {detailRecord.subItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="p-1 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] shrink-0">
                          {getCategoryIcon(item.category || '')}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--color-text-primary)] truncate">{item.name}</div>
                          <div className="text-[10px] text-[var(--color-text-secondary)]">{item.category}</div>
                        </div>
                      </div>
                      <span className="font-mono tabular-nums font-semibold text-[var(--color-accent)] shrink-0">
                        Rs. {(item.cost || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {language === 'ne'
                    ? 'कुनै छुट्टाछुट्टै सामान सूचीबद्ध गरिएको छैन।'
                    : 'No itemized parts recorded for this visit.'}
                </p>
              )}
            </Card>

            {/* Notes Card (only rendered when notes exist) */}
            {detailRecord.notes && detailRecord.notes.trim() !== '' && (
              <Card variant="primary" padding="md" className="space-y-1.5">
                <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {language === 'ne' ? 'टिप्पणी (Notes)' : 'Notes'}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {detailRecord.notes}
                </p>
              </Card>
            )}

            {/* Next Service & Reminder Card */}
            <Card variant="primary" padding="md" className="space-y-2.5">
              <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                {language === 'ne' ? 'अर्को सर्भिस तालिका र रिमाइन्डर' : 'Next Service & Reminder Configuration'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                  <span className="text-[10px] text-[var(--color-text-secondary)] block">
                    {language === 'ne' ? 'लक्षित दूरी' : 'Next Distance'}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-[var(--color-text-primary)]">
                    {detailRecord.nextServiceKm
                      ? `${detailRecord.nextServiceKm.toLocaleString()} km`
                      : (language === 'ne' ? 'तोकिएको छैन' : 'Not set')}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                  <span className="text-[10px] text-[var(--color-text-secondary)] block">
                    {language === 'ne' ? 'लक्षित मिति' : 'Next Date'}
                  </span>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {detailRecord.nextServiceDateAD
                      ? formatBsDisplayDate(detailRecord.nextServiceDateAD, language)
                      : (language === 'ne' ? 'तोकिएको छैन' : 'Not set')}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                  <span className="text-[10px] text-[var(--color-text-secondary)] block">
                    {language === 'ne' ? 'रिमाइन्डर' : 'Reminder'}
                  </span>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {detailRecord.enableReminder ?? true
                      ? reminderLabelMap[detailRecord.reminderInterval || '1_week']
                      : (language === 'ne' ? 'बन्द' : 'Disabled')}
                  </span>
                </div>
              </div>
            </Card>

            {/* Receipt Photo Card */}
            <Card variant="primary" padding="md" className="space-y-2.5">
              <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                {language === 'ne' ? 'बिल / रसिद' : 'Receipt / Bill'}
              </div>
              {detailRecord.receiptPhoto ? (
                <button
                  type="button"
                  onClick={() =>
                    setActiveReceiptView({
                      title: `${detailRecord.workDone} — ${language === 'ne' ? 'रसिद' : 'Receipt'}`,
                      imageBase64: detailRecord.receiptPhoto!
                    })
                  }
                  className="w-full rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-accent)] transition group relative"
                >
                  <img
                    src={detailRecord.receiptPhoto}
                    alt="Service Receipt"
                    className="w-full max-h-60 object-contain"
                  />
                  <div className="p-2 text-xs font-semibold text-[var(--color-accent)] flex items-center justify-center gap-1.5 border-t border-[var(--color-border)]">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{t.viewReceipt}</span>
                  </div>
                </button>
              ) : (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {language === 'ne' ? 'कुनै बिल वा रसिद संलग्न गरिएको छैन।' : 'No receipt attached.'}
                </p>
              )}
            </Card>
          </div>
          );
        })()}
      </FullScreenSheet>

      {/* 6. 3-STEP GUIDED ADD / EDIT SERVICE FULL-SCREEN SHEET (Screen 7) */}
      <FullScreenSheet
        isOpen={isAddSheetOpen}
        onClose={handleCloseAddSheet}
        title={
          savedSuccessRecord
            ? (language === 'ne' ? 'मर्मत सुरक्षित भयो' : 'Service Saved')
            : editingServiceId
            ? (language === 'ne' ? 'मर्मत विवरण सम्पादन' : 'Edit Service')
            : (language === 'ne' ? 'नयाँ मर्मत थप्नुहोस्' : 'Add Service')
        }
        subtitle={
          savedSuccessRecord
            ? `${bike.name} · ${formatBsDisplayDate(savedSuccessRecord.serviceDateAD, language)}`
            : `${bike.name} · ${
                sheetStep === 1
                  ? (language === 'ne' ? 'चरण १/३ — मर्मत जानकारी' : 'Step 1 of 3 — Service Information')
                  : sheetStep === 2
                  ? (language === 'ne' ? 'चरण २/३ — सेवा वस्तुहरू' : 'Step 2 of 3 — Service Items')
                  : (language === 'ne' ? 'चरण ३/३ — थप जानकारी' : 'Step 3 of 3 — Additional Information')
              }`
        }
        footer={
          savedSuccessRecord ? (
            <div className="flex items-center gap-2.5">
              <Button
                variant="secondary"
                size="lg"
                onClick={handleCloseAddSheet}
                className="px-5"
              >
                {language === 'ne' ? 'समाप्त' : 'Done'}
              </Button>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => {
                  const target = savedSuccessRecord;
                  handleCloseAddSheet();
                  setDetailRecord(target);
                }}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                {language === 'ne' ? 'रेकर्ड हेर्नुहोस्' : 'View Record'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              {sheetStep > 1 && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    setFormError(null);
                    setSheetStep(prev => (prev - 1) as 1 | 2 | 3);
                  }}
                >
                  {language === 'ne' ? 'पछाडि' : 'Back'}
                </Button>
              )}

              {sheetStep < 3 ? (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => handleGoToStep((sheetStep + 1) as 1 | 2 | 3)}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  {language === 'ne' ? 'अर्को' : 'Next'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  onClick={() => handleSubmit()}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  {editingServiceId
                    ? (language === 'ne' ? 'सेभ गर्नुहोस्' : 'Save Changes')
                    : (language === 'ne' ? 'मर्मत सेभ गर्नुहोस्' : 'Save Service')}
                </Button>
              )}
            </div>
          )
        }
      >
        {savedSuccessRecord ? (
          <div className="py-6 space-y-5 animate-in fade-in">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-[var(--color-success)]/15 border border-[var(--color-success)]/40 flex items-center justify-center text-[var(--color-success)]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {editingServiceId
                    ? (language === 'ne' ? 'मर्मत रेकर्ड अद्यावधिक भयो' : 'Service Record Updated')
                    : (language === 'ne' ? 'मर्मत रेकर्ड सुरक्षित भयो' : 'Service Record Saved')}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {language === 'ne'
                    ? 'तपाईंको ड्यासबोर्ड र मर्मत इतिहास अद्यावधिक गरिएको छ।'
                    : 'Your vehicle odometer, dashboard, and maintenance history are updated.'}
                </p>
              </div>
            </div>

            <Card variant="primary" padding="md" className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                    {language === 'ne' ? 'गरिएको काम' : 'Work Performed'}
                  </div>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                    {savedSuccessRecord.workDone}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                    {language === 'ne' ? 'कुल खर्च' : 'Total Cost'}
                  </div>
                  <div className="text-base font-semibold font-mono tabular-nums text-[var(--color-accent)]">
                    Rs. {(savedSuccessRecord.cost || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-[var(--color-border)] text-xs">
                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)]">
                  <span className="text-[10px] text-[var(--color-text-secondary)] block">
                    {language === 'ne' ? 'मर्मत मिति' : 'Service Date'}
                  </span>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {formatBsDisplayDate(savedSuccessRecord.serviceDateAD, language)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)]">
                  <span className="text-[10px] text-[var(--color-text-secondary)] block">
                    {language === 'ne' ? 'ओडोमिटर' : 'Odometer'}
                  </span>
                  <span className="font-semibold font-mono tabular-nums text-[var(--color-text-primary)]">
                    {savedSuccessRecord.odometerKm.toLocaleString()} km
                  </span>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 3-Step Guided Stepper (Screen 7 Top Progress Bar) */}
            <div className="space-y-2">
              <div className="flex items-center justify-center max-w-xs mx-auto">
                {[
                  { num: 1 as const, en: 'Service Information', ne: 'मर्मत जानकारी' },
                  { num: 2 as const, en: 'Service Items', ne: 'सेवा वस्तुहरू' },
                  { num: 3 as const, en: 'Additional Information', ne: 'थप जानकारी' }
                ].map((s, idx) => (
                  <React.Fragment key={s.num}>
                    <button
                      type="button"
                      onClick={() => handleGoToStep(s.num)}
                      aria-label={language === 'ne' ? s.ne : s.en}
                      className={`w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center transition duration-150 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                        sheetStep === s.num
                          ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] clay-btn-primary ring-2 ring-[var(--color-accent)]/30'
                          : sheetStep > s.num
                          ? 'bg-[var(--color-success)] text-[#071316] clay-btn-primary'
                          : 'bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset text-[var(--color-text-secondary)]'
                      }`}
                    >
                      {sheetStep > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                    </button>
                    {idx < 2 && (
                      <div
                        className={`h-1 flex-1 mx-2 rounded-full transition-colors clay-inset ${
                          sheetStep > s.num ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-2)]'
                        }`}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
              <div className="text-center text-sm font-semibold text-[var(--color-text-primary)]">
                {sheetStep === 1
                  ? (language === 'ne' ? 'मर्मत जानकारी' : 'Service Information')
                  : sheetStep === 2
                  ? (language === 'ne' ? 'सेवा वस्तुहरू' : 'Service Items')
                  : (language === 'ne' ? 'थप जानकारी' : 'Additional Information')}
              </div>
            </div>

            {/* Form Error Banner */}
            {formError && (
              <div
                role="alert"
                className="p-3 rounded-2xl bg-[var(--color-error-subtle)] border border-[var(--color-error)]/50 text-[var(--color-error)] text-xs flex items-center gap-2 animate-in fade-in"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* STEP 1: SERVICE INFORMATION (Date, Odometer, Optional Workshop — NO overall service category) */}
              {sheetStep === 1 && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Full-width Service Date (BS prominent + AD preview, calendar icon right) */}
                  <NepaliDatePicker
                    label={language === 'ne' ? 'मर्मत मिति' : 'Service Date'}
                    valueAD={serviceDateAD}
                    onChange={(ad) => {
                      setServiceDateAD(ad);
                      setConfirmOdometerAnomaly(false);
                      setFieldErrors(prev => ({ ...prev, date: undefined, odometer: undefined }));
                      setFormError(null);
                    }}
                    required={true}
                    error={Boolean(fieldErrors.date)}
                    errorMessage={fieldErrors.date}
                    language={language}
                  />

                  {/* Full-width Odometer Reading with km unit & validation */}
                  <div className="space-y-2">
                    <NumberInput
                      label={language === 'ne' ? 'ओडोमिटर रिडिङ' : 'Odometer Reading'}
                      required
                      unit="km"
                      min={0}
                      max={9999999}
                      placeholder={language === 'ne' ? 'हालको ओडोमिटर लेख्नुहोस्' : 'Enter odometer reading'}
                      value={odometerInput}
                      onChange={(e) => {
                        setOdometerInput(e.target.value);
                        setConfirmOdometerAnomaly(false);
                        setFieldErrors(prev => ({ ...prev, odometer: undefined }));
                        setFormError(null);
                      }}
                      error={fieldErrors.odometer}
                    />
                    {odometerConsistencyWarning && (
                      <div className="p-3 rounded-2xl bg-[var(--color-warning-subtle)] border border-[var(--color-warning)]/40 space-y-2 animate-in fade-in">
                        <p className="text-xs text-[var(--color-warning)] font-medium flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{odometerConsistencyWarning}</span>
                        </p>
                        <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={confirmOdometerAnomaly}
                            onChange={(e) => {
                              setConfirmOdometerAnomaly(e.target.checked);
                              setFieldErrors(prev => ({ ...prev, odometer: undefined }));
                              setFormError(null);
                            }}
                            className="w-4 h-4 rounded accent-[var(--color-accent)]"
                          />
                          <span>
                            {language === 'ne'
                              ? 'यो ओडोमिटर रिडिङ सही छ (मिटर परिवर्तन / सुधार)'
                              : 'Confirm this odometer reading (meter reset or correction)'}
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Optional Service Centre / Workshop */}
                  <TextInput
                    label={language === 'ne' ? 'सर्भिस सेन्टर / वर्कसप (ऐच्छिक)' : 'Service Centre / Workshop (Optional)'}
                    placeholder={language === 'ne' ? 'वर्कसप वा मेकानिकको नाम' : 'Workshop or mechanic name'}
                    value={serviceCenter}
                    onChange={(e) => setServiceCenter(e.target.value)}
                  />
                </div>
              )}

              {/* STEP 2: SERVICE ITEMS (Auto-populated 1st empty row, Item Category dropdown, NPR Amount, Live Total) */}
              {sheetStep === 2 && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Prominent Live Total Cost Summary Card */}
                  <Card variant="primary" padding="md" className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent)] shrink-0">
                        <Tag className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                          {language === 'ne' ? 'कुल मर्मत खर्च' : 'Total Service Cost'}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-secondary)]">
                          {language === 'ne'
                            ? `${subItems.length} सेवा वस्तुबाट स्वतः गणना गरिएको`
                            : `Calculated from ${subItems.length} service ${subItems.length === 1 ? 'item' : 'items'}`}
                        </div>
                      </div>
                    </div>

                    <div className="text-xl font-semibold font-mono tabular-nums text-[var(--color-accent)] shrink-0">
                      NPR {calculatedItemsTotal.toLocaleString()}
                    </div>
                  </Card>

                  {/* Repeatable Service Item Rows */}
                  <Card variant="primary" padding="md" className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                        {language === 'ne' ? 'सेवा वस्तुहरू' : 'Service Items'}
                        <span className="ml-1 text-[var(--color-error)] font-semibold">*</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowNewCatInput(prev => !prev)}
                        className="text-xs text-[var(--color-accent)] hover:underline font-semibold flex items-center gap-1"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>
                          {showNewCatInput
                            ? t.cancel
                            : (language === 'ne' ? '+ नयाँ वर्ग' : '+ New Category')}
                        </span>
                      </button>
                    </div>

                    {showNewCatInput && (
                      <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-accent)]/40 animate-in fade-in">
                        <input
                          type="text"
                          placeholder={language === 'ne' ? 'नयाँ वर्गको नाम' : 'New category name'}
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          className="flex-1 min-h-[40px] bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                        <Button variant="primary" size="sm" onClick={handleCreateCategory}>
                          {language === 'ne' ? 'थप्नुहोस्' : 'Add'}
                        </Button>
                      </div>
                    )}

                    <div className="space-y-3">
                      {subItems.map((item, idx) => {
                        const rowOptions = Array.from(
                          new Set([...categories, ...(item.category ? [item.category] : [])])
                        );
                        const isMissingName = Boolean(fieldErrors.subItems && !item.name.trim());
                        const isInvalidCost = Boolean(
                          fieldErrors.subItems && !isValidCostInput(item.costInput)
                        );
                        const isOnlyItem = subItems.length <= 1;

                        return (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                {language === 'ne' ? `वस्तु #${idx + 1}` : `Item #${idx + 1}`}
                              </span>
                              <IconButton
                                size="sm"
                                variant="danger"
                                disabled={isOnlyItem}
                                onClick={() => handleRemoveSubItem(item.id)}
                                aria-label={
                                  isOnlyItem
                                    ? (language === 'ne' ? 'कम्तिमा एउटा वस्तु आवश्यक छ' : 'At least one item is required')
                                    : (language === 'ne' ? 'वस्तु हटाउनुहोस्' : 'Remove item')
                                }
                                title={
                                  isOnlyItem
                                    ? (language === 'ne' ? 'कम्तिमा एउटा वस्तु आवश्यक छ' : 'At least one item is required')
                                    : (language === 'ne' ? 'हटाउनुहोस्' : 'Remove')
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </IconButton>
                            </div>

                            <TextInput
                              id={`service-item-name-${item.id}`}
                              label={language === 'ne' ? 'सेवा वस्तु' : 'Service Item'}
                              required
                              placeholder={language === 'ne' ? 'सेवा वस्तु लेख्नुहोस्' : 'Enter service item'}
                              value={item.name}
                              onChange={(e) => handleUpdateSubItem(item.id, { name: e.target.value })}
                              error={
                                isMissingName
                                  ? (language === 'ne' ? 'सेवा वस्तुको नाम आवश्यक छ।' : 'Service item description is required.')
                                  : undefined
                              }
                              className="bg-[var(--color-surface-1)]"
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <CustomDropdown
                                id={`service-item-category-${item.id}`}
                                label={language === 'ne' ? 'वर्ग' : 'Category'}
                                required
                                value={item.category}
                                onValueChange={(nextCategory) =>
                                  handleUpdateSubItem(item.id, { category: nextCategory })
                                }
                                options={rowOptions.map((c) => ({
                                  value: c,
                                  label: c,
                                  icon: getCategoryIcon(c)
                                }))}
                                searchPlaceholder={language === 'ne' ? 'वर्ग खोज्नुहोस्...' : 'Search category...'}
                                emptyText={language === 'ne' ? 'कुनै वर्ग भेटिएन' : 'No matching category'}
                                triggerClassName="bg-[var(--color-surface-1)]"
                              />

                              <NumberInput
                                id={`service-item-cost-${item.id}`}
                                label={language === 'ne' ? 'रकम' : 'Amount'}
                                rightAdornment={<span>NPR</span>}
                                min={0}
                                placeholder={language === 'ne' ? 'रकम लेख्नुहोस्' : 'Enter amount'}
                                value={item.costInput}
                                onChange={(e) =>
                                  handleUpdateSubItem(item.id, { costInput: e.target.value })
                                }
                                error={
                                  isInvalidCost
                                    ? (language === 'ne' ? 'मान्य रकम प्रविष्ट गर्नुहोस्।' : 'Enter a valid non-negative amount.')
                                    : undefined
                                }
                                className="bg-[var(--color-surface-1)] pr-14 text-right"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {fieldErrors.subItems && (
                      <p className="text-xs text-[var(--color-error)] font-medium flex items-center gap-1.5 px-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{fieldErrors.subItems}</span>
                      </p>
                    )}

                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      fullWidth
                      onClick={handleAddSubItemRow}
                      leftIcon={<Plus className="w-4 h-4" />}
                    >
                      <span>{language === 'ne' ? 'अर्को वस्तु थप्नुहोस्' : 'Add Another Item'}</span>
                    </Button>
                  </Card>
                </div>
              )}

              {/* STEP 3: ADDITIONAL INFORMATION */}
              {sheetStep === 3 && (
                <div className="space-y-4 animate-in fade-in">
                  <TextArea
                    label={language === 'ne' ? 'गरिएको काम (ऐच्छिक)' : 'Work Performed (Optional)'}
                    placeholder={
                      language === 'ne'
                        ? 'उदाहरण: इन्जिन आयल परिवर्तन, चेन सफाइ'
                        : 'Describe maintenance work completed'
                    }
                    value={workDone}
                    onChange={(e) => {
                      setWorkDone(e.target.value);
                      setFieldErrors(prev => ({ ...prev, workDone: undefined }));
                      setFormError(null);
                    }}
                    error={fieldErrors.workDone}
                    hint={
                      language === 'ne'
                        ? 'खाली छोड्नुभएमा चरण २ का सेवा वस्तुहरूबाट स्वतः सारांश बन्नेछ।'
                        : 'Leave blank to auto-summarize from Step 2 service items.'
                    }
                    rows={3}
                  />

                  <TextArea
                    label={language === 'ne' ? 'टिप्पणी (ऐच्छिक)' : 'Notes (Optional)'}
                    placeholder={language === 'ne' ? 'पार्टपुर्जा वा मेकानिकको सुझाव लेख्नुहोस्' : 'Mechanic advice or extra notes'}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />

                  {/* Digital Receipt Upload (Optional) */}
                  <Card variant="primary" padding="md" className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--color-text-primary)] flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                        <span>
                          {language === 'ne' ? 'बिल / रसिद फोटो (ऐच्छिक)' : 'Receipt Upload (Optional)'}
                        </span>
                      </span>
                      {receiptPhoto && (
                        <button
                          type="button"
                          onClick={() => setReceiptPhoto(undefined)}
                          className="text-xs text-[var(--color-error)] hover:underline flex items-center gap-1 font-medium"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{t.delete}</span>
                        </button>
                      )}
                    </div>

                    {receiptPhoto ? (
                      <div className="relative rounded-2xl overflow-hidden border border-[var(--color-border)] max-w-xs group">
                        <img src={receiptPhoto} alt="Receipt preview" className="w-full h-28 object-cover" />
                        <div className="p-2 bg-[var(--color-surface-2)] flex justify-center">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setActiveReceiptView({ title: t.viewReceipt, imageBase64: receiptPhoto })}
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                          >
                            {t.viewReceipt}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 min-h-[52px] p-3 border border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] rounded-2xl cursor-pointer bg-[var(--color-surface-2)] clay-inset hover:bg-[var(--color-surface-3)] transition text-center">
                        <Camera className="w-4 h-4 text-[var(--color-accent)]" />
                        <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                          {language === 'ne' ? 'बिल वा रसिद फोटो छान्नुहोस्' : 'Snap or upload bill / receipt photo'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </Card>

                  {/* Next Service Schedule & Reminder Configuration (Optional) */}
                  <Card variant="primary" padding="md" className="space-y-3.5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[var(--color-text-primary)]">
                          {language === 'ne' ? 'अर्को सर्भिस दूरी (ऐच्छिक)' : 'Next-Service Distance (Optional)'}
                        </span>
                        <span className="text-[11px] font-medium text-[var(--color-accent)]">
                          {t.targetKmHelpers}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {[500, 1000, 2000, 3000].map(inc => (
                          <SelectableChip
                            key={inc}
                            size="sm"
                            selected={nextServiceKm === (Number(odometerKm) || 0) + inc}
                            onClick={() => handleSetTargetKmIncrement(inc)}
                            className="justify-center font-mono"
                          >
                            +{inc}
                          </SelectableChip>
                        ))}
                      </div>

                      <NumberInput
                        label={language === 'ne' ? 'अर्को लक्षित कि.मी. (ऐच्छिक)' : 'Next-Service Odometer (Optional)'}
                        unit="km"
                        min={0}
                        placeholder={language === 'ne' ? 'उदाहरण: 5500' : 'Leave blank if unset'}
                        value={nextServiceKm}
                        onChange={(e) => {
                          setNextServiceKm(e.target.value === '' ? '' : Number(e.target.value));
                          setFieldErrors(prev => ({ ...prev, nextServiceKm: undefined }));
                        }}
                        error={fieldErrors.nextServiceKm}
                      />
                    </div>

                    <div className="space-y-2 pt-3 border-t border-[var(--color-border)]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[var(--color-text-primary)]">
                          {language === 'ne' ? 'अर्को सर्भिस मिति (ऐच्छिक)' : 'Next-Service Date (Optional)'}
                        </span>
                        <div className="flex items-center gap-1">
                          {[
                            { d: 30, label: '+1m' },
                            { d: 90, label: '+3m' },
                            { d: 180, label: '+6m' }
                          ].map(p => (
                            <SelectableChip
                              key={p.d}
                              size="sm"
                              selected={false}
                              onClick={() => handleSetTargetDateIncrement(p.d)}
                            >
                              {p.label}
                            </SelectableChip>
                          ))}
                        </div>
                      </div>

                      {nextServiceDateAD ? (
                        <div className="space-y-1.5">
                          <NepaliDatePicker
                            label={language === 'ne' ? 'लक्षित मिति (ऐच्छिक)' : 'Target Service Date (Optional)'}
                            valueAD={nextServiceDateAD}
                            onChange={(ad) => setNextServiceDateAD(ad)}
                            showQuickPresets={false}
                            language={language}
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setNextServiceDateAD('')}
                              className="text-[11px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-error)] transition"
                            >
                              {language === 'ne' ? 'मिति हटाउनुहोस्' : 'Clear target date'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetTargetDateIncrement(90)}
                          className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] flex items-center justify-between transition"
                        >
                          <span>{language === 'ne' ? 'लक्षित मिति तोकिएको छैन (छान्न थिच्नुहोस्)' : 'No next-service date set (Tap to pick)'}</span>
                          <Calendar className="w-4 h-4 text-[var(--color-accent)]" />
                        </button>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[var(--color-border)] space-y-3">
                      <Switch
                        checked={enableReminder}
                        onChange={setEnableReminder}
                        label={language === 'ne' ? 'रिमाइन्डर सक्रिय गर्नुहोस्' : 'Reminder Enabled'}
                        description={
                          language === 'ne'
                            ? 'आगामी मर्मत म्याद अगावै सूचना पाउनुहोस्'
                            : 'Get notified ahead of next scheduled maintenance'
                        }
                      />

                      {enableReminder && (
                        <SelectField
                          label={language === 'ne' ? 'रिमाइन्डर समय' : 'Reminder Interval'}
                          searchable={false}
                          value={reminderInterval}
                          onValueChange={(val) =>
                            setReminderInterval(val as ServiceRecord['reminderInterval'] & string)
                          }
                          options={[
                            { value: 'today', label: t.reminderToday },
                            { value: '1_week', label: t.reminder1Week },
                            { value: '2_weeks', label: t.reminder2Weeks },
                            { value: '4_weeks', label: t.reminder4Weeks }
                          ]}
                        />
                      )}
                    </div>
                  </Card>
                </div>
              )}
            </form>
          </div>
        )}
      </FullScreenSheet>

      {/* 7. FULLSCREEN RECEIPT VIEWER */}
      <FullScreenSheet
        isOpen={Boolean(activeReceiptView)}
        onClose={() => setActiveReceiptView(null)}
        title={activeReceiptView?.title || t.viewReceipt}
        leadingIcon={<Camera className="w-4 h-4" />}
      >
        {activeReceiptView && (
          <div className="flex items-center justify-center py-2">
            <img
              src={activeReceiptView.imageBase64}
              alt="Receipt"
              className="max-h-[78vh] w-auto object-contain rounded-2xl border border-[var(--color-border)]"
            />
          </div>
        )}
      </FullScreenSheet>

      {/* 8. DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(confirmDeleteRecord)}
        onClose={() => setConfirmDeleteRecord(null)}
        onConfirm={executeDeleteService}
        title={language === 'ne' ? 'मर्मत रेकर्ड मेटाउने?' : 'Delete Service Record?'}
        subtitle={
          confirmDeleteRecord
            ? `${confirmDeleteRecord.workDone} (${formatBsDisplayDate(confirmDeleteRecord.serviceDateAD, language)})`
            : undefined
        }
        message={
          language === 'ne'
            ? 'के तपाईं यो मर्मत रेकर्ड स्थायी रूपमा मेटाउन निश्चित हुनुहुन्छ? यो कार्य फिर्ता गर्न सकिँदैन।'
            : 'Are you sure you want to permanently delete this service record? This action cannot be undone.'
        }
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        icon={<Trash2 className="w-5 h-5" />}
        variant="danger"
      />
    </div>
  );
};
