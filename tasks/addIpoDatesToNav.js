// tasks\addIpoDatesToNav.js
import fs from 'fs/promises';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

// [핵심 수정] 라이브러리 유효성 검사 비활성화
yahooFinance.setGlobalConfig({
    validation: {
        logErrors: true,
        failOnUnknownProperties: false,
        failOnInvalidData: false,
    },
});

const NAV_SOURCE_DIR = path.resolve(process.cwd(), 'public', 'nav');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getFirstTradeDate(symbol) {
    try {
        const quote = await yahooFinance.quote(symbol);
        const firstTradeDateMs = quote.firstTradeDateMilliseconds;
        if (!firstTradeDateMs) return null;
        return new Date(firstTradeDateMs).toISOString().split('T')[0];
    } catch (error) {
        return null;
    }
}

async function processNavFile(filePath) {
    console.log(`\nProcessing file: ${path.basename(filePath)}`);
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const tickers = JSON.parse(fileContent);
        let hasChanges = false;

        for (const ticker of tickers) {
            if (ticker.ipoDate) {
                continue;
            }
            const ipoDate = await getFirstTradeDate(ticker.symbol);
            await delay(200);

            if (ipoDate) {
                ticker.ipoDate = ipoDate;
                if (ticker.upcoming) {
                    delete ticker.upcoming;
                }
                hasChanges = true;
                console.log(
                    `  ✅ [PROMOTED] ${ticker.symbol}: Set ipoDate to ${ipoDate}`
                );
            } else {
                if (!ticker.upcoming) {
                    ticker.upcoming = true;
                    hasChanges = true;
                    console.log(
                        `  ⚠️ [MARKED] ${ticker.symbol} as 'upcoming' (IPO date not found)`
                    );
                }
            }
        }

        if (hasChanges) {
            await fs.writeFile(
                filePath,
                JSON.stringify(tickers, null, 4),
                'utf-8'
            );
            console.log(`  -> Saved changes to ${path.basename(filePath)}`);
        } else {
            console.log(
                `  -> No changes needed for ${path.basename(filePath)}`
            );
        }
    } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
    }
}

async function main() {
    console.log('--- Starting to Sync Ticker Status (IPO Date & Upcoming) ---');
    const files = (await fs.readdir(NAV_SOURCE_DIR)).filter((f) =>
        /^[a-z]\.json$/.test(f)
    );

    for (const file of files) {
        await processNavFile(path.join(NAV_SOURCE_DIR, file));
    }

    console.log('\n--- Finished processing all files. ---');
    console.log(
        "Now, please run 'npm run generate-nav' to create the final nav.json with updated status."
    );
}

main();
