import {
  calculateBitcoinEquivalent,
  calculateConsoleEquivalent,
  parseCoinGeckoBitcoinPrice,
  parseDebtSnapshot,
  parseTreasuryDebtResponse,
  type BitcoinPriceData,
  type DebtSnapshot,
  type DebtSnapshotEntry,
} from './calculator.js';
import {
  CONSOLES,
  COUNTRIES,
  MAXIMUM_BITCOIN_SUPPLY,
  type Country,
  type CountryCode,
} from './data.js';

const REQUEST_TIMEOUT_MS = 8_000;
const DEBT_SNAPSHOT_URL = 'data/debt.json';
const TREASURY_DEBT_URL =
  'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1';
const COINGECKO_PRICE_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true';

interface AppElements {
  countrySelection: HTMLSelectElement;
  status: HTMLElement;
  debtLabel: HTMLElement;
  debtValue: HTMLElement;
  debtMeta: HTMLElement;
  featuredConsoleName: HTMLElement;
  featuredConsoleValue: HTMLElement;
  bitcoinValue: HTMLElement;
  bitcoinMeta: HTMLElement;
  consoleList: HTMLElement;
  heroConsoleImage: HTMLImageElement;
}

let debtSnapshotPromise: Promise<DebtSnapshot> | null = null;
let bitcoinPricePromise: Promise<BitcoinPriceData | null> | null = null;
let debtByCountry = new Map<string, DebtSnapshotEntry>();
let activeCountryCode: CountryCode = COUNTRIES[0].code;
let activeSelectionId = 0;
let activeRatioRenderId = 0;
let activeTreasuryController: AbortController | null = null;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function fetchJson(url: string, externalSignal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromExternalSignal = () => controller.abort();

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
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
  } catch (error) {
    if (isAbortError(error) && controller.signal.aborted && !externalSignal?.aborted) {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS} ms`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
}

function getDebtSnapshot(): Promise<DebtSnapshot> {
  if (!debtSnapshotPromise) {
    const countryCodes = COUNTRIES.map((country) => country.code);
    debtSnapshotPromise = fetchJson(DEBT_SNAPSHOT_URL)
      .then((payload) => parseDebtSnapshot(payload, countryCodes));
  }
  return debtSnapshotPromise;
}

function getBitcoinPrice(): Promise<BitcoinPriceData | null> {
  if (!bitcoinPricePromise) {
    bitcoinPricePromise = fetchJson(COINGECKO_PRICE_URL)
      .then(parseCoinGeckoBitcoinPrice)
      .catch(() => null);
  }
  return bitcoinPricePromise;
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Required element #${id} is missing`);
  }
  return element as T;
}

function clearElement(element: HTMLElement): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCount(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

function formatCompactCount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatUnixDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(timestamp * 1_000));
}

function getCountry(countryCode: CountryCode): Country {
  const country = COUNTRIES.find((candidate) => candidate.code === countryCode);
  if (!country) {
    throw new Error(`Unknown country code ${countryCode}`);
  }
  return country;
}

function appendDebtMeta(container: HTMLElement, debt: DebtSnapshotEntry): void {
  clearElement(container);

  const sourceLink = document.createElement('a');
  sourceLink.href = debt.source.url;
  sourceLink.textContent = debt.code === 'USA' ? 'U.S. Treasury' : 'IMF WEO';
  sourceLink.title = `${debt.source.name} · ${debt.source.dataset}`;
  container.appendChild(sourceLink);

  const dateLabel = /^\d{4}$/.test(debt.asOf)
    ? `${debt.asOf} estimate`
    : formatDate(debt.asOf);
  container.appendChild(document.createTextNode(` · ${dateLabel}`));
}

