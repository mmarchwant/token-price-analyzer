import { useTranslation } from 'react-i18next';
import { useAppData } from './AppData';
import { useSettingsStore } from '../state/settings';
import {
  applyVat,
  convertFromUsd,
  convertToUsd,
  formatMoney,
  formatTokens,
  removeVat,
} from '../domain/currency';
import type { ChannelFee, Currency, PriceOffer, UsageProfile } from '../domain/types';

export function useActiveProfile(): UsageProfile {
  const { profiles } = useAppData();
  const activeProfileId = useSettingsStore((state) => state.activeProfileId);

  const matched = profiles.find((p) => p.id === activeProfileId);
  if (matched) {
    return matched;
  }

  const firstPreset = profiles.find((p) => p.isPreset);
  if (firstPreset) {
    return firstPreset;
  }

  if (profiles.length > 0) {
    return profiles[0]!;
  }

  throw new Error('No usage profiles available');
}

export interface UseMoneyResult {
  fmt: (amountUsd: number, opts?: { maxFractionDigits?: number; compact?: boolean }) => string;
  fmtPerMTok: (
    usdPerMTok: number,
    opts?: { maxFractionDigits?: number; compact?: boolean },
  ) => string;
  fmtTokens: (n: number) => string;
  toUsd: (amount: number, currencyParam: Currency) => number;
  currency: Currency;
  isVatApplied: boolean;
}

export function useMoney(): UseMoneyResult {
  const { fx } = useAppData();
  const currency = useSettingsStore((state) => state.currency);
  const vatRatePct = useSettingsStore((state) => state.vatRatePct);
  const { i18n } = useTranslation();

  const locale = i18n.language || 'en';
  const isVatApplied = vatRatePct > 0;

  const fmt = (
    amountUsd: number,
    opts?: { maxFractionDigits?: number; compact?: boolean },
  ): string => {
    const converted = convertFromUsd(amountUsd, currency, fx);
    const withVat = applyVat(converted, vatRatePct);
    return formatMoney(withVat, currency, locale, opts);
  };

  const fmtPerMTok = (
    usdPerMTok: number,
    opts?: { maxFractionDigits?: number; compact?: boolean },
  ): string => {
    return fmt(usdPerMTok, opts);
  };

  const fmtTokensFn = (n: number): string => {
    return formatTokens(n, locale);
  };

  const toUsd = (amount: number, currencyParam: Currency): number => {
    const withoutVat = removeVat(amount, vatRatePct);
    return convertToUsd(withoutVat, currencyParam, fx);
  };

  return {
    fmt,
    fmtPerMTok,
    fmtTokens: fmtTokensFn,
    toUsd,
    currency,
    isVatApplied,
  };
}

export function useFeeFor(offer: PriceOffer): ChannelFee | undefined {
  const { fees } = useAppData();

  if (offer.channel.startsWith('openrouter')) {
    return fees.find((f) => f.vendor === 'openrouter');
  }

  return fees.find((f) => f.vendor === offer.vendor);
}
