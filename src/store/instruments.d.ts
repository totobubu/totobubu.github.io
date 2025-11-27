import type { Currency } from '@/types/common';

export interface Instrument {
    symbol: string;
    isin?: string;
    market?: string;
    currency?: Currency;
    koName?: string;
    longName?: string;
    company?: string;
    isEtf?: boolean;
    [key: string]: any;
}

export function registerInstruments(tickers: any[], options?: { markInitialized?: boolean }): void;
export function resolveInstrumentBySymbol(symbol: string): Instrument | null;
export function resolveInstrumentByIsin(isin: string): Instrument | null;
export function resolveInstrument(query: { symbol?: string; isin?: string }): Instrument | null;
export function ensureInstrumentDirectory(): Promise<void>;
export const instrumentState: {
    bySymbol: Record<string, Instrument>;
    byIsin: Record<string, Instrument>;
    hasNavSnapshot: boolean;
};
