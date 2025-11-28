/**
 * Calendar Events 데이터를 월별로 분할하는 스크립트
 *
 * 기존: calendar-events.json (24.8MB) 단일 파일
 * 개선: calendar/{year}/{month}.json 형태로 분산
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const INPUT_FILE = 'public/calendar-events.json';
const OUTPUT_DIR = 'public/calendar/monthly';

console.log('📅 Calendar 데이터 월별 분할 시작...\n');

// 출력 디렉토리 생성
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`✓ 디렉토리 생성: ${OUTPUT_DIR}`);
}

// 원본 데이터 로드
console.log(`📂 로딩: ${INPUT_FILE}`);
const rawData = readFileSync(INPUT_FILE, 'utf-8');
const allEvents = JSON.parse(rawData);
console.log(`✓ ${Object.keys(allEvents).length}개 날짜 로드 완료\n`);

// 월별로 그룹화
const monthlyData = {};
let totalDates = 0;

for (const [dateStr, events] of Object.entries(allEvents)) {
  // dateStr 형식: "YYYY-MM-DD"
  const [year, month] = dateStr.split('-');
  const yearMonth = `${year}-${month}`;

  if (!monthlyData[yearMonth]) {
    monthlyData[yearMonth] = {};
  }

  monthlyData[yearMonth][dateStr] = events;
  totalDates++;
}

console.log(`📊 ${Object.keys(monthlyData).length}개 월로 분할됨`);
console.log(`📊 총 ${totalDates}개 날짜\n`);

// 월별 파일 생성
let filesCreated = 0;
let totalSize = 0;

for (const [yearMonth, events] of Object.entries(monthlyData)) {
  const [year, month] = yearMonth.split('-');
  const yearDir = path.join(OUTPUT_DIR, year);

  // 연도 디렉토리 생성
  if (!existsSync(yearDir)) {
    mkdirSync(yearDir, { recursive: true });
  }

  // 월별 파일 작성
  const filePath = path.join(yearDir, `${month}.json`);
  const content = JSON.stringify(events, null, 2);
  writeFileSync(filePath, content, 'utf-8');

  const fileSize = Buffer.byteLength(content, 'utf-8');
  totalSize += fileSize;
  filesCreated++;

  const sizeKB = (fileSize / 1024).toFixed(2);
  console.log(`✓ ${yearMonth}: ${sizeKB} KB (${Object.keys(events).length}개 날짜)`);
}

console.log(`\n✅ 완료!`);
console.log(`📁 생성된 파일: ${filesCreated}개`);
console.log(`📦 총 크기: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`📂 위치: ${OUTPUT_DIR}`);

// 메타데이터 파일 생성 (빠른 조회용)
const metadata = {
  totalMonths: Object.keys(monthlyData).length,
  totalDates: totalDates,
  dateRange: {
    start: Object.keys(allEvents)[0],
    end: Object.keys(allEvents)[Object.keys(allEvents).length - 1]
  },
  months: Object.keys(monthlyData).sort()
};

const metadataPath = path.join(OUTPUT_DIR, 'metadata.json');
writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
console.log(`\n✓ 메타데이터 생성: ${metadataPath}`);
