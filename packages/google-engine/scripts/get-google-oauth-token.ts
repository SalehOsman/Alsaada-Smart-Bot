import http from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Discover credentials from environment or .env file
function getEnvCredentials(): { clientId: string; clientSecret: string } {
  let clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
  let clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('GOOGLE_OAUTH_CLIENT_ID=')) {
          clientId = clientId || trimmed.replace('GOOGLE_OAUTH_CLIENT_ID=', '').trim().replace(/^["']|["']$/g, '');
        }
        if (trimmed.startsWith('GOOGLE_OAUTH_CLIENT_SECRET=')) {
          clientSecret = clientSecret || trimmed.replace('GOOGLE_OAUTH_CLIENT_SECRET=', '').trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch {}
  }

  return { clientId, clientSecret };
}

const { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET } = getEnvCredentials();
const PORT = 8085;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
].join(' ');

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Error: GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in .env');
    process.exit(1);
  }

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
    }).toString();

  console.log('\n================================================================');
  console.log('🔗 GOOGLE DRIVE OAUTH2 AUTHORIZATION');
  console.log('================================================================');
  console.log('\nPlease open this URL in your browser to authorize Al-Saada Smart Bot:');
  console.log('\n' + authUrl + '\n');
  console.log('Waiting for authorization callback on http://localhost:' + PORT + ' ...');
  console.log('================================================================\n');

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://localhost:${PORT}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>❌ Authorization Failed</h1><p>${error}</p>`);
        server.close();
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #10b981;">✅ تم ربط وتفويض Google Drive بنجاح!</h1>
            <p>تم استلام الرمز بنجاح. يمكنك إغلاق هذه الصفحة الآن والعودة للطرفية.</p>
          </div>
        `);

        console.log('✅ Received authorization code! Exchanging for tokens...');

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          console.error('❌ Token exchange failed:', errText);
          server.close();
          process.exit(1);
        }

        const tokenData = (await tokenRes.json()) as any;
        console.log('🎉 Tokens received successfully!');

        // Save tokens securely to google-oauth-tokens.json
        const tokenFilePath = resolve(process.cwd(), 'google-oauth-tokens.json');
        writeFileSync(
          tokenFilePath,
          JSON.stringify(
            {
              client_id: CLIENT_ID,
              client_secret: CLIENT_SECRET,
              refresh_token: tokenData.refresh_token,
              access_token: tokenData.access_token,
              token_type: tokenData.token_type,
              expires_in: tokenData.expires_in,
              scope: tokenData.scope,
              created_at: new Date().toISOString(),
            },
            null,
            2
          )
        );
        console.log(`💾 Saved permanent credentials to: ${tokenFilePath}`);

        // Update .env
        const envPath = resolve(process.cwd(), '.env');
        if (existsSync(envPath)) {
          let envContent = readFileSync(envPath, 'utf8');
          if (!envContent.includes('GOOGLE_OAUTH_REFRESH_TOKEN')) {
            envContent += `\n# Google Drive OAuth2 User Credentials\nGOOGLE_OAUTH_CLIENT_ID=${CLIENT_ID}\nGOOGLE_OAUTH_CLIENT_SECRET=${CLIENT_SECRET}\nGOOGLE_OAUTH_REFRESH_TOKEN=${tokenData.refresh_token}\n`;
            writeFileSync(envPath, envContent);
            console.log('💾 Appended OAuth credentials to .env file');
          }
        }

        server.close();
        console.log('\n🚀 Starting immediate Google Drive upload probe...');
        await runUploadTest(tokenData.access_token);
        process.exit(0);
      }
    } catch (err) {
      console.error('Callback error:', err);
      server.close();
      process.exit(1);
    }
  });

  server.listen(PORT);
}

async function runUploadTest(accessToken: string) {
  const folderId = '1PQYOWNDH5aG93lm9OY2C2UfDd-YGnbbR';
  const fileName = `alsaada-probe-${Date.now()}.txt`;
  const fileContent = `Al-Saada Smart Bot Enterprise Storage Probe\nUploaded at: ${new Date().toISOString()}\nTarget Folder: ${folderId}`;

  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const boundary = '-------AlsaadaProbeBoundary' + Date.now();
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\n`
    ),
    Buffer.from(fileContent),
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('❌ Upload Test Failed:', res.status, errText);
    return;
  }

  const data = (await res.json()) as any;
  console.log('\n================================================================');
  console.log('🎉 GOOGLE DRIVE FILE UPLOAD VERIFIED 100% OPERATIONAL!');
  console.log('================================================================');
  console.log('📁 File ID:', data.id);
  console.log('📄 File Name:', data.name);
  console.log('📂 Parent Folder ID:', folderId);
  console.log('================================================================\n');
}

main().catch(console.error);
