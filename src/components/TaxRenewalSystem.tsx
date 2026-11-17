import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  Calendar,
  History,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Receipt,
  Scale,
  AlertTriangle,
  Camera,
  Eye,
  Trash2,
  Bell,
  Save,
  Edit2,
  Shield,
  Check,
  Plus,
  MapPin,
  FileText,
  BookOpen,
  Info
} from 'lucide-react';
import { Bike, DocumentItem, RenewalRecord, TaxStatusResult } from '../types';
import { db } from '../db/db';
import { calculateNepalTaxStatus, getEstimatedBaseTax } from '../utils/nepalTax';
import {
  adToBs,
  formatAdDate,
  formatAdDisplayDate,
  formatBsDisplayDate
} from '../utils/nepaliCalendar';
import { NepaliDatePicker } from './NepaliDatePicker';
import { downloadIcsFile, getReminderDaysBefore } from '../utils/calendarExport';
import { getDocumentExpiryStatus, normalizeDocumentCategory } from './DocumentVault';
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
  SelectableChip,
  SelectField,
  StatusBadge,
  StatusIndicator,
  Switch,
  TextArea,
  TextInput
} from './ui';
import { ContextualVehicleBar } from './ContextualVehicleBar';

interface Props {
  bike: Bike;
  renewals: RenewalRecord[];
  documents?: DocumentItem[];
  onRefresh: () => void;
  language: 'en' | 'ne';
  onOpenVault: () => void;
  openAddTrigger?: number;
  selectedRenewalTrigger?: { id: number; ts: number } | null;
  onOpenGarage?: () => void;
}

interface RenewalFieldErrors {
  renewedDate?: string;
  validUntilDate?: string;
  taxAmount?: string;
  fineAmount?: string;
}

export type TaxRecordClassification = 'paid' | 'upcoming' | 'overdue' | 'not_recorded';
export type TaxSortBy = 'valid_desc' | 'valid_asc' | 'renewed_desc' | 'amount_desc' | 'amount_asc';

export function classifyTaxRenewalRecord(
  record: RenewalRecord,
  latestRenewalId: number | undefined,
  baseTax: number,
  currentDateInput?: Date | string
): {
  classification: Exclude<TaxRecordClassification, 'not_recorded'>;
  isCurrentCycle: boolean;
  taxStatus: TaxStatusResult;
} {
  const taxStatus = calculateNepalTaxStatus(record.validUntilAD, baseTax, currentDateInput);
  const isCurrentCycle = latestRenewalId !== undefined && record.id === latestRenewalId;

  // Past superseded renewals represent completed historical tax payments
  if (!isCurrentCycle) {
    return {
      classification: 'paid',
      isCurrentCycle: false,
      taxStatus
    };
  }

  if (taxStatus.status === 'VALID') {
    return {
      classification: taxStatus.daysRemaining <= 15 ? 'upcoming' : 'paid',
      isCurrentCycle: true,
      taxStatus
    };
  }

  return {
    classification: 'overdue',
    isCurrentCycle: true,
    taxStatus
  };
}

export function filterAndSortRenewals(
  records: RenewalRecord[],
  options: {
    searchQuery: string;
    statusFilter: 'ALL' | Exclude<TaxRecordClassification, 'not_recorded'>;
    sortBy: TaxSortBy;
    latestRenewalId: number | undefined;
    baseTax: number;
    language: 'en' | 'ne';
  }
): RenewalRecord[] {
  const q = options.searchQuery.trim().toLowerCase();

  const filtered = records.filter(r => {
    const info = classifyTaxRenewalRecord(r, options.latestRenewalId, options.baseTax);
    if (options.statusFilter !== 'ALL' && info.classification !== options.statusFilter) {
      return false;
    }

    if (!q) return true;
    const validBs = r.validUntilAD ? formatBsDisplayDate(r.validUntilAD, options.language).toLowerCase() : '';
    const renewedBs = r.renewedDateAD ? formatBsDisplayDate(r.renewedDateAD, options.language).toLowerCase() : '';

    return (
      (r.officeLocation || '').toLowerCase().includes(q) ||
      (r.notes || '').toLowerCase().includes(q) ||
      (r.validUntilBS || '').toLowerCase().includes(q) ||
      (r.validUntilAD || '').toLowerCase().includes(q) ||
      (r.renewedDateBS || '').toLowerCase().includes(q) ||
      (r.renewedDateAD || '').toLowerCase().includes(q) ||
      validBs.includes(q) ||
      renewedBs.includes(q) ||
      String(r.totalPaid || 0).includes(q) ||
      String(r.taxAmount || 0).includes(q) ||
      String(r.fineAmount || 0).includes(q) ||
      info.classification.includes(q)
    );
  });

  return [...filtered].sort((a, b) => {
    const validA = new Date(a.validUntilAD).getTime() || 0;
    const validB = new Date(b.validUntilAD).getTime() || 0;
    const renA = new Date(a.renewedDateAD || a.validUntilAD).getTime() || 0;
    const renB = new Date(b.renewedDateAD || b.validUntilAD).getTime() || 0;
    const amtA = Number(a.totalPaid || a.taxAmount || 0);
    const amtB = Number(b.totalPaid || b.taxAmount || 0);

    switch (options.sortBy) {
      case 'valid_asc':
        return validA - validB || (a.id || 0) - (b.id || 0);
      case 'renewed_desc':
        return renB - renA || validB - validA || (b.id || 0) - (a.id || 0);
      case 'amount_desc':
        return amtB - amtA || validB - validA || (b.id || 0) - (a.id || 0);
      case 'amount_asc':
        return amtA - amtB || validB - validA || (a.id || 0) - (b.id || 0);
      case 'valid_desc':
      default:
        return validB - validA || renB - renA || (b.id || 0) - (a.id || 0);
    }
  });
}

