// Declare numberToWords globally for TypeScript
declare const numberToWords: { toWords: (num: number) => string };

// GDP values for each country in USD (in trillions)
const GDPs: { [key: string]: number } = {
    USA: 21,    // 21 trillion USD
    CHN: 15,    // 15 trillion USD (China)
    JPN: 5,     // 5 trillion USD
    DEU: 4,     // 4 trillion USD (Germany)
    RUS: 1.7,   // 1.7 trillion USD (Russia)
    AUS: 1.4,   // 1.4 trillion USD (Australia)
    IND: 3.05,  // 3.05 trillion USD (India)
    CAN: 1.8,   // 1.8 trillion USD (Canada)
    BRA: 2.1,   // 2.1 trillion USD (Brazil)
    ITA: 2.0,   // 2 trillion USD (Italy)
    SLV: 0.027  // 27 billion USD (El Salvador)
};

// Fallback static debt values for countries not covered by the World Bank API
const fallbackDebtData: { [key: string]: number } = {
    RUS: 17.8,   // Russia's national debt to GDP ratio
    AUS: 55.1,   // Australia's national debt to GDP ratio
    IND: 89.6,   // India's national debt to GDP ratio
    CAN: 112.1,  // Canada's national debt to GDP ratio
    BRA: 98.9,   // Brazil's national debt to GDP ratio
    ITA: 154.2,   // Italy's national debt to GDP ratio
    SLV: 82.8,   // El Salvador's national debt to GDP ratio
    DEU: 59.8,   // Germany's national debt to GDP ratio
    CHN: 65.5    // China's national debt to GDP ratio (fallback)
};

// Prices of retro game consoles (in USD)
const consolePrices = {
    atari2600: 100,
    nes: 150,
    segaGenesis: 120,
    snes: 200,
    playstation1: 80,
    n64: 300,
    gameBoy: 100,
    playstation2: 130,
    xbox: 150,
    gameCube: 180,
    psp: 75,
    nintendoDS: 80
};

// Console Names
const consoleNames = {
    atari2600: 'Atari 2600',
    nes: 'NES',
    segaGenesis: 'Sega Genesis',
    snes: 'SNES',
    playstation1: 'PlayStation 1',
    n64: 'Nintendo 64',
    gameBoy: 'Game Boy',
    playstation2: 'PlayStation 2',
    xbox: 'Xbox',
    gameCube: 'GameCube',
    psp: 'PSP',
    nintendoDS: 'Nintendo DS'
};

// Country Names
const countryNames: { [key: string]: string } = {
    USA: "United States",
    CHN: "China",
    JPN: "Japan",
    DEU: "Germany",
    RUS: "Russia",
    AUS: "Australia",
    IND: "India",
    CAN: "Canada",
    BRA: "Brazil",
    ITA: "Italy",
    SLV: "El Salvador"
};

// Fallback static Bitcoin price in case the API fails
const fallbackBitcoinPrice = 20000; // Example fallback price in USD
const totalBitcoinSupply = 21_000_000; // Fixed Bitcoin supply

// Get Bitcoin price from CoinGecko API (with fallback in case of failure)
async function getBitcoinPrice(): Promise<number> {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        if (!response.ok) {
            throw new Error(`CoinGecko API responded with status ${response.status}`);
        }
        const data = await response.json();
        return data.bitcoin.usd;
    } catch (error) {
        console.error('Error fetching Bitcoin price:', error);
        // Return fallback Bitcoin price if the API call fails
        return fallbackBitcoinPrice;
    }
}

// Function to format numbers using international number formatting
function formatNumber(number: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(number);
}

// Function to convert numbers to words (for USD amounts)
function convertNumberToWords(num: number): string {
    return numberToWords.toWords(num).replace(/,/g, '-'); // Replace commas with hyphens for readability
}

// Function to fetch national debt as a percentage of GDP from the World Bank API for the last 5 years
async function fetchWorldBankDebtPercentage(countryCode: string): Promise<number> {
    try {
        const response = await fetch(`https://api.worldbank.org/v2/country/${countryCode}/indicator/GC.DOD.TOTL.GD.ZS?format=json&date=2015:2020`);
        const data = await response.json();

        if (data[1] && data[1].length > 0) {
            const lastThreeValues = data[1]
                .filter((item: any) => item.value !== null)
                .slice(0, 3); // Take the last 3 available values

            if (lastThreeValues.length > 0) {
                const averageDebtPercentage = lastThreeValues.reduce((sum: number, item: any) => sum + item.value, 0) / lastThreeValues.length;
                return averageDebtPercentage;
            }
        }
        throw new Error('No valid data from World Bank');
    } catch (error) {
        console.error('Error fetching World Bank data:', error);
        throw error;
    }
}

// Fallback function for countries not covered by the World Bank
async function fetchCountryEconomyDebt(countryCode: keyof typeof fallbackDebtData): Promise<number> {
    if (fallbackDebtData[countryCode] !== undefined) {
        return fallbackDebtData[countryCode];
    }

    throw new Error(`No data available for ${countryCode}`);
}

// Function to remove the highlighted border from all flags
function removeFlagHighlights() {
    const flags = document.querySelectorAll('.flag');
    flags.forEach(flag => {
        flag.classList.remove('selected-flag');
    });
}

// Function to load and display national debt data
async function loadNationalDebtData(countryCode: string) {
    try {
        let debtPercentage: number;
        try {
            // First, try World Bank API
            debtPercentage = await fetchWorldBankDebtPercentage(countryCode);
        } catch (error) {
            console.error('World Bank data not available, switching to fallback data.', error);
            // Fallback to CountryEconomy if World Bank API fails
            debtPercentage = await fetchCountryEconomyDebt(countryCode as keyof typeof fallbackDebtData);
        }

        const countryGDP = GDPs[countryCode] * 1_000_000_000_000;  // Convert GDP from trillion to actual value
        const countryName = countryNames[countryCode]; // Get the country name

        // Calculate national debt
        const debt = (debtPercentage / 100) * countryGDP;

        // Fetch current Bitcoin price (or fallback price)
        const bitcoinPrice = await getBitcoinPrice();

        // Calculate percentage of total Bitcoin supply
        const bitcoinSupplyPercentage = (debt / (bitcoinPrice * totalBitcoinSupply)) * 100;

        // Display results with formatted numbers (one per line)
        const resultHTML = `
            <li><img src="images/usd.png" alt="USD Pile" class="icon" /> 
                <div>${countryName} National Debt: ${formatNumber(debt)}</div>
                <div class="word-representation">(${convertNumberToWords(debt)})</div>
            </li>
            <li><img src="images/bitcoin.png" alt="Bitcoin" class="icon" /> 
                <div>That's ${(debt / bitcoinPrice).toFixed(2)} Bitcoin </div>
                <div class="word-representation"> (This is ${bitcoinSupplyPercentage.toFixed(6)}% of the total Bitcoin supply)</div>
            </li>
            <li><img src="images/gameboy.png" alt="Game Boy" class="icon" /> 
                <div>That's ${Math.floor(debt / consolePrices.gameBoy).toLocaleString()} ${consoleNames.gameBoy} consoles</div>
            </li>
            <li><img src="images/atari2600.png" alt="Atari 2600" class="icon" /> 
                <div>That's ${Math.floor(debt / consolePrices.atari2600).toLocaleString()} ${consoleNames.atari2600} consoles</div>
            </li>
            <li><img src="images/nes.png" alt="NES" class="icon" /> 
                <div>That's ${Math.floor(debt / consolePrices.nes).toLocaleString()} ${consoleNames.nes} consoles</div>
            </li>
            <li><img src="images/snes.png" alt="SNES" class="icon" /> 
                <div>That's ${Math.floor(debt / consolePrices.snes).toLocaleString()} ${consoleNames.snes} consoles</div>
            </li>
            <li><img src="images/playstation.png" alt="PlayStation 1" class="icon" /> 
                <div>That's ${Math.floor(debt / consolePrices.playstation1).toLocaleString()} ${consoleNames.playstation1} consoles</div>
            </li>
            <li><img src="images/n64.png" alt="Nintendo 64" class="icon" /> 
                <div>That's ${Math.floor(debt / consolePrices.n64).toLocaleString()} ${consoleNames.n64} consoles</div>
            </li>
            <li><img src="images/xbox.png" alt="Xbox" class="icon" /> 
                <div>That's ${Math.floor(debt / consolePrices.xbox).toLocaleString()} ${consoleNames.xbox} consoles</div>
            </li>
            <li><img src="images/gamecube.png" alt="GameCube" class="icon" /> 
                <div>That's ${Math.floor(debt / consolePrices.gameCube).toLocaleString()} ${consoleNames.gameCube} consoles</div>
            </li>
        `;

        // Set inner HTML for the results container
        document.getElementById('consolesBitcoin')!.innerHTML = resultHTML;

        // Highlight the selected flag
        removeFlagHighlights();
        const selectedFlag = document.querySelector(`img[data-country="${countryCode}"]`);
        selectedFlag?.classList.add('selected-flag');

    } catch (error) {
        console.error('Error calculating national debt:', error);
        document.getElementById('consolesBitcoin')!.textContent = `No data available for ${countryCode}`;
    }
}

// Event listener for flag selection
const flagContainer = document.getElementById('flag-selection')!;

// Event listener to handle flag selection
flagContainer.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    if (target.classList.contains('flag')) {
        const countryCode = target.dataset.country!;
        loadNationalDebtData(countryCode);
    }
});

// Default load USA data
window.addEventListener('DOMContentLoaded', () => {
    loadNationalDebtData('USA');
});
