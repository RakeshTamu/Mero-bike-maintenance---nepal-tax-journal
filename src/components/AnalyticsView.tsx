import React, { useState } from 'react';
import {
  PieChart,
  BarChart3,
  TrendingUp,
  Plus,
  Fuel,
  Wrench,
  Shield,
  FileCheck,
  DollarSign,
  X,
  Calendar,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import { ExpenseRecord, ExpenseCategory, Bike } from '../types';
import { db } from '../db/db';
import { adToBs, formatAdDate } from '../utils/nepaliCalendar';
import { NepaliDatePicker } from './NepaliDatePicker';
import { SelectField } from './ui';

interface Props {
  bike: Bike;
  expenses: ExpenseRecord[];
  onRefresh: () => void;
  language: 'en' | 'ne';
  onOpenRefuel?: () => void;
}

const CATEGORY_META: { [key in ExpenseCategory]: { labelEn: string; labelNe: string; color: string; icon: any } } = {
  service: { labelEn: 'Service & Maintenance', labelNe: 'सर्भिस तथा मर्मत', color: '#06b6d4', icon: Wrench },
  tax_renewal: { labelEn: 'Tax & Blue Book Renewals', labelNe: 'सवारी कर तथा नवीकरण', color: '#10b981', icon: FileCheck },
  repair_parts: { labelEn: 'Repairs & Parts', labelNe: 'पार्टपुर्जा फेरबदल', color: '#f59e0b', icon: Wrench },
  fuel: { labelEn: 'Fuel / Petrol', labelNe: 'पेट्रोल / इन्धन', color: '#ec4899', icon: Fuel },
  insurance: { labelEn: 'Third-Party / Full Insurance', labelNe: 'सवारी बीमा', color: '#8b5cf6', icon: Shield },
  accessories: { labelEn: 'Accessories & Mods', labelNe: 'एक्सेसरिज तथा मोडिफिकेसन', color: '#64748b', icon: Layers }
};

interface TooltipPayload {
  payload: {
    id: number;
    dateAD: string;
    dateBS: string;
    displayDate: string;
    odometerKm: number;
    fuelLiters: number;
    amount: number;
    distanceKm: number;
    kmpl: number;
  };
}

const CustomFuelTooltip: React.FC<{ active?: boolean; payload?: TooltipPayload[]; language: 'en' | 'ne' }> = ({
  active,
  payload,
  language
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3.5 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] ring-1 ring-white/5 text-xs space-y-1.5 min-w-[200px]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-1.5">
          <span className="font-semibold text-[var(--color-text-primary)] font-mono tabular-nums">{data.dateAD}</span>
          <span className="text-[10px] text-[var(--color-accent)] font-mono tabular-nums">{data.dateBS} BS</span>
        </div>
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between text-[var(--color-text-secondary)]">
            <span>{language === 'ne' ? 'इन्धन माइलेज' : 'Fuel Mileage'}:</span>
            <span className="text-[var(--color-accent)] font-bold font-mono tabular-nums text-sm">{data.kmpl} KM/L</span>
          </div>
          <div className="flex items-center justify-between text-[var(--color-text-secondary)] text-[11px]">
            <span>{language === 'ne' ? 'ओडोमिटर' : 'Odometer'}:</span>
            <span className="font-mono tabular-nums text-[var(--color-text-primary)]">{data.odometerKm.toLocaleString()} KM</span>
          </div>
          {data.distanceKm > 0 && (
            <div className="flex items-center justify-between text-[var(--color-text-secondary)] text-[11px]">
              <span>{language === 'ne' ? 'पार दुरी' : 'Distance'}:</span>
              <span className="font-mono tabular-nums text-[var(--color-success)]">+{data.distanceKm} KM</span>
            </div>
          )}
          <div className="flex items-center justify-between text-[var(--color-text-secondary)] text-[11px]">
            <span>{language === 'ne' ? 'इन्धन परिमाण' : 'Fuel Liters'}:</span>
            <span className="font-mono tabular-nums text-[var(--color-text-primary)]">{data.fuelLiters} L (Rs. {data.amount.toLocaleString()})</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const AnalyticsView: React.FC<Props> = ({ bike, expenses, onRefresh, language, onOpenRefuel }) => {
  const [isLogging, setIsLogging] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'service' | 'tax' | 'fuel'>('all');

  // Form State
  const [dateAD, setDateAD] = useState(formatAdDate(new Date()));
  const [category, setCategory] = useState<ExpenseCategory>('fuel');
  const [amount, setAmount] = useState<number>(1500);
  const [description, setDescription] = useState('');
  const [odometerKm, setOdometerKm] = useState<number>(bike.odometerKm || 0);
  const [fuelLiters, setFuelLiters] = useState<number>(0);

  // Totals & Category Breakdown
  const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  const categoryTotals: { [key in ExpenseCategory]: number } = {
    service: 0,
    tax_renewal: 0,
    repair_parts: 0,
    fuel: 0,
    insurance: 0,
    accessories: 0
  };

  expenses.forEach(exp => {
    if (categoryTotals[exp.category] !== undefined) {
      categoryTotals[exp.category] += exp.amount;
    } else {
      categoryTotals.service += exp.amount;
    }
  });

  // Calculate Cost Per KM
  const costPerKm = (bike.odometerKm && bike.odometerKm > 0)
    ? (totalSpent / bike.odometerKm).toFixed(2)
    : '0.00';

  // Monthly Spending for last 6 months
  const monthlyData: { [key: string]: number } = {};
  const monthLabels: string[] = [];

  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = 0;
    monthLabels.push(key);
  }

  expenses.forEach(exp => {
    const key = exp.dateAD.slice(0, 7);
    if (monthlyData[key] !== undefined) {
      monthlyData[key] += exp.amount;
    }
  });

  const maxMonthly = Math.max(...Object.values(monthlyData), 5000);

  // Fuel Efficiency (KM/L) Trends calculation for the active bike
  const fuelExpenses = expenses
    .filter(exp => exp.category === 'fuel' && exp.odometerKm)
    .sort((a, b) => new Date(a.dateAD).getTime() - new Date(b.dateAD).getTime());

  interface FuelPoint {
    id: number;
    dateAD: string;
    dateBS: string;
    displayDate: string;
    odometerKm: number;
    fuelLiters: number;
    amount: number;
    distanceKm: number;
    kmpl: number;
    description?: string;
  }

  const fuelTrendData: FuelPoint[] = [];

  for (let i = 0; i < fuelExpenses.length; i++) {
    const current = fuelExpenses[i];
    const prev = i > 0 ? fuelExpenses[i - 1] : null;

    let kmpl = 0;
    let distance = 0;

    if (prev && current.odometerKm && prev.odometerKm && current.fuelLiters && current.fuelLiters > 0) {
      distance = Math.max(0, current.odometerKm - prev.odometerKm);
      if (distance > 0) {
        kmpl = parseFloat((distance / current.fuelLiters).toFixed(1));
      }
    }

    // Fallback: check if description explicitly records KM/L
    if (kmpl === 0 && current.description) {
      const match = current.description.match(/(\d+(\.\d+)?)\s*KM\/L/i);
      if (match) {
        kmpl = parseFloat(match[1]);
      }
    }

    if (kmpl > 0 && kmpl <= 120) {
      fuelTrendData.push({
        id: current.id || i,
        dateAD: current.dateAD,
        dateBS: current.dateBS,
        displayDate: current.dateAD.slice(5),
        odometerKm: current.odometerKm!,
        fuelLiters: current.fuelLiters || 0,
        amount: current.amount,
        distanceKm: distance,
        kmpl,
        description: current.description
      });
    }
  }

  // Mileage Metrics
  const allKmpl = fuelTrendData.map(d => d.kmpl);
  const avgKmpl = allKmpl.length > 0
    ? (allKmpl.reduce((a, b) => a + b, 0) / allKmpl.length).toFixed(1)
    : '0.0';
  const bestKmpl = allKmpl.length > 0
    ? Math.max(...allKmpl).toFixed(1)
    : '0.0';
  const latestKmpl = fuelTrendData.length > 0
    ? fuelTrendData[fuelTrendData.length - 1].kmpl.toFixed(1)
    : '0.0';

  const benchmarkKmpl = bike.category === 'Scooter'
    ? 42
    : bike.cc <= 125
      ? 48
      : bike.cc <= 160
        ? 39
        : bike.cc <= 250
          ? 34
          : 27;

  const fuelCostPerKm = parseFloat(avgKmpl) > 0
    ? (170.5 / parseFloat(avgKmpl)).toFixed(2)
    : '0.00';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    const bsDate = adToBs(dateAD).formatted;

    await db.expenses.add({
      bikeId: bike.id!,
      dateAD,
      dateBS: bsDate,
      category,
      amount: Number(amount),
      description: description.trim(),
      odometerKm: Number(odometerKm) || undefined,
      fuelLiters: category === 'fuel' ? Number(fuelLiters) || undefined : undefined
    });

    if (Number(odometerKm) > (bike.odometerKm || 0)) {
      await db.bikes.update(bike.id!, { odometerKm: Number(odometerKm) });
    }

    setIsLogging(false);
    setDescription('');
    onRefresh();
  };

  const filteredExpenses = expenses
    .filter(exp => {
      if (activeTab === 'all') return true;
      if (activeTab === 'service') return exp.category === 'service' || exp.category === 'repair_parts';
      if (activeTab === 'tax') return exp.category === 'tax_renewal';
      if (activeTab === 'fuel') return exp.category === 'fuel';
      return true;
    })
    .sort((a, b) => new Date(b.dateAD).getTime() - new Date(a.dateAD).getTime());

  return (
    <div className="space-y-4">
      {/* Top Spending KPI Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)]">
          <span className="text-xs text-[var(--color-text-secondary)] font-medium">
            {language === 'ne' ? 'सवारीमा कुल खर्च' : 'Total Bike Expenses'}
          </span>
          <div className="text-2xl font-bold text-[var(--color-text-primary)] font-mono tabular-nums mt-1">
            Rs. {totalSpent.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--color-accent)] mt-1 font-mono tabular-nums">
            {expenses.length} {language === 'ne' ? 'कुल रेकर्डहरू' : 'recorded transactions'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)]">
          <span className="text-xs text-[var(--color-text-secondary)] font-medium">
            {language === 'ne' ? 'प्रति कि.मी. लागत' : 'Cost per Kilometer'}
          </span>
          <div className="text-2xl font-bold text-[var(--color-text-primary)] font-mono tabular-nums mt-1">
            Rs. {costPerKm} <span className="text-xs font-normal text-[var(--color-text-secondary)] font-sans">/ KM</span>
          </div>
          <div className="text-[11px] text-[var(--color-text-secondary)] mt-1 font-mono tabular-nums">
            {bike.odometerKm?.toLocaleString()} KM tracked
          </div>
        </div>
      </div>

      {/* Fuel Efficiency (KM/L) Trends Chart (Powered by Recharts) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent)]">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  {language === 'ne' ? 'इन्धन खपत तथा माइलेज ट्रेन्ड' : 'Fuel Efficiency Trends'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 text-[var(--color-accent)] text-[10px] font-mono font-bold">
                  KM/L
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {language === 'ne'
                  ? `${bike.name} को पम्प रिफ्युल अनुसार प्रति लिटर माइलेज`
                  : `Fuel economy across pump refills for ${bike.name}`}
              </p>
            </div>
          </div>

          {onOpenRefuel && (
            <button
              onClick={onOpenRefuel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--color-accent)] hover:opacity-90 text-[var(--color-accent-fg)] font-semibold text-xs active:scale-[0.98] transition-all duration-150"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === 'ne' ? 'पेट्रोल दर्ता' : 'Log Refuel'}</span>
            </button>
          )}
        </div>

        {/* 4 Mileage KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
            <span className="text-[11px] text-[var(--color-text-secondary)] block font-medium">
              {language === 'ne' ? 'औसत माइलेज' : 'Average Economy'}
            </span>
            <div className="text-xl font-bold text-[var(--color-accent)] font-mono tabular-nums mt-0.5">
              {avgKmpl} <span className="text-xs font-normal text-[var(--color-text-secondary)]">KM/L</span>
            </div>
            <span className="text-[10px] text-[var(--color-text-secondary)] font-mono tabular-nums">
              {fuelTrendData.length} {language === 'ne' ? 'रिफ्युल गणना' : 'fills tracked'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
            <span className="text-[11px] text-[var(--color-text-secondary)] block font-medium">
              {language === 'ne' ? 'उत्कृष्ट माइलेज' : 'Best Economy'}
            </span>
            <div className="text-xl font-bold text-[var(--color-success)] font-mono tabular-nums mt-0.5">
              {bestKmpl} <span className="text-xs font-normal text-[var(--color-text-secondary)]">KM/L</span>
            </div>
            <span className="text-[10px] text-[var(--color-success)]">
              Peak efficiency
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
            <span className="text-[11px] text-[var(--color-text-secondary)] block font-medium">
              {language === 'ne' ? 'पछिल्लो माइलेज' : 'Latest Refill'}
            </span>
            <div className="text-xl font-bold text-[var(--color-text-primary)] font-mono tabular-nums mt-0.5">
              {latestKmpl} <span className="text-xs font-normal text-[var(--color-text-secondary)]">KM/L</span>
            </div>
            <span className="text-[10px] text-[var(--color-text-secondary)]">
              Recent pump fill
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
            <span className="text-[11px] text-[var(--color-text-secondary)] block font-medium">
              {language === 'ne' ? 'इन्धन खर्च / कि.मी.' : 'Running Cost / KM'}
            </span>
            <div className="text-xl font-bold text-[var(--color-warning)] font-mono tabular-nums mt-0.5">
              Rs. {fuelCostPerKm}
            </div>
            <span className="text-[10px] text-[var(--color-text-secondary)] font-mono tabular-nums">
              @ Rs. 170.5/L NOC
            </span>
          </div>
        </div>

        {/* The Recharts Area Chart */}
        {fuelTrendData.length >= 1 ? (
          <div className="space-y-3 pt-1">
            <div className="w-full h-64 min-h-[256px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={fuelTrendData}
                  margin={{ top: 15, right: 12, left: -15, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="fuelEfficiencyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="displayDate"
                    stroke="#71717a"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={11}
                    domain={[(dataMin: number) => Math.max(10, Math.floor(dataMin - 4)), (dataMax: number) => Math.ceil(dataMax + 4)]}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                    unit=" km/l"
                  />
                  <ReferenceLine
                    y={benchmarkKmpl}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{
                      value: `Target: ${benchmarkKmpl} KM/L`,
                      fill: '#f59e0b',
                      fontSize: 10,
                      position: 'insideTopRight'
                    }}
                  />
                  <Tooltip content={<CustomFuelTooltip language={language} />} />
                  <Area
                    type="monotone"
                    dataKey="kmpl"
                    stroke="#ec4899"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#fuelEfficiencyGrad)"
                    dot={{ r: 4, fill: '#ec4899', stroke: '#09090b', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#f43f5e', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Quick Chart Legend & Context */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-[var(--color-text-secondary)] pt-2 border-t border-[var(--color-border)] px-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                  <span className="text-[var(--color-text-primary)] font-medium">
                    {language === 'ne' ? 'वास्तविक माइलेज' : 'Actual Mileage (KM/L)'}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t border-dashed border-amber-400" />
                  <span className="text-[var(--color-text-primary)] font-medium">
                    {language === 'ne' ? `मापदण्ड (${benchmarkKmpl} KM/L)` : `Target Baseline (${benchmarkKmpl} KM/L)`}
                  </span>
                </span>
              </div>
              <span className="font-mono tabular-nums text-[var(--color-text-secondary)]">
                {bike.category} {bike.cc}cc
              </span>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/30 text-[var(--color-accent)] flex items-center justify-center mx-auto">
              <Fuel className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                {language === 'ne' ? 'कुनै इन्धन माइलेज रेकर्ड छैन' : 'No Fuel Efficiency Records Yet'}
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto mt-1">
                {language === 'ne'
                  ? 'पम्पमा पेट्रोल भर्दा ओडोमिटर कि.मी. र लिटर दर्ता गर्नुहोस्। एपले स्वतः प्रति लिटर माइलेज ट्रेन्ड चार्ट बनाउनेछ।'
                  : 'Log refuels with your odometer KM and liters to automatically plot your KM/L trends.'}
              </p>
            </div>
            {onOpenRefuel && (
              <button
                onClick={onOpenRefuel}
                className="px-4 py-2 rounded-xl bg-[var(--color-accent)] hover:opacity-90 text-[var(--color-accent-fg)] font-semibold text-xs inline-flex items-center gap-1.5 transition-all duration-150 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'ne' ? 'पहिलो पेट्रोल दर्ता गर्नुहोस्' : 'Log First Refuel'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Monthly Bar Chart */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              {language === 'ne' ? 'पछिल्लो ६ महिनाको खर्च' : '6-Month Expense Trend'}
            </h3>
          </div>
          <button
            onClick={() => setIsLogging(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--color-accent)] hover:opacity-90 text-[var(--color-accent-fg)] font-semibold text-xs transition-all duration-150 active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === 'ne' ? 'खर्च थप्नुहोस्' : 'Add Expense'}</span>
          </button>
        </div>

        {/* CSS/SVG Bar Chart */}
        <div className="pt-4 flex items-end justify-between gap-2 h-44 border-b border-[var(--color-border)] px-2">
          {monthLabels.map((mKey) => {
            const val = monthlyData[mKey] || 0;
            const heightPercent = Math.max(6, Math.round((val / maxMonthly) * 100));
            const monthName = new Date(mKey + '-01').toLocaleString('en-US', { month: 'short' });
            return (
              <div key={mKey} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="text-[10px] font-mono tabular-nums text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 truncate">
                  Rs.{val >= 1000 ? Math.round(val / 1000) + 'k' : val}
                </div>
                <div className="w-full max-w-[36px] bg-[var(--color-surface-2)] rounded-t-lg overflow-hidden flex items-end">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full bg-[var(--color-accent)] rounded-t-lg transition-all duration-300 group-hover:opacity-90"
                  />
                </div>
                <span className="text-[11px] font-medium text-[var(--color-text-secondary)] pb-1">
                  {monthName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Breakdown Progress */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] space-y-3">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <PieChart className="w-4 h-4 text-[var(--color-accent)]" />
          <span>{language === 'ne' ? 'शीर्षक अनुसार खर्च विभाजन' : 'Category Breakdown'}</span>
        </h3>

        <div className="space-y-3 pt-2">
          {(Object.keys(CATEGORY_META) as ExpenseCategory[]).map((catKey) => {
            const cat = CATEGORY_META[catKey];
            const catAmount = categoryTotals[catKey] || 0;
            const pct = totalSpent > 0 ? Math.round((catAmount / totalSpent) * 100) : 0;

            return (
              <div key={catKey} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-[var(--color-text-primary)]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span>{language === 'ne' ? cat.labelNe : cat.labelEn}</span>
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-[var(--color-text-primary)]">
                    Rs. {catAmount.toLocaleString()} <span className="text-[var(--color-text-secondary)] text-[11px]">({pct}%)</span>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Log Expense Modal */}
      {isLogging && (
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              {language === 'ne' ? 'नयाँ खर्च दर्ता गर्नुहोस्' : 'Log New Expense'}
            </h3>
            <button
              type="button"
              onClick={() => setIsLogging(false)}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <SelectField
            label={language === 'ne' ? 'खर्चको शीर्षक' : 'Category'}
            value={category}
            onValueChange={(val) => setCategory(val as ExpenseCategory)}
            options={(Object.keys(CATEGORY_META) as ExpenseCategory[]).map((key) => ({
              value: key,
              label: language === 'ne' ? CATEGORY_META[key].labelNe : CATEGORY_META[key].labelEn
            }))}
          />

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              {language === 'ne' ? 'रकम (रु.)' : 'Amount (Rs.)'}
            </label>
            <input
              type="number"
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] font-mono tabular-nums focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <NepaliDatePicker
            label={language === 'ne' ? 'खर्च मिति' : 'Expense Date'}
            valueAD={dateAD}
            onChange={(ad) => setDateAD(ad)}
            required
            language={language}
          />

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              {language === 'ne' ? 'विवरण' : 'Description'}
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 10L Petrol, Chain Lube Spray, Tubeless Puncture Fix"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {category === 'fuel' && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {language === 'ne' ? 'इन्धन परिमाण (लिटर - ऐच्छिक)' : 'Fuel Liters (Optional)'}
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 11.5"
                value={fuelLiters || ''}
                onChange={(e) => setFuelLiters(Number(e.target.value))}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] font-mono tabular-nums focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              {language === 'ne' ? 'ओडोमिटर कि.मी. (ऐच्छिक)' : 'Odometer KM (Optional)'}
            </label>
            <input
              type="number"
              placeholder="e.g. 9850"
              value={odometerKm || ''}
              onChange={(e) => setOdometerKm(Number(e.target.value))}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] font-mono tabular-nums focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsLogging(false)}
              className="flex-1 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors duration-150"
            >
              {language === 'ne' ? 'रद्द' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[var(--color-accent)] hover:opacity-90 text-[var(--color-accent-fg)] font-semibold text-xs transition-all duration-150 active:scale-[0.98]"
            >
              {language === 'ne' ? 'खर्च सेभ गर्नुहोस्' : 'Save Expense'}
            </button>
          </div>
        </form>
      )}

      {/* Filterable Expense Transactions List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
            {language === 'ne' ? 'हालका खर्च रेकर्डहरू' : 'Expense Log'}
          </h3>
          <div className="flex gap-1 bg-[var(--color-surface-1)] p-1 rounded-xl border border-[var(--color-border)] text-[11px]">
            {(['all', 'service', 'tax', 'fuel'] as const).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`px-2.5 py-1 rounded-lg transition-colors duration-150 ${
                  activeTab === tabKey
                    ? 'bg-[var(--color-surface-2)] text-[var(--color-accent)] font-semibold'
                    : 'text-[var(--color-text-secondary)]'
                }`}
              >
                {tabKey === 'all' ? 'All' : tabKey === 'service' ? 'Service' : tabKey === 'tax' ? 'Tax' : 'Fuel'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          {filteredExpenses.map((item) => {
            const meta = CATEGORY_META[item.category] || CATEGORY_META.service;
            return (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                  >
                    <meta.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--color-text-primary)] truncate max-w-[200px]">
                      {item.description}
                    </h4>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 font-mono tabular-nums">
                      {item.dateAD} ({item.dateBS} BS)
                      {item.odometerKm && ` · ${item.odometerKm.toLocaleString()} KM`}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-[var(--color-text-primary)] font-mono tabular-nums">
                    Rs. {item.amount.toLocaleString()}
                  </div>
                  <span
                    className="text-[10px] uppercase font-semibold tracking-wider block mt-0.5"
                    style={{ color: meta.color }}
                  >
                    {language === 'ne' ? meta.labelNe : meta.labelEn.split(' ')[0]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
