const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

if (args.length < 1) {
    console.log('Usage: node scripts/sync_nav.js <MAPPINGS_JSON_FILE>');
    console.log('Example: node scripts/sync_nav.js mappings.json');
    process.exit(1);
}

const mappingsFile = args[0];

if (!fs.existsSync(mappingsFile)) {
    console.error(`Error: Mappings file not found: ${mappingsFile}`);
    process.exit(1);
}

const navDir = path.join(__dirname, '../public/nav');

try {
    const mappingsData = fs.readFileSync(mappingsFile, 'utf8');
    const mappings = JSON.parse(mappingsData);

    // mappings can be an array or an object (if exported from Firebase Console directly, it might be object with keys)
    // We expect an array of objects: { systemTicker: "AAPL", stockInfo: { name: "애플" }, brokerageTicker: "ISIN..." }

    let mappingList = [];
    if (Array.isArray(mappings)) {
        mappingList = mappings;
    } else {
        mappingList = Object.values(mappings);
    }

    console.log(`Loaded ${mappingList.length} mappings.`);

    let updatedCount = 0;

    // Iterate through all markets in public/nav
    const markets = fs
        .readdirSync(navDir)
        .filter((file) => fs.statSync(path.join(navDir, file)).isDirectory());

    mappingList.forEach((mapping) => {
        const symbol = mapping.systemTicker;
        const koName = mapping.stockInfo?.name;
        const isin = mapping.brokerageTicker;

        if (!symbol || !koName) return;

        // Find the file for this symbol
        let found = false;

        for (const market of markets) {
            const marketDir = path.join(navDir, market);
            const firstLetter = symbol.charAt(0).toLowerCase(); // Assuming simple tickers
            // Handle special chars if needed, but usually A-Z
            const filename = `${firstLetter}.json`;
            const filePath = path.join(marketDir, filename);

            if (fs.existsSync(filePath)) {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const stocks = JSON.parse(fileContent);

                const stockIndex = stocks.findIndex((s) => s.symbol === symbol);

                if (stockIndex !== -1) {
                    // Update
                    let changed = false;
                    if (stocks[stockIndex].koName !== koName) {
                        stocks[stockIndex].koName = koName;
                        changed = true;
                    }
                    if (isin && stocks[stockIndex].isin !== isin) {
                        stocks[stockIndex].isin = isin;
                        changed = true;
                    }

                    if (changed) {
                        fs.writeFileSync(
                            filePath,
                            JSON.stringify(stocks, null, 4),
                            'utf8'
                        );
                        console.log(
                            `Updated ${symbol} in ${market}/${filename}`
                        );
                        updatedCount++;
                    }
                    found = true;
                    break; // Stop searching markets
                }
            }
        }

        if (!found) {
            // console.warn(`Symbol ${symbol} not found in any market file.`);
        }
    });

    console.log(`Sync complete. Updated ${updatedCount} stocks.`);
} catch (error) {
    console.error('Error processing:', error);
    process.exit(1);
}
