import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bike as BikeIcon,
  Plus,
  Trash2,
  Save,
  X,
  Camera,
  Star,
  Edit2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Shield,
  Info
} from 'lucide-react';
import { Bike, VehicleCategory } from '../types';
import { db } from '../db/db';
import { bsToAd, formatAdDate, getCurrentNepaliDate } from '../utils/nepaliCalendar';
import { translations, formatMessage } from '../utils/translations';
import {
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  FullScreenSheet,
  IconButton,
  NumberInput,
  SelectField,
  StatusBadge,
  TextInput
} from './ui';
import { VehicleImage } from './VehicleImage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bikes: Bike[];
  selectedBikeId: number;
  onSelectBike: (bikeId: number) => void;
  onRefresh: () => void;
  language: 'en' | 'ne';
  initialMode?: 'list' | 'add' | 'edit';
  initialEditBikeId?: number | null;
  onOpenTrafficCheck?: () => void;
}

const CATEGORIES: { id: VehicleCategory }[] = [
  { id: 'Bike' },
  { id: 'Scooter' },
  { id: 'Car' },
  { id: 'Electric' },
  { id: 'Other' }
];

interface FormErrors {
  name?: string;
  registrationNumber?: string;
  cc?: string;
  boughtYearBS?: string;
  odometerKm?: string;
  general?: string;
}

function computeAdYear(bsYearStr: string): string {
  const bsY = Number(bsYearStr);
  if (!Number.isFinite(bsY) || bsY < 2000 || bsY > 2200) {
    return String(new Date().getFullYear());
  }
  if (bsY >= 2070 && bsY <= 2095) {
    try {
      return String(bsToAd(bsY, 4, 1).getFullYear());
    } catch {
      return String(bsY - 57);
    }
  }
  return String(bsY - 57);
}