function renderBitcoin(
  debtAmountUsd: number,
  bitcoinPrice: BitcoinPriceData | null,
  elements: AppElements,
): void {
  if (!bitcoinPrice) {
    elements.bitcoinValue.textContent = 'Price unavailable';
    elements.bitcoinValue.removeAttribute('aria-label');
    elements.bitcoinMeta.textContent = 'CoinGecko';
    return;
  }

  const equivalent = calculateBitcoinEquivalent(
    debtAmountUsd,
    bitcoinPrice.priceUsd,
    MAXIMUM_BITCOIN_SUPPLY,
  );
  elements.bitcoinValue.textContent = formatCompactCount(equivalent.bitcoin);
  elements.bitcoinValue.setAttribute(
    'aria-label',
    `${formatCount(equivalent.bitcoin, 2)} BTC`,
  );

  const updated = bitcoinPrice.lastUpdatedAt === null
    ? ''
    : ` · ${formatUnixDate(bitcoinPrice.lastUpdatedAt)}`;
  elements.bitcoinMeta.textContent =
    `${formatUsd(bitcoinPrice.priceUsd)} per BTC · CoinGecko${updated}`;
}

function renderFeaturedConsole(debtAmountUsd: number, elements: AppElements): void {
  const featuredConsole = CONSOLES[0];
  const equivalent = calculateConsoleEquivalent(
    debtAmountUsd,
    featuredConsole.referencePriceUsd,
  );

  elements.featuredConsoleName.textContent = featuredConsole.id === 'game-boy'
    ? 'Game Boys'
    : featuredConsole.name;
  elements.featuredConsoleValue.textContent = formatCompactCount(equivalent);
  elements.featuredConsoleValue.setAttribute(
    'aria-label',
    `${formatCount(equivalent)} ${featuredConsole.name} consoles`,
  );
}

function renderConsoles(debtAmountUsd: number, elements: AppElements): void {
  clearElement(elements.consoleList);

  for (const consoleReference of CONSOLES) {
    const item = document.createElement('li');
    item.className = 'console-row';

    const image = document.createElement('img');
    image.src = consoleReference.imagePath;
    image.alt = '';
    image.className = 'console-image';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.width = consoleReference.imageWidth;
    image.height = consoleReference.imageHeight;

    const copy = document.createElement('div');
    copy.className = 'console-copy';
    const name = document.createElement('h3');
    name.className = 'console-name';
    name.textContent = consoleReference.name;
    const count = document.createElement('p');
    count.className = 'console-count';
    const equivalent = calculateConsoleEquivalent(
      debtAmountUsd,
      consoleReference.referencePriceUsd,
    );
    count.textContent = formatCompactCount(equivalent);
    count.setAttribute(
      'aria-label',
      `${formatCount(equivalent)} ${consoleReference.name} consoles`,
    );
    const note = document.createElement('small');
    note.className = 'console-price';
    note.textContent = `Reference price: ${formatUsd(consoleReference.referencePriceUsd)}`;

    copy.append(name, count, note);
    item.append(image, copy);
    elements.consoleList.appendChild(item);
  }
}

function renderDebt(
  debt: DebtSnapshotEntry,
  country: Country,
  selectionId: number,
  elements: AppElements,
): void {
  const ratioRenderId = ++activeRatioRenderId;

  elements.debtLabel.textContent = country.code === 'USA'
    ? `${country.name} national debt`
    : `${country.name} general government gross debt`;
  elements.debtValue.textContent = formatCompactUsd(debt.amountUsd);
  appendDebtMeta(elements.debtMeta, debt);
  renderFeaturedConsole(debt.amountUsd, elements);
  renderConsoles(debt.amountUsd, elements);

  elements.status.classList.remove('is-loading', 'is-error');
  elements.status.dataset.state = 'ready';
  elements.status.textContent = `${country.name} ratios ready.`;

  elements.bitcoinValue.textContent = 'Loading…';
  elements.bitcoinValue.removeAttribute('aria-label');
  elements.bitcoinMeta.textContent = 'CoinGecko';
  void getBitcoinPrice().then((bitcoinPrice) => {
    if (
      selectionId !== activeSelectionId
      || ratioRenderId !== activeRatioRenderId
      || country.code !== activeCountryCode
    ) {
      return;
    }
    renderBitcoin(debt.amountUsd, bitcoinPrice, elements);
  });
}

