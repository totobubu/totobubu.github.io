// NEW FILE: api/sendEmail.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'DivGrow 문의 <contact@divgrow.com>',
            to: ['totobubu.lab@gmail.com'],
            subject: `[DivGrow] ${name} 님의 문의`,
            html: `
                <h1>DivGrow 문의하기</h1>
                <p><strong>보낸 사람:</strong> ${name}</p>
                <p><strong>이메일:</strong> ${email}</p>
                <hr>
                <h2>내용:</h2>
                <p>${message.replace(/\n/g, '<br>')}</p>
            `,
        });

        if (error) {
            console.error('Resend API Error:', error);
            return res.status(500).json({ error: '이메일 발송에 실패했습니다.', details: error });
        }

        return res.status(200).json({ message: '이메일이 성공적으로 발송되었습니다.', data });

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: '서버 오류가 발생했습니다.', details: error });
    }
}
