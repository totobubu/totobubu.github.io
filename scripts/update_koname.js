const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

if (args.length < 3) {
    console.log(
        'Usage: node scripts/update_koname.js <MARKET> <SYMBOL> <KONAME>'
    );
    console.log('Example: node scripts/update_koname.js NASDAQ AAPL "애플"');
    process.exit(1);
}

const market = args[0].toUpperCase();
const symbol = args[1].toUpperCase();
const koName = args[2];

const navDir = path.join(__dirname, '../public/nav');
const marketDir = path.join(navDir, market);

if (!fs.existsSync(marketDir)) {
    console.error(`Error: Market directory not found: ${marketDir}`);
    process.exit(1);
}

// Determine the file based on the first letter of the symbol
const firstLetter = symbol.charAt(0).toLowerCase();
// Handle non-alphabet characters if necessary, but assuming standard symbols
const filename = `${firstLetter}.json`;
const filePath = path.join(marketDir, filename);

if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
}

try {
    const data = fs.readFileSync(filePath, 'utf8');
    const stocks = JSON.parse(data);

    const stockIndex = stocks.findIndex((s) => s.symbol === symbol);

    if (stockIndex === -1) {
        console.error(`Error: Symbol ${symbol} not found in ${filePath}`);
        process.exit(1);
    }

    // Update koName
    stocks[stockIndex].koName = koName;

    // Save file
    fs.writeFileSync(filePath, JSON.stringify(stocks, null, 4), 'utf8');
    console.log(
        `Successfully updated ${symbol} with koName "${koName}" in ${filePath}`
    );
} catch (error) {
    console.error('Error processing file:', error);
    process.exit(1);
}