export const BikeManagementModal: React.FC<Props> = ({
  isOpen,
  onClose,
  bikes,
  selectedBikeId,
  onSelectBike,
  onRefresh,
  language,
  initialMode = 'list',
  initialEditBikeId = null,
  onOpenTrafficCheck
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingBike, setEditingBike] = useState<Bike | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingLockRef = useRef(false);
  const formTopRef = useRef<HTMLDivElement | null>(null);

  // Deletion Confirmation Dialog State
  const [confirmDeleteBike, setConfirmDeleteBike] = useState<Bike | null>(null);
  const [deleteRelatedRecords, setDeleteRelatedRecords] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // Feedback Banner
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const todayBs = useMemo(() => getCurrentNepaliDate(), []);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<VehicleCategory>('Bike');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [boughtYearBS, setBoughtYearBS] = useState(String(todayBs.year));
  const [boughtYearAD, setBoughtYearAD] = useState(() => computeAdYear(String(todayBs.year)));
  const [cc, setCc] = useState<string>('150');
  const [engineNo, setEngineNo] = useState('');
  const [chassisNo, setChassisNo] = useState('');
  const [odometerKm, setOdometerKm] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [platePhotoUrl, setPlatePhotoUrl] = useState<string>('');
  const [showPlateAsPhoto, setShowPlateAsPhoto] = useState<boolean>(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const t = translations[language];

  const categoryLabels: Record<VehicleCategory, string> = {
    Bike: t.catBike,
    Scooter: t.catScooter,
    Car: t.catCar,
    Electric: t.catElectric,
    Other: t.catOther
  };

  const purchaseYearBounds = useMemo(() => {
    const savedYearNum = editingBike?.boughtYearBS ? Number(editingBike.boughtYearBS) : NaN;
    const minYear =
      Number.isFinite(savedYearNum) && savedYearNum >= 2000 && savedYearNum < 2055
        ? savedYearNum
        : 2055;
    const maxYear = Math.max(
      todayBs.year + 35,
      Number.isFinite(savedYearNum) && savedYearNum <= 2200 ? savedYearNum : 0
    );
    return { minYear, maxYear };
  }, [todayBs.year, editingBike?.boughtYearBS]);

  const purchaseYearOptions = useMemo(() => {
    const { minYear, maxYear } = purchaseYearBounds;
    const opts: { value: string; label: string }[] = [
      { value: '', label: t.selectBsYear }
    ];
    for (let yr = maxYear; yr >= minYear; yr--) {
      opts.push({
        value: String(yr),
        label: `${yr} BS (${computeAdYear(String(yr))} AD)`
      });
    }
    return opts;
  }, [purchaseYearBounds, t.selectBsYear]);

  const purchaseYearQuickJumps = useMemo(() => {
    const { minYear, maxYear } = purchaseYearBounds;
    const candidates = [
      todayBs.year + 30,
      todayBs.year + 20,
      todayBs.year + 10,
      todayBs.year,
      2075,
      2065,
      minYear
    ];
    const seen = new Set<number>();
    const jumps: { label: string; targetValue: string }[] = [];
    for (const yr of candidates) {
      if (yr >= minYear && yr <= maxYear && !seen.has(yr)) {
        seen.add(yr);
        jumps.push({ label: `${yr} BS`, targetValue: String(yr) });
      }
    }
    return jumps;
  }, [purchaseYearBounds, todayBs.year]);

  const resetFormFields = () => {
    setEditingBike(null);
    setName('');
    setCategory('Bike');
    setRegistrationNumber('');
    const bsY = String(todayBs.year);
    setBoughtYearBS(bsY);
    setBoughtYearAD(computeAdYear(bsY));
    setCc('150');
    setEngineNo('');
    setChassisNo('');
    setOdometerKm('');
    setPhotoUrl('');
    setPlatePhotoUrl('');
    setShowPlateAsPhoto(false);
    setErrors({});
  };

  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setConfirmDeleteBike(null);
      setFeedbackMessage(null);
      setIsSaving(false);
      savingLockRef.current = false;
      if (initialMode === 'add') {
        resetFormFields();
        setIsAdding(true);
      } else if (initialMode === 'edit') {
        const targetBike =
          bikes.find((b) => b.id === initialEditBikeId) ||
          bikes.find((b) => b.id === selectedBikeId) ||
          bikes[0];
        if (targetBike) {
          handleStartEdit(targetBike);
        } else {
          setIsAdding(false);
          setEditingBike(null);
        }
      } else {
        setIsAdding(false);
        setEditingBike(null);
      }
    }
  }, [isOpen, initialMode, initialEditBikeId]);

  const handleClose = () => {
    setIsAdding(false);
    setEditingBike(null);
    setErrors({});
    setConfirmDeleteBike(null);
    setIsSaving(false);
    savingLockRef.current = false;
    onClose();
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 3500);
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

  const handlePlatePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 600;
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
        setPlatePhotoUrl(canvas.toDataURL('image/jpeg', 0.82));
        setShowPlateAsPhoto(true);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleStartAdd = () => {
    resetFormFields();
    setIsAdding(true);
  };

  const handleStartEdit = (b: Bike) => {
    setEditingBike(b);
    setName(b.name);
    setCategory(b.category);
    setRegistrationNumber(b.registrationNumber);
    setBoughtYearBS(b.boughtYearBS);
    setBoughtYearAD(b.boughtYearAD || computeAdYear(b.boughtYearBS));
    setCc(b.cc ? String(b.cc) : '');
    setEngineNo(b.engineNo || '');
    setChassisNo(b.chassisNo || '');
    setOdometerKm(
      typeof b.odometerKm === 'number' && Number.isFinite(b.odometerKm) ? String(b.odometerKm) : ''
    );
    setPhotoUrl(b.photoUrl || '');
    setPlatePhotoUrl(b.platePhotoUrl || '');
    setShowPlateAsPhoto(b.showPlateAsPhoto || false);
    setErrors({});
    setIsAdding(true);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (savingLockRef.current || isSaving) return;

    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = t.errVehicleNameRequired;
    }
    if (!registrationNumber.trim()) {
      newErrors.registrationNumber = t.errRegNumberRequired;
    }
    if (category !== 'Electric' && (!cc.trim() || Number(cc) <= 0)) {
      newErrors.cc = t.errCcRequired;
    }
    if (!boughtYearBS.trim()) {
      newErrors.boughtYearBS = t.errPurchaseYearRequired;
    }

    const trimmedOdo = odometerKm.trim();
    if (trimmedOdo !== '') {
      const odoNum = Number(trimmedOdo);
      if (!Number.isFinite(odoNum) || odoNum < 0) {
        newErrors.odometerKm = t.errOdometerNonNegative;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      newErrors.general = t.errCheckRequiredFields;
      setErrors(newErrors);
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    savingLockRef.current = true;
    setIsSaving(true);

    try {
      const parsedCc = cc.trim() ? Math.max(0, Number(cc)) : 0;
      const parsedOdo = trimmedOdo !== '' ? Math.max(0, Number(trimmedOdo)) : undefined;
      const normalizedPlate = registrationNumber.trim().toUpperCase();

      if (editingBike && editingBike.id) {
        const updatedRecord: Bike = {
          ...editingBike,
          name: name.trim(),
          category,
          registrationNumber: normalizedPlate,
          platePhotoUrl: platePhotoUrl || undefined,
          showPlateAsPhoto: Boolean(showPlateAsPhoto && platePhotoUrl),
          boughtYearBS: boughtYearBS.trim(),
          boughtYearAD: boughtYearAD.trim(),
          cc: parsedCc,
          engineNo: engineNo.trim().toUpperCase(),
          chassisNo: chassisNo.trim().toUpperCase(),
          photoUrl: photoUrl || undefined
        };
        if (parsedOdo !== undefined) {
          updatedRecord.odometerKm = parsedOdo;
        } else {
          delete updatedRecord.odometerKm;
        }
        await db.bikes.put(updatedRecord);
        setErrors({});
        onRefresh();
        if (initialMode === 'edit') {
          handleClose();
          return;
        }
        showToast(t.vehicleUpdatedSuccess);
        setIsAdding(false);
        setEditingBike(null);
      } else {
        const isFirst = bikes.length === 0;
        const newVehiclePayload: Bike = {
          name: name.trim(),
          category,
          registrationNumber: normalizedPlate,
          platePhotoUrl: platePhotoUrl || undefined,
          showPlateAsPhoto: Boolean(showPlateAsPhoto && platePhotoUrl),
          boughtYearBS: boughtYearBS.trim(),
          boughtYearAD: boughtYearAD.trim(),
          cc: parsedCc,
          engineNo: engineNo.trim().toUpperCase(),
          chassisNo: chassisNo.trim().toUpperCase(),
          photoUrl: photoUrl || undefined,
          isPrimary: isFirst,
          createdDate: formatAdDate(new Date())
        };
        if (parsedOdo !== undefined) {
          newVehiclePayload.odometerKm = parsedOdo;
        }
        const newId = await db.bikes.add(newVehiclePayload);
        onSelectBike(newId as number);
        setErrors({});
        onRefresh();
        if (initialMode === 'add') {
          handleClose();
          return;
        }
        showToast(t.vehicleAddedSuccess);
        setIsAdding(false);
        setEditingBike(null);
      }
    } catch (err: any) {
      setErrors({ general: `${t.errSaveVehicleFailed}: ${err?.message || 'Database error'}` });
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      savingLockRef.current = false;
      setIsSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!confirmDeleteBike || !confirmDeleteBike.id) return;
    setIsDeleting(true);

    try {
      const bikeId = confirmDeleteBike.id;

      await db.bikes.delete(bikeId);

      if (deleteRelatedRecords) {
        await db.services.where('bikeId').equals(bikeId).delete();
        await db.renewals.where('bikeId').equals(bikeId).delete();
        await db.expenses.where('bikeId').equals(bikeId).delete();
        await db.documents.where('bikeId').equals(bikeId).delete();
        await db.components.where('bikeId').equals(bikeId).delete();
      }

      const remaining = bikes.filter((b) => b.id !== bikeId);

      if (remaining.length > 0) {
        if (selectedBikeId === bikeId) {
          const newPrimary = remaining.find((b) => b.isPrimary) || remaining[0];
          onSelectBike(newPrimary.id!);
        }
      } else {
        setIsAdding(false);
        setEditingBike(null);
      }

      showToast(formatMessage(t.vehicleRemovedToast, { name: confirmDeleteBike.name }));

      setConfirmDeleteBike(null);
      onRefresh();
      if (initialMode === 'edit') {
        handleClose();
      }
    } catch (err: any) {
      showToast(`${t.errRemoveVehicleFailed}: ${err?.message || 'Database error'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetPrimary = async (id?: number) => {
    if (!id) return;
    await db.transaction('rw', db.bikes, async () => {
      const all = await db.bikes.toArray();
      for (const b of all) {
        await db.bikes.update(b.id!, { isPrimary: b.id === id });
      }
    });
    if (editingBike && editingBike.id === id) {
      setEditingBike({ ...editingBike, isPrimary: true });
    }
    onSelectBike(id);
    onRefresh();
    showToast(t.primaryUpdated);
  };

  const handleBackOrClose = () => {
    if (isSaving) return;
    if ((isAdding || editingBike) && initialMode !== 'add' && initialMode !== 'edit') {
      setIsAdding(false);
      setEditingBike(null);
      setErrors({});
    } else {
      handleClose();
    }
  };

  return (
    <>
      <FullScreenSheet
        isOpen={isOpen}
        onClose={handleBackOrClose}
        minimalHeader={!isAdding}
        backLabel={t.backToApp}
        title={
          isAdding
            ? editingBike
              ? t.editVehicle
              : t.addVehicle
            : t.myVehiclesTitle
        }
        subtitle={
          isAdding
            ? t.vehicleDetailsSubtitle
            : t.myVehiclesSubtitle
        }
        footer={
          isAdding ? (
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={isSaving}
                onClick={handleBackOrClose}
              >
                {t.cancel}
              </Button>
              <Button
                type="submit"
                form="vehicle-management-form"
                variant="primary"
                size="md"
                fullWidth
                loading={isSaving}
                disabled={isSaving}
                leftIcon={<Save className="w-4 h-4" />}
              >
                {editingBike ? t.saveChanges : t.saveVehicle}
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {/* Feedback Banner */}
          {feedbackMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in duration-150 ${
                feedbackMessage.type === 'success'
                  ? 'bg-[var(--color-success-subtle)] border-[var(--color-success)]/40 text-[var(--color-success)]'
                  : 'bg-[var(--color-error-subtle)] border-[var(--color-error)]/40 text-[var(--color-error)]'
              }`}
            >
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span className="font-medium">{feedbackMessage.text}</span>
            </div>
          )}

          {isAdding ? (
            <form
              id="vehicle-management-form"
              onSubmit={handleSave}
              noValidate
              className="space-y-4 animate-in fade-in duration-150"
            >
              <div ref={formTopRef} />
              {errors.general && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-[var(--color-error-subtle)] border border-[var(--color-error)]/40 text-[var(--color-error)] text-xs flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-semibold">{errors.general}</span>
                </div>
              )}

              {/* Photo Picker */}
              <Card padding="sm" surface="raised-sm" className="flex items-center gap-4 p-3.5">
                <div className="w-28 h-20 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] clay-inset overflow-hidden relative flex items-center justify-center shrink-0">
                  <VehicleImage
                    photoUrl={photoUrl}
                    name={name || 'Vehicle'}
                    variant="card"
                    blendToSurface="var(--color-surface-2)"
                    className="w-full h-full"
                  />
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      aria-label="Remove photo"
                      className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-lg bg-black/75 text-white hover:text-[var(--color-error)] flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="min-w-0 space-y-1">
                  <label className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] clay-btn-secondary text-xs font-semibold text-[var(--color-text-primary)] cursor-pointer transition active:scale-95">
                    <Camera className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>{t.uploadPhoto}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    {t.optionalVehicleImage}
                  </p>
                </div>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <TextInput
                  label={t.vehicleNameLabel}
                  required
                  placeholder={t.vehicleNamePlaceholder}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined, general: undefined }));
                  }}
                  error={errors.name}
                />

                <SelectField
                  label={t.vehicleCategoryLabel}
                  required
                  searchable={false}
                  value={category}
                  onValueChange={(val) => setCategory(val as VehicleCategory)}
                  options={CATEGORIES.map((c) => ({
                    value: c.id,
                    label: categoryLabels[c.id]
                  }))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <TextInput
                  label={t.regNumberLabel}
                  required
                  placeholder={t.regNumberPlaceholder}
                  value={registrationNumber}
                  onChange={(e) => {
                    setRegistrationNumber(e.target.value);
                    if (errors.registrationNumber) {
                      setErrors((prev) => ({ ...prev, registrationNumber: undefined, general: undefined }));
                    }
                  }}
                  error={errors.registrationNumber}
                  className="font-mono uppercase"
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
                    if (errors.cc) setErrors((prev) => ({ ...prev, cc: undefined, general: undefined }));
                  }}
                  error={errors.cc}
                />
              </div>

              {/* License Plate Photo & Card Display Option */}
              <Card variant="secondary" padding="sm" className="p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-[var(--color-text-primary)] block">
                      {t.licensePlatePhotoOptional}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-secondary)]">
                      {t.licensePlatePhotoHint}
                    </span>
                  </div>
                  {platePhotoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setPlatePhotoUrl('');
                        setShowPlateAsPhoto(false);
                      }}
                      className="text-xs text-[var(--color-error)] hover:underline flex items-center gap-1 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{t.removeAction}</span>
                    </button>
                  )}
                </div>

                {platePhotoUrl ? (
                  <div className="space-y-2.5">
                    <div className="w-36 h-16 rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-center">
                      <img src={platePhotoUrl} alt="Plate" className="w-full h-full object-contain" />
                    </div>
                    <Checkbox
                      checked={showPlateAsPhoto}
                      onChange={setShowPlateAsPhoto}
                      label={t.showPlateOnCard}
                    />
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-2.5 border border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] rounded-xl cursor-pointer bg-[var(--color-surface-1)] transition">
                    <Camera className="w-4 h-4 text-[var(--color-accent)]" />
                    <span className="text-xs font-medium text-[var(--color-text-primary)]">
                      {t.uploadPlatePhoto}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePlatePhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <SelectField
                  label={t.purchaseYearBsAd}
                  required
                  searchable
                  searchPlaceholder={t.searchYearPlaceholder}
                  quickJumps={purchaseYearQuickJumps}
                  value={boughtYearBS}
                  onValueChange={(bsY) => {
                    setBoughtYearBS(bsY);
                    setBoughtYearAD(computeAdYear(bsY));
                    if (errors.boughtYearBS) {
                      setErrors((prev) => ({ ...prev, boughtYearBS: undefined, general: undefined }));
                    }
                  }}
                  options={purchaseYearOptions}
                  error={errors.boughtYearBS}
                />

                <NumberInput
                  label={t.currentOdometerLabel}
                  unit="km"
                  min={0}
                  inputMode="numeric"
                  placeholder={t.enterCurrentOdometer}
                  value={odometerKm}
                  onChange={(e) => {
                    setOdometerKm(e.target.value);
                    if (errors.odometerKm) {
                      setErrors((prev) => ({ ...prev, odometerKm: undefined, general: undefined }));
                    }
                  }}
                  error={errors.odometerKm}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <TextInput
                  label={t.engineNoOptional}
                  placeholder={t.fromBlueBook}
                  value={engineNo}
                  onChange={(e) => setEngineNo(e.target.value)}
                  className="font-mono uppercase"
                />

                <TextInput
                  label={t.chassisNoOptional}
                  placeholder={t.fromBlueBook}
                  value={chassisNo}
                  onChange={(e) => setChassisNo(e.target.value)}
                  className="font-mono uppercase"
                />
              </div>

              {/* Vehicle Profile Quick Management Actions (when editing existing vehicle) */}
              {editingBike && (
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)]">
                  <div className="flex flex-wrap items-center gap-2">
                    {!editingBike.isPrimary && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSetPrimary(editingBike.id)}
                        leftIcon={<Star className="w-3.5 h-3.5 text-[var(--color-accent)]" />}
                      >
                        <span>{t.setAsPrimary}</span>
                      </Button>
                    )}
                    {editingBike.id === selectedBikeId && onOpenTrafficCheck && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={onOpenTrafficCheck}
                        leftIcon={<Shield className="w-3.5 h-3.5 text-[var(--color-accent)]" />}
                      >
                        <span>{t.spotCardShort}</span>
                      </Button>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDeleteBike(editingBike)}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    className="text-[var(--color-error)] hover:bg-[var(--color-error-subtle)]"
                  >
                    <span>{t.deleteVehicleAction}</span>
                  </Button>
                </div>
              )}
            </form>
          ) : (
            <div className="space-y-4">
              {/* My Vehicles Header (Matched with Maintenance Page Header Layout) */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight truncate">
                    {t.myVehiclesTitle}
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)] truncate">
                    {t.myVehiclesSubtitle}
                  </p>
                </div>

                {bikes.length > 0 && (
                  <Button
                    variant="primary"
                    pill
                    size="sm"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={handleStartAdd}
                    className="shrink-0"
                  >
                    <span>{t.addVehicle}</span>
                  </Button>
                )}
              </div>

              {bikes.length === 0 ? (
                <EmptyState
                  icon={<BikeIcon className="w-7 h-7 text-[var(--color-accent)]" />}
                  title={t.yourGarageEmpty}
                  description={t.yourGarageEmptyDesc}
                  action={
                    <Button
                      variant="primary"
                      pill
                      size="md"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={handleStartAdd}
                    >
                      {t.addVehicle}
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                      {t.registeredVehicles} (<span className="font-mono tabular-nums">{bikes.length}</span>)
                    </span>
                  </div>
                  <div className="space-y-2.5">
                  {bikes.map((b) => {
                    const isSelected = b.id === selectedBikeId;
                    return (
                      <Card
                        key={b.id}
                        padding="sm"
                        surface="raised-sm"
                        className={`p-3.5 flex items-center justify-between gap-3 transition ${
                          isSelected
                            ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/35 bg-[var(--color-surface-2)]'
                            : 'hover:bg-[var(--color-surface-2)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectBike(b.id!);
                            handleClose();
                          }}
                          className="flex items-center gap-3 text-left min-w-0 flex-1"
                        >
                          <VehicleImage
                            photoUrl={b.photoUrl}
                            name={b.name}
                            variant="thumb"
                            className="w-12 h-12 rounded-xl"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                                {b.name}
                              </h4>
                              {b.isPrimary && (
                                <StatusBadge status="accent">
                                  {t.primaryBike}
                                </StatusBadge>
                              )}
                            </div>
                            <p className="text-xs font-mono tabular-nums font-medium text-[var(--color-accent)] mt-0.5 truncate">
                              {b.registrationNumber}
                              {b.cc > 0 ? ` · ${b.cc}cc` : ''}
                            </p>
                            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 truncate tabular-nums">
                              {t.odometerLabel}:{' '}
                              {typeof b.odometerKm === 'number' ? (
                                <span className="font-mono tabular-nums">
                                  {b.odometerKm.toLocaleString()} km
                                </span>
                              ) : (
                                t.notRecorded
                              )}{' '}
                              · <span className="font-mono tabular-nums">{b.boughtYearBS} BS</span>
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          {!b.isPrimary && (
                            <IconButton
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSetPrimary(b.id)}
                              title={t.setAsPrimary}
                              aria-label={t.setAsPrimary}
                            >
                              <Star className="w-4 h-4" />
                            </IconButton>
                          )}
                          <IconButton
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(b)}
                            title={t.editVehicle}
                            aria-label={t.editVehicle}
                          >
                            <Edit2 className="w-4 h-4" />
                          </IconButton>
                          <IconButton
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeleteBike(b)}
                            title={t.deleteVehicleAction}
                            aria-label={t.deleteVehicleAction}
                            className="hover:text-[var(--color-error)]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        </div>
                      </Card>
                    );
                  })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </FullScreenSheet>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(confirmDeleteBike)}
        onClose={() => setConfirmDeleteBike(null)}
        onConfirm={executeDelete}
        title={t.removeVehicleTitle}
        subtitle={
          confirmDeleteBike
            ? `${confirmDeleteBike.name} · ${confirmDeleteBike.registrationNumber}`
            : undefined
        }
        message={formatMessage(t.removeVehicleMessage, { name: confirmDeleteBike?.name || '' })}
        confirmLabel={t.deleteVehicleAction}
        cancelLabel={t.cancel}
        icon={<ShieldAlert className="w-5 h-5" />}
        variant="danger"
        loading={isDeleting}
      >
        <div className="space-y-2.5 pt-1">
          <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
            <Checkbox
              checked={deleteRelatedRecords}
              onChange={setDeleteRelatedRecords}
              label={t.deleteRelatedRecordsLabel}
            />
          </div>
          {bikes.length <= 1 && (
            <div className="p-2.5 rounded-xl bg-[var(--color-warning-subtle)] border border-[var(--color-warning)]/35 text-[var(--color-warning)] text-[11px] flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>{t.onlyVehicleRemoveNote}</span>
            </div>
          )}
        </div>
      </ConfirmDialog>
    </>
  );
};
