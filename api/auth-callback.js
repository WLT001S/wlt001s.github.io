export default async function handler(req, res) {
    const { code, state } = req.query;

    if (!code || !state) {
        return res.status(400).send('Thiếu authorization code hoặc state');
    }

    const [userId, serverId] = state.split('-');

    try {
        // Exchange authorization code lấy access token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: process.env.REDIRECT_URI,
                scope: 'guilds.join'
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            throw new Error(tokenData.error_description || tokenData.error || 'Không lấy được access token');
        }

        // Thêm user vào server
        const addResponse = await fetch(`https://discord.com/api/v10/guilds/${serverId}/members/${userId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bot ${process.env.BOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ access_token: tokenData.access_token })
        });

        if (!addResponse.ok) {
            const errData = await addResponse.json();
            throw new Error(errData.message || 'Lỗi thêm user vào server');
        }

        // (Tuỳ chọn) Thông báo bot-hosting về kết quả (có thể bỏ qua)
        if (process.env.BOT_WEBHOOK_URL) {
            await fetch(process.env.BOT_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'oauth_result', userId, serverId, success: true })
            });
        }

        res.status(200).send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:3em;">
            <h1>✅ Thêm vào server thành công!</h1>
            <p>Bạn có thể đóng trang này và quay lại Discord.</p>
            </body></html>
        `);
    } catch (error) {
        console.error('OAuth Callback Error:', error);
        res.status(500).send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:3em;">
            <h1>❌ Lỗi khi thêm vào server</h1>
            <p>${error.message}</p>
            </body></html>
        `);
    }
}
