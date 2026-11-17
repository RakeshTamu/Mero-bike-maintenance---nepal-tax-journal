import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Camera,
  Eye,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Shield,
  Plus,
  AlertTriangle,
  MoreVertical,
  Save,
  Edit2,
  BookOpen,
  CreditCard,
  Calendar,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { Bike, DocumentItem } from '../types';
import { db } from '../db/db';
import {
  formatAdDate,
  formatAdDisplayDate,
  formatBsDisplayDate,
  diffDays,
  parseLocalCalendarDate
} from '../utils/nepaliCalendar';
import { NepaliDatePicker } from './NepaliDatePicker';
import { translations } from '../utils/translations';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FullScreenSheet,
  IconButton,
  SearchInput,
  SelectableChip,
  SelectField,
  StatusBadge,
  TextArea,
  TextInput
} from './ui';
import { ContextualVehicleBar } from './ContextualVehicleBar';

interface Props {
  bike?: Bike;
  bikeId: number;
  documents: DocumentItem[];
  onRefresh: () => void;
  language: 'en' | 'ne';
  openAddTrigger?: number;
  onOpenGarage?: () => void;
}

export type CanonicalDocumentCategory = 'bluebook' | 'license' | 'insurance' | 'other';

export const DOCUMENT_CATEGORIES: readonly {
  id: CanonicalDocumentCategory;
  labelEn: string;
  labelNe: string;
}[] = [
  { id: 'bluebook', labelEn: 'Blue Book', labelNe: 'ब्लुबुक' },
  { id: 'license', labelEn: 'Driving Licence', labelNe: 'सवारी चालक अनुमतिपत्र' },
  { id: 'insurance', labelEn: 'Insurance', labelNe: 'बीमा' },
  { id: 'other', labelEn: 'Other', labelNe: 'अन्य' }
] as const;

type FilterTabId = 'all' | CanonicalDocumentCategory;

export function normalizeDocumentCategory(cat?: string): CanonicalDocumentCategory {
  if (!cat) return 'other';
  if (cat === 'bluebook' || cat === 'bluebook_front' || cat === 'bluebook_tax') {
    return 'bluebook';
  }
  if (cat === 'license' || cat === 'license_front' || cat === 'license_back') {
    return 'license';
  }
  if (cat === 'insurance') {
    return 'insurance';
  }
  // Map pollution, tax receipts, citizenship, medical, driver_other, and other safely under 'other'
  return 'other';
}

function getCategoryMeta(cat: string, language: 'en' | 'ne') {
  const canonical = normalizeDocumentCategory(cat);
  const found = DOCUMENT_CATEGORIES.find(c => c.id === canonical)!;
  const label = language === 'ne' ? found.labelNe : found.labelEn;

  if (canonical === 'bluebook') {
    return { label, icon: <BookOpen className="w-5 h-5 text-[var(--color-accent)]" /> };
  }
  if (canonical === 'license') {
    return { label, icon: <CreditCard className="w-5 h-5 text-[var(--color-accent)]" /> };
  }
  if (canonical === 'insurance') {
    return { label, icon: <Shield className="w-5 h-5 text-[var(--color-success)]" /> };
  }
  return { label, icon: <FolderOpen className="w-5 h-5 text-[var(--color-text-secondary)]" /> };
}

export interface DocumentExpiryStatusInfo {
  status: 'expired' | 'due_today' | 'expiring_soon' | 'valid';
  semantic: 'error' | 'warning' | 'success';
  days: number;
  label: string;
  detailMessage: string;
}

