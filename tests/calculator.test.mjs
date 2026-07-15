import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const calculatorSource = await readFile(new URL('../dist/calculator.js', import.meta.url), 'utf8');
const calculatorModuleUrl = `data:text/javascript;base64,${Buffer.from(calculatorSource).toString('base64')}`;

const {
  calculateBitcoinEquivalent,
  calculateConsoleEquivalent,
  calculateDebtFromGdp,
  findLatestCommonYear,
  parseCoinGeckoBitcoinPrice,
  parseTreasuryDebtResponse,
  parseWorldBankDebtSeries,
  parseWorldBankGdpSeries,
} = await import(calculatorModuleUrl);

test('findLatestCommonYear selects the newest year present in both series', () => {
  const result = findLatestCommonYear(
    [
      { year: 2024, value: 91 },
      { year: 2022, value: 87 },
    ],
    [
      { year: 2023, value: 5_000_000_000_000 },
      { year: 2022, value: 4_800_000_000_000 },
    ],
  );

  assert.deepEqual(result, {
    year: 2022,
    debtToGdpPercent: 87,
    gdpUsd: 4_800_000_000_000,
  });
});

test('calculateDebtFromGdp keeps GDP and debt ratio in the same calculation', () => {
  assert.equal(calculateDebtFromGdp(2_000_000_000_000, 75), 1_500_000_000_000);
});

test('Bitcoin and console conversions use explicit reference values', () => {
  const bitcoinEquivalent = calculateBitcoinEquivalent(2_100_000, 100_000, 21_000_000);
  assert.equal(bitcoinEquivalent.bitcoin, 21);
  assert.ok(Math.abs(bitcoinEquivalent.percentageOfMaximumSupply - 0.0001) < 1e-12);
  assert.equal(calculateConsoleEquivalent(1_049, 100), 10);
});

test('World Bank parsers reject malformed and implausible API data', () => {
  assert.throws(() => parseWorldBankDebtSeries({ data: [] }), /invalid shape/);
  assert.throws(
    () => parseWorldBankGdpSeries([
      {},
      [
        {
          indicator: { id: 'NY.GDP.MKTP.CD' },
          date: '2024',
          value: -1,
        },
      ],
    ]),
    /no valid/,
  );
});

test('World Bank parsers return validated observations', () => {
  const debtPayload = [
    {},
    [
      {
        indicator: { id: 'GC.DOD.TOTL.GD.ZS' },
        date: '2023',
        value: 63.5,
      },
    ],
  ];
  const gdpPayload = [
    {},
    [
      {
        indicator: { id: 'NY.GDP.MKTP.CD' },
        date: '2023',
        value: 4_500_000_000_000,
      },
    ],
  ];

  assert.deepEqual(parseWorldBankDebtSeries(debtPayload), [{ year: 2023, value: 63.5 }]);
  assert.deepEqual(parseWorldBankGdpSeries(gdpPayload), [
    { year: 2023, value: 4_500_000_000_000 },
  ]);
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
