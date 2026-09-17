'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { normalizeDigits } from '@alsaada/regional-engine';

export type ThemeMode = 'light' | 'dark' | 'system';
export type TableDensity = 'comfortable' | 'compact';
export type TimeFormat = '12h' | '24h';
export type DateFormat = 'DD/MM/YYYY' | 'YYYY-MM-DD';
export type WeekStart = 'saturday' | 'sunday' | 'monday';
export type NumberFormatMode = 'western' | 'eastern';
export type CurrencyCode = 'EGP' | 'SAR' | 'USD';

export interface TimezoneOption {
  id: string;
  name: string;
  flag: string;
  city: string;
  offsetLabel: string;
}

export const SUPPORTED_TIMEZONES: TimezoneOption[] = [
  {
    id: 'Africa/Cairo',
    name: 'توقيت القاهرة (جمهورية مصر العربية)',
    flag: '🇪🇬',
    city: 'القاهرة',
    offsetLabel: 'UTC+2 / +3',
  },
  {
    id: 'Asia/Riyadh',
    name: 'توقيت مكة المكرمة والرياض (المملكة العربية السعودية)',
    flag: '🇸🇦',
    city: 'الرياض',
    offsetLabel: 'UTC+3',
  },
  {
    id: 'Asia/Dubai',
    name: 'توقيت أبوظبي ودبي (دولة الإمارات)',
    flag: '🇦🇪',
    city: 'دبي',
    offsetLabel: 'UTC+4',
  },
  {
    id: 'Europe/London',
    name: 'توقيت لندن (المملكة المتحدة / غرينتش)',
    flag: '🇬🇧',
    city: 'لندن',
    offsetLabel: 'UTC+0 / +1',
  },
  {
    id: 'UTC',
    name: 'التوقيت العالمي المنسق (UTC)',
    flag: '🌐',
    city: 'UTC',
    offsetLabel: 'UTC+0',
  },
];

export interface DashboardPreferences {
  theme: ThemeMode;
  tableDensity: TableDensity;
  sidebarCollapsed: boolean;
  timezone: string;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  weekStart: WeekStart;
  numberFormat: NumberFormatMode;
  currencyCode: CurrencyCode;
  currencySymbol: string;
  decimalPlaces: number;
  refreshInterval: number; // in seconds: 0 = manual, 15, 30, 60
  tableRowsPerPage: number; // 10, 25, 50, 100
  soundNotifications: boolean;
}

export const DEFAULT_PREFERENCES: DashboardPreferences = {
  theme: 'light',
  tableDensity: 'comfortable',
  sidebarCollapsed: false,
  timezone: 'Africa/Cairo',
  timeFormat: '12h',
  dateFormat: 'DD/MM/YYYY',
  weekStart: 'saturday',
  numberFormat: 'western',
  currencyCode: 'EGP',
  currencySymbol: 'ج.م',
  decimalPlaces: 2,
  refreshInterval: 30,
  tableRowsPerPage: 25,
  soundNotifications: true,
};

const STORAGE_KEY = 'alsaada_dashboard_preferences';

const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toEasternDigits(str: string): string {
  if (!str) return '';
  return str.replace(/\d/g, (d) => EASTERN_DIGITS[parseInt(d, 10)] ?? d);
}

