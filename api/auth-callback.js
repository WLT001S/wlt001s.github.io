export default async function handler(req, res) {
  // Chỉ accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { code, state } = req.query;
  
  if (!code || !state) {
    return res.status(400).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Lỗi</h1>
          <p>Thiếu authorization code hoặc state</p>
        </body>
      </html>
    `);
  }
  
  const [userId, serverId] = state.split('-');
  
  try {
    // Exchange code for access token
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
    
    if (!tokenData.access_token) {
      throw new Error('No access token received');
    }
    
    // Add user to server
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
    
    // Notify bot server about success/failure (optional)
    if (process.env.BOT_WEBHOOK_URL) {
      await fetch(process.env.BOT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'oauth_result',
          userId,
          serverId,
          success: addMemberResponse.ok
        })
      });
    }
    
    return res.status(200).send(`
      <html>
        <head>
          <title>Discord OAuth2 Success</title>
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; background: #2c2f33; color: white; }
            .success { color: #4CAF50; }
            .container { max-width: 500px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">✅ Thành công!</h1>
            <p>Bạn đã được thêm vào server Discord.</p>
            <p>Có thể đóng trang này và quay lại Discord.</p>
          </div>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('OAuth Error:', error);
    
    // Notify bot server about error (optional)
    if (process.env.BOT_WEBHOOK_URL) {
      await fetch(process.env.BOT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'oauth_result',
          userId,
          serverId,
          success: false,
          error: error.message
        })
      });
    }
    
    return res.status(500).send(`
      <html>
        <head>
          <title>Discord OAuth2 Error</title>
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; background: #2c2f33; color: white; }
            .error { color: #f44336; }
            .container { max-width: 500px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">❌ Lỗi!</h1>
            <p>Có lỗi xảy ra khi thêm vào server.</p>
            <p>Vui lòng thử lại sau.</p>
          </div>
        </body>
      </html>
    `);
  }
}
