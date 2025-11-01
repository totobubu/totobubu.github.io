// api/parsePdfTransaction.js
/**
 * 증권사 거래내역서 PDF 파싱 API
 * 
 * 지원 증권사:
 * - 토스증권 (toss)
 */

import formidable from 'formidable';
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    try {
        // formidable을 사용하여 파일 파싱
        const form = formidable({
            maxFileSize: 10 * 1024 * 1024, // 10MB
            keepExtensions: true,
        });

        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                else resolve([fields, files]);
            });
        });

        const file = files.file?.[0];
        const brokerage = fields.brokerage?.[0];

        if (!file) {
            return res.status(400).json({ error: '파일이 없습니다.' });
        }

        if (!brokerage) {
            return res.status(400).json({ error: '증권사 정보가 없습니다.' });
        }

        // 증권사별 파싱 처리
        let result;
        switch (brokerage) {
            case 'toss':
                result = await parseTossPdf(file.filepath);
                break;
            default:
                return res.status(400).json({ error: '지원하지 않는 증권사입니다.' });
        }

        // 임시 파일 삭제
        fs.unlinkSync(file.filepath);

        return res.status(200).json(result);
    } catch (error) {
        console.error('PDF 파싱 오류:', error);
        return res.status(500).json({ 
            error: 'PDF 파싱에 실패했습니다.',
            details: error.message 
        });
    }
}

/**
 * 토스증권 PDF 파싱
 */
async function parseTossPdf(filePath) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(process.cwd(), 'scripts', 'extract_toss_transactions.py');
        
        // Python 스크립트 실행
        const pythonProcess = spawn('python', [scriptPath, filePath]);
        
        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('Python 스크립트 오류:', stderr);
                reject(new Error(stderr || 'Python 스크립트 실행 실패'));
                return;
            }

            try {
                // JSON 출력 파싱
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (error) {
                console.error('JSON 파싱 오류:', error);
                reject(new Error('결과 파싱 실패'));
            }
        });
    });
}

