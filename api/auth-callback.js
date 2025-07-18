export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { code, state } = req.query;
    
    // Debug logging
    console.log('=== OAuth2 Debug ===');
    console.log('Code:', code ? 'Present' : 'Missing');
    console.log('State:', state ? 'Present' : 'Missing');
    console.log('Environment check:', {
        BOT_TOKEN: !!process.env.BOT_TOKEN,
        CLIENT_ID: !!process.env.CLIENT_ID,
        CLIENT_SECRET: !!process.env.CLIENT_SECRET
    });
    
    if (!code || !state) {
        return res.status(400).send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px; background: #2c2f33; color: white;">
                    <h1>❌ Lỗi Parameters</h1>
                    <p>Code: ${code || 'MISSING'}</p>
                    <p>State: ${state || 'MISSING'}</p>
                </body>
            </html>
        `);
    }
    
    // Validate environment variables
    if (!process.env.BOT_TOKEN || !process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
        console.error('Missing environment variables');
        return res.status(500).send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px; background: #2c2f33; color: white;">
                    <h1>❌ Lỗi Cấu Hình</h1>
                    <p>Server thiếu environment variables</p>
                </body>
            </html>
        `);
    }
    
    const [userId, serverId] = state.split('-');
    
    try {
        // Step 1: Exchange code for access token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.REDIRECT_URI,
                scope: 'guilds.join'
            })
        });
        
        const tokenData = await tokenResponse.json();
        console.log('Token response status:', tokenResponse.status);
        
        if (!tokenData.access_token) {
            console.error('Token error:', tokenData);
            throw new Error(`Token exchange failed: ${tokenData.error_description || tokenData.error}`);
        }
        
        // Step 2: Add user to server
        const addMemberResponse = await fetch(`https://discord.com/api/v10/guilds/${serverId}/members/${userId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bot ${process.env.BOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                access_token: tokenData.access_token
            })
        });
        
        console.log('Add member response status:', addMemberResponse.status);
        
        if (!addMemberResponse.ok) {
            const errorData = await addMemberResponse.json();
            console.error('Add member error:', errorData);
            
            let errorMessage = 'Có lỗi xảy ra khi thêm vào server';
            
            switch (addMemberResponse.status) {
                case 403:
                    errorMessage = 'Bot không có quyền thêm member vào server này';
                    break;
                case 404:
                    errorMessage = 'Server không tồn tại hoặc bot chưa được thêm vào server';
                    break;
                case 400:
                    if (errorData.code === 40007) {
                        errorMessage = 'User đã có trong server rồi';
                    } else {
                        errorMessage = `Lỗi request: ${errorData.message}`;
                    }
                    break;
                default:
                    errorMessage = `Lỗi Discord API: ${errorData.message || 'Unknown error'}`;
            }
            
            throw new Error(errorMessage);
        }
        
        return res.status(200).send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px; background: #2c2f33; color: white;">
                    <h1 style="color: #4CAF50;">✅ Thành công!</h1>
                    <p>User đã được thêm vào server Discord.</p>
                    <p>Có thể đóng trang này và quay lại Discord.</p>
                </body>
            </html>
        `);
        
    } catch (error) {
        console.error('OAuth2 Error:', error);
        return res.status(500).send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px; background: #2c2f33; color: white;">
                    <h1 style="color: #f44336;">❌ Lỗi!</h1>
                    <p>${error.message}</p>
                    <p>Vui lòng thử lại sau hoặc liên hệ admin.</p>
                </body>
            </html>
        `);
    }
}
