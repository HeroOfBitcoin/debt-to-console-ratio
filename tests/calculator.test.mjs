import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const calculatorSource = await readFile(new URL('../dist/calculator.js', import.meta.url), 'utf8');
const calculatorModuleUrl = `data:text/javascript;base64,${Buffer.from(calculatorSource).toString('base64')}`;
const dataSource = await readFile(new URL('../dist/data.js', import.meta.url), 'utf8');
const dataModuleUrl = `data:text/javascript;base64,${Buffer.from(dataSource).toString('base64')}`;
const { COUNTRIES } = await import(dataModuleUrl);
const debtSnapshotPayload = JSON.parse(
  await readFile(new URL('../public/data/debt.json', import.meta.url), 'utf8'),
);

const {
  calculateBitcoinEquivalent,
  calculateConsoleEquivalent,
  calculateDebtFromGdp,
  parseCoinGeckoBitcoinPrice,
  parseDebtSnapshot,
  parseTreasuryDebtResponse,
} = await import(calculatorModuleUrl);

const validDebtSnapshot = {
  schemaVersion: 1,
  countries: [
    {
      code: 'USA',
      amountUsd: 39_417_905_469_064.21,
      asOf: '2026-07-13',
      source: {
        name: 'U.S. Treasury Fiscal Data',
        dataset: 'Debt to the Penny',
        url: 'https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/debt-to-the-penny',
      },
      methodology: 'Total public debt outstanding reported by the U.S. Treasury',
    },
    {
      code: 'CAN',
      amountUsd: 2_775_625_380_000,
      asOf: '2026',
      debtToGdpPercent: 110.7,
      gdpUsd: 2_507_340_000_000,
      source: {
        name: 'International Monetary Fund',
        dataset: 'World Economic Outlook (April 2026)',
        url: 'https://www.imf.org/external/datamapper/GGXWDG_NGDP@WEO/CAN',
      },
      methodology:
        'GGXWDG_NGDP (% of GDP) multiplied by NGDPD (billions of U.S. dollars)',
    },
  ],
};

test('calculateDebtFromGdp keeps GDP and debt ratio in the same calculation', () => {
  assert.equal(calculateDebtFromGdp(2_000_000_000_000, 75), 1_500_000_000_000);
});

test('Bitcoin and console conversions use explicit reference values', () => {
  const bitcoinEquivalent = calculateBitcoinEquivalent(2_100_000, 100_000, 21_000_000);
  assert.equal(bitcoinEquivalent.bitcoin, 21);
  assert.ok(Math.abs(bitcoinEquivalent.percentageOfMaximumSupply - 0.0001) < 1e-12);
  assert.equal(calculateConsoleEquivalent(1_049, 100), 10);
});

test('Treasury and CoinGecko parsers reject invalid payloads', () => {
  assert.throws(
    () => parseTreasuryDebtResponse({
      data: [{ record_date: 'not-a-date', tot_pub_debt_out_amt: '36000000000000' }],
    }),
    /date is invalid/,
  );
  assert.throws(
    () => parseCoinGeckoBitcoinPrice({ bitcoin: { usd: 'not-a-price' } }),
    /finite number/,
  );
});

test('debt snapshot parser accepts complete Treasury and IMF records', () => {
  assert.deepEqual(parseDebtSnapshot(validDebtSnapshot, ['USA', 'CAN']), validDebtSnapshot);
});

test('checked-in debt snapshot covers every configured country', () => {
  const countryCodes = COUNTRIES.map((country) => country.code);
  const snapshot = parseDebtSnapshot(debtSnapshotPayload, countryCodes);
  assert.deepEqual(snapshot.countries.map((country) => country.code), countryCodes);
});

test('debt snapshot parser requires every configured country exactly once', () => {
  assert.throws(
    () => parseDebtSnapshot(
      { ...validDebtSnapshot, countries: validDebtSnapshot.countries.slice(0, 1) },
      ['USA', 'CAN'],
    ),
    /missing configured countries: CAN/,
  );
  assert.throws(
    () => parseDebtSnapshot(
      {
        ...validDebtSnapshot,
        countries: [validDebtSnapshot.countries[0], validDebtSnapshot.countries[0]],
      },
      ['USA', 'CAN'],
    ),
    /duplicate country code USA/,
  );
});

test('debt snapshot parser rejects untrusted fields and sources', () => {
  assert.throws(
    () => parseDebtSnapshot(
      { ...validDebtSnapshot, generatedAt: '2026-07-15' },
      ['USA', 'CAN'],
    ),
    /unexpected or missing fields/,
  );
  assert.throws(
    () => parseDebtSnapshot(
      {
        ...validDebtSnapshot,
        countries: [
          validDebtSnapshot.countries[0],
          {
            ...validDebtSnapshot.countries[1],
            source: {
              ...validDebtSnapshot.countries[1].source,
              url: 'https://example.com/not-imf-data',
            },
          },
        ],
      },
      ['USA', 'CAN'],
    ),
    /must identify an IMF World Economic Outlook source/,
  );
});

test('debt snapshot parser verifies calculated IMF debt amounts', () => {
  assert.throws(
    () => parseDebtSnapshot(
      {
        ...validDebtSnapshot,
        countries: [
          validDebtSnapshot.countries[0],
          { ...validDebtSnapshot.countries[1], amountUsd: 1_000_000_000 },
        ],
      },
      ['USA', 'CAN'],
    ),
    /does not match its IMF inputs/,
  );
});
