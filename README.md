
# Retro National Debt Calculator

This project displays the national debt of various countries and converts it into the equivalent value of popular retro gaming consoles and Bitcoin.

## Features

- Displays national debt for the USA by default and allows you to select other countries.
- Converts the national debt into the equivalent number of retro gaming consoles (e.g., Atari 2600, NES, PlayStation).
- Also converts the debt into the value of Bitcoin, showing what percentage of the total Bitcoin supply it represents.

## Table of Contents

1. [Installation](#installation)
2. [Running Locally](#running-locally)
3. [Deploying to GitHub Pages](#deploying-to-github-pages)
4. [Project Structure](#project-structure)

---

## Installation

Follow the steps below to install and run the project locally.

### Prerequisites

- [Node.js](https://nodejs.org/) installed on your machine
- A GitHub account (for deployment on GitHub Pages)

### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/retro-national-debt-calculator.git
   cd retro-national-debt-calculator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the TypeScript code:
   ```bash
   npx tsc
   ```

4. Install a static server (e.g., `http-server`):
   ```bash
   npm install -g http-server
   ```

---

## Running Locally

To run the project locally:

1. Start the local server:
   ```bash
   http-server ./dist
   ```

2. Open your browser and go to:
   ```
   http://127.0.0.1:8080
   ```

You should now be able to see the Retro National Debt Calculator running locally.

---

## Deploying to GitHub Pages

To deploy the project to GitHub Pages, follow these steps:

### Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com/) and create a new repository.
   - Repository name: `your-repo-name`
   - Set it to public.

### Step 2: Push Your Code to GitHub

1. Initialize Git and add your files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Add your GitHub repository as a remote:
   ```bash
   git remote add origin https://github.com/your-username/your-repo-name.git
   ```

3. Push your code:
   ```bash
   git push -u origin master
   ```

### Step 3: Deploy to GitHub Pages

1. Install the `gh-pages` package:
   ```bash
   npm install gh-pages --save-dev
   ```

2. Add the following lines to your **`package.json`**:

   ```json
   "scripts": {
     "deploy": "gh-pages -d dist"
   }
   ```

3. Run the deployment script:
   ```bash
   npm run deploy
   ```

4. Go to your GitHub repository, click on **Settings** → **Pages**, and ensure the **Source** is set to **gh-pages branch**.

Your app should now be live on GitHub Pages at:
```
https://your-username.github.io/your-repo-name/
```

---

## Project Structure

```
retro-national-debt-calculator/
│
├── dist/                    # Compiled output files
│   ├── index.html           # Main HTML file
│   ├── app.js               # Compiled JavaScript
│   ├── styles.css           # Styles
│   └── images/              # Console and Bitcoin images
│       ├── atari2600.png
│       ├── nes.png
│       ├── segaGenesis.png
│       ├── snes.png
│       ├── playstation1.png
│       ├── n64.png
│       ├── gameboy.png
│       ├── playstation2.png
│       ├── xbox.png
│       ├── gamecube.png
│       ├── psp.png
│       ├── nintendoDS.png
│       ├── bitcoin.png
│       └── usd_pile.png
│
├── src/                     # Source files
│   ├── app.ts               # TypeScript source file
│   └── styles.css           # CSS file
├── package.json             # Node.js package file
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

---

## License

This project is open-source under the MIT license.
