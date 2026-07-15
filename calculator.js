const WORLD_BANK_DEBT_INDICATOR = 'GC.DOD.TOTL.GD.ZS';
const WORLD_BANK_GDP_INDICATOR = 'NY.GDP.MKTP.CD';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parseFiniteNumber(value, fieldName) {
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
function assertRange(value, minimum, maximum, fieldName) {
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
        throw new Error(`${fieldName} is outside the expected range`);
    }
    return value;
}
function parseWorldBankSeries(payload, indicatorId, minimum, maximum) {
    if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[1])) {
        throw new Error('World Bank response has an invalid shape');
    }
    const observations = [];
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
            const value = assertRange(parseFiniteNumber(item.value, `${indicatorId} value`), minimum, maximum, `${indicatorId} value`);
            observations.push({ year, value });
        }
        catch (_error) {
            // Ignore malformed observations if the response also contains usable data.
        }
    }
    if (observations.length === 0) {
        throw new Error(`World Bank returned no valid ${indicatorId} observations`);
    }
    return observations.sort((left, right) => right.year - left.year);
}
export function parseWorldBankDebtSeries(payload) {
    return parseWorldBankSeries(payload, WORLD_BANK_DEBT_INDICATOR, 0, 1000);
}
export function parseWorldBankGdpSeries(payload) {
    return parseWorldBankSeries(payload, WORLD_BANK_GDP_INDICATOR, 1000000, 1000000000000000);
}
export function findLatestCommonYear(debtSeries, gdpSeries) {
    const gdpByYear = new Map();
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
export function calculateDebtFromGdp(gdpUsd, debtToGdpPercent) {
    assertRange(gdpUsd, 1000000, 1000000000000000, 'GDP');
    assertRange(debtToGdpPercent, 0, 1000, 'Debt-to-GDP percentage');
    return gdpUsd * (debtToGdpPercent / 100);
}
export function calculateBitcoinEquivalent(debtUsd, bitcoinPriceUsd, maximumSupply) {
    assertRange(debtUsd, 0, 1000000000000000, 'Debt');
    assertRange(bitcoinPriceUsd, 1, 100000000, 'Bitcoin price');
    assertRange(maximumSupply, 1, 100000000, 'Maximum Bitcoin supply');
    const bitcoin = debtUsd / bitcoinPriceUsd;
    return {
        bitcoin,
        percentageOfMaximumSupply: (bitcoin / maximumSupply) * 100,
    };
}
export function calculateConsoleEquivalent(debtUsd, referencePriceUsd) {
    assertRange(debtUsd, 0, 1000000000000000, 'Debt');
    assertRange(referencePriceUsd, 1, 1000000, 'Console reference price');
    return Math.floor(debtUsd / referencePriceUsd);
}
export function parseTreasuryDebtResponse(payload) {
    if (!isRecord(payload) || !Array.isArray(payload.data) || payload.data.length === 0) {
        throw new Error('Treasury response has an invalid shape');
    }
    const record = payload.data[0];
    if (!isRecord(record) || typeof record.record_date !== 'string') {
        throw new Error('Treasury debt record is invalid');
    }
    const date = record.record_date;
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
        || Number.isNaN(parsedDate.getTime())
        || parsedDate.toISOString().slice(0, 10) !== date) {
        throw new Error('Treasury debt date is invalid');
    }
    const amountUsd = assertRange(parseFiniteNumber(record.tot_pub_debt_out_amt, 'Treasury debt amount'), 1000000000, 1000000000000000, 'Treasury debt amount');
    return { amountUsd, date };
}
export function parseCoinGeckoBitcoinPrice(payload) {
    if (!isRecord(payload) || !isRecord(payload.bitcoin)) {
        throw new Error('CoinGecko response has an invalid shape');
    }
    const priceUsd = assertRange(parseFiniteNumber(payload.bitcoin.usd, 'Bitcoin price'), 100, 100000000, 'Bitcoin price');
    let lastUpdatedAt = null;
    if (payload.bitcoin.last_updated_at !== undefined) {
        const timestamp = parseFiniteNumber(payload.bitcoin.last_updated_at, 'Bitcoin update time');
        const currentUnixTime = Math.floor(Date.now() / 1000);
        lastUpdatedAt = assertRange(timestamp, 1230768000, currentUnixTime + 86400, 'Bitcoin update time');
    }
    return { priceUsd, lastUpdatedAt };
}