export function getDocumentExpiryStatus(
  expiryDate: string | undefined,
  language: 'en' | 'ne',
  referenceDate?: Date | string
): DocumentExpiryStatusInfo | null {
  if (!expiryDate) return null;
  const parsed = parseLocalCalendarDate(expiryDate);
  if (isNaN(parsed.getTime())) return null;

  const days = diffDays(parsed, referenceDate ?? new Date());
  if (days < 0) {
    const overdueDays = Math.abs(days);
    return {
      status: 'expired',
      semantic: 'error',
      days,
      label: language === 'ne' ? 'म्याद समाप्त' : 'Expired',
      detailMessage:
        language === 'ne'
          ? `म्याद ${overdueDays} दिन पहिले समाप्त भइसकेको छ`
          : `Expired ${overdueDays} day${overdueDays === 1 ? '' : 's'} ago`
    };
  }
  if (days === 0) {
    return {
      status: 'due_today',
      semantic: 'warning',
      days: 0,
      label: language === 'ne' ? 'आज म्याद सकिँदै' : 'Expires Today',
      detailMessage:
        language === 'ne' ? 'आज म्याद समाप्त हुँदैछ' : 'Expires today'
    };
  }
  if (days <= 30) {
    return {
      status: 'expiring_soon',
      semantic: 'warning',
      days,
      label: language === 'ne' ? `${days} दिन बाँकी` : `${days}d left`,
      detailMessage:
        language === 'ne'
          ? `म्याद सकिन ${days} दिन बाँकी`
          : `Expires in ${days} day${days === 1 ? '' : 's'}`
    };
  }
  return {
    status: 'valid',
    semantic: 'success',
    days,
    label: language === 'ne' ? 'वैध' : 'Valid',
    detailMessage:
      language === 'ne'
        ? `वैध (${days} दिन बाँकी)`
        : `Valid (${days} days remaining)`
  };
}

export function getExpiringDocuments(
  documents: DocumentItem[],
  language: 'en' | 'ne',
  referenceDate?: Date | string
): Array<{ doc: DocumentItem; expiry: DocumentExpiryStatusInfo }> {
  return (documents || [])
    .map((doc) => {
      const expiry = getDocumentExpiryStatus(doc.expiryDate, language, referenceDate);
      return expiry && expiry.days <= 30 ? { doc, expiry } : null;
    })
    .filter((item): item is { doc: DocumentItem; expiry: DocumentExpiryStatusInfo } => item !== null)
    .sort((a, b) => a.expiry.days - b.expiry.days);
}

function compressDocumentImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (event) => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const DocumentVault: React.FC<Props> = ({
  bike,
  bikeId,
  documents,
  onRefresh,
  language,
  openAddTrigger,
  onOpenGarage
}) => {
  const t = translations[language];

  const [filterCategory, setFilterCategory] = useState<FilterTabId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuDocId, setOpenMenuDocId] = useState<number | null>(null);

  // Add / Edit Form Sheet state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CanonicalDocumentCategory>('bluebook');
  const [docTitle, setDocTitle] = useState('');
  const [uploadDateAD, setUploadDateAD] = useState(formatAdDate(new Date()));
  const [expiryDateAD, setExpiryDateAD] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Delete Confirmation & Document Detail/Preview Sheet state
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<DocumentItem | null>(null);
  const [viewingDoc, setViewingDoc] = useState<DocumentItem | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  // Close contextual menu on outside click
  useEffect(() => {
    if (openMenuDocId === null) return;
    const handleDocClick = () => setOpenMenuDocId(null);
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [openMenuDocId]);

  // Keep viewingDoc synced after edit/replace
  useEffect(() => {
    if (viewingDoc?.id) {
      const updated = (documents || []).find(d => d.id === viewingDoc.id);
      setViewingDoc(updated || null);
    }
  }, [documents]);

  // Documents that are expired or expiring within 30 days
  const expiringAlerts = getExpiringDocuments(documents || [], language);

  // Filter documents by simplified category chip and search
  const filteredDocs = (documents || []).filter((doc) => {
    const matchesCategory =
      filterCategory === 'all' || normalizeDocumentCategory(doc.category) === filterCategory;

    if (!matchesCategory) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const metaLabel = getCategoryMeta(doc.category, language).label.toLowerCase();
    const expiryInfo = getDocumentExpiryStatus(doc.expiryDate, language);
    const expiryBs = doc.expiryDate ? formatBsDisplayDate(doc.expiryDate, language).toLowerCase() : '';
    return (
      (doc.title || '').toLowerCase().includes(q) ||
      (doc.notes || '').toLowerCase().includes(q) ||
      metaLabel.includes(q) ||
      (doc.uploadDate || '').toLowerCase().includes(q) ||
      (doc.expiryDate || '').toLowerCase().includes(q) ||
      expiryBs.includes(q) ||
      (expiryInfo?.label.toLowerCase().includes(q) ?? false) ||
      (expiryInfo?.status.includes(q) ?? false)
    );
  });

  const handleOpenAddForm = () => {
    setEditingDocId(null);
    setSelectedCategory('bluebook');
    setDocTitle('');
    setUploadDateAD(formatAdDate(new Date()));
    setExpiryDateAD('');
    setDocNotes('');
    setPreviewImage(null);
    setUploadError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (doc: DocumentItem) => {
    setViewingDoc(null);
    setEditingDocId(doc.id || null);
    setSelectedCategory(normalizeDocumentCategory(doc.category));
    setDocTitle(doc.title || '');
    setUploadDateAD(doc.uploadDate || formatAdDate(new Date()));
    setExpiryDateAD(doc.expiryDate || '');
    setDocNotes(doc.notes || '');
    setPreviewImage(doc.imageBase64 || null);
    setUploadError(null);
    setIsFormOpen(true);
  };

  const handleOpenDetail = (doc: DocumentItem) => {
    setViewingDoc(doc);
    setZoomLevel(1);
    setRotation(0);
  };

  // External trigger from Quick Actions
  const lastTriggerRef = useRef<number | undefined>(openAddTrigger);
  useEffect(() => {
    if (openAddTrigger !== undefined && openAddTrigger > (lastTriggerRef.current || 0)) {
      handleOpenAddForm();
    }
    lastTriggerRef.current = openAddTrigger;
  }, [openAddTrigger]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError(language === 'ne' ? 'कृपया तस्बिर फाइल मात्र छान्नुहोस्।' : 'Please select an image file.');
      return;
    }
    setUploadError(null);
    try {
      const dataUrl = await compressDocumentImage(file);
      setPreviewImage(dataUrl);
    } catch {
      setUploadError(language === 'ne' ? 'फोटो प्रशोधन गर्न सकिएन।' : 'Unable to process document image.');
    } finally {
      e.target.value = '';
    }
  };

  // Direct replace image from Document Detail view
  const handleReplaceViewingImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewingDoc?.id) return;
    if (!file.type.startsWith('image/')) return;
    try {
      const newImage = await compressDocumentImage(file);
      await db.documents.update(viewingDoc.id, { imageBase64: newImage });
      setZoomLevel(1);
      setRotation(0);
      onRefresh();
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveDocument = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!previewImage) {
      setUploadError(
        language === 'ne'
          ? 'कृपया क्यामेरा वा ग्यालरीबाट कागजपत्रको फोटो छान्नुहोस्।'
          : 'Please upload or capture an image of the document.'
      );
      return;
    }

    const defaultLabel = getCategoryMeta(selectedCategory, language).label;
    const payload: Omit<DocumentItem, 'id'> = {
      bikeId,
      title: docTitle.trim() || defaultLabel,
      category: selectedCategory,
      imageBase64: previewImage,
      uploadDate: uploadDateAD || formatAdDate(new Date()),
      expiryDate: expiryDateAD || undefined,
      notes: docNotes.trim()
    };

    if (editingDocId) {
      await db.documents.update(editingDocId, payload);
    } else {
      await db.documents.add(payload);
    }

    setPreviewImage(null);
    setEditingDocId(null);
    setDocTitle('');
    setDocNotes('');
    setExpiryDateAD('');
    setUploadError(null);
    setIsFormOpen(false);
    onRefresh();
  };

  const executeDeleteDoc = async () => {
    if (!confirmDeleteDoc?.id) return;
    const docId = confirmDeleteDoc.id;
    await db.documents.delete(docId);
    if (viewingDoc?.id === docId) {
      setViewingDoc(null);
    }
    setConfirmDeleteDoc(null);
    onRefresh();
  };

  const categoryOptions = DOCUMENT_CATEGORIES.map((c) => ({
    value: c.id,
    label: language === 'ne' ? c.labelNe : c.labelEn
  }));

  const filterChips: { id: FilterTabId; en: string; ne: string }[] = [
    { id: 'all', en: 'All', ne: 'सबै' },
    ...DOCUMENT_CATEGORIES.map((c) => ({
      id: c.id as FilterTabId,
      en: c.labelEn,
      ne: c.labelNe
    }))
  ];

  return (
    <div className="space-y-4 pb-4">
      {/* 1. SIMPLIFIED DOCUMENTS HEADER (Single Add Document button) */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight truncate">
            {language === 'ne' ? 'कागजात' : 'Documents'}
          </h2>
          <p className="text-xs font-mono tabular-nums text-[var(--color-text-secondary)] truncate">
            {documents.length}{' '}
            {language === 'ne'
              ? 'अफलाइन सुरक्षित कागजात'
              : documents.length === 1
              ? 'saved document'
              : 'saved documents'}
          </p>
        </div>

        <Button
          variant="primary"
          pill
          size="sm"
          onClick={handleOpenAddForm}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shrink-0"
        >
          <span>{language === 'ne' ? 'कागजात थप्नुहोस्' : 'Add Document'}</span>
        </Button>
      </div>

      {/* CONTEXTUAL ACTIVE VEHICLE SELECTOR */}
      {bike && onOpenGarage && (
        <ContextualVehicleBar
          bike={bike}
          language={language}
          onOpenGarage={onOpenGarage}
          secondaryMeta={bike.cc > 0 ? `${bike.cc}cc` : undefined}
        />
      )}

      {/* 2. HORIZONTAL CATEGORY FILTER CHIPS */}
      <div
        role="tablist"
        aria-label={language === 'ne' ? 'कागजात वर्ग फिल्टर' : 'Document Categories'}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5"
      >
        {filterChips.map((chip) => (
          <SelectableChip
            key={chip.id}
            role="tab"
            aria-selected={filterCategory === chip.id}
            size="sm"
            selected={filterCategory === chip.id}
            onClick={() => setFilterCategory(chip.id)}
          >
            {language === 'ne' ? chip.ne : chip.en}
          </SelectableChip>
        ))}
      </div>

      {documents.length > 0 && (
        <SearchInput
          placeholder={
            language === 'ne'
              ? 'कागजातको नाम, प्रकार वा टिप्पणी खोज्नुहोस्...'
              : 'Search document title, type, or notes...'
          }
          value={searchQuery}
          onChange={setSearchQuery}
        />
      )}

      {expiringAlerts.length > 0 && (
        <Card
          variant="secondary"
          padding="md"
          className={`space-y-2.5 ${
            expiringAlerts.some((a) => a.expiry.status === 'expired')
              ? 'border-[var(--color-error)]/45 bg-[var(--color-error-subtle)]/30'
              : 'border-[var(--color-warning)]/45 bg-[var(--color-warning-subtle)]/30'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle
                className={`w-4 h-4 shrink-0 ${
                  expiringAlerts.some((a) => a.expiry.status === 'expired')
                    ? 'text-[var(--color-error)]'
                    : 'text-[var(--color-warning)]'
                }`}
              />
              <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                {language === 'ne'
                  ? `${expiringAlerts.length} कागजातको म्याद ध्यान दिनुपर्नेछ`
                  : `${expiringAlerts.length} Document${expiringAlerts.length === 1 ? '' : 's'} Requiring Renewal Attention`}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            {expiringAlerts.slice(0, 3).map(({ doc, expiry }) => (
              <button
                key={doc.id || doc.title}
                type="button"
                onClick={() => handleOpenDetail(doc)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-1)]/90 border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 flex items-center justify-between gap-2 text-left transition"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                    {doc.title} · <span className="text-[var(--color-accent)]">{getCategoryMeta(doc.category, language).label}</span>
                  </div>
                  <div className="text-[11px] font-mono text-[var(--color-text-secondary)] truncate">
                    {doc.expiryDate ? `${formatBsDisplayDate(doc.expiryDate, language)} (${formatAdDisplayDate(doc.expiryDate)})` : ''}
                  </div>
                </div>
                <StatusBadge status={expiry.semantic} className="shrink-0">
                  <span>{expiry.label}</span>
                </StatusBadge>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* 3. DOCUMENTS LIST OR EMPTY STATE */}
      {documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6 text-[var(--color-accent)]" />}
          title={language === 'ne' ? 'कुनै कागजात अपलोड गरिएको छैन' : 'No Documents Added Yet'}
          description={
            language === 'ne'
              ? 'अफलाइन सुरक्षित पहुँचका लागि ब्लुबुक, लाइसेन्स, बीमा वा अन्य कागजात थप्न माथि दायाँपट्टिको "कागजात थप्नुहोस्" थिच्नुहोस्।'
              : 'Tap "Add Document" at the top right to save your Blue Book, Driving Licence, Insurance, or other vehicle records.'
          }
        />
      ) : filteredDocs.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-5 h-5" />}
          title={language === 'ne' ? 'यस वर्गमा कुनै कागजात छैन' : 'No Matching Documents'}
          description={
            language === 'ne'
              ? 'अर्को वर्ग छान्नुहोस् वा खोज शब्द हटाएर सबै कागजात हेर्नुहोस्।'
              : 'No saved documents match the selected category or search query.'
          }
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFilterCategory('all');
                setSearchQuery('');
              }}
            >
              {language === 'ne' ? 'सबै देखाउनुहोस्' : 'Show All Documents'}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredDocs.map((doc) => {
            const meta = getCategoryMeta(doc.category, language);
            const expiryStatus = getDocumentExpiryStatus(doc.expiryDate, language);
            const isMenuOpen = openMenuDocId === doc.id;

            return (
              <Card
                key={doc.id}
                variant="interactive"
                padding="md"
                onClick={() => handleOpenDetail(doc)}
                className="relative flex items-center justify-between gap-3 min-h-[86px] group"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Document Thumbnail / Icon */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset flex items-center justify-center shrink-0">
                    {doc.imageBase64 ? (
                      <img
                        src={doc.imageBase64}
                        alt={doc.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      meta.icon
                    )}
                  </div>

                  {/* Document Title, Identification/Category, Expiry & Status */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition truncate">
                        {doc.title}
                      </h4>
                      {expiryStatus && (
                        <StatusBadge status={expiryStatus.semantic} className="shrink-0">
                          <span>{expiryStatus.label}</span>
                        </StatusBadge>
                      )}
                    </div>

                    <div className="text-xs text-[var(--color-accent)] font-medium truncate">
                      {meta.label}
                    </div>

                    <div className="text-[11px] text-[var(--color-text-secondary)] truncate font-mono tabular-nums">
                      {doc.expiryDate
                        ? `${language === 'ne' ? 'म्याद:' : 'Valid until'} ${formatBsDisplayDate(doc.expiryDate, language)} (${formatAdDisplayDate(doc.expiryDate)})`
                        : doc.notes
                        ? doc.notes
                        : `${language === 'ne' ? 'थपिएको:' : 'Added'} ${formatBsDisplayDate(doc.uploadDate, language)}`}
                    </div>
                  </div>
                </div>

                {/* Contextual 3-Dot Menu */}
                <div
                  className="relative shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconButton
                    size="sm"
                    onClick={() => setOpenMenuDocId(isMenuOpen ? null : (doc.id || null))}
                    aria-label={language === 'ne' ? 'कागजात विकल्पहरू' : 'Document Options'}
                    title={language === 'ne' ? 'विकल्पहरू' : 'Options'}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </IconButton>

                  {isMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-11 z-30 w-44 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] clay-raised p-1.5 space-y-0.5 animate-in fade-in duration-150"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpenMenuDocId(null);
                          handleOpenDetail(doc);
                        }}
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-xl text-left text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] flex items-center gap-2 transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                        <span>{language === 'ne' ? 'हेर्नुहोस्' : 'Preview'}</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpenMenuDocId(null);
                          handleOpenEditForm(doc);
                        }}
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-xl text-left text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] flex items-center gap-2 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                        <span>{language === 'ne' ? 'विवरण सम्पादन' : 'Edit Details'}</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpenMenuDocId(null);
                          setConfirmDeleteDoc(doc);
                        }}
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-xl text-left text-xs font-medium text-[var(--color-error)] hover:bg-[var(--color-error-subtle)] flex items-center gap-2 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.delete}</span>
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 4. DOCUMENT DETAIL & PREVIEW FULL-SCREEN SHEET */}
      <FullScreenSheet
        isOpen={Boolean(viewingDoc)}
        onClose={() => setViewingDoc(null)}
        title={viewingDoc?.title || ''}
        subtitle={viewingDoc ? getCategoryMeta(viewingDoc.category, language).label : undefined}
        leadingIcon={viewingDoc ? getCategoryMeta(viewingDoc.category, language).icon : undefined}
        rightAction={
          viewingDoc && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleOpenEditForm(viewingDoc)}
                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              >
                <span>{language === 'ne' ? 'सम्पादन' : 'Edit'}</span>
              </Button>
              <IconButton
                variant="danger"
                size="sm"
                onClick={() => setConfirmDeleteDoc(viewingDoc)}
                aria-label={t.delete}
                title={t.delete}
              >
                <Trash2 className="w-4 h-4" />
              </IconButton>
            </div>
          )
        }
      >
        {viewingDoc && (
          <div className="space-y-4">
            {/* Hidden Replace Image File Input */}
            <input
              ref={replaceInputRef}
              type="file"
              accept="image/*"
              onChange={handleReplaceViewingImage}
              className="hidden"
            />

            {/* Image Preview Container + Zoom/Rotate Controls */}
            <Card variant="primary" padding="sm" className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-1.5">
                  <IconButton
                    size="sm"
                    onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}
                    aria-label="Zoom In"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                    aria-label="Zoom Out"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    onClick={() => setRotation(prev => (prev + 90) % 360)}
                    aria-label="Rotate"
                    title="Rotate"
                  >
                    <RotateCw className="w-4 h-4" />
                  </IconButton>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => replaceInputRef.current?.click()}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  <span>{language === 'ne' ? 'फोटो बदल्नुहोस्' : 'Replace Image'}</span>
                </Button>
              </div>

              <div className="min-h-[240px] max-h-[55vh] rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] overflow-hidden flex items-center justify-center p-2">
                {viewingDoc.imageBase64 ? (
                  <img
                    src={viewingDoc.imageBase64}
                    alt={viewingDoc.title}
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s ease-out'
                    }}
                    className="max-h-[50vh] w-auto max-w-full rounded-xl object-contain"
                  />
                ) : (
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    {language === 'ne' ? 'फोटो उपलब्ध छैन' : 'No image stored'}
                  </div>
                )}
              </div>
            </Card>

            {/* Document Metadata Card */}
            <Card variant="primary" padding="md" className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--color-text-secondary)]">
                  {language === 'ne' ? 'कागजात वर्ग:' : 'Category:'}
                </span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {getCategoryMeta(viewingDoc.category, language).label}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
                <span className="text-[var(--color-text-secondary)]">
                  {language === 'ne' ? 'थपिएको मिति:' : 'Date Added:'}
                </span>
                <span className="font-mono tabular-nums font-medium text-[var(--color-text-primary)]">
                  {formatBsDisplayDate(viewingDoc.uploadDate, language)} ·{' '}
                  <span className="text-[var(--color-text-secondary)]">
                    {formatAdDisplayDate(viewingDoc.uploadDate)}
                  </span>
                </span>
              </div>

              {viewingDoc.expiryDate && (
                <div className="flex items-start justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
                  <span className="text-[var(--color-text-secondary)] shrink-0">
                    {language === 'ne' ? 'म्याद समाप्त मिति:' : 'Expiry Date:'}
                  </span>
                  <div className="text-right space-y-1">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <span className="font-mono tabular-nums font-medium text-[var(--color-text-primary)]">
                        {formatBsDisplayDate(viewingDoc.expiryDate, language)} ·{' '}
                        <span className="text-[var(--color-text-secondary)]">
                          {formatAdDisplayDate(viewingDoc.expiryDate)}
                        </span>
                      </span>
                      {(() => {
                        const st = getDocumentExpiryStatus(viewingDoc.expiryDate, language);
                        return st ? (
                          <StatusBadge status={st.semantic}>
                            <span>{st.label}</span>
                          </StatusBadge>
                        ) : null;
                      })()}
                    </div>
                    {(() => {
                      const st = getDocumentExpiryStatus(viewingDoc.expiryDate, language);
                      return st ? (
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                          {st.detailMessage}
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-[var(--color-border)] space-y-1">
                <span className="text-[var(--color-text-secondary)] block">
                  {language === 'ne' ? 'टिप्पणी / विवरण:' : 'Notes / Details:'}
                </span>
                <p className="text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
                  {viewingDoc.notes || (language === 'ne' ? 'कुनै टिप्पणी दर्ता गरिएको छैन।' : 'No notes recorded.')}
                </p>
              </div>
            </Card>
          </div>
        )}
      </FullScreenSheet>

      {/* 5. ADD / EDIT DOCUMENT FULL-SCREEN SHEET */}
      <FullScreenSheet
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingDocId(null);
          setUploadError(null);
        }}
        title={
          editingDocId
            ? (language === 'ne' ? 'कागजात विवरण सम्पादन' : 'Edit Document')
            : (language === 'ne' ? 'नयाँ कागजात थप्नुहोस्' : 'Add Document')
        }
        subtitle={
          language === 'ne'
            ? 'अफलाइन सुरक्षित भण्डारण'
            : 'Stored locally for offline inspection'
        }
        leadingIcon={<FileText className="w-4 h-4" />}
        footer={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setIsFormOpen(false);
                setEditingDocId(null);
                setUploadError(null);
              }}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => handleSaveDocument()}
              leftIcon={<Save className="w-4 h-4" />}
            >
              {editingDocId
                ? (language === 'ne' ? 'परिवर्तन सेभ गर्नुहोस्' : 'Save Changes')
                : (language === 'ne' ? 'कागजात सेभ गर्नुहोस्' : 'Save Document')}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveDocument} className="space-y-4">
          {uploadError && (
            <div
              role="alert"
              className="p-3 rounded-2xl bg-[var(--color-error-subtle)] border border-[var(--color-error)]/50 text-[var(--color-error)] text-xs flex items-center gap-2 animate-in fade-in"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{uploadError}</span>
            </div>
          )}

          {/* Document Image Upload / Preview */}
          <Card variant="primary" padding="md" className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--color-text-primary)]">
                {language === 'ne' ? 'कागजातको फोटो' : 'Document Image'}
                <span className="ml-1 text-[var(--color-error)] font-semibold">*</span>
              </label>
              {previewImage && (
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="text-xs text-[var(--color-error)] hover:underline font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'ne' ? 'हटाउनुहोस्' : 'Remove'}</span>
                </button>
              )}
            </div>

            <label
              className={`flex flex-col items-center justify-center w-full min-h-[168px] border-2 border-dashed rounded-2xl cursor-pointer bg-[var(--color-surface-2)] transition overflow-hidden ${
                uploadError && !previewImage
                  ? 'border-[var(--color-error)] ring-2 ring-[var(--color-error)]/25'
                  : 'border-[var(--color-border)] hover:border-[var(--color-accent)]'
              }`}
            >
              {previewImage ? (
                <div className="w-full p-2 flex flex-col items-center gap-2">
                  <img
                    src={previewImage}
                    alt="Document preview"
                    className="max-h-48 w-auto object-contain rounded-xl"
                  />
                  <span className="text-[11px] font-medium text-[var(--color-accent)]">
                    {language === 'ne' ? 'अर्को फोटो छान्न थिच्नुहोस्' : 'Tap to replace image'}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-5 text-center space-y-1.5">
                  <Camera className="w-7 h-7 text-[var(--color-accent)]" />
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                    {language === 'ne'
                      ? 'क्यामेरा वा ग्यालरीबाट फोटो छान्नुहोस्'
                      : 'Tap to capture or upload document photo'}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    JPEG, PNG, WebP
                  </p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </Card>

          {/* Category, Name & Dates */}
          <Card variant="primary" padding="md" className="space-y-4">
            <SelectField
              label={language === 'ne' ? 'कागजातको प्रकार' : 'Document Category'}
              required
              searchable={false}
              value={selectedCategory}
              onValueChange={(val) => setSelectedCategory(val as CanonicalDocumentCategory)}
              options={categoryOptions}
            />

            <TextInput
              label={language === 'ne' ? 'कागजातको नाम / विवरण (ऐच्छिक)' : 'Document Name / Details (Optional)'}
              placeholder={
                language === 'ne'
                  ? 'खाली छोड्नुभएमा वर्गको नाम प्रयोग हुनेछ'
                  : 'Leave blank to use selected category name'
              }
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
            />

            <NepaliDatePicker
              label={language === 'ne' ? 'थपिएको मिति' : 'Date Added'}
              valueAD={uploadDateAD}
              onChange={(ad) => setUploadDateAD(ad)}
              showQuickPresets={false}
              language={language}
            />

            <div className="space-y-1.5">
              {expiryDateAD ? (
                <div className="space-y-1.5">
                  <NepaliDatePicker
                    label={language === 'ne' ? 'म्याद समाप्त मिति (ऐच्छिक)' : 'Expiry / Valid-Until Date (Optional)'}
                    valueAD={expiryDateAD}
                    onChange={(ad) => setExpiryDateAD(ad)}
                    showQuickPresets={true}
                    language={language}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setExpiryDateAD('')}
                      className="text-[11px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-error)] transition"
                    >
                      {language === 'ne' ? 'म्याद मिति हटाउनुहोस्' : 'Clear expiry date'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[var(--color-text-primary)]">
                    {language === 'ne' ? 'म्याद समाप्त मिति (ऐच्छिक)' : 'Expiry / Valid-Until Date (Optional)'}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setExpiryDateAD(formatAdDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)))
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] flex items-center justify-between transition"
                  >
                    <div className="text-left">
                      <span className="block">
                        {language === 'ne'
                          ? 'म्याद मिति तोकिएको छैन (छान्न थिच्नुहोस्)'
                          : 'No expiry date set (Tap to add validity date)'}
                      </span>
                      {(selectedCategory === 'insurance' || selectedCategory === 'license' || selectedCategory === 'bluebook') && (
                        <span className="block text-[10px] text-[var(--color-accent)] mt-0.5">
                          {language === 'ne'
                            ? 'बीमा/लाइसेन्स म्याद चेतावनीका लागि मिति थप्न सिफारिस गरिन्छ'
                            : 'Recommended for insurance, licence & Blue Book expiry alerts'}
                        </span>
                      )}
                    </div>
                    <Calendar className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
                  </button>
                </div>
              )}
            </div>

            <TextArea
              label={language === 'ne' ? 'टिप्पणी / विवरण (ऐच्छिक)' : 'Notes / Remarks (Optional)'}
              placeholder={
                language === 'ne'
                  ? 'कागजात नम्बर, कार्यालय वा थप विवरण'
                  : 'Document reference, issuing office, or additional notes'
              }
              value={docNotes}
              onChange={(e) => setDocNotes(e.target.value)}
              rows={2}
            />
          </Card>
        </form>
      </FullScreenSheet>

      {/* 6. DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(confirmDeleteDoc)}
        onClose={() => setConfirmDeleteDoc(null)}
        onConfirm={executeDeleteDoc}
        title={language === 'ne' ? 'कागजात मेटाउने?' : 'Delete Document?'}
        subtitle={confirmDeleteDoc?.title}
        message={
          language === 'ne'
            ? 'के तपाईं यो कागजात अफलाइन भल्टबाट स्थायी रूपमा मेटाउन निश्चित हुनुहुन्छ?'
            : 'Are you sure you want to permanently delete this document from your offline storage?'
        }
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        icon={<Trash2 className="w-5 h-5" />}
        variant="danger"
      />
    </div>
  );
};