export function parseDateSafe(val?: Date | string | number | null): Date | null {
  if (val === undefined || val === null || val === '') return new Date();
  const d = val instanceof Date ? val : new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export interface DashboardPreferencesContextType {
  preferences: DashboardPreferences;
  resolvedTheme: 'light' | 'dark';
  isSaving: boolean;
  lastSaved: Date | null;
  updatePreferences: (partial: Partial<DashboardPreferences>) => void;
  setTheme: (theme: ThemeMode) => void;
  resetPreferences: () => void;
  formatTime: (date?: Date | string | number | null, includeSeconds?: boolean) => string;
  formatDate: (date?: Date | string | number | null) => string;
  formatDateTime: (date?: Date | string | number | null) => string;
  formatNumber: (value: number | string | null | undefined, decimals?: number) => string;
  formatCurrency: (amount: number) => string;
  playNotificationSound: () => void;
  currentTimezoneInfo: TimezoneOption;
}

const DashboardPreferencesContext = createContext<
  DashboardPreferencesContextType | undefined
>(undefined);

export function DashboardPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [preferences, setPreferences] = useState<DashboardPreferences>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<DashboardPreferences>;
          return { ...DEFAULT_PREFERENCES, ...parsed };
        }
      } catch {}
    }
    return DEFAULT_PREFERENCES;
  });
  const [systemDark, setSystemDark] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Initialize from localStorage, cookies, and system media query on client mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        setSystemDark(mq.matches);

        const mqListener = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        mq.addEventListener('change', mqListener);

        // Cross-tab synchronization
        const handleStorage = (e: StorageEvent) => {
          if (e.key === STORAGE_KEY && e.newValue) {
            try {
              const updated = JSON.parse(e.newValue) as Partial<DashboardPreferences>;
              setPreferences((prev) => ({ ...prev, ...updated }));
            } catch {}
          }
        };
        window.addEventListener('storage', handleStorage);

        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<DashboardPreferences>;
          setPreferences((prev) => ({
            ...prev,
            ...parsed,
          }));
        }

        // Fetch user preferences from server API in background
        fetch('/api/user/preferences')
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.preferences) {
              setPreferences((prev) => {
                const merged = { ...prev, ...data.preferences };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                return merged;
              });
            }
          })
          .catch(() => {
            // Offline or unauthenticated - rely on local storage
          });

        isInitializedRef.current = true;

        return () => {
          mq.removeEventListener('change', mqListener);
          window.removeEventListener('storage', handleStorage);
        };
      }
    } catch {
      // Ignore initial load exceptions
    }
  }, []);

  // Compute resolved theme
  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (preferences.theme === 'system') {
      return systemDark ? 'dark' : 'light';
    }
    return preferences.theme === 'dark' ? 'dark' : 'light';
  }, [preferences.theme, systemDark]);

  // Synchronize document classes and cookies whenever resolvedTheme or timezone changes
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }

    // Update Cookies for Server Components & Middleware
    document.cookie = `alsaada_theme=${resolvedTheme}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `alsaada_tz=${preferences.timezone}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `alsaada_num_format=${preferences.numberFormat}; path=/; max-age=31536000; SameSite=Lax`;
  }, [resolvedTheme, preferences.timezone, preferences.numberFormat]);

  // Server sync with debounce
  const syncWithBackend = useCallback((prefs: DashboardPreferences) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    setIsSaving(true);

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/user/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prefs),
        });
      } catch {
        // Silently tolerate sync errors, local persistence remains SSOT
      } finally {
        setIsSaving(false);
        setLastSaved(new Date());
      }
    }, 600);
  }, []);

  // Update preferences state and trigger saves
  const updatePreferences = useCallback(
    (partial: Partial<DashboardPreferences>) => {
      setPreferences((prev) => {
        const next = { ...prev, ...partial };
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          }
        } catch {
          // LocalStorage quota or access error
        }
        syncWithBackend(next);
        return next;
      });
    },
    [syncWithBackend]
  );

  const setTheme = useCallback(
    (theme: ThemeMode) => {
      updatePreferences({ theme });
    },
    [updatePreferences]
  );

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
      }
    } catch {
      // LocalStorage error
    }
    syncWithBackend(DEFAULT_PREFERENCES);
  }, [syncWithBackend]);

  // Current timezone lookup
  const currentTimezoneInfo = useMemo(() => {
    return (
      SUPPORTED_TIMEZONES.find((tz) => tz.id === preferences.timezone) ||
      SUPPORTED_TIMEZONES[0]!
    );
  }, [preferences.timezone]);

  // Formatting helpers
  const formatTime = useCallback(
    (date?: Date | string | number | null, includeSeconds: boolean = false): string => {
      const d = parseDateSafe(date);
      if (!d) return '--:--';
      try {
        const formatter = new Intl.DateTimeFormat('ar-EG', {
          timeZone: preferences.timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: includeSeconds ? '2-digit' : undefined,
          hour12: preferences.timeFormat === '12h',
        });
        const formatted = formatter.format(d);
        return preferences.numberFormat === 'eastern'
          ? toEasternDigits(formatted)
          : normalizeDigits(formatted);
      } catch {
        return d.toLocaleTimeString();
      }
    },
    [preferences.timezone, preferences.timeFormat, preferences.numberFormat]
  );

  const formatDate = useCallback(
    (date?: Date | string | number | null): string => {
      const d = parseDateSafe(date);
      if (!d) return '--/--/----';
      try {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: preferences.timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(d);

        const y = parts.find((p) => p.type === 'year')?.value || '2026';
        const m = parts.find((p) => p.type === 'month')?.value || '01';
        const day = parts.find((p) => p.type === 'day')?.value || '01';

        const rawDate =
          preferences.dateFormat === 'YYYY-MM-DD'
            ? `${y}-${m}-${day}`
            : `${day}/${m}/${y}`;

        return preferences.numberFormat === 'eastern'
          ? toEasternDigits(rawDate)
          : rawDate;
      } catch {
        return d.toLocaleDateString();
      }
    },
    [preferences.timezone, preferences.dateFormat, preferences.numberFormat]
  );

  const formatDateTime = useCallback(
    (date?: Date | string | number | null): string => {
      const d = parseDateSafe(date);
      if (!d) return '--';
      return `${formatDate(d)} ${formatTime(d, true)}`;
    },
    [formatDate, formatTime]
  );

  const formatNumber = useCallback(
    (value: number | string | null | undefined, decimals: number = preferences.decimalPlaces): string => {
      if (value === null || value === undefined || value === '') return '';
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);

      const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(num);

      return preferences.numberFormat === 'eastern'
        ? toEasternDigits(formatted)
        : formatted;
    },
    [preferences.decimalPlaces, preferences.numberFormat]
  );

  const formatCurrency = useCallback(
    (amount: number): string => {
      const formattedNum = formatNumber(amount);
      return `${formattedNum} ${preferences.currencySymbol}`;
    },
    [formatNumber, preferences.currencySymbol]
  );

  // Play subtle chime using Web Audio API
  const playNotificationSound = useCallback(() => {
    if (!preferences.soundNotifications) return;
    try {
      if (typeof window !== 'undefined') {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        const now = ctx.currentTime;

        // Tone 1: 587.33 Hz (D5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.08, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.15);

        // Tone 2: 880 Hz (A5)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.08);
        gain2.gain.setValueAtTime(0.08, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.3);

        // Release Web Audio hardware resources after chime completes
        setTimeout(() => {
          try {
            if (ctx.state !== 'closed') {
              void ctx.close();
            }
          } catch {}
        }, 400);
      }
    } catch {
      // Audio autoplay policy or browser restriction
    }
  }, [preferences.soundNotifications]);

  const contextValue = useMemo<DashboardPreferencesContextType>(
    () => ({
      preferences,
      resolvedTheme,
      isSaving,
      lastSaved,
      updatePreferences,
      setTheme,
      resetPreferences,
      formatTime,
      formatDate,
      formatDateTime,
      formatNumber,
      formatCurrency,
      playNotificationSound,
      currentTimezoneInfo,
    }),
    [
      preferences,
      resolvedTheme,
      isSaving,
      lastSaved,
      updatePreferences,
      setTheme,
      resetPreferences,
      formatTime,
      formatDate,
      formatDateTime,
      formatNumber,
      formatCurrency,
      playNotificationSound,
      currentTimezoneInfo,
    ]
  );

  return (
    <DashboardPreferencesContext.Provider value={contextValue}>
      {children}
    </DashboardPreferencesContext.Provider>
  );
}

export function useDashboardPreferences(): DashboardPreferencesContextType {
  const context = useContext(DashboardPreferencesContext);
  if (!context) {
    throw new Error(
      'useDashboardPreferences must be used within a DashboardPreferencesProvider'
    );
  }
  return context;
}
