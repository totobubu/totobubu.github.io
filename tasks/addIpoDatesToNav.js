// tasks\addIpoDatesToNav.js
import fs from 'fs/promises';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

// 라이브러리 유효성 검사 비활성화
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
        // 일부러 에러 로그를 숨겨서, 'upcoming'으로 처리될 때 터미널이 지저분해지는 것을 방지
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
            // 1. 이미 유효한 ipoDate가 있으면 건너뜀
            if (ticker.ipoDate) {
                continue;
            }

            // 2. ipoDate가 없는 경우, API를 통해 조회 시도
            const ipoDate = await getFirstTradeDate(ticker.symbol);
            await delay(200); // API 호출 간 지연

            if (ipoDate) {
                // 3-A. [승격] ipoDate를 찾았을 경우
                ticker.ipoDate = ipoDate;
                // 이전에 'upcoming' 이었다면 제거
                if (ticker.upcoming) {
                    delete ticker.upcoming;
                }
                hasChanges = true;
                console.log(
                    `  ✅ [PROMOTED] ${ticker.symbol}: Set ipoDate to ${ipoDate}`
                );
            } else {
                // 3-B. [신규/미정] ipoDate를 찾지 못했을 경우
                // 아직 'upcoming'으로 표시되지 않았다면 추가
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
