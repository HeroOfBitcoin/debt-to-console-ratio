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

export interface DebtSnapshotSource {
  name: string;
  dataset: string;
  url: string;
}

interface BaseDebtSnapshotEntry {
  code: string;
  amountUsd: number;
  asOf: string;
  source: DebtSnapshotSource;
  methodology: string;
}

export interface ReportedDebtSnapshotEntry extends BaseDebtSnapshotEntry {
  code: 'USA';
}

export interface CalculatedDebtSnapshotEntry extends BaseDebtSnapshotEntry {
  debtToGdpPercent: number;
  gdpUsd: number;
}

export type DebtSnapshotEntry = ReportedDebtSnapshotEntry | CalculatedDebtSnapshotEntry;

export interface DebtSnapshot {
  schemaVersion: 1;
  countries: DebtSnapshotEntry[];
}

function isRecord(value: unknown): value is { [key: string]: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  record: { [key: string]: unknown },
  expectedKeys: readonly string[],
  fieldName: string,
): void {
  const actualKeys = Object.keys(record).sort();
  const sortedExpectedKeys = expectedKeys.slice().sort();
  if (
    actualKeys.length !== sortedExpectedKeys.length
    || actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    throw new Error(`${fieldName} has unexpected or missing fields`);
  }
}

function parseSnapshotNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fieldName: string,
): number {
  if (typeof value !== 'number') {
    throw new Error(`${fieldName} must be a JSON number`);
  }
  return assertRange(value, minimum, maximum, fieldName);
}

function parseSnapshotString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value;
}

function parseSnapshotSource(
  value: unknown,
  countryCode: string,
): DebtSnapshotSource {
  if (!isRecord(value)) {
    throw new Error(`${countryCode} source must be an object`);
  }
  assertExactKeys(value, ['name', 'dataset', 'url'], `${countryCode} source`);

  const name = parseSnapshotString(value.name, `${countryCode} source name`);
  const dataset = parseSnapshotString(value.dataset, `${countryCode} source dataset`);
  const url = parseSnapshotString(value.url, `${countryCode} source URL`);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (_error) {
    throw new Error(`${countryCode} source URL is invalid`);
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error(`${countryCode} source URL must use HTTPS`);
  }

  if (countryCode === 'USA') {
    if (
      name !== 'U.S. Treasury Fiscal Data'
      || dataset !== 'Debt to the Penny'
      || parsedUrl.hostname !== 'fiscaldata.treasury.gov'
      || parsedUrl.port !== ''
      || parsedUrl.pathname !== '/datasets/debt-to-the-penny/debt-to-the-penny'
      || parsedUrl.search !== ''
      || parsedUrl.hash !== ''
    ) {
      throw new Error('USA snapshot must identify the U.S. Treasury Debt to the Penny source');
    }
  } else if (
    name !== 'International Monetary Fund'
    || !/^World Economic Outlook \([^)]+\)$/.test(dataset)
    || parsedUrl.hostname !== 'www.imf.org'
    || parsedUrl.port !== ''
    || parsedUrl.pathname !== `/external/datamapper/GGXWDG_NGDP@WEO/${countryCode}`
    || parsedUrl.search !== ''
    || parsedUrl.hash !== ''
  ) {
    throw new Error(`${countryCode} snapshot must identify an IMF World Economic Outlook source`);
  }

  return { name, dataset, url };
}

