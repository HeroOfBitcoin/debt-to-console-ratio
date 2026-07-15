export interface DatedValue {
  year: number;
  value: number;
}

export interface CommonYearDebtData {
  year: number;
  debtToGdpPercent: number;
  gdpUsd: number;
}

export interface TreasuryDebtData {
  amountUsd: number;
  date: string;
}

export interface BitcoinPriceData {
  priceUsd: number;
  lastUpdatedAt: number | null;
}

export interface BitcoinEquivalent {
  bitcoin: number;
  percentageOfMaximumSupply: number;
}

const WORLD_BANK_DEBT_INDICATOR = 'GC.DOD.TOTL.GD.ZS';
const WORLD_BANK_GDP_INDICATOR = 'NY.GDP.MKTP.CD';

function isRecord(value: unknown): value is { [key: string]: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`${fieldName} must be a finite number`);
}

function assertRange(
  value: number,
  minimum: number,
  maximum: number,
  fieldName: string,
): number {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${fieldName} is outside the expected range`);
  }
  return value;
}

function parseWorldBankSeries(
  payload: unknown,
  indicatorId: string,
  minimum: number,
  maximum: number,
): DatedValue[] {
  if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[1])) {
    throw new Error('World Bank response has an invalid shape');
  }

  const observations: DatedValue[] = [];
  for (const item of payload[1]) {
    if (!isRecord(item) || item.value === null) {
      continue;
    }

    const indicator = item.indicator;
    if (!isRecord(indicator) || indicator.id !== indicatorId) {
      continue;
    }

    if (typeof item.date !== 'string' || !/^\d{4}$/.test(item.date)) {
      continue;
    }

    const year = Number(item.date);
    if (year < 1960 || year > new Date().getUTCFullYear() + 1) {
      continue;
    }

    try {
      const value = assertRange(
        parseFiniteNumber(item.value, `${indicatorId} value`),
        minimum,
        maximum,
        `${indicatorId} value`,
      );
      observations.push({ year, value });
    } catch (_error) {
      // Ignore malformed observations if the response also contains usable data.
    }
  }

  if (observations.length === 0) {
    throw new Error(`World Bank returned no valid ${indicatorId} observations`);
  }

  return observations.sort((left, right) => right.year - left.year);
}

export function parseWorldBankDebtSeries(payload: unknown): DatedValue[] {
  return parseWorldBankSeries(payload, WORLD_BANK_DEBT_INDICATOR, 0, 1_000);
}

export function parseWorldBankGdpSeries(payload: unknown): DatedValue[] {
  return parseWorldBankSeries(payload, WORLD_BANK_GDP_INDICATOR, 1_000_000, 1_000_000_000_000_000);
}

export function findLatestCommonYear(
  debtSeries: readonly DatedValue[],
  gdpSeries: readonly DatedValue[],
): CommonYearDebtData {
  const gdpByYear = new Map<number, number>();
  for (const observation of gdpSeries) {
    gdpByYear.set(observation.year, observation.value);
  }

  const newestDebtFirst = debtSeries.slice().sort((left, right) => right.year - left.year);
  for (const debt of newestDebtFirst) {
    const gdpUsd = gdpByYear.get(debt.year);
    if (gdpUsd !== undefined) {
      return {
        year: debt.year,
        debtToGdpPercent: debt.value,
        gdpUsd,
      };
    }
  }

  throw new Error('Debt-to-GDP and GDP series have no common year');
}

export function calculateDebtFromGdp(gdpUsd: number, debtToGdpPercent: number): number {
  assertRange(gdpUsd, 1_000_000, 1_000_000_000_000_000, 'GDP');
  assertRange(debtToGdpPercent, 0, 1_000, 'Debt-to-GDP percentage');
  return gdpUsd * (debtToGdpPercent / 100);
}

export function calculateBitcoinEquivalent(
  debtUsd: number,
  bitcoinPriceUsd: number,
  maximumSupply: number,
): BitcoinEquivalent {
  assertRange(debtUsd, 0, 1_000_000_000_000_000, 'Debt');
  assertRange(bitcoinPriceUsd, 1, 100_000_000, 'Bitcoin price');
  assertRange(maximumSupply, 1, 100_000_000, 'Maximum Bitcoin supply');

  const bitcoin = debtUsd / bitcoinPriceUsd;
  return {
    bitcoin,
    percentageOfMaximumSupply: (bitcoin / maximumSupply) * 100,
  };
}

export function calculateConsoleEquivalent(debtUsd: number, referencePriceUsd: number): number {
  assertRange(debtUsd, 0, 1_000_000_000_000_000, 'Debt');
  assertRange(referencePriceUsd, 1, 1_000_000, 'Console reference price');
  return Math.floor(debtUsd / referencePriceUsd);
}

export function parseTreasuryDebtResponse(payload: unknown): TreasuryDebtData {
  if (!isRecord(payload) || !Array.isArray(payload.data) || payload.data.length === 0) {
    throw new Error('Treasury response has an invalid shape');
  }

  const record = payload.data[0];
  if (!isRecord(record) || typeof record.record_date !== 'string') {
    throw new Error('Treasury debt record is invalid');
  }

  const date = record.record_date;
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new Error('Treasury debt date is invalid');
  }

  const amountUsd = assertRange(
    parseFiniteNumber(record.tot_pub_debt_out_amt, 'Treasury debt amount'),
    1_000_000_000,
    1_000_000_000_000_000,
    'Treasury debt amount',
  );

  return { amountUsd, date };
}

export function parseCoinGeckoBitcoinPrice(payload: unknown): BitcoinPriceData {
  if (!isRecord(payload) || !isRecord(payload.bitcoin)) {
    throw new Error('CoinGecko response has an invalid shape');
  }

  const priceUsd = assertRange(
    parseFiniteNumber(payload.bitcoin.usd, 'Bitcoin price'),
    100,
    100_000_000,
    'Bitcoin price',
  );

  let lastUpdatedAt: number | null = null;
  if (payload.bitcoin.last_updated_at !== undefined) {
    const timestamp = parseFiniteNumber(payload.bitcoin.last_updated_at, 'Bitcoin update time');
    const currentUnixTime = Math.floor(Date.now() / 1_000);
    lastUpdatedAt = assertRange(timestamp, 1_230_768_000, currentUnixTime + 86_400, 'Bitcoin update time');
  }

  return { priceUsd, lastUpdatedAt };
}