export function isDuplicateRenewalSubmission(
  existingRenewals: RenewalRecord[],
  candidate: Pick<RenewalRecord, 'bikeId' | 'renewedDateAD' | 'validUntilAD'>,
  editingId: number | null
): boolean {
  return existingRenewals.some(r => {
    if (editingId !== null && r.id === editingId) return false;
    if (r.bikeId !== candidate.bikeId) return false;
    return r.renewedDateAD === candidate.renewedDateAD && r.validUntilAD === candidate.validUntilAD;
  });
}

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
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
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const TaxRenewalSystem: React.FC<Props> = ({
  bike,
  renewals,
  documents = [],
  onRefresh,
  language,
  onOpenVault,
  openAddTrigger,
  selectedRenewalTrigger,
  onOpenGarage
}) => {
  const t = translations[language];

  // Existing sections: Tax | Insurance | Blue Book
  const [activeSectionPill, setActiveSectionPill] = useState<'tax' | 'insurance' | 'bluebook'>('tax');
  const [showTaxBreakdownDetails, setShowTaxBreakdownDetails] = useState(false);

  // Full-Screen Detail & Form Sheets
  const [detailRecord, setDetailRecord] = useState<RenewalRecord | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRenewalId, setEditingRenewalId] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RenewalFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'paid' | 'upcoming' | 'overdue'>('ALL');
  const [sortBy, setSortBy] = useState<TaxSortBy>('valid_desc');
  const [showAllRenewals, setShowAllRenewals] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nepal Act Rules accordion
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  // Digital Receipt / Blue Book Viewer & Delete Confirmation
  const [activeReceiptView, setActiveReceiptView] = useState<{ title: string; imageBase64: string } | null>(null);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<RenewalRecord | null>(null);

  // Form State (preserving all RenewalRecord fields)
  const estimatedBaseTax = getEstimatedBaseTax(bike.cc, bike.category);
  const [renewedDateAD, setRenewedDateAD] = useState(formatAdDate(new Date()));
  const [validUntilAD, setValidUntilAD] = useState(
    formatAdDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))
  );
  const [taxAmountInput, setTaxAmountInput] = useState<string>(String(estimatedBaseTax));
  const [fineAmountInput, setFineAmountInput] = useState<string>('0');
  const [officeLocation, setOfficeLocation] = useState('');
  const [bluebookPages, setBluebookPages] = useState<string[]>([]);
  const [receiptPhoto, setReceiptPhoto] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [enableReminder, setEnableReminder] = useState<boolean>(true);
  const [reminderInterval, setReminderInterval] = useState<'today' | '1_week' | '2_weeks' | '4_weeks'>('1_week');

  // Reset detail sheet when active vehicle changes
  useEffect(() => {
    setDetailRecord(null);
  }, [bike.id]);

  // Keep detailRecord synced after edit/refresh
  useEffect(() => {
    if (detailRecord?.id) {
      const updated = renewals.find(r => r.id === detailRecord.id);
      setDetailRecord(updated || null);
    }
  }, [renewals]);

  // Sort renewals newest validUntilAD first
  const sortedRenewals = [...renewals].sort(
    (a, b) => new Date(b.validUntilAD).getTime() - new Date(a.validUntilAD).getTime()
  );
  const latestRenewal = sortedRenewals[0] || null;

  // Tax status calculated strictly from latest recorded renewal
  const taxStatus: TaxStatusResult | null = latestRenewal
    ? calculateNepalTaxStatus(latestRenewal.validUntilAD, estimatedBaseTax)
    : null;

  const isRenewalApproaching = Boolean(
    taxStatus &&
      ((taxStatus.status === 'VALID' && taxStatus.daysRemaining <= 15) ||
        taxStatus.status === 'GRACE_PERIOD')
  );

  // Open Add Renewal Sheet with clean state
  const handleOpenAddModal = () => {
    const todayStr = formatAdDate(new Date());
    const oneYearLaterStr = formatAdDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
    setEditingRenewalId(null);
    setRenewedDateAD(todayStr);
    setValidUntilAD(oneYearLaterStr);
    setTaxAmountInput(String(estimatedBaseTax));
    setFineAmountInput('0');
    setOfficeLocation('');
    setBluebookPages([]);
    setReceiptPhoto(undefined);
    setNotes('');
    setEnableReminder(true);
    setReminderInterval('1_week');
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(false);
    setIsAddModalOpen(true);
  };

  // Open Edit Renewal Sheet pre-populated with saved record data
  const handleEditRenewal = (record: RenewalRecord) => {
    setDetailRecord(null);
    setEditingRenewalId(record.id || null);
    setRenewedDateAD(record.renewedDateAD || formatAdDate(new Date()));
    setValidUntilAD(record.validUntilAD);
    setTaxAmountInput(String(record.taxAmount ?? 0));
    setFineAmountInput(String(record.fineAmount ?? 0));
    setOfficeLocation(record.officeLocation || '');
    setBluebookPages(Array.isArray(record.bluebookPages) ? [...record.bluebookPages] : []);
    setReceiptPhoto(record.receiptPhoto);
    setNotes(record.notes || '');
    setEnableReminder(record.enableReminder ?? true);
    setReminderInterval(record.reminderInterval || '1_week');
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(false);
    setIsAddModalOpen(true);
  };

  // Listen to external Add trigger from Quick Actions
  const lastTriggerRef = useRef<number | undefined>(openAddTrigger);
  useEffect(() => {
    if (openAddTrigger !== undefined && openAddTrigger > (lastTriggerRef.current || 0)) {
      handleOpenAddModal();
    }
    lastTriggerRef.current = openAddTrigger;
  }, [openAddTrigger]);

  // Listen to external record selection from Dashboard Recent Activity -> open Renewal Details
  const lastSelectedRenewalTsRef = useRef<number>(0);
  useEffect(() => {
    if (
      selectedRenewalTrigger &&
      selectedRenewalTrigger.ts > lastSelectedRenewalTsRef.current
    ) {
      const target = renewals.find(r => r.id === selectedRenewalTrigger.id);
      if (target) {
        lastSelectedRenewalTsRef.current = selectedRenewalTrigger.ts;
        setDetailRecord(target);
      }
    }
  }, [selectedRenewalTrigger, renewals]);

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setEditingRenewalId(null);
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(false);
    setReceiptPhoto(undefined);
    setBluebookPages([]);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError(language === 'ne' ? 'कृपया तस्बिर फाइल मात्र छान्नुहोस्।' : 'Please select an image file.');
      return;
    }
    try {
      const compressed = await compressImageFile(file);
      setReceiptPhoto(compressed);
      setFormError(null);
    } catch {
      setFormError(language === 'ne' ? 'तस्बिर अपलोड गर्न सकिएन।' : 'Unable to process image.');
    }
  };

  const handleBluebookPageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((f: File) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setFormError(language === 'ne' ? 'कृपया तस्बिर फाइल मात्र छान्नुहोस्।' : 'Please select image files only.');
      return;
    }

    try {
      const compressedList = await Promise.all(imageFiles.map((f: File) => compressImageFile(f)));
      setBluebookPages(prev => [...prev, ...compressedList]);
      setFormError(null);
    } catch {
      setFormError(language === 'ne' ? 'ब्लुबुक फोटो प्रशोधन गर्न सकिएन।' : 'Unable to process Blue Book image.');
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveBluebookPage = (index: number) => {
    setBluebookPages(prev => prev.filter((_, idx) => idx !== index));
  };

  const parsedTaxAmount = taxAmountInput.trim() === '' ? NaN : Number(taxAmountInput);
  const parsedFineAmount = fineAmountInput.trim() === '' ? 0 : Number(fineAmountInput);
  const liveTotalAmount =
    (Number.isFinite(parsedTaxAmount) && parsedTaxAmount >= 0 ? parsedTaxAmount : 0) +
    (Number.isFinite(parsedFineAmount) && parsedFineAmount >= 0 ? parsedFineAmount : 0);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const errors: RenewalFieldErrors = {};

    if (!renewedDateAD) {
      errors.renewedDate =
        language === 'ne' ? 'कृपया नवीकरण गरिएको मिति छान्नुहोस्।' : 'Please select the renewed date.';
    }

    if (!validUntilAD) {
      errors.validUntilDate =
        language === 'ne' ? 'कृपया म्याद समाप्त हुने मिति छान्नुहोस्।' : 'Please select the valid-until date.';
    } else if (renewedDateAD && new Date(validUntilAD).getTime() <= new Date(renewedDateAD).getTime()) {
      errors.validUntilDate =
        language === 'ne'
          ? 'म्याद समाप्त हुने मिति नवीकरण मितिभन्दा पछिको हुनुपर्छ।'
          : 'Valid-until date must be after the renewal date.';
    }

    if (taxAmountInput.trim() === '' || !Number.isFinite(parsedTaxAmount) || parsedTaxAmount <= 0) {
      errors.taxAmount =
        language === 'ne'
          ? 'कृपया ० भन्दा बढी मान्य कर रकम (NPR) प्रविष्ट गर्नुहोस्।'
          : 'Please enter a valid tax amount greater than NPR 0.';
    }

    if (fineAmountInput.trim() !== '' && (!Number.isFinite(parsedFineAmount) || parsedFineAmount < 0)) {
      errors.fineAmount =
        language === 'ne'
          ? 'जरिवाना रकम ० वा सोभन्दा माथि हुनुपर्छ।'
          : 'Fine amount cannot be negative.';
    }

    setFieldErrors(errors);

    const firstErr =
      errors.renewedDate || errors.validUntilDate || errors.taxAmount || errors.fineAmount;
    if (firstErr) {
      setFormError(firstErr);
      return;
    }

    const renewedDateBS = adToBs(renewedDateAD).formatted;
    const validUntilBS = adToBs(validUntilAD).formatted;
    const finalTax = Number(parsedTaxAmount);
    const finalFine = Number(parsedFineAmount || 0);
    const totalPaid = finalTax + finalFine;

    const payload: Omit<RenewalRecord, 'id'> = {
      bikeId: bike.id!,
      renewedDateAD,
      renewedDateBS,
      validUntilAD,
      validUntilBS,
      taxAmount: finalTax,
      fineAmount: finalFine,
      totalPaid,
      officeLocation: officeLocation.trim(),
      bluebookPages: [...bluebookPages],
      receiptPhoto,
      notes: notes.trim(),
      enableReminder,
      reminderInterval
    };

    if (isDuplicateRenewalSubmission(renewals, payload, editingRenewalId)) {
      setFormError(
        language === 'ne'
          ? 'यही नवीकरण र म्याद मिति भएको कर रेकर्ड पहिले नै सुरक्षित छ।'
          : 'A tax renewal record with these exact renewed and expiry dates already exists.'
      );
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      if (editingRenewalId) {
        await db.renewals.update(editingRenewalId, payload);
      } else {
        await db.renewals.add(payload);
      }

      handleCloseAddModal();
      onRefresh();
    } catch {
      setFormError(
        language === 'ne'
          ? 'कर नवीकरण सेभ गर्न सकिएन। कृपया पुनः प्रयास गर्नुहोस्।'
          : 'Could not save tax renewal record. Please try again.'
      );
      setIsSubmitting(false);
    }
  };

  const executeDeleteRenewal = async () => {
    if (!confirmDeleteRecord?.id) return;
    await db.renewals.delete(confirmDeleteRecord.id);
    if (detailRecord?.id === confirmDeleteRecord.id) {
      setDetailRecord(null);
    }
    setConfirmDeleteRecord(null);
    onRefresh();
  };

  // Filter & Sort Renewal History while keeping overall latestRenewal status intact
  const filteredRenewals = filterAndSortRenewals(renewals, {
    searchQuery,
    statusFilter,
    sortBy,
    latestRenewalId: latestRenewal?.id,
    baseTax: estimatedBaseTax,
    language
  });

  const hasActiveTaxFilterOrSort =
    Boolean(searchQuery.trim()) || statusFilter !== 'ALL' || sortBy !== 'valid_desc';
  const visibleRenewals =
    hasActiveTaxFilterOrSort || showAllRenewals ? filteredRenewals : filteredRenewals.slice(0, 2);

  // Visual progress ratio for Tax Status Panel
  const progressPercent = (() => {
    if (!taxStatus) return 0;
    if (taxStatus.status === 'VALID') {
      return Math.max(4, Math.min(100, Math.round((taxStatus.daysRemaining / 365) * 100)));
    }
    if (taxStatus.status === 'GRACE_PERIOD') {
      return Math.max(4, Math.min(100, Math.round((taxStatus.daysLeftInGrace / 90) * 100)));
    }
    return 100;
  })();

  const statusPresentation = (() => {
    if (!taxStatus || !latestRenewal) {
      return {
        semantic: 'neutral' as const,
        label: language === 'ne' ? 'दर्ता गरिएको छैन' : 'Not Recorded',
        badgeText: language === 'ne' ? 'दर्ता छैन' : 'Not Recorded',
        progressCaption:
          language === 'ne'
            ? 'कर म्याद ट्र्याक गर्न आफ्नो नवीकरण दर्ता गर्नुहोस्।'
            : 'Add your current Blue Book renewal to track validity.'
      };
    }
    if (taxStatus.status === 'VALID' && !isRenewalApproaching) {
      return {
        semantic: 'success' as const,
        label: language === 'ne' ? 'कर भुक्तानी सम्पन्न (वैध)' : 'Paid · Tax Valid',
        badgeText: language === 'ne' ? 'भुक्तानी भयो' : 'Paid',
        progressCaption:
          language === 'ne'
            ? '३६५-दिने वार्षिक अवधिमा बाँकी समय'
            : 'Remaining in 365-day annual cycle'
      };
    }
    if (taxStatus.status === 'VALID' && isRenewalApproaching) {
      return {
        semantic: 'warning' as const,
        label: language === 'ne' ? 'आगामी नवीकरण नजिकिँदै' : 'Upcoming Renewal',
        badgeText: language === 'ne' ? 'आगामी' : 'Upcoming',
        progressCaption:
          language === 'ne'
            ? 'म्याद सकिन १५ दिन वा कम बाँकी'
            : 'Expiring within 15 days'
      };
    }
    if (taxStatus.status === 'GRACE_PERIOD') {
      return {
        semantic: 'warning' as const,
        label: language === 'ne' ? 'म्याद नाघेको (९०-दिने ग्रेस)' : 'Overdue (Grace Period)',
        badgeText: language === 'ne' ? 'म्याद नाघेको' : 'Overdue',
        progressCaption:
          language === 'ne'
            ? '९०-दिने जरिवाना-रहित ग्रेस अवधि बाँकी'
            : 'Remaining in 90-day penalty-free grace period'
      };
    }
    return {
      semantic: 'error' as const,
      label: language === 'ne' ? 'कर म्याद नाघेको' : 'Tax Overdue',
      badgeText: language === 'ne' ? 'म्याद नाघेको' : 'Overdue',
      progressCaption:
        language === 'ne'
          ? 'ग्रेस अवधि समाप्त — जरिवाना लागू हुन सक्छ'
          : 'Grace period elapsed — statutory penalty applies'
    };
  })();

  const reminderLabelMap: Record<'today' | '1_week' | '2_weeks' | '4_weeks', string> = {
    today: t.reminderToday,
    '1_week': t.reminder1Week,
    '2_weeks': t.reminder2Weeks,
    '4_weeks': t.reminder4Weeks
  };

  return (
    <div className="space-y-4 pb-4">
      {/* 1. SIMPLIFIED TAX & RENEWAL HEADER */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight truncate">
            {language === 'ne' ? 'कर तथा नवीकरण' : 'Tax & Renewal'}
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] truncate">
            {language === 'ne' ? 'नेपाल सवारी कर र बीमा म्याद' : 'Blue Book tax & compliance'}
          </p>
        </div>

        <Button
          variant="primary"
          pill
          size="sm"
          onClick={handleOpenAddModal}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shrink-0"
        >
          <span>{language === 'ne' ? 'नवीकरण थप्नुहोस्' : 'Add Renewal'}</span>
        </Button>
      </div>

      {/* CONTEXTUAL ACTIVE VEHICLE SELECTOR */}
      {onOpenGarage && (
        <ContextualVehicleBar
          bike={bike}
          language={language}
          onOpenGarage={onOpenGarage}
          secondaryMeta={bike.cc > 0 ? `${bike.cc}cc` : undefined}
        />
      )}

      {/* 2. EXISTING SECTION PILLS: Tax | Insurance | Blue Book (Screen 8) */}
      <div
        role="tablist"
        aria-label={language === 'ne' ? 'कर र कागजात खण्डहरू' : 'Tax & Compliance Sections'}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5"
      >
        {[
          { id: 'tax' as const, en: 'Tax', ne: 'सवारी कर' },
          { id: 'insurance' as const, en: 'Insurance', ne: 'बीमा' },
          { id: 'bluebook' as const, en: 'Blue Book', ne: 'ब्लुबुक' }
        ].map((tab) => (
          <SelectableChip
            key={tab.id}
            role="tab"
            aria-selected={activeSectionPill === tab.id}
            selected={activeSectionPill === tab.id}
            onClick={() => setActiveSectionPill(tab.id)}
          >
            {language === 'ne' ? tab.ne : tab.en}
          </SelectableChip>
        ))}
      </div>

      {/* 3A. TAX STATUS PANEL (Screen 8) */}
      {activeSectionPill === 'tax' && (
        <Card
          variant="primary"
          padding="lg"
          className={`space-y-4 ${
            statusPresentation.semantic === 'error'
              ? 'border-[var(--color-error)]/45'
              : statusPresentation.semantic === 'warning'
              ? 'border-[var(--color-warning)]/45'
              : statusPresentation.semantic === 'success'
              ? 'border-[var(--color-success)]/45'
              : ''
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <StatusIndicator
                size="md"
                status={statusPresentation.semantic}
                icon={
                  statusPresentation.semantic === 'success' ? (
                    <Check className="w-6 h-6 stroke-[2.5]" />
                  ) : statusPresentation.semantic === 'warning' ? (
                    <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
                  ) : statusPresentation.semantic === 'error' ? (
                    <AlertOctagon className="w-6 h-6 stroke-[2.2]" />
                  ) : (
                    <Info className="w-6 h-6 stroke-[2.2]" />
                  )
                }
              />

              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] tracking-tight truncate">
                  {statusPresentation.label}
                </h3>
                {latestRenewal ? (
                  <div className="text-xs text-[var(--color-text-secondary)] mt-0.5 space-y-0.5">
                    <div className="font-mono tabular-nums font-medium text-[var(--color-text-primary)]">
                      {language === 'ne' ? 'म्याद:' : 'Valid until'}{' '}
                      {formatBsDisplayDate(latestRenewal.validUntilAD, language)} (BS)
                    </div>
                    <div className="text-[11px] font-mono tabular-nums">
                      {formatAdDisplayDate(latestRenewal.validUntilAD)} AD
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    {language === 'ne'
                      ? 'अहिलेसम्म नवीकरण मिति दर्ता गरिएको छैन'
                      : 'No renewal record logged yet'}
                  </p>
                )}
              </div>
            </div>

            <StatusBadge status={statusPresentation.semantic}>
              <span>{statusPresentation.badgeText}</span>
            </StatusBadge>
          </div>

          {/* Visual Status Progress & Days Metric */}
          {taxStatus && latestRenewal ? (
            <div className="space-y-2.5 pt-1">
              <div
                aria-label={statusPresentation.progressCaption}
                className="h-3 w-full bg-[var(--color-surface-2)] clay-inset rounded-full overflow-hidden border border-[var(--color-border)] p-[1px]"
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    statusPresentation.semantic === 'success'
                      ? 'bg-[var(--color-success)]'
                      : statusPresentation.semantic === 'warning'
                      ? 'bg-[var(--color-warning)]'
                      : 'bg-[var(--color-error)]'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-end justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-[var(--color-text-secondary)]">
                    {taxStatus.status === 'VALID'
                      ? (language === 'ne' ? 'बाँकी दिनहरू' : 'Days Remaining')
                      : taxStatus.status === 'GRACE_PERIOD'
                      ? (language === 'ne' ? 'ग्रेस अवधि बाँकी' : 'Grace Days Left')
                      : (language === 'ne' ? 'म्याद नाघेको' : 'Days Overdue')}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-secondary)]">
                    {statusPresentation.progressCaption}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-2xl font-semibold font-mono tabular-nums text-[var(--color-text-primary)]">
                    {taxStatus.status === 'VALID'
                      ? taxStatus.daysRemaining
                      : taxStatus.status === 'GRACE_PERIOD'
                      ? taxStatus.daysLeftInGrace
                      : taxStatus.daysOverdue}
                  </span>{' '}
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                    {language === 'ne' ? 'दिन' : 'days'}
                  </span>
                </div>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => setShowTaxBreakdownDetails(prev => !prev)}
                  rightIcon={
                    showTaxBreakdownDetails ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )
                  }
                >
                  <span>
                    {showTaxBreakdownDetails
                      ? (language === 'ne' ? 'विवरण लुकाउनुहोस्' : 'Hide Details')
                      : (language === 'ne' ? 'विवरण हेर्नुहोस्' : 'View Details')}
                  </span>
                </Button>
              </div>

              {/* Expandable Details Breakdown: Clearly separates Estimated vs Recorded amounts */}
              {showTaxBreakdownDetails && (
                <div className="p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] space-y-2.5 text-xs animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--color-text-secondary)]">
                      {language === 'ne' ? 'पछिल्लो भुक्तानी (दर्ता भएको):' : 'Last Recorded Paid:'}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-[var(--color-accent)]">
                      NPR {(latestRenewal.totalPaid || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--color-text-secondary)]">
                      {language === 'ne' ? 'अनुमानित वार्षिक दर (रेफरेन्स):' : 'Estimated Annual Tax (Ref.):'}
                    </span>
                    <span className="font-mono tabular-nums font-medium text-[var(--color-text-primary)]">
                      NPR {estimatedBaseTax.toLocaleString()}
                    </span>
                  </div>

                  {taxStatus.status === 'FINED' && taxStatus.estimatedFineAmount > 0 && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--color-error)]">
                        {language === 'ne'
                          ? `अनुमानित जरिवाना (${taxStatus.fineMultiplierPercent}%):`
                          : `Estimated Penalty (${taxStatus.fineMultiplierPercent}%):`}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-[var(--color-error)]">
                        ~NPR {taxStatus.estimatedFineAmount.toLocaleString()}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--color-text-secondary)]">
                      {language === 'ne' ? 'दर्ता कार्यालय:' : 'Recorded Office:'}
                    </span>
                    <span className="font-medium text-[var(--color-text-primary)] truncate max-w-[190px]">
                      {latestRenewal.officeLocation || (language === 'ne' ? 'दर्ता नभएको' : 'Not recorded')}
                    </span>
                  </div>

                  <p className="text-[11px] text-[var(--color-text-secondary)] pt-2 border-t border-[var(--color-border)] leading-relaxed">
                    {taxStatus.message}
                  </p>

                  <Button
                    variant="outline"
                    size="sm"
                    fullWidth
                    onClick={() =>
                      downloadIcsFile({
                        title: `${bike.name} Blue Book Tax Renewal Due`,
                        description: `Nepal Blue Book annual tax expiry (${latestRenewal.validUntilBS} BS) for ${bike.registrationNumber}.`,
                        startDate: latestRenewal.validUntilAD,
                        location: latestRenewal.officeLocation || 'Yatayat Office',
                        reminderDaysBefore: getReminderDaysBefore(latestRenewal.reminderInterval)
                      })
                    }
                    leftIcon={<Calendar className="w-3.5 h-3.5" />}
                  >
                    <span>{language === 'ne' ? 'पात्रोमा रिमाइन्डर (.ics)' : 'Export Reminder (.ics)'}</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-2 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {language === 'ne'
                  ? 'ब्लुबुक कर नवीकरण मिति र रसिद सुरक्षित राख्न माथि दायाँपट्टिको "नवीकरण थप्नुहोस्" थिच्नुहोस्।'
                  : 'Tap "Add Renewal" at the top right to monitor Blue Book tax validity and 90-day grace periods.'}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* 3B. INSURANCE VIEW (Displays actual saved Insurance docs, expiry dates & warnings) */}
      {activeSectionPill === 'insurance' && (() => {
        const insuranceDocs = documents.filter(
          (d) => normalizeDocumentCategory(d.category) === 'insurance'
        );
        return (
          <Card variant="primary" padding="lg" className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent)] shrink-0">
                  <Shield className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                    {language === 'ne' ? 'सवारी तेस्रो पक्षीय / पूर्ण बीमा' : 'Third-Party & Comprehensive Insurance'}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] truncate">
                    {language === 'ne' ? 'कागजात भल्टबाट म्याद र स्थिति' : 'Saved policy documents & expiry status'}
                  </p>
                </div>
              </div>
              {insuranceDocs.length === 0 && (
                <StatusBadge status="neutral" className="shrink-0">
                  <span>{language === 'ne' ? 'दर्ता छैन' : 'Not Recorded'}</span>
                </StatusBadge>
              )}
            </div>

            {insuranceDocs.length > 0 ? (
              <div className="space-y-2.5">
                {insuranceDocs.map((doc) => {
                  const expiryInfo = getDocumentExpiryStatus(doc.expiryDate, language);
                  return (
                    <div
                      key={doc.id || doc.title}
                      className="p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[var(--color-text-primary)] truncate">
                          {doc.title}
                        </span>
                        {expiryInfo ? (
                          <StatusBadge status={expiryInfo.semantic} className="shrink-0">
                            <span>{expiryInfo.label}</span>
                          </StatusBadge>
                        ) : (
                          <StatusBadge status="neutral" className="shrink-0">
                            <span>{language === 'ne' ? 'म्याद नतोकिएको' : 'No Expiry Date'}</span>
                          </StatusBadge>
                        )}
                      </div>

                      {doc.expiryDate ? (
                        <div className="text-[11px] font-mono tabular-nums text-[var(--color-text-secondary)]">
                          {language === 'ne' ? 'म्याद:' : 'Valid until'}{' '}
                          <span className="text-[var(--color-text-primary)] font-semibold">
                            {formatBsDisplayDate(doc.expiryDate, language)}
                          </span>{' '}
                          ({formatAdDisplayDate(doc.expiryDate)})
                          {expiryInfo ? ` · ${expiryInfo.detailMessage}` : ''}
                        </div>
                      ) : (
                        <div className="text-[11px] text-[var(--color-text-secondary)]">
                          {language === 'ne'
                            ? 'स्वचालित म्याद चेतावनीका लागि कागजात भल्टमा म्याद मिति थप्नुहोस्।'
                            : 'Add an expiry date in Documents Vault to receive renewal alerts.'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {language === 'ne'
                  ? 'कागजात भल्टमा आफ्नो बीमा पोलिसीको प्रतिलिपि र म्याद मिति सुरक्षित राख्नुहोस् ताकि म्याद सकिनुअघि अलर्ट पाउन सकियोस्।'
                  : 'Save your insurance policy certificate and expiry date in Documents Vault to track policy validity and receive timely expiry warnings.'}
              </div>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={onOpenVault}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              <span>
                {insuranceDocs.length > 0
                  ? (language === 'ne' ? 'कागजात भल्टमा व्यवस्थापन गर्नुहोस्' : 'Manage in Documents Vault')
                  : (language === 'ne' ? 'कागजात भल्ट खोल्नुहोस्' : 'Open Documents Vault')}
              </span>
            </Button>
          </Card>
        );
      })()}

      {/* 3C. BLUE BOOK VIEW (Vehicle specs, tax validity & Vault Blue Book docs) */}
      {activeSectionPill === 'bluebook' && (() => {
        const bluebookDocs = documents.filter(
          (d) => normalizeDocumentCategory(d.category) === 'bluebook'
        );
        return (
          <Card variant="primary" padding="lg" className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent)] shrink-0">
                  <BookOpen className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                    {language === 'ne' ? 'सवारी दर्ता किताब (ब्लुबुक)' : 'Vehicle Registration (Blue Book)'}
                  </h3>
                  <p className="text-xs font-mono text-[var(--color-text-secondary)] truncate">
                    {bike.registrationNumber} · {bike.cc}cc
                  </p>
                </div>
              </div>
              <StatusBadge status={statusPresentation.semantic} className="shrink-0">
                <span>{statusPresentation.badgeText}</span>
              </StatusBadge>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--color-text-secondary)]">{language === 'ne' ? 'इन्जिन नं:' : 'Engine Number:'}</span>
                <span className="font-mono text-[var(--color-text-primary)] font-semibold">
                  {bike.engineNo || (language === 'ne' ? 'दर्ता नभएको' : 'Not recorded')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--color-text-secondary)]">{language === 'ne' ? 'चेसिस नं:' : 'Chassis Number:'}</span>
                <span className="font-mono text-[var(--color-text-primary)] font-semibold">
                  {bike.chassisNo || (language === 'ne' ? 'दर्ता नभएको' : 'Not recorded')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--color-text-secondary)]">{language === 'ne' ? 'खरिद वर्ष:' : 'Purchase Year:'}</span>
                <span className="font-mono text-[var(--color-text-primary)] font-semibold">
                  {bike.boughtYearBS ? `${bike.boughtYearBS} BS` : (language === 'ne' ? 'दर्ता नभएको' : 'Not recorded')}
                </span>
              </div>
              {latestRenewal && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
                  <span className="text-[var(--color-text-secondary)]">{language === 'ne' ? 'कर वैध मिति:' : 'Tax Valid Until:'}</span>
                  <span className="font-mono text-[var(--color-text-primary)] font-semibold text-right">
                    {formatBsDisplayDate(latestRenewal.validUntilAD, language)} ({formatAdDisplayDate(latestRenewal.validUntilAD)})
                  </span>
                </div>
              )}
              {bluebookDocs.some((d) => d.expiryDate) && (
                <div className="pt-2 border-t border-[var(--color-border)] space-y-1">
                  {bluebookDocs
                    .filter((d) => d.expiryDate)
                    .map((d) => {
                      const st = getDocumentExpiryStatus(d.expiryDate, language);
                      return (
                        <div key={d.id || d.title} className="flex items-center justify-between gap-2">
                          <span className="text-[var(--color-text-secondary)] truncate">{d.title}:</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono text-[var(--color-text-primary)]">
                              {formatBsDisplayDate(d.expiryDate!, language)}
                            </span>
                            {st && <StatusBadge status={st.semantic}>{st.label}</StatusBadge>}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenVault}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              <span>{language === 'ne' ? 'ब्लुबुक पाना कागजात हेर्नुहोस्' : 'Open Blue Book in Vault'}</span>
            </Button>
          </Card>
        );
      })()}

      {/* 4. RENEWAL HISTORY (Screen 8 Bottom List / Empty State) */}
      {renewals.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-6 h-6 text-[var(--color-accent)]" />}
          title={language === 'ne' ? 'अझै कुनै कर नवीकरण रेकर्ड छैन' : 'No Renewal Records Yet'}
          description={
            language === 'ne'
              ? 'नवीकरण मिति, भुक्तानी विवरण र ब्लुबुक पाना सुरक्षित राख्न माथि दायाँपट्टिको "नवीकरण थप्नुहोस्" थिच्नुहोस्।'
              : 'Tap "Add Renewal" at the top right to record expiry dates, NPR payments, and office receipts.'
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {language === 'ne' ? 'नवीकरण इतिहास' : 'Renewal History'}
              </h3>
            </div>
            <span className="text-xs text-[var(--color-text-secondary)] font-mono tabular-nums">
              {hasActiveTaxFilterOrSort
                ? `${filteredRenewals.length}/${renewals.length}`
                : renewals.length}{' '}
              {language === 'ne' ? 'रेकर्ड' : renewals.length === 1 ? 'record' : 'records'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_195px] gap-2.5 items-center">
            <SearchInput
              placeholder={
                language === 'ne'
                  ? 'कार्यालय, मिति, रकम वा टिप्पणी खोज्नुहोस्...'
                  : 'Search office, date, amount, or notes...'
              }
              value={searchQuery}
              onChange={setSearchQuery}
            />

            <CustomDropdown
              ariaLabel={language === 'ne' ? 'नवीकरण क्रमबद्ध' : 'Sort renewals'}
              menuTitle={language === 'ne' ? 'नवीकरण क्रमबद्ध' : 'Sort Renewals'}
              searchable={false}
              value={sortBy}
              onValueChange={(val) => setSortBy(val as TaxSortBy)}
              options={[
                { value: 'valid_desc', label: language === 'ne' ? 'म्याद (नयाँ पहिले)' : 'Valid Until: Newest' },
                { value: 'valid_asc', label: language === 'ne' ? 'म्याद (पुरानो पहिले)' : 'Valid Until: Oldest' },
                { value: 'renewed_desc', label: language === 'ne' ? 'नवीकरण मिति (नयाँ)' : 'Renewed Date: Newest' },
                { value: 'amount_desc', label: language === 'ne' ? 'रकम (बढी→कम)' : 'Amount: High → Low' },
                { value: 'amount_asc', label: language === 'ne' ? 'रकम (कम→बढी)' : 'Amount: Low → High' }
              ]}
            />
          </div>

          {/* Tax Status Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'ALL' as const, en: 'All', ne: 'सबै' },
              { id: 'paid' as const, en: 'Paid', ne: 'भुक्तानी भयो' },
              { id: 'upcoming' as const, en: 'Upcoming', ne: 'आगामी' },
              { id: 'overdue' as const, en: 'Overdue', ne: 'म्याद नाघेको' }
            ].map(f => (
              <SelectableChip
                key={f.id}
                size="sm"
                selected={statusFilter === f.id}
                onClick={() => setStatusFilter(f.id)}
              >
                {language === 'ne' ? f.ne : f.en}
              </SelectableChip>
            ))}
          </div>

          {filteredRenewals.length === 0 ? (
            <EmptyState
              icon={<Receipt className="w-5 h-5" />}
              title={language === 'ne' ? 'कुनै मिल्दो रेकर्ड भेटिएन' : 'No Matching Renewals'}
              description={
                language === 'ne'
                  ? 'खोज शब्द वा स्थिति फिल्टर परिवर्तन गरी पुन: प्रयास गर्नुहोस्।'
                  : 'Try clearing your search or selecting a different status filter.'
              }
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setSortBy('valid_desc');
                  }}
                >
                  {language === 'ne' ? 'फिल्टर हटाउनुहोस्' : 'Clear Filters'}
                </Button>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {visibleRenewals.map((item) => {
                const recordInfo = classifyTaxRenewalRecord(
                  item,
                  latestRenewal?.id,
                  estimatedBaseTax
                );
                const badgeStatus =
                  recordInfo.classification === 'paid'
                    ? 'success'
                    : recordInfo.classification === 'upcoming'
                    ? 'warning'
                    : recordInfo.taxStatus.status === 'GRACE_PERIOD'
                    ? 'warning'
                    : 'error';
                const badgeLabel =
                  recordInfo.classification === 'paid'
                    ? language === 'ne'
                      ? 'भुक्तानी भयो'
                      : 'Paid'
                    : recordInfo.classification === 'upcoming'
                    ? language === 'ne'
                      ? 'आगामी'
                      : 'Upcoming'
                    : recordInfo.taxStatus.status === 'GRACE_PERIOD'
                    ? language === 'ne'
                      ? 'म्याद नाघेको (ग्रेस)'
                      : 'Overdue · Grace'
                    : language === 'ne'
                    ? 'म्याद नाघेको'
                    : 'Overdue';

                const attachmentCount =
                  (item.bluebookPages?.length || 0) + (item.receiptPhoto ? 1 : 0);

                return (
                <Card
                  key={item.id}
                  variant="interactive"
                  padding="md"
                  onClick={() => setDetailRecord(item)}
                  className="flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 clay-inset flex items-center justify-center text-[var(--color-accent)] shrink-0">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-mono tabular-nums font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition duration-150">
                          {language === 'ne' ? 'म्याद:' : 'Valid until'}{' '}
                          {formatBsDisplayDate(item.validUntilAD, language)}
                        </span>
                        <StatusBadge status={badgeStatus}>
                          <span>{badgeLabel}</span>
                        </StatusBadge>
                      </div>
                      <div className="text-[11px] text-[var(--color-text-secondary)] font-mono tabular-nums truncate">
                        {language === 'ne' ? 'नवीकरण:' : 'Renewed'}{' '}
                        {item.renewedDateAD
                          ? formatBsDisplayDate(item.renewedDateAD, language)
                          : `${item.renewedDateBS} BS`}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-2 truncate">
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {item.officeLocation || (language === 'ne' ? 'कार्यालय दर्ता नभएको' : 'Office not recorded')}
                          </span>
                        </span>
                        {attachmentCount > 0 && (
                          <span className="text-[10px] font-mono text-[var(--color-accent)] shrink-0">
                            · {attachmentCount} {language === 'ne' ? 'संलग्न' : attachmentCount === 1 ? 'file' : 'files'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-semibold font-mono tabular-nums text-[var(--color-accent)]">
                        NPR {(item.totalPaid || item.taxAmount || 0).toLocaleString()}
                      </div>
                      {item.fineAmount > 0 && (
                        <div className="text-[10px] font-mono tabular-nums text-[var(--color-error)]">
                          +{item.fineAmount.toLocaleString()} {language === 'ne' ? 'जरिवाना' : 'fine'}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)]" />
                  </div>
                </Card>
                );
              })}

              {!hasActiveTaxFilterOrSort && filteredRenewals.length > 2 && (
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => setShowAllRenewals(prev => !prev)}
                  rightIcon={
                    showAllRenewals ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  }
                >
                  <span>
                    {showAllRenewals
                      ? (language === 'ne' ? 'कम देखाउनुहोस्' : 'Show Latest 2')
                      : (language === 'ne'
                        ? `सबै इतिहास हेर्नुहोस् (${filteredRenewals.length})`
                        : `View All History (${filteredRenewals.length})`)}
                  </span>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. NEPAL MOTOR VEHICLE ACT RULES REFERENCE ACCORDION */}
      <Card variant="primary" padding="none" className="overflow-hidden">
        <button
          type="button"
          onClick={() => setIsScheduleOpen(prev => !prev)}
          aria-expanded={isScheduleOpen}
          className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-[var(--color-surface-2)] transition"
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold text-[var(--color-text-primary)]">
            <Scale className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
            <span>{t.taxActTitle}</span>
          </div>
          {isScheduleOpen ? (
            <ChevronUp className="w-4 h-4 text-[var(--color-text-secondary)] shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)] shrink-0" />
          )}
        </button>

        {isScheduleOpen && (
          <div className="px-4 pb-4 pt-3 border-t border-[var(--color-border)] text-xs space-y-3 animate-in fade-in">
            <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
              {language === 'ne'
                ? 'नेपाल सवारी तथा यातायात व्यवस्था ऐन अनुसार म्याद समाप्त भएको ९० दिनसम्म बिना जरिवाना कर बुझाउन सकिन्छ।'
                : 'Under Nepal Motor Vehicle & Transport Management Act rules, road tax can be renewed without penalty for up to 90 days after expiry.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                <span className="font-semibold text-[var(--color-success)] block">
                  {language === 'ne' ? '०–९० दिन (ग्रेस अवधि):' : '0–90 Days (Grace Period):'}
                </span>
                <span className="text-[var(--color-text-secondary)]">
                  {language === 'ne' ? '०% जरिवाना (सामान्य कर मात्र)' : '0% penalty (standard tax only)'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                <span className="font-semibold text-[var(--color-warning)] block">
                  {language === 'ne' ? 'ग्रेसपछिको पहिलो ३० दिन:' : 'First 30 Days Past Grace:'}
                </span>
                <span className="text-[var(--color-text-secondary)]">
                  {language === 'ne' ? '५% जरिवाना' : '5% fine on base tax'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                <span className="font-semibold text-[var(--color-error)] block">
                  {language === 'ne' ? 'त्यसपछिको ४५ दिन:' : 'Next 45 Days:'}
                </span>
                <span className="text-[var(--color-text-secondary)]">
                  {language === 'ne' ? '१०% जरिवाना' : '10% fine on base tax'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                <span className="font-semibold text-[var(--color-error)] block">
                  {language === 'ne' ? 'आर्थिक वर्षको अन्त्यसम्म / पछि:' : 'Fiscal Year End / Later:'}
                </span>
                <span className="text-[var(--color-text-secondary)]">
                  {language === 'ne' ? '२०% देखि ३२%+ सम्म जरिवाना' : '20% to 32%+ statutory penalty'}
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 6. RENEWAL RECORD DETAILS FULL-SCREEN SHEET */}
      <FullScreenSheet
        isOpen={Boolean(detailRecord)}
        onClose={() => setDetailRecord(null)}
        title={language === 'ne' ? 'नवीकरण विवरण' : 'Renewal Details'}
        subtitle={
          detailRecord
            ? `${formatBsDisplayDate(detailRecord.validUntilAD, language)} (${detailRecord.validUntilBS})`
            : undefined
        }
        leadingIcon={<Receipt className="w-4 h-4" />}
        rightAction={
          detailRecord && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleEditRenewal(detailRecord)}
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
          const detailInfo = classifyTaxRenewalRecord(
            detailRecord,
            latestRenewal?.id,
            estimatedBaseTax
          );
          const detailBadgeStatus =
            detailInfo.classification === 'paid'
              ? 'success'
              : detailInfo.classification === 'upcoming'
              ? 'warning'
              : detailInfo.taxStatus.status === 'GRACE_PERIOD'
              ? 'warning'
              : 'error';
          const detailBadgeLabel =
            detailInfo.classification === 'paid'
              ? language === 'ne'
                ? 'भुक्तानी भयो'
                : 'Paid'
              : detailInfo.classification === 'upcoming'
              ? language === 'ne'
                ? 'आगामी'
                : 'Upcoming'
              : detailInfo.taxStatus.status === 'GRACE_PERIOD'
              ? language === 'ne'
                ? 'म्याद नाघेको (ग्रेस)'
                : 'Overdue · Grace'
              : language === 'ne'
              ? 'म्याद नाघेको'
              : 'Overdue';

          return (
          <div className="space-y-4">
            {/* Dates & Payment Breakdown */}
            <Card variant="primary" padding="md" className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {language === 'ne' ? 'कुल भुक्तानी (NPR)' : 'Total Paid (Recorded)'}
                  </div>
                  <div className="text-2xl font-semibold font-mono tabular-nums text-[var(--color-accent)] mt-0.5">
                    NPR {(detailRecord.totalPaid || detailRecord.taxAmount || 0).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={detailBadgeStatus}>
                    <span>{detailBadgeLabel}</span>
                  </StatusBadge>
                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">
                    {detailInfo.isCurrentCycle
                      ? (language === 'ne' ? 'हालको चक्र' : 'Current Cycle')
                      : (language === 'ne' ? 'ऐतिहासिक रेकर्ड' : 'Historical Record')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5 border-t border-[var(--color-border)] text-xs">
                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] block">
                    {language === 'ne' ? 'नवीकरण गरिएको मिति (BS / AD)' : 'Renewed Date (BS & AD)'}
                  </span>
                  <span className="font-semibold text-[var(--color-text-primary)] block mt-0.5">
                    {detailRecord.renewedDateAD
                      ? `${formatBsDisplayDate(detailRecord.renewedDateAD, language)} BS`
                      : `${detailRecord.renewedDateBS} BS`}
                  </span>
                  {detailRecord.renewedDateAD && (
                    <span className="text-[11px] font-mono text-[var(--color-text-secondary)]">
                      {formatAdDisplayDate(detailRecord.renewedDateAD)}
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] block">
                    {language === 'ne' ? 'म्याद समाप्त मिति (BS / AD)' : 'Valid Until (BS & AD)'}
                  </span>
                  <span className="font-semibold text-[var(--color-text-primary)] block mt-0.5">
                    {formatBsDisplayDate(detailRecord.validUntilAD, language)} BS
                  </span>
                  <span className="text-[11px] font-mono text-[var(--color-text-secondary)]">
                    {formatAdDisplayDate(detailRecord.validUntilAD)}
                  </span>
                </div>
              </div>

              {detailRecord.fineAmount > 0 && (
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                    <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] block">
                      {language === 'ne' ? 'सवारी कर' : 'Base Tax'}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-[var(--color-text-primary)]">
                      NPR {(detailRecord.taxAmount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                    <span className="text-[10px] uppercase tracking-wide text-[var(--color-error)] block">
                      {language === 'ne' ? 'जरिवाना' : 'Fine Paid'}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-[var(--color-error)]">
                      NPR {(detailRecord.fineAmount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </Card>

            {/* Office & Reminder Info */}
            <Card variant="primary" padding="md" className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--color-text-secondary)]">
                  {language === 'ne' ? 'यातायात कार्यालय / माध्यम:' : 'Office / Payment Channel:'}
                </span>
                <span className="font-semibold text-[var(--color-text-primary)] text-right">
                  {detailRecord.officeLocation || (language === 'ne' ? 'दर्ता नभएको' : 'Not recorded')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
                <span className="text-[var(--color-text-secondary)]">
                  {language === 'ne' ? 'रिमाइन्डर:' : 'Reminder:'}
                </span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {detailRecord.enableReminder ?? true
                    ? reminderLabelMap[detailRecord.reminderInterval || '1_week']
                    : (language === 'ne' ? 'बन्द' : 'Disabled')}
                </span>
              </div>
              {detailRecord.notes && (
                <div className="pt-2 border-t border-[var(--color-border)] space-y-1">
                  <span className="text-[11px] font-medium text-[var(--color-text-secondary)] block">
                    {language === 'ne' ? 'टिप्पणी:' : 'Notes:'}
                  </span>
                  <p className="text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
                    {detailRecord.notes}
                  </p>
                </div>
              )}
            </Card>

            {/* Blue Book Page Images */}
            <Card variant="primary" padding="md" className="space-y-2.5">
              <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                {language === 'ne' ? 'ब्लुबुक पानाका तस्बिरहरू' : 'Blue Book Page Images'}
              </div>
              {detailRecord.bluebookPages && detailRecord.bluebookPages.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {detailRecord.bluebookPages.map((imgData, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setActiveReceiptView({
                          title: `${language === 'ne' ? 'ब्लुबुक पाना' : 'Blue Book Page'} #${idx + 1}`,
                          imageBase64: imgData
                        })
                      }
                      className="rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-accent)] transition"
                    >
                      <img
                        src={imgData}
                        alt={`Blue Book page ${idx + 1}`}
                        className="w-full h-28 object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {language === 'ne' ? 'कुनै ब्लुबुक पाना संलग्न छैन।' : 'No Blue Book page images attached.'}
                </p>
              )}
            </Card>

            {/* Receipt Photo */}
            <Card variant="primary" padding="md" className="space-y-2.5">
              <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                {language === 'ne' ? 'कर रसिद / भौचर' : 'Tax Receipt / Voucher'}
              </div>
              {detailRecord.receiptPhoto ? (
                <button
                  type="button"
                  onClick={() =>
                    setActiveReceiptView({
                      title: `${formatBsDisplayDate(detailRecord.validUntilAD, language)} — ${
                        language === 'ne' ? 'रसिद' : 'Receipt'
                      }`,
                      imageBase64: detailRecord.receiptPhoto!
                    })
                  }
                  className="w-full rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-accent)] transition"
                >
                  <img
                    src={detailRecord.receiptPhoto}
                    alt="Tax Receipt"
                    className="w-full max-h-60 object-contain"
                  />
                  <div className="p-2 text-xs font-semibold text-[var(--color-accent)] flex items-center justify-center gap-1.5 border-t border-[var(--color-border)]">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{language === 'ne' ? 'रसिद ठूलो पार्नुहोस्' : 'View Full Receipt'}</span>
                  </div>
                </button>
              ) : (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {language === 'ne' ? 'कुनै रसिद संलग्न छैन।' : 'No tax receipt attached.'}
                </p>
              )}
            </Card>
          </div>
          );
        })()}
      </FullScreenSheet>

      {/* 7. ADD / EDIT TAX RENEWAL FULL-SCREEN SHEET */}
      <FullScreenSheet
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        title={
          editingRenewalId
            ? (language === 'ne' ? 'कर नवीकरण सम्पादन' : 'Edit Tax Renewal')
            : (language === 'ne' ? 'कर नवीकरण थप्नुहोस्' : 'Add Tax Renewal')
        }
        subtitle={`${bike.name} · ${bike.cc}cc`}
        leadingIcon={<Receipt className="w-4 h-4" />}
        footer={
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" size="lg" onClick={handleCloseAddModal}>
              {t.cancel}
            </Button>
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
              {editingRenewalId
                ? (language === 'ne' ? 'परिवर्तन सेभ गर्नुहोस्' : 'Save Changes')
                : (language === 'ne' ? 'नवीकरण सेभ गर्नुहोस्' : 'Save Renewal')}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="p-3 rounded-2xl bg-[var(--color-error-subtle)] border border-[var(--color-error)]/50 text-[var(--color-error)] text-xs flex items-center gap-2 animate-in fade-in"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{formError}</span>
            </div>
          )}

          {/* GROUP 1: RENEWAL DATES */}
          <Card variant="primary" padding="md" className="space-y-4">
            <div className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              <span>{language === 'ne' ? 'नवीकरण मितिहरू (BS / AD)' : 'Renewal Dates (BS / AD)'}</span>
            </div>

            <NepaliDatePicker
              label={language === 'ne' ? 'नवीकरण गरिएको मिति' : 'Renewed Date'}
              valueAD={renewedDateAD}
              onChange={(ad) => {
                setRenewedDateAD(ad);
                setFieldErrors(prev => ({ ...prev, renewedDate: undefined, validUntilDate: undefined }));
                setFormError(null);
              }}
              required={true}
              error={Boolean(fieldErrors.renewedDate)}
              errorMessage={fieldErrors.renewedDate}
              showQuickPresets={false}
              language={language}
            />

            <NepaliDatePicker
              label={language === 'ne' ? 'म्याद समाप्त हुने मिति' : 'Valid-Until Date'}
              valueAD={validUntilAD}
              onChange={(ad) => {
                setValidUntilAD(ad);
                setFieldErrors(prev => ({ ...prev, validUntilDate: undefined }));
                setFormError(null);
              }}
              required={true}
              error={Boolean(fieldErrors.validUntilDate)}
              errorMessage={fieldErrors.validUntilDate}
              showQuickPresets={true}
              language={language}
              helperText={
                language === 'ne'
                  ? '१ वर्ष म्याद थप्न "+1 Year" प्रयोग गर्नुहोस्'
                  : 'Use "+1 Year" for standard 1-year annual Blue Book expiry.'
              }
            />
          </Card>

          {/* GROUP 2: PAYMENT (NPR) */}
          <Card variant="primary" padding="md" className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                {language === 'ne' ? 'कर भुक्तानी विवरण (NPR)' : 'Payment Details (NPR)'}
              </span>
              <StatusBadge status="neutral">
                <span className="font-mono tabular-nums">
                  {language === 'ne'
                    ? `अनुमानित दर: NPR ${estimatedBaseTax.toLocaleString()}`
                    : `Est. Rate: NPR ${estimatedBaseTax.toLocaleString()}`}
                </span>
              </StatusBadge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberInput
                label={language === 'ne' ? 'सवारी कर रकम' : 'Tax Amount'}
                required
                unit="NPR"
                min={1}
                value={taxAmountInput}
                onChange={(e) => {
                  setTaxAmountInput(e.target.value);
                  setFieldErrors(prev => ({ ...prev, taxAmount: undefined }));
                  setFormError(null);
                }}
                error={fieldErrors.taxAmount}
                hint={
                  !editingRenewalId
                    ? (language === 'ne'
                      ? `${bike.cc}cc सवारीको अनुमानित दर स्वतः भरिएको — वास्तविक तिरेको रकम मिलाउनुहोस्`
                      : `Prefilled from ${bike.cc}cc reference rate — edit to match actual receipt`)
                    : undefined
                }
              />

              <NumberInput
                label={language === 'ne' ? 'जरिवाना रकम (ऐच्छिक)' : 'Fine Amount (Optional)'}
                unit="NPR"
                min={0}
                value={fineAmountInput}
                onChange={(e) => {
                  setFineAmountInput(e.target.value);
                  setFieldErrors(prev => ({ ...prev, fineAmount: undefined }));
                  setFormError(null);
                }}
                error={fieldErrors.fineAmount}
              />
            </div>

            <div className="p-3 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {language === 'ne' ? 'जम्मा भुक्तानी (कर + जरिवाना):' : 'Total Amount (Tax + Fine):'}
              </span>
              <span className="text-lg font-semibold font-mono tabular-nums text-[var(--color-accent)]">
                NPR {liveTotalAmount.toLocaleString()}
              </span>
            </div>
          </Card>

          {/* GROUP 3: OFFICE & OPTIONAL DOCUMENTS */}
          <Card variant="primary" padding="md" className="space-y-3.5">
            <div className="text-xs font-semibold text-[var(--color-text-primary)]">
              {language === 'ne' ? 'कार्यालय तथा कागजात (ऐच्छिक)' : 'Office & Documents (Optional)'}
            </div>

            <TextInput
              label={language === 'ne' ? 'यातायात कार्यालय / माध्यम (ऐच्छिक)' : 'Transport Office / Method (Optional)'}
              placeholder={
                language === 'ne'
                  ? 'उदाहरण: यातायात कार्यालय वा अनलाइन भुक्तानी'
                  : 'e.g. Yatayat office or payment method'
              }
              value={officeLocation}
              onChange={(e) => setOfficeLocation(e.target.value)}
            />

            {/* Optional Blue Book Page Images */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--color-text-primary)] flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  <span>
                    {language === 'ne' ? 'ब्लुबुक पाना तस्बिर (ऐच्छिक)' : 'Blue Book Page Images (Optional)'}
                  </span>
                </label>
                {bluebookPages.length > 0 && (
                  <span className="text-[11px] font-mono text-[var(--color-accent)]">
                    {bluebookPages.length}
                  </span>
                )}
              </div>

              {bluebookPages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {bluebookPages.map((imgData, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] group"
                    >
                      <img src={imgData} alt={`Blue Book page ${idx + 1}`} className="w-full h-20 object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveBluebookPage(idx)}
                        aria-label="Remove page"
                        className="absolute top-1 right-1 p-1 rounded-lg bg-black/75 text-white hover:text-[var(--color-error)] transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center justify-center gap-2 min-h-[46px] p-2.5 border border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] rounded-2xl cursor-pointer bg-[var(--color-surface-2)] clay-inset hover:bg-[var(--color-surface-3)] transition text-center">
                <Plus className="w-4 h-4 text-[var(--color-accent)]" />
                <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {language === 'ne' ? 'ब्लुबुक पानाको फोटो थप्नुहोस्' : 'Add Blue Book page image(s)'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleBluebookPageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Optional Tax Receipt */}
            <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--color-text-primary)] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  <span>
                    {language === 'ne' ? 'कर रसिद / भौचर फोटो (ऐच्छिक)' : 'Receipt Upload (Optional)'}
                  </span>
                </label>
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
                <div className="relative rounded-2xl overflow-hidden border border-[var(--color-border)] max-w-xs">
                  <img src={receiptPhoto} alt="Tax receipt preview" className="w-full h-28 object-cover" />
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
                <label className="flex items-center justify-center gap-2 min-h-[48px] p-2.5 border border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] rounded-2xl cursor-pointer bg-[var(--color-surface-2)] clay-inset hover:bg-[var(--color-surface-3)] transition text-center">
                  <Camera className="w-4 h-4 text-[var(--color-accent)]" />
                  <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                    {language === 'ne' ? 'कर रसिद वा भौचर फोटो छान्नुहोस्' : 'Snap or upload tax receipt'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <TextArea
              label={language === 'ne' ? 'टिप्पणी (ऐच्छिक)' : 'Notes (Optional)'}
              placeholder={language === 'ne' ? 'भौचर नम्बर वा अन्य विवरण' : 'Voucher reference or additional remarks'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </Card>

          {/* GROUP 4: REMINDERS */}
          <Card variant="primary" padding="md" className="space-y-3">
            <div className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              <span>{language === 'ne' ? 'नवीकरण रिमाइन्डर' : 'Renewal Reminders'}</span>
            </div>

            <Switch
              checked={enableReminder}
              onChange={setEnableReminder}
              label={language === 'ne' ? 'नवीकरण रिमाइन्डर सक्रिय गर्नुहोस्' : 'Reminder Enabled'}
              description={
                language === 'ne'
                  ? 'कर म्याद सकिनु अगावै सूचना पाउनुहोस्'
                  : 'Alert ahead of Blue Book tax expiry'
              }
            />

            {enableReminder && (
              <SelectField
                label={language === 'ne' ? 'रिमाइन्डर समय' : 'Reminder Interval'}
                searchable={false}
                value={reminderInterval}
                onValueChange={(val) =>
                  setReminderInterval(val as RenewalRecord['reminderInterval'] & string)
                }
                options={[
                  { value: 'today', label: t.reminderToday },
                  { value: '1_week', label: t.reminder1Week },
                  { value: '2_weeks', label: t.reminder2Weeks },
                  { value: '4_weeks', label: t.reminder4Weeks }
                ]}
              />
            )}
          </Card>
        </form>
      </FullScreenSheet>

      {/* 8. FULLSCREEN RECEIPT / BLUE BOOK IMAGE VIEWER */}
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
              alt="Tax document"
              className="max-h-[78vh] w-auto object-contain rounded-2xl border border-[var(--color-border)]"
            />
          </div>
        )}
      </FullScreenSheet>

      {/* 9. DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(confirmDeleteRecord)}
        onClose={() => setConfirmDeleteRecord(null)}
        onConfirm={executeDeleteRenewal}
        title={language === 'ne' ? 'नवीकरण रेकर्ड मेटाउने?' : 'Delete Renewal Record?'}
        subtitle={
          confirmDeleteRecord
            ? `${formatBsDisplayDate(confirmDeleteRecord.validUntilAD, language)} (${confirmDeleteRecord.validUntilAD})`
            : undefined
        }
        message={
          language === 'ne'
            ? 'के तपाईं यो कर नवीकरण रेकर्ड स्थायी रूपमा मेटाउन निश्चित हुनुहुन्छ? यो कार्य फिर्ता गर्न सकिँदैन।'
            : 'Are you sure you want to permanently delete this renewal record? This action cannot be undone.'
        }
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        icon={<Trash2 className="w-5 h-5" />}
        variant="danger"
      />
    </div>
  );
};