function parseSnapshotAsOf(value: unknown, countryCode: string): string {
  const asOf = parseSnapshotString(value, `${countryCode} asOf`);
  const currentYear = new Date().getUTCFullYear();

  if (countryCode === 'USA') {
    const parsedDate = new Date(`${asOf}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(asOf)
      || Number.isNaN(parsedDate.getTime())
      || parsedDate.toISOString().slice(0, 10) !== asOf
      || parsedDate.getUTCFullYear() < 1993
      || parsedDate.getTime() > Date.now() + 86_400_000
    ) {
      throw new Error('USA snapshot asOf date is invalid');
    }
    return asOf;
  }

  if (!/^\d{4}$/.test(asOf)) {
    throw new Error(`${countryCode} snapshot asOf must be a year`);
  }
  const year = Number(asOf);
  if (year < 1980 || year > currentYear) {
    throw new Error(`${countryCode} snapshot year is outside the expected range`);
  }
  return asOf;
}

function parseDebtSnapshotEntry(
  value: unknown,
  expectedCountryCodes: ReadonlySet<string>,
): DebtSnapshotEntry {
  if (!isRecord(value)) {
    throw new Error('Debt snapshot country entry must be an object');
  }

  const code = parseSnapshotString(value.code, 'Debt snapshot country code');
  if (!/^[A-Z]{3}$/.test(code) || !expectedCountryCodes.has(code)) {
    throw new Error(`Debt snapshot contains unexpected country code ${code}`);
  }

  const expectedKeys = code === 'USA'
    ? ['code', 'amountUsd', 'asOf', 'source', 'methodology']
    : [
        'code',
        'amountUsd',
        'asOf',
        'debtToGdpPercent',
        'gdpUsd',
        'source',
        'methodology',
      ];
  assertExactKeys(value, expectedKeys, `${code} snapshot entry`);

  const amountUsd = parseSnapshotNumber(
    value.amountUsd,
    1_000_000_000,
    1_000_000_000_000_000,
    `${code} debt amount`,
  );
  const asOf = parseSnapshotAsOf(value.asOf, code);
  const source = parseSnapshotSource(value.source, code);
  const methodology = parseSnapshotString(value.methodology, `${code} methodology`);

  if (code === 'USA') {
    if (methodology !== 'Total public debt outstanding reported by the U.S. Treasury') {
      throw new Error('USA snapshot methodology is invalid');
    }
    return { code: 'USA', amountUsd, asOf, source, methodology };
  }

  if (
    methodology
    !== 'GGXWDG_NGDP (% of GDP) multiplied by NGDPD (billions of U.S. dollars)'
  ) {
    throw new Error(`${code} snapshot methodology is invalid`);
  }

  const debtToGdpPercent = parseSnapshotNumber(
    value.debtToGdpPercent,
    0,
    1_000,
    `${code} debt-to-GDP percentage`,
  );
  const gdpUsd = parseSnapshotNumber(
    value.gdpUsd,
    1_000_000,
    1_000_000_000_000_000,
    `${code} GDP`,
  );
  const calculatedAmount = calculateDebtFromGdp(gdpUsd, debtToGdpPercent);
  if (Math.abs(calculatedAmount - amountUsd) > 1) {
    throw new Error(`${code} debt amount does not match its IMF inputs`);
  }

  return {
    code,
    amountUsd,
    asOf,
    debtToGdpPercent,
    gdpUsd,
    source,
    methodology,
  };
}

export function parseDebtSnapshot(
  payload: unknown,
  expectedCountryCodes: readonly string[],
): DebtSnapshot {
  if (!isRecord(payload)) {
    throw new Error('Debt snapshot must be an object');
  }
  assertExactKeys(payload, ['schemaVersion', 'countries'], 'Debt snapshot');
  if (payload.schemaVersion !== 1) {
    throw new Error('Debt snapshot schemaVersion must be 1');
  }
  if (!Array.isArray(payload.countries)) {
    throw new Error('Debt snapshot countries must be an array');
  }

  const expectedCodes = new Set<string>();
  for (const code of expectedCountryCodes) {
    if (!/^[A-Z]{3}$/.test(code) || expectedCodes.has(code)) {
      throw new Error('Expected country codes must be unique ISO alpha-3 codes');
    }
    expectedCodes.add(code);
  }
  if (expectedCodes.size === 0) {
    throw new Error('At least one expected country code is required');
  }

  const countries = payload.countries.map((entry) => parseDebtSnapshotEntry(entry, expectedCodes));
  const seenCodes = new Set<string>();
  for (const country of countries) {
    if (seenCodes.has(country.code)) {
      throw new Error(`Debt snapshot contains duplicate country code ${country.code}`);
    }
    seenCodes.add(country.code);
  }

  const missingCodes = expectedCountryCodes.filter((code) => !seenCodes.has(code));
  if (missingCodes.length > 0 || countries.length !== expectedCodes.size) {
    throw new Error(`Debt snapshot is missing configured countries: ${missingCodes.join(', ')}`);
  }

  return { schemaVersion: 1, countries };
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
