import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM에서는 __dirname을 직접 사용할 수 없으므로, 아래와 같이 경로를 설정합니다.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const navDir = path.join(__dirname, 'public', 'nav'); // nav 폴더 경로
const outputFile = path.join(__dirname, 'public', 'nav.json'); // 출력 파일 경로

function generateNavJson() {
    let allTickers = [];
    const files = fs.readdirSync(navDir); // nav 폴더 내 파일 목록 읽기

    for (const file of files) {
        if (path.extname(file) === '.json') {
            const filePath = path.join(navDir, file); // 파일 경로
            try {
                const data = fs.readFileSync(filePath, 'utf8'); // 파일 내용 읽기
                const tickers = JSON.parse(data); // JSON 파싱
                if (Array.isArray(tickers)) {
                    allTickers = allTickers.concat(tickers); // 티커 목록에 추가
                } else {
                    console.warn(`[${file}] 파일이 배열 형태가 아닙니다.`);
                }
            } catch (error) {
                console.error(`[${file}] 파일 읽기 오류: ${error}`);
            }
        }
    }

    // 티커 심볼 기준으로 정렬
    allTickers.sort((a, b) => a.symbol.localeCompare(b.symbol));

    // 최종 nav.json 파일 생성 (4칸 들여쓰기 적용)
    const navJson = JSON.stringify({ nav: allTickers }, null, 4);
    fs.writeFileSync(outputFile, navJson, 'utf8');

    console.log('✅ nav.json 파일 생성 완료!');
}

generateNavJson();