# Debt to Console Ratio

A playful [Hero of Bitcoin](https://heroofbitcoin.xyz/) side project that translates national debt into Bitcoin and classic game console equivalents.

[Open the live site](https://heroofbitcoin.github.io/debt-to-console-ratio/)

## Data

The checked-in snapshot in `public/data/debt.json` keeps every country comparison available without relying on a third-party API at page load.

- United States: U.S. Treasury **Debt to the Penny**; the browser may refresh this figure from Treasury.
- Other countries: IMF **World Economic Outlook** general-government gross debt as a percentage of GDP, multiplied by nominal GDP for the same year.
- Bitcoin: live USD price from CoinGecko, loaded independently of the debt and console ratios.
- Consoles: fixed illustrative USD reference prices in `src/data.ts`.

Update and validate the Treasury + IMF snapshot with:

```bash
npm run data:update
```

Country definitions, reporting dates, IMF estimates, exchange rates, and console prices differ. The comparisons are illustrative, not financial advice.

## Development

Node.js 20 or newer is required.

```bash
npm install
npm test
python3 -m http.server 8080 --directory dist
```

Open <http://127.0.0.1:8080>. `npm test` creates a clean build in `dist/` before running the test suite.

## Deployment

GitHub Pages serves the `gh-pages` branch:

```bash
npm run deploy
```

Do not edit `dist/` directly; it is generated from `src/` and `public/`.

## License and assets

Code is available under the [MIT License](LICENSE). Product names and trademarks belong to their respective owners. Verify image-asset rights before redistributing them separately.