function setPackagedDataError(elements: AppElements): void {
  elements.countrySelection.disabled = true;
  elements.status.classList.remove('is-loading');
  elements.status.classList.add('is-error');
  elements.status.dataset.state = 'error';
  elements.status.textContent = 'Debt data could not be loaded. Please try again later.';
  elements.debtLabel.textContent = 'Debt data unavailable';
  elements.debtValue.textContent = '—';
  elements.debtMeta.textContent = 'The packaged Treasury and IMF dataset is unavailable.';
  elements.featuredConsoleValue.textContent = '—';
  elements.featuredConsoleValue.removeAttribute('aria-label');
  elements.bitcoinValue.textContent = '—';
  elements.bitcoinValue.removeAttribute('aria-label');
  elements.bitcoinMeta.textContent = '';
  clearElement(elements.consoleList);
}

async function refreshUnitedStatesDebt(
  snapshotDebt: DebtSnapshotEntry,
  country: Country,
  selectionId: number,
  elements: AppElements,
): Promise<void> {
  const controller = new AbortController();
  activeTreasuryController = controller;

  try {
    const payload = await fetchJson(TREASURY_DEBT_URL, controller.signal);
    const treasuryDebt = parseTreasuryDebtResponse(payload);
    if (
      selectionId !== activeSelectionId
      || controller.signal.aborted
      || activeCountryCode !== 'USA'
      || treasuryDebt.date < snapshotDebt.asOf
    ) {
      return;
    }

    renderDebt(
      {
        ...snapshotDebt,
        amountUsd: treasuryDebt.amountUsd,
        asOf: treasuryDebt.date,
      },
      country,
      selectionId,
      elements,
    );
  } catch (_error) {
    // The validated Treasury snapshot remains on screen when a live refresh is unavailable.
  } finally {
    if (activeTreasuryController === controller) {
      activeTreasuryController = null;
    }
  }
}

function selectCountry(countryCode: CountryCode, elements: AppElements): void {
  const debt = debtByCountry.get(countryCode);
  if (!debt) {
    setPackagedDataError(elements);
    return;
  }

  activeTreasuryController?.abort();
  activeTreasuryController = null;
  activeCountryCode = countryCode;
  const selectionId = ++activeSelectionId;
  const country = getCountry(countryCode);

  elements.countrySelection.value = countryCode;
  renderDebt(debt, country, selectionId, elements);

  if (countryCode === 'USA') {
    void refreshUnitedStatesDebt(debt, country, selectionId, elements);
  }
}

function renderCountryOptions(elements: AppElements): void {
  clearElement(elements.countrySelection);

  for (const country of COUNTRIES) {
    const option = document.createElement('option');
    option.value = country.code;
    option.textContent = country.name;
    elements.countrySelection.appendChild(option);
  }
  elements.countrySelection.value = activeCountryCode;
}

function initializeApp(): void {
  const elements: AppElements = {
    countrySelection: requiredElement<HTMLSelectElement>('country-selection'),
    status: requiredElement('status'),
    debtLabel: requiredElement('debt-label'),
    debtValue: requiredElement('debt-value'),
    debtMeta: requiredElement('debt-meta'),
    featuredConsoleName: requiredElement('featured-console-name'),
    featuredConsoleValue: requiredElement('featured-console-value'),
    bitcoinValue: requiredElement('bitcoin-value'),
    bitcoinMeta: requiredElement('bitcoin-meta'),
    consoleList: requiredElement('console-list'),
    heroConsoleImage: requiredElement<HTMLImageElement>('hero-console-image'),
  };

  const heroConsole = CONSOLES[0];
  elements.heroConsoleImage.src = heroConsole.imagePath;
  elements.heroConsoleImage.alt = `${heroConsole.name} console`;
  elements.heroConsoleImage.width = heroConsole.imageWidth;
  elements.heroConsoleImage.height = heroConsole.imageHeight;
  elements.countrySelection.disabled = true;
  renderCountryOptions(elements);

  elements.countrySelection.addEventListener('change', () => {
    const country = COUNTRIES.find(
      (candidate) => candidate.code === elements.countrySelection.value,
    );
    if (country) {
      selectCountry(country.code, elements);
    }
  });

  void getDebtSnapshot()
    .then((snapshot) => {
      debtByCountry = new Map(snapshot.countries.map((entry) => [entry.code, entry]));
      elements.countrySelection.disabled = false;
      selectCountry(activeCountryCode, elements);
    })
    .catch(() => {
      setPackagedDataError(elements);
    });
}

window.addEventListener('DOMContentLoaded', initializeApp);
