import { execSync } from 'child_process';

// 커맨드라인 인자로 파일 패턴 받기
const pattern = process.argv[2] || 'public/data/**/*.json';

// glob 패턴을 정규식으로 변환
function patternToRegex(pattern) {
    // ** 를 임시 토큰으로 변환
    let regexStr = pattern.replace(/\*\*/g, '{{RECURSIVE}}');
    // * 를 [^/]* 로 변환 (경로 구분자 제외)
    regexStr = regexStr.replace(/\*/g, '[^/]*');
    // {{RECURSIVE}} 를 .* 로 변환
    regexStr = regexStr.replace(/\{\{RECURSIVE\}\}/g, '.*');

    return new RegExp('^' + regexStr + '$');
}

try {
    // Git에서 수정된 모든 파일 목록 가져오기
    const allModifiedFiles = execSync('git ls-files -m', {
        encoding: 'utf8',
    }).trim();

    if (!allModifiedFiles) {
        console.log(`No modified files found.`);
        process.exit(0);
    }

    // 패턴을 정규식으로 변환
    const regex = patternToRegex(pattern);

    // 패턴에 맞는 파일만 필터링
    const matchedFiles = allModifiedFiles
        .split('\n')
        .filter((f) => f.trim())
        .filter((f) => regex.test(f));

    if (matchedFiles.length > 0) {
        const fileList = matchedFiles.join(' ');
        console.log(
            `Formatting ${matchedFiles.length} modified file(s) matching "${pattern}"...`
        );

        // Prettier로 포맷팅 실행
        execSync(`prettier --write ${fileList}`, { stdio: 'inherit' });

        console.log('Formatting complete!');
    } else {
        console.log(`No modified files found matching "${pattern}"`);
    }
} catch (error) {
    console.error('Error formatting files:', error.message);
    process.exit(1);
}
