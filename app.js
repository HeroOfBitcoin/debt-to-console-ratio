import { calculateBitcoinEquivalent, calculateConsoleEquivalent, calculateDebtFromGdp, findLatestCommonYear, parseCoinGeckoBitcoinPrice, parseTreasuryDebtResponse, parseWorldBankDebtSeries, parseWorldBankGdpSeries, } from './calculator.js';
import { CONSOLES, COUNTRIES, MAXIMUM_BITCOIN_SUPPLY, } from './data.js';
const REQUEST_TIMEOUT_MS = 8000;
const TREASURY_DEBT_URL = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1';
const COINGECKO_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true';
const WORLD_BANK_DEBT_INDICATOR = 'GC.DOD.TOTL.GD.ZS';
const WORLD_BANK_GDP_INDICATOR = 'NY.GDP.MKTP.CD';
let activeRequestId = 0;
let activeDebtController = null;
let bitcoinPricePromise = null;
function isAbortError(error) {
    return error instanceof DOMException && error.name === 'AbortError';
}
async function fetchJson(url, externalSignal) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const abortFromExternalSignal = () => controller.abort();
    if (externalSignal?.aborted) {
        controller.abort();
    }
    else {
        externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });
    }
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
            throw new Error(`Request failed with HTTP ${response.status}`);
        }
        return await response.json();
    }
    catch (error) {
        if (isAbortError(error) && controller.signal.aborted && !externalSignal?.aborted) {
            throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS} ms`);
        }
        throw error;
    }
    finally {
        window.clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', abortFromExternalSignal);
    }
}
function getWorldBankUrl(countryCode, indicator) {
    return `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}?format=json&mrnev=10&per_page=100`;
}
async function fetchTreasuryDebt(country, signal) {
    const payload = await fetchJson(TREASURY_DEBT_URL, signal);
    const treasuryDebt = parseTreasuryDebtResponse(payload);
    return {
        amountUsd: treasuryDebt.amountUsd,
        country,
        status: 'live',
        label: `${country.name} gross federal debt`,
        sourceName: 'U.S. Treasury Fiscal Data',
        sourceUrl: 'https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/debt-to-the-penny',
        dateLabel: treasuryDebt.date,
        methodology: 'Reported total public debt outstanding',
    };
}
async function fetchWorldBankDebt(country, signal) {
    const [debtPayload, gdpPayload] = await Promise.all([
        fetchJson(getWorldBankUrl(country.code, WORLD_BANK_DEBT_INDICATOR), signal),
        fetchJson(getWorldBankUrl(country.code, WORLD_BANK_GDP_INDICATOR), signal),
    ]);
    const debtSeries = parseWorldBankDebtSeries(debtPayload);
    const gdpSeries = parseWorldBankGdpSeries(gdpPayload);
    const commonYear = findLatestCommonYear(debtSeries, gdpSeries);
    return {
        amountUsd: calculateDebtFromGdp(commonYear.gdpUsd, commonYear.debtToGdpPercent),
        country,
        status: 'live',
        label: `${country.name} estimated central government debt`,
        sourceName: 'World Bank Open Data',
        sourceUrl: 'https://data.worldbank.org/indicator/GC.DOD.TOTL.GD.ZS',
        dateLabel: String(commonYear.year),
        methodology: 'Debt-to-GDP ratio multiplied by GDP for the same year',
    };
}
function getCachedDebt(country) {
    if (!country.cachedEstimate) {
        return null;
    }
    return {
        amountUsd: calculateDebtFromGdp(country.cachedEstimate.gdpUsd, country.cachedEstimate.debtToGdpPercent),
        country,
        status: 'cached',
        label: `${country.name} estimated government debt`,
        sourceName: 'Cached estimate',
        sourceUrl: null,
        dateLabel: null,
        methodology: 'Historical debt-to-GDP estimate multiplied by approximate GDP; no reference year',
    };
}
async function loadDebt(country, signal) {
    if (country.code === 'USA') {
        try {
            return await fetchTreasuryDebt(country, signal);
        }
        catch (error) {
            if (isAbortError(error)) {
                throw error;
            }
            console.warn('Treasury debt data is unavailable; trying World Bank data.', error);
        }
    }
    try {
        return await fetchWorldBankDebt(country, signal);
    }
    catch (error) {
        if (isAbortError(error)) {
            throw error;
        }
        const cachedDebt = getCachedDebt(country);
        if (cachedDebt) {
            console.warn('World Bank data is unavailable; using a clearly labelled cached estimate.', error);
            return cachedDebt;
        }
        throw new Error(`No reliable debt data is available for ${country.name}`);
    }
}
function getBitcoinPrice() {
    if (!bitcoinPricePromise) {
        bitcoinPricePromise = fetchJson(COINGECKO_PRICE_URL)
            .then(parseCoinGeckoBitcoinPrice)
            .catch((error) => {
            console.warn('Bitcoin price is unavailable; no fallback price will be used.', error);
            return null;
        });
    }
    return bitcoinPricePromise;
}
function requiredElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Required element #${id} is missing`);
    }
    return element;
}
function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}
function formatUsd(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value);
}
function formatCompactUsd(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 2,
    }).format(value);
}
function formatCount(value, maximumFractionDigits = 0) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}
function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
}
function appendSourceMeta(container, debt) {
    clearElement(container);
    if (debt.sourceUrl) {
        const sourceLink = document.createElement('a');
        sourceLink.href = debt.sourceUrl;
        sourceLink.textContent = debt.sourceName;
        container.appendChild(sourceLink);
    }
    else {
        container.appendChild(document.createTextNode(debt.sourceName));
    }
    if (debt.dateLabel) {
        const formattedDate = /^\d{4}$/.test(debt.dateLabel)
            ? debt.dateLabel
            : formatDate(debt.dateLabel);
        container.appendChild(document.createTextNode(` · As of ${formattedDate}`));
    }
    container.appendChild(document.createTextNode(` · ${debt.methodology}`));
}
function renderBitcoin(debtAmountUsd, bitcoinPrice, elements) {
    if (!bitcoinPrice) {
        elements.bitcoinValue.textContent = 'Bitcoin price unavailable';
        elements.bitcoinMeta.textContent = 'CoinGecko could not be reached. No fallback price was used.';
        return;
    }
    const equivalent = calculateBitcoinEquivalent(debtAmountUsd, bitcoinPrice.priceUsd, MAXIMUM_BITCOIN_SUPPLY);
    elements.bitcoinValue.textContent = `${formatCount(equivalent.bitcoin, 2)} BTC`;
    const updated = bitcoinPrice.lastUpdatedAt === null
        ? ''
        : ` · Price updated ${new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }).format(new Date(bitcoinPrice.lastUpdatedAt * 1000))}`;
    elements.bitcoinMeta.textContent =
        `${formatCount(equivalent.percentageOfMaximumSupply, 4)}% of Bitcoin's ` +
            `${formatCount(MAXIMUM_BITCOIN_SUPPLY)} maximum supply · ` +
            `${formatUsd(bitcoinPrice.priceUsd)} per BTC · CoinGecko${updated}`;
}
function renderConsoles(debtAmountUsd, elements) {
    clearElement(elements.consoleList);
    for (const consoleReference of CONSOLES) {
        const item = document.createElement('li');
        item.className = 'console-row';
        const image = document.createElement('img');
        image.src = consoleReference.imagePath;
        image.alt = '';
        image.className = 'console-image';
        image.loading = 'lazy';
        image.width = 96;
        image.height = 72;
        const copy = document.createElement('div');
        copy.className = 'console-copy';
        const name = document.createElement('h3');
        name.className = 'console-name';
        name.textContent = consoleReference.name;
        const count = document.createElement('p');
        count.className = 'console-count';
        count.textContent = `${formatCount(calculateConsoleEquivalent(debtAmountUsd, consoleReference.referencePriceUsd))} consoles`;
        const note = document.createElement('small');
        note.className = 'console-price';
        note.textContent = `Illustrative reference price: ${formatUsd(consoleReference.referencePriceUsd)}`;
        copy.append(name, count, note);
        item.append(image, copy);
        elements.consoleList.appendChild(item);
    }
}
function renderDebt(debt, bitcoinPrice, elements) {
    elements.debtLabel.textContent = debt.label;
    elements.debtValue.textContent = formatCompactUsd(debt.amountUsd);
    appendSourceMeta(elements.debtMeta, debt);
    renderBitcoin(debt.amountUsd, bitcoinPrice, elements);
    renderConsoles(debt.amountUsd, elements);
    elements.status.classList.remove('is-loading', 'is-error');
    elements.status.dataset.state = debt.status === 'cached' ? 'cached' : 'ready';
    elements.status.textContent = debt.status === 'cached'
        ? `Showing a cached estimate for ${debt.country.name}.`
        : `Showing the latest available data for ${debt.country.name}.`;
}
function setLoadingState(country, elements) {
    elements.status.classList.remove('is-error');
    elements.status.classList.add('is-loading');
    elements.status.dataset.state = 'loading';
    elements.status.textContent = `Loading debt data for ${country.name}…`;
    elements.debtLabel.textContent = `${country.name} debt`;
    elements.debtValue.textContent = '—';
    elements.debtMeta.textContent = 'Checking official data sources…';
    elements.bitcoinValue.textContent = '—';
    elements.bitcoinMeta.textContent = 'Loading Bitcoin price…';
    clearElement(elements.consoleList);
}
function setErrorState(country, elements) {
    elements.status.classList.remove('is-loading');
    elements.status.classList.add('is-error');
    elements.status.dataset.state = 'error';
    elements.status.textContent = `${country.name} debt data is currently unavailable. Try again later.`;
    elements.debtLabel.textContent = `${country.name} debt unavailable`;
    elements.debtValue.textContent = '—';
    elements.debtMeta.textContent = 'No official data or clearly identified cached estimate is available.';
    elements.bitcoinValue.textContent = '—';
    elements.bitcoinMeta.textContent = 'A debt amount is required for this comparison.';
    clearElement(elements.consoleList);
}
function setSelectedCountry(countryCode, elements) {
    const buttons = elements.countrySelection.querySelectorAll('.country-button');
    buttons.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.country === countryCode));
    });
}
async function selectCountry(country, elements) {
    activeDebtController?.abort();
    const controller = new AbortController();
    activeDebtController = controller;
    const requestId = ++activeRequestId;
    setSelectedCountry(country.code, elements);
    setLoadingState(country, elements);
    try {
        const [debt, bitcoinPrice] = await Promise.all([
            loadDebt(country, controller.signal),
            getBitcoinPrice(),
        ]);
        if (requestId !== activeRequestId || controller.signal.aborted) {
            return;
        }
        renderDebt(debt, bitcoinPrice, elements);
    }
    catch (error) {
        if (isAbortError(error) || requestId !== activeRequestId) {
            return;
        }
        console.warn(`Unable to load debt data for ${country.name}.`, error);
        setErrorState(country, elements);
    }
}
function renderCountryButtons(elements) {
    clearElement(elements.countrySelection);
    for (const country of COUNTRIES) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'country-button';
        button.dataset.country = country.code;
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', `Show debt estimate for ${country.name}`);
        const flag = document.createElement('span');
        flag.className = 'country-flag';
        flag.setAttribute('aria-hidden', 'true');
        flag.textContent = country.flag;
        const name = document.createElement('span');
        name.className = 'country-name';
        name.textContent = country.name;
        button.append(flag, name);
        button.addEventListener('click', () => {
            void selectCountry(country, elements);
        });
        elements.countrySelection.appendChild(button);
    }
}
function initializeApp() {
    const elements = {
        countrySelection: requiredElement('country-selection'),
        status: requiredElement('status'),
        debtLabel: requiredElement('debt-label'),
        debtValue: requiredElement('debt-value'),
        debtMeta: requiredElement('debt-meta'),
        bitcoinValue: requiredElement('bitcoin-value'),
        bitcoinMeta: requiredElement('bitcoin-meta'),
        consoleList: requiredElement('console-list'),
        heroConsoleImage: requiredElement('hero-console-image'),
    };
    const heroConsole = CONSOLES[0];
    elements.heroConsoleImage.src = heroConsole.imagePath;
    elements.heroConsoleImage.alt = `${heroConsole.name} console`;
    renderCountryButtons(elements);
    void selectCountry(COUNTRIES[0], elements);
}
window.addEventListener('DOMContentLoaded', initializeApp);
