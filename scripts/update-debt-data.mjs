import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COUNTRY_CODES = [
  'USA',
  'CHN',
  'JPN',
  'DEU',
  'RUS',
  'AUS',
  'IND',
  'CAN',
  'BRA',
  'ITA',
  'SLV',
];
const IMF_COUNTRY_CODES = COUNTRY_CODES.filter((code) => code !== 'USA');

const TREASURY_DEBT_URL =
  'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1';
const TREASURY_SOURCE_URL =
  'https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/debt-to-the-penny';
const IMF_API_BASE_URL = 'https://www.imf.org/external/datamapper/api/v2';
const IMF_DEBT_INDICATOR = 'GGXWDG_NGDP';
const IMF_GDP_INDICATOR = 'NGDPD';
const IMF_DEBT_UNIT = 'Percent of GDP';
const IMF_GDP_UNIT = 'Billions of U.S. dollars';
const IMF_METHODOLOGY =
  'GGXWDG_NGDP (% of GDP) multiplied by NGDPD (billions of U.S. dollars)';
const REQUEST_TIMEOUT_MS = 30_000;

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(projectRoot, 'public/data/debt.json');
const temporaryOutputPath = `${outputPath}.tmp`;

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFiniteNumber(value, fieldName) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    const number = Number(value);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  throw new Error(`${fieldName} must be a finite number`);
}

function assertRange(value, minimum, maximum, fieldName) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${fieldName} is outside the expected range`);
  }
  return value;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

function parseIsoDate(value, fieldName) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must be an ISO date`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${fieldName} is not a valid calendar date`);
  }
  if (parsed.getTime() > Date.now() + 86_400_000) {
    throw new Error(`${fieldName} cannot be in the future`);
  }
  return value;
}

function parseTreasuryDebt(payload) {
  if (!isRecord(payload) || !Array.isArray(payload.data) || payload.data.length !== 1) {
    throw new Error('Treasury response must contain exactly one latest record');
  }
  const record = payload.data[0];
  if (!isRecord(record)) {
    throw new Error('Treasury debt record is invalid');
  }

  return {
    date: parseIsoDate(record.record_date, 'Treasury record_date'),
    amountUsd: assertRange(
      parseFiniteNumber(record.tot_pub_debt_out_amt, 'Treasury debt amount'),
      1_000_000_000,
      1_000_000_000_000_000,
      'Treasury debt amount',
    ),
  };
}

function parseImfIndicator(payload, indicatorId, expectedUnit) {
  if (!isRecord(payload) || !isRecord(payload.api) || payload.api.version !== '2') {
    throw new Error(`${indicatorId} response is not IMF DataMapper API v2 data`);
  }
  if (!isRecord(payload.indicators) || !isRecord(payload.values)) {
    throw new Error(`${indicatorId} response is missing indicators or values`);
  }

  const metadata = payload.indicators[indicatorId];
  const countries = payload.values[indicatorId];
  if (!isRecord(metadata) || !isRecord(countries)) {
    throw new Error(`${indicatorId} response is missing the requested indicator`);
  }
  if (
    metadata.dataset !== 'WEO'
    || metadata.unit !== expectedUnit
    || typeof metadata.source !== 'string'
    || !/^World Economic Outlook \([^)]+\)$/.test(metadata.source)
  ) {
    throw new Error(`${indicatorId} metadata does not describe the expected WEO series`);
  }

  return { metadata, countries };
}

function parseImfCountrySeries(countries, countryCode, indicatorId, minimum, maximum) {
  const rawSeries = countries[countryCode];
  if (!isRecord(rawSeries)) {
    throw new Error(`${indicatorId} has no series for ${countryCode}`);
  }

  const series = new Map();
  for (const [yearText, rawValue] of Object.entries(rawSeries)) {
    if (!/^\d{4}$/.test(yearText)) {
      throw new Error(`${indicatorId} has an invalid year for ${countryCode}`);
    }
    const year = Number(yearText);
    const value = assertRange(
      parseFiniteNumber(rawValue, `${indicatorId} ${countryCode} ${yearText}`),
      minimum,
      maximum,
      `${indicatorId} ${countryCode} ${yearText}`,
    );
    series.set(year, value);
  }
  if (series.size === 0) {
    throw new Error(`${indicatorId} has no observations for ${countryCode}`);
  }
  return series;
}

function findLatestCommonImfYear(debtSeries, gdpSeries, countryCode) {
  const currentYear = new Date().getUTCFullYear();
  const commonYears = [...debtSeries.keys()]
    .filter((year) => year <= currentYear && gdpSeries.has(year))
    .sort((left, right) => right - left);
  if (commonYears.length === 0) {
    throw new Error(`IMF debt and GDP series have no common current or historical year for ${countryCode}`);
  }
  return commonYears[0];
}

function createTreasuryEntry(treasuryDebt) {
  return {
    code: 'USA',
    amountUsd: treasuryDebt.amountUsd,
    asOf: treasuryDebt.date,
    source: {
      name: 'U.S. Treasury Fiscal Data',
      dataset: 'Debt to the Penny',
      url: TREASURY_SOURCE_URL,
    },
    methodology: 'Total public debt outstanding reported by the U.S. Treasury',
  };
}

function createImfEntries(debtPayload, gdpPayload) {
  const debtIndicator = parseImfIndicator(
    debtPayload,
    IMF_DEBT_INDICATOR,
    IMF_DEBT_UNIT,
  );
  const gdpIndicator = parseImfIndicator(gdpPayload, IMF_GDP_INDICATOR, IMF_GDP_UNIT);
  if (debtIndicator.metadata.source !== gdpIndicator.metadata.source) {
    throw new Error('IMF debt and GDP indicators come from different WEO releases');
  }

  return IMF_COUNTRY_CODES.map((code) => {
    const debtSeries = parseImfCountrySeries(
      debtIndicator.countries,
      code,
      IMF_DEBT_INDICATOR,
      0,
      1_000,
    );
    const gdpSeries = parseImfCountrySeries(
      gdpIndicator.countries,
      code,
      IMF_GDP_INDICATOR,
      0.001,
      1_000_000,
    );
    const year = findLatestCommonImfYear(debtSeries, gdpSeries, code);
    const debtToGdpPercent = debtSeries.get(year);
    const gdpUsd = Math.round(gdpSeries.get(year) * 1_000_000_000);
    const amountUsd = Math.round(gdpUsd * (debtToGdpPercent / 100));

    assertRange(gdpUsd, 1_000_000, 1_000_000_000_000_000, `${code} GDP`);
    assertRange(amountUsd, 1_000_000_000, 1_000_000_000_000_000, `${code} debt`);

    return {
      code,
      amountUsd,
      asOf: String(year),
      debtToGdpPercent,
      gdpUsd,
      source: {
        name: 'International Monetary Fund',
        dataset: debtIndicator.metadata.source,
        url: `https://www.imf.org/external/datamapper/${IMF_DEBT_INDICATOR}@WEO/${code}`,
      },
      methodology: IMF_METHODOLOGY,
    };
  });
}

