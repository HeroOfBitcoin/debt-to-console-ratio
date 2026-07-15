import { calculateBitcoinEquivalent, calculateConsoleEquivalent, parseCoinGeckoBitcoinPrice, parseDebtSnapshot, parseTreasuryDebtResponse, } from './calculator.js';
import { CONSOLES, COUNTRIES, MAXIMUM_BITCOIN_SUPPLY, } from './data.js';
const REQUEST_TIMEOUT_MS = 8000;
const DEBT_SNAPSHOT_URL = 'data/debt.json';
const TREASURY_DEBT_URL = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1';
const COINGECKO_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true';
const CAROUSEL_AUTOPLAY_MS = 6500;
const CAROUSEL_TRANSITION_MS = 320;
let debtSnapshotPromise = null;
let bitcoinPricePromise = null;
let debtByCountry = new Map();
let activeCountryCode = COUNTRIES[0].code;
let activeConsoleIndex = 0;
let activeDebtAmountUsd = null;
let activeSelectionId = 0;
let activeRatioRenderId = 0;
let activeTreasuryController = null;
let carouselAutoplayId = null;
let carouselTransitionId = null;
let carouselPaused = true;
let carouselPointerInside = false;
let carouselFocusInside = false;
let carouselInteractionOverride = false;
let carouselAnnouncementId = 0;
let reducedMotionQuery = null;
let preloadedConsoleImages = [];
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
function getDebtSnapshot() {
    if (!debtSnapshotPromise) {
        const countryCodes = COUNTRIES.map((country) => country.code);
        debtSnapshotPromise = fetchJson(DEBT_SNAPSHOT_URL)
            .then((payload) => parseDebtSnapshot(payload, countryCodes));
    }
    return debtSnapshotPromise;
}
function getBitcoinPrice() {
    if (!bitcoinPricePromise) {
        bitcoinPricePromise = fetchJson(COINGECKO_PRICE_URL)
            .then(parseCoinGeckoBitcoinPrice)
            .catch(() => null);
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
function formatCompactCount(value) {
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2,
    }).format(value);
}
function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
}
function formatUnixDate(timestamp) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(timestamp * 1000));
}
function getCountry(countryCode) {
    const country = COUNTRIES.find((candidate) => candidate.code === countryCode);
    if (!country) {
        throw new Error(`Unknown country code ${countryCode}`);
    }
    return country;
}
function appendDebtMeta(container, debt) {
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
function renderBitcoin(debtAmountUsd, bitcoinPrice, elements) {
    if (!bitcoinPrice) {
        elements.bitcoinValue.textContent = 'Price unavailable';
        elements.bitcoinValue.removeAttribute('aria-label');
        elements.bitcoinMeta.textContent = 'CoinGecko';
        return;
    }
    const equivalent = calculateBitcoinEquivalent(debtAmountUsd, bitcoinPrice.priceUsd, MAXIMUM_BITCOIN_SUPPLY);
    elements.bitcoinValue.textContent = formatCompactCount(equivalent.bitcoin);
    elements.bitcoinValue.setAttribute('aria-label', `${formatCount(equivalent.bitcoin, 2)} BTC`);
    const updated = bitcoinPrice.lastUpdatedAt === null
        ? ''
        : ` · ${formatUnixDate(bitcoinPrice.lastUpdatedAt)}`;
    elements.bitcoinMeta.textContent =
        `${formatUsd(bitcoinPrice.priceUsd)} per BTC · CoinGecko${updated}`;
}
function renderActiveConsole(elements) {
    const consoleReference = CONSOLES[activeConsoleIndex];
    const position = String(activeConsoleIndex + 1).padStart(2, '0');
    const total = String(CONSOLES.length).padStart(2, '0');
    elements.featuredConsoleName.textContent = consoleReference.ratioLabel;
    elements.featuredConsolePrice.textContent =
        `Reference price: ${formatUsd(consoleReference.referencePriceUsd)}`;
    elements.heroConsoleImage.src = consoleReference.imagePath;
    elements.heroConsoleImage.alt = '';
    elements.heroConsoleImage.width = consoleReference.imageWidth;
    elements.heroConsoleImage.height = consoleReference.imageHeight;
    elements.carouselPosition.textContent = `${position} / ${total}`;
    elements.carouselSlide.removeAttribute('aria-labelledby');
    elements.carouselSlide.setAttribute('aria-label', `Slide ${activeConsoleIndex + 1} of ${CONSOLES.length}: ${consoleReference.ratioLabel}`);
    if (activeDebtAmountUsd === null) {
        elements.featuredConsoleValue.textContent = '—';
        elements.featuredConsoleValue.removeAttribute('aria-label');
        return;
    }
    const equivalent = calculateConsoleEquivalent(activeDebtAmountUsd, consoleReference.referencePriceUsd);
    elements.featuredConsoleValue.textContent = formatCompactCount(equivalent);
    elements.featuredConsoleValue.setAttribute('aria-label', `${formatCount(equivalent)} ${consoleReference.ratioLabel}`);
}
function clearCarouselTransition(elements) {
    if (carouselTransitionId !== null) {
        window.clearTimeout(carouselTransitionId);
        carouselTransitionId = null;
    }
    elements.consoleCarousel.classList.remove('is-transitioning');
    delete elements.consoleCarousel.dataset.direction;
}
function beginCarouselTransition(direction, elements) {
    clearCarouselTransition(elements);
    if (reducedMotionQuery?.matches) {
        return;
    }
    elements.consoleCarousel.dataset.direction = direction;
    elements.consoleCarousel.classList.add('is-transitioning');
    carouselTransitionId = window.setTimeout(() => {
        clearCarouselTransition(elements);
    }, CAROUSEL_TRANSITION_MS);
}
function announceActiveConsole(elements) {
    const announcementId = ++carouselAnnouncementId;
    elements.carouselAnnouncement.textContent = '';
    window.requestAnimationFrame(() => {
        if (announcementId !== carouselAnnouncementId) {
            return;
        }
        const consoleReference = CONSOLES[activeConsoleIndex];
        elements.carouselAnnouncement.textContent =
            `Showing ${consoleReference.ratioLabel}, slide ${activeConsoleIndex + 1} of ${CONSOLES.length}.`;
    });
}
function stopCarouselAutoplay() {
    if (carouselAutoplayId !== null) {
        window.clearInterval(carouselAutoplayId);
        carouselAutoplayId = null;
    }
}
function updateCarouselToggle(elements) {
    const action = carouselPaused ? 'Play' : 'Pause';
    elements.carouselToggle.textContent = action;
    elements.carouselToggle.removeAttribute('aria-pressed');
    elements.carouselToggle.setAttribute('aria-label', `${action} automatic console rotation`);
}
function setActiveConsole(index, direction, elements, announce) {
    const normalizedIndex = (index + CONSOLES.length) % CONSOLES.length;
    if (normalizedIndex !== activeConsoleIndex) {
        beginCarouselTransition(direction, elements);
        activeConsoleIndex = normalizedIndex;
        renderActiveConsole(elements);
    }
    if (announce) {
        announceActiveConsole(elements);
    }
}
function startCarouselAutoplay(elements) {
    stopCarouselAutoplay();
    if (carouselPaused
        || (!carouselInteractionOverride
            && (carouselPointerInside || carouselFocusInside))
        || activeDebtAmountUsd === null
        || elements.carouselNext.disabled
        || document.visibilityState === 'hidden') {
        return;
    }
    carouselAutoplayId = window.setInterval(() => {
        setActiveConsole(activeConsoleIndex + 1, 'next', elements, false);
    }, CAROUSEL_AUTOPLAY_MS);
}
function useCarouselControl(index, direction, elements) {
    setActiveConsole(index, direction, elements, true);
    startCarouselAutoplay(elements);
}
function setCarouselControlsDisabled(elements, disabled) {
    elements.carouselPrevious.disabled = disabled;
    elements.carouselToggle.disabled = disabled;
    elements.carouselNext.disabled = disabled;
    if (disabled) {
        stopCarouselAutoplay();
    }
}
function preloadConsoleImages() {
    preloadedConsoleImages = CONSOLES.map((consoleReference) => {
        const image = new Image(consoleReference.imageWidth, consoleReference.imageHeight);
        image.src = consoleReference.imagePath;
        image.alt = '';
        image.decoding = 'async';
        return image;
    });
}
function renderDebt(debt, country, selectionId, elements) {
    const ratioRenderId = ++activeRatioRenderId;
    activeDebtAmountUsd = debt.amountUsd;
    elements.debtLabel.textContent = country.code === 'USA'
        ? `${country.name} national debt`
        : `${country.name} general government gross debt`;
    elements.debtValue.textContent = formatCompactUsd(debt.amountUsd);
    elements.debtValue.setAttribute('aria-label', formatUsd(debt.amountUsd));
    appendDebtMeta(elements.debtMeta, debt);
    renderActiveConsole(elements);
    setCarouselControlsDisabled(elements, false);
    startCarouselAutoplay(elements);
    elements.status.classList.remove('is-loading', 'is-error');
    elements.status.dataset.state = 'ready';
    elements.status.textContent = `${country.name} ratios ready.`;
    elements.bitcoinValue.textContent = 'Loading…';
    elements.bitcoinValue.removeAttribute('aria-label');
    elements.bitcoinMeta.textContent = 'CoinGecko';
    void getBitcoinPrice().then((bitcoinPrice) => {
        if (selectionId !== activeSelectionId
            || ratioRenderId !== activeRatioRenderId
            || country.code !== activeCountryCode) {
            return;
        }
        renderBitcoin(debt.amountUsd, bitcoinPrice, elements);
    });
}
function setPackagedDataError(elements) {
    activeDebtAmountUsd = null;
    activeRatioRenderId += 1;
    elements.countrySelection.disabled = true;
    setCarouselControlsDisabled(elements, true);
    elements.status.classList.remove('is-loading');
    elements.status.classList.add('is-error');
    elements.status.dataset.state = 'error';
    elements.status.textContent = 'Debt data could not be loaded. Please try again later.';
    elements.debtLabel.textContent = 'Debt data unavailable';
    elements.debtValue.textContent = '—';
    elements.debtValue.removeAttribute('aria-label');
    elements.debtMeta.textContent = '';
    renderActiveConsole(elements);
    elements.carouselAnnouncement.textContent = '';
    elements.bitcoinTitle.textContent = 'Bitcoin';
    elements.bitcoinValue.textContent = '—';
    elements.bitcoinValue.removeAttribute('aria-label');
    elements.bitcoinMeta.textContent = '';
}
async function refreshUnitedStatesDebt(snapshotDebt, country, selectionId, elements) {
    const controller = new AbortController();
    activeTreasuryController = controller;
    try {
        const payload = await fetchJson(TREASURY_DEBT_URL, controller.signal);
        const treasuryDebt = parseTreasuryDebtResponse(payload);
        if (selectionId !== activeSelectionId
            || controller.signal.aborted
            || activeCountryCode !== 'USA'
            || treasuryDebt.date < snapshotDebt.asOf) {
            return;
        }
        renderDebt({
            ...snapshotDebt,
            amountUsd: treasuryDebt.amountUsd,
            asOf: treasuryDebt.date,
        }, country, selectionId, elements);
    }
    catch (_error) {
        // The validated Treasury snapshot remains on screen when a live refresh is unavailable.
    }
    finally {
        if (activeTreasuryController === controller) {
            activeTreasuryController = null;
        }
    }
}
function selectCountry(countryCode, elements) {
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
function renderCountryOptions(elements) {
    clearElement(elements.countrySelection);
    for (const country of COUNTRIES) {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = country.name;
        elements.countrySelection.appendChild(option);
    }
    elements.countrySelection.value = activeCountryCode;
}
function initializeApp() {
    const elements = {
        countrySelection: requiredElement('country-selection'),
        status: requiredElement('status'),
        debtLabel: requiredElement('debt-label'),
        debtValue: requiredElement('debt-value'),
        debtMeta: requiredElement('debt-meta'),
        consoleCarousel: requiredElement('console-carousel'),
        carouselSlide: requiredElement('carousel-slide'),
        featuredConsoleName: requiredElement('featured-console-name'),
        featuredConsoleValue: requiredElement('featured-console-value'),
        featuredConsolePrice: requiredElement('featured-console-price'),
        heroConsoleImage: requiredElement('hero-console-image'),
        carouselPosition: requiredElement('carousel-position'),
        carouselPrevious: requiredElement('carousel-previous'),
        carouselToggle: requiredElement('carousel-toggle'),
        carouselNext: requiredElement('carousel-next'),
        carouselAnnouncement: requiredElement('carousel-announcement'),
        bitcoinTitle: requiredElement('bitcoin-title'),
        bitcoinValue: requiredElement('bitcoin-value'),
        bitcoinMeta: requiredElement('bitcoin-meta'),
    };
    preloadConsoleImages();
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    carouselPaused = reducedMotionQuery.matches;
    elements.countrySelection.disabled = true;
    setCarouselControlsDisabled(elements, true);
    renderCountryOptions(elements);
    updateCarouselToggle(elements);
    elements.countrySelection.addEventListener('change', () => {
        const country = COUNTRIES.find((candidate) => candidate.code === elements.countrySelection.value);
        if (country) {
            selectCountry(country.code, elements);
        }
    });
    elements.carouselPrevious.addEventListener('click', () => {
        useCarouselControl(activeConsoleIndex - 1, 'previous', elements);
    });
    elements.carouselNext.addEventListener('click', () => {
        useCarouselControl(activeConsoleIndex + 1, 'next', elements);
    });
    elements.carouselToggle.addEventListener('click', () => {
        if (carouselPaused) {
            carouselPaused = false;
            carouselInteractionOverride = carouselPointerInside || carouselFocusInside;
        }
        else {
            carouselPaused = true;
            carouselInteractionOverride = false;
        }
        updateCarouselToggle(elements);
        startCarouselAutoplay(elements);
    });
    elements.consoleCarousel.addEventListener('keydown', (event) => {
        const eventTarget = event.target;
        if (!(eventTarget instanceof Element)
            || eventTarget.closest('button, select, a, input, textarea')
            || elements.carouselNext.disabled
            || event.altKey
            || event.ctrlKey
            || event.metaKey) {
            return;
        }
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                useCarouselControl(activeConsoleIndex - 1, 'previous', elements);
                break;
            case 'ArrowRight':
                event.preventDefault();
                useCarouselControl(activeConsoleIndex + 1, 'next', elements);
                break;
            case 'Home':
                event.preventDefault();
                useCarouselControl(0, 'previous', elements);
                break;
            case 'End':
                event.preventDefault();
                useCarouselControl(CONSOLES.length - 1, 'next', elements);
                break;
            default:
                break;
        }
    });
    elements.consoleCarousel.addEventListener('pointerenter', () => {
        carouselPointerInside = true;
        if (!carouselInteractionOverride) {
            stopCarouselAutoplay();
        }
    });
    elements.consoleCarousel.addEventListener('pointerleave', () => {
        carouselPointerInside = false;
        if (!carouselFocusInside) {
            carouselInteractionOverride = false;
        }
        startCarouselAutoplay(elements);
    });
    elements.consoleCarousel.addEventListener('focusin', () => {
        carouselFocusInside = true;
        if (!carouselInteractionOverride) {
            stopCarouselAutoplay();
        }
    });
    elements.consoleCarousel.addEventListener('focusout', (event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && elements.consoleCarousel.contains(nextTarget)) {
            return;
        }
        carouselFocusInside = false;
        if (!carouselPointerInside) {
            carouselInteractionOverride = false;
        }
        startCarouselAutoplay(elements);
    });
    reducedMotionQuery.addEventListener('change', (event) => {
        if (event.matches) {
            carouselPaused = true;
            carouselInteractionOverride = false;
            updateCarouselToggle(elements);
            stopCarouselAutoplay();
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            stopCarouselAutoplay();
        }
        else {
            startCarouselAutoplay(elements);
        }
    });
    window.addEventListener('pagehide', () => {
        stopCarouselAutoplay();
        clearCarouselTransition(elements);
    });
    window.addEventListener('pageshow', () => {
        startCarouselAutoplay(elements);
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
