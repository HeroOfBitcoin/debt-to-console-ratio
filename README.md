# Debt to Console Ratio

Debt to Console Ratio is a playful [Hero of Bitcoin](https://heroofbitcoin.xyz/) side project. It turns national debt estimates into Bitcoin and classic game console equivalents—because trillions are easier to grasp when expressed as a warehouse full of Game Boys.

[Open the live site](https://heroofbitcoin.github.io/debt-to-console-ratio/)

## How the numbers work

The United States figure comes from the latest U.S. Treasury Debt to the Penny record. Other countries use the newest year for which the World Bank provides both central-government debt-to-GDP and GDP; the application multiplies those two observations from the same year. Clearly labelled cached estimates are used only when the World Bank has no usable response. Bitcoin conversions use CoinGecko without a fabricated fallback price, while console equivalents use fixed illustrative reference prices defined in the application.

These figures are illustrative. Reporting dates, definitions of public debt, exchange rates, and market prices differ, so countries are not perfectly comparable and results should not be treated as current fiscal data or financial advice.

## Development

Node.js 20 or newer is required.

```bash
npm install
npm run build
npm test
```

`npm run build` clears the generated `dist/` directory, compiles the TypeScript sources in `src/`, and copies the static files from `public/`. To preview the result locally:

```bash
python3 -m http.server 8080 --directory dist
```

Then open <http://127.0.0.1:8080>.

## Deployment

GitHub Pages serves the root of the `gh-pages` branch. A deployment always runs a clean build and the test suite first:

```bash
npm run deploy
```

Deploying requires write access to the repository. Do not edit `dist/` directly; it is ignored build output.

## Structure

```text
src/                    Application, data model, and pure calculations
public/                 HTML, CSS, favicon, and image sources
scripts/                Reproducible build helpers
tests/                  Node test suite
dist/                   Generated site output (ignored)
```

## License and assets

The source code is available under the [MIT License](LICENSE). Product names and trademarks belong to their respective owners. Image assets are not automatically covered by the code license; verify their provenance and permitted use before redistributing them separately.