function validateSnapshot(snapshot) {
  if (snapshot.schemaVersion !== 1 || snapshot.countries.length !== COUNTRY_CODES.length) {
    throw new Error('Generated snapshot does not contain every configured country');
  }

  snapshot.countries.forEach((entry, index) => {
    const expectedCode = COUNTRY_CODES[index];
    if (entry.code !== expectedCode) {
      throw new Error(`Generated snapshot order mismatch: expected ${expectedCode}`);
    }
    assertRange(
      entry.amountUsd,
      1_000_000_000,
      1_000_000_000_000_000,
      `${entry.code} generated debt`,
    );
    if (entry.code !== 'USA') {
      const recalculated = entry.gdpUsd * (entry.debtToGdpPercent / 100);
      if (Math.abs(recalculated - entry.amountUsd) > 1) {
        throw new Error(`${entry.code} generated debt does not match its IMF inputs`);
      }
    }
  });
}

const [treasuryPayload, imfDebtPayload, imfGdpPayload] = await Promise.all([
  fetchJson(TREASURY_DEBT_URL),
  fetchJson(`${IMF_API_BASE_URL}/${IMF_DEBT_INDICATOR}`),
  fetchJson(`${IMF_API_BASE_URL}/${IMF_GDP_INDICATOR}`),
]);

const snapshot = {
  schemaVersion: 1,
  countries: [
    createTreasuryEntry(parseTreasuryDebt(treasuryPayload)),
    ...createImfEntries(imfDebtPayload, imfGdpPayload),
  ],
};
validateSnapshot(snapshot);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(temporaryOutputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
await rename(temporaryOutputPath, outputPath);

console.log(`Updated ${outputPath} with ${snapshot.countries.length} validated country records.`);
