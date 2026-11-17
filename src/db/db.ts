import Dexie, { Table } from 'dexie';
import {
  Bike,
  ServiceRecord,
  RenewalRecord,
  ExpenseRecord,
  DocumentItem,
  ComponentWearItem,
  VehicleCategory
} from '../types';

const VALID_VEHICLE_CATEGORIES: VehicleCategory[] = ['Bike', 'Scooter', 'Car', 'Electric', 'Other'];

const DB_STORES_SCHEMA = {
  bikes: '++id, name, category, registrationNumber, isPrimary',
  services: '++id, bikeId, serviceDateAD, odometerKm, nextServiceDateAD',
  renewals: '++id, bikeId, renewedDateAD, validUntilAD',
  expenses: '++id, bikeId, dateAD, category, amount',
  documents: '++id, bikeId, category, title',
  components: '++id, bikeId, type',
  settings: 'key'
};

export class SawaariDatabase extends Dexie {
  bikes!: Table<Bike, number>;
  services!: Table<ServiceRecord, number>;
  renewals!: Table<RenewalRecord, number>;
  expenses!: Table<ExpenseRecord, number>;
  documents!: Table<DocumentItem, number>;
  components!: Table<ComponentWearItem, number>;
  settings!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('SawaariBikeDB');
    this.version(1).stores(DB_STORES_SCHEMA);

    // Non-destructive v2 migration: safely normalizes missing defaults & numeric types
    // without touching user data, attachments, or deleting any existing records.
    this.version(2)
      .stores(DB_STORES_SCHEMA)
      .upgrade(async (tx) => {
        await tx
          .table('bikes')
          .toCollection()
          .modify((bike: any) => {
            if (!VALID_VEHICLE_CATEGORIES.includes(bike.category)) {
              bike.category = 'Bike';
            }
            const parsedCc = Number(bike.cc);
            bike.cc = Number.isFinite(parsedCc) && parsedCc >= 0 ? parsedCc : 0;
            if (bike.odometerKm !== undefined && bike.odometerKm !== null) {
              const parsedOdo = Number(bike.odometerKm);
              if (Number.isFinite(parsedOdo) && parsedOdo >= 0) {
                bike.odometerKm = parsedOdo;
              } else {
                delete bike.odometerKm;
              }
            }
          });

        await tx
          .table('services')
          .toCollection()
          .modify((svc: any) => {
            const parsedBikeId = Number(svc.bikeId);
            if (Number.isInteger(parsedBikeId) && parsedBikeId > 0) {
              svc.bikeId = parsedBikeId;
            }
            const parsedCost = Number(svc.cost);
            svc.cost = Number.isFinite(parsedCost) && parsedCost >= 0 ? parsedCost : 0;
            const parsedOdo = Number(svc.odometerKm);
            svc.odometerKm = Number.isFinite(parsedOdo) && parsedOdo >= 0 ? parsedOdo : 0;
          });

        await tx
          .table('renewals')
          .toCollection()
          .modify((ren: any) => {
            const parsedBikeId = Number(ren.bikeId);
            if (Number.isInteger(parsedBikeId) && parsedBikeId > 0) {
              ren.bikeId = parsedBikeId;
            }
            if (!Array.isArray(ren.bluebookPages)) {
              ren.bluebookPages = typeof ren.bluebookPages === 'string' && ren.bluebookPages ? [ren.bluebookPages] : [];
            }
            const tax = Number(ren.taxAmount);
            const fine = Number(ren.fineAmount);
            const total = Number(ren.totalPaid);
            ren.taxAmount = Number.isFinite(tax) && tax >= 0 ? tax : 0;
            ren.fineAmount = Number.isFinite(fine) && fine >= 0 ? fine : 0;
            ren.totalPaid = Number.isFinite(total) && total >= 0 ? total : ren.taxAmount + ren.fineAmount;
          });

        await tx
          .table('expenses')
          .toCollection()
          .modify((exp: any) => {
            const parsedBikeId = Number(exp.bikeId);
            if (Number.isInteger(parsedBikeId) && parsedBikeId > 0) {
              exp.bikeId = parsedBikeId;
            }
            const amt = Number(exp.amount);
            exp.amount = Number.isFinite(amt) && amt >= 0 ? amt : 0;
          });

        await tx
          .table('documents')
          .toCollection()
          .modify((doc: any) => {
            const parsedBikeId = Number(doc.bikeId);
            if (Number.isInteger(parsedBikeId) && parsedBikeId > 0) {
              doc.bikeId = parsedBikeId;
            }
            if (typeof doc.imageBase64 !== 'string') {
              doc.imageBase64 = '';
            }
            if (typeof doc.category !== 'string' || !doc.category) {
              doc.category = 'other';
            }
          });

        await tx
          .table('components')
          .toCollection()
          .modify((comp: any) => {
            const parsedBikeId = Number(comp.bikeId);
            if (Number.isInteger(parsedBikeId) && parsedBikeId > 0) {
              comp.bikeId = parsedBikeId;
            }
            const lastKm = Number(comp.lastReplacedKm);
            const lifeKm = Number(comp.lifespanKm);
            comp.lastReplacedKm = Number.isFinite(lastKm) && lastKm >= 0 ? lastKm : 0;
            comp.lifespanKm = Number.isFinite(lifeKm) && lifeKm > 0 ? lifeKm : 1000;
          });
      });
  }
}

export const db = new SawaariDatabase();

// No automatic demo data generation in production.
// A new installation starts with an empty database and triggers the First-Time Setup flow.
// Intentional database reset clears all records and keeps the database empty without reseeding.
export async function seedInitialDataIfEmpty() {
  // Deliberately no-op: production starts with an empty garage
  return;
}

export async function ensureDefaultComponentsForBike(bikeId: number, _currentOdo: number = 0) {
  try {
    return await db.components.where('bikeId').equals(bikeId).toArray();
  } catch (err) {
    console.error('Error loading components:', err);
    return [];
  }
}

