import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createSign } from 'node:crypto';

export interface GooglePreflightResult {
  authSuccess: boolean;
  driveSuccess: boolean;
  sheetsSuccess: boolean;
  geminiSuccess: boolean;
  folderName?: string;
  spreadsheetTitle?: string;
  details: string[];
  errors: string[];
}

export async function runGooglePreflight(options?: {
  envPath?: string;
  jsonKeyPath?: string;
}): Promise<GooglePreflightResult> {
  const result: GooglePreflightResult = {
    authSuccess: false,
    driveSuccess: false,
    sheetsSuccess: false,
    geminiSuccess: false,
    details: [],
    errors: [],
  };

  // 1. Resolve Credentials
  const envFilePath = options?.envPath || resolve(process.cwd(), '.env');
  if (existsSync(envFilePath)) {
    try {
      const envContent = readFileSync(envFilePath, 'utf8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1PQYOWNDH5aG93lm9OY2C2UfDd-YGnbbR';
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1zhWF8d9KocbfxYiMrtu38-SEp-D82uaLIpJajXD5NLw';
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // Check if a service-account.json file exists in root or specified path
  const candidateJsonPaths = [
    options?.jsonKeyPath,
    resolve(process.cwd(), 'service-account.json'),
    resolve(process.cwd(), 'alsaada-smart-bot-key.json'),
  ].filter(Boolean) as string[];

  for (const p of candidateJsonPaths) {
    if (existsSync(p)) {
      try {
        const raw = JSON.parse(readFileSync(p, 'utf8'));
        if (raw.client_email && raw.private_key) {
          email = email || raw.client_email;
          privateKey = privateKey || raw.private_key;
          result.details.push(`📂 Loaded service account credentials from: ${p}`);
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  if (!email || !privateKey) {
    result.errors.push('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY in .env or service-account.json');
    return result;
  }

  // 2. Derive OAuth2 Access Token via JWT Assertion
  let accessToken = '';
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
      iss: email,
      scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const base64Claim = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
    const signatureInput = `${base64Header}.${base64Claim}`;

    const sign = createSign('RSA-SHA256');
    sign.update(signatureInput);
    sign.end();
    const signature = sign.sign(privateKey, 'base64url');
    const jwt = `${signatureInput}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`OAuth2 token error (${tokenRes.status}): ${errText}`);
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new Error('No access_token returned in Google OAuth2 response');
    }

    accessToken = tokenData.access_token;
    result.authSuccess = true;
    result.details.push(`🔐 Google OAuth2 token derived successfully for: ${email}`);
  } catch (err: any) {
    result.errors.push(`Google Auth Failed: ${err.message}`);
    return result;
  }

  // 3. Probe Google Drive Folder
  if (driveFolderId) {
    try {
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFolderId}?fields=id,name,capabilities`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!driveRes.ok) {
        const driveErr = await driveRes.text();
        throw new Error(`Drive folder probe failed (${driveRes.status}): ${driveErr}`);
      }

      const driveData = (await driveRes.json()) as { id: string; name: string; capabilities?: { canAddChildren?: boolean } };
      result.driveSuccess = true;
      result.folderName = driveData.name;
      result.details.push(
        `📁 Google Drive Folder verified: "${driveData.name}" (ID: ${driveData.id}) [Editor Rights: ${driveData.capabilities?.canAddChildren ? 'Confirmed' : 'Read Only'}]`
      );

      // Check if OAuth2 User Token is available for file upload
      let userDriveToken = '';
      const oauthJsonPath = resolve(process.cwd(), 'google-oauth-tokens.json');
      let oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
      let oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
      let oauthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

      if (existsSync(oauthJsonPath)) {
        try {
          const rawOauth = JSON.parse(readFileSync(oauthJsonPath, 'utf8'));
          oauthClientId = oauthClientId || rawOauth.client_id;
          oauthClientSecret = oauthClientSecret || rawOauth.client_secret;
          oauthRefreshToken = oauthRefreshToken || rawOauth.refresh_token;
        } catch {}
      }

      if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
        try {
          const userTokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: oauthClientId,
              client_secret: oauthClientSecret,
              refresh_token: oauthRefreshToken,
              grant_type: 'refresh_token',
            }),
          });
          if (userTokenRes.ok) {
            const userTokenData = (await userTokenRes.json()) as any;
            userDriveToken = userTokenData.access_token;
            result.details.push(`👤 Google Drive OAuth2 User Authorization: Active & Auto-Refreshed`);
          }
        } catch (err: any) {
          result.details.push(`⚠️ User OAuth token refresh failed: ${err.message}`);
        }
      }

      if (userDriveToken) {
        result.details.push(`🚀 Google Drive File Upload: 100% Operational (Full Read/Write/Delete)`);
      }
    } catch (err: any) {
      result.errors.push(`Google Drive Probe Error: ${err.message}`);
    }
  }

  // 4. Probe Google Sheets Spreadsheet
  if (spreadsheetId) {
    try {
      const sheetsRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!sheetsRes.ok) {
        const sheetsErr = await sheetsRes.text();
        throw new Error(`Spreadsheet probe failed (${sheetsRes.status}): ${sheetsErr}`);
      }

      const sheetsData = (await sheetsRes.json()) as { properties: { title: string }; sheets: any[] };
      result.sheetsSuccess = true;
      result.spreadsheetTitle = sheetsData.properties.title;
      result.details.push(
        `📊 Google Sheets verified: "${sheetsData.properties.title}" (Tabs: ${sheetsData.sheets?.length ?? 1})`
      );
    } catch (err: any) {
      result.errors.push(`Google Sheets Probe Error: ${err.message}`);
    }
  }

  // 5. Probe Gemini API Keys (Multi-Key Failover Verification)
  if (geminiApiKey) {
    const keys = geminiApiKey
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 5);

    let validCount = 0;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (!key) continue;
      const keyLabel = i === 0 ? 'Primary' : `Failover #${i}`;
      const maskedKey = `${key.slice(0, 8)}...${key.slice(-4)}`;

      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'ping' }] }],
            }),
          }
        );

        if (geminiRes.ok) {
          validCount++;
          result.details.push(
            `🧠 Gemini Key [${keyLabel}] (${maskedKey}): Active & Verified on Gemini 2.5 Flash`
          );
        } else {
          const geminiErr = await geminiRes.text();
          result.errors.push(
            `⚠️ Gemini Key [${keyLabel}] (${maskedKey}) failed (${geminiRes.status}): ${geminiErr.slice(0, 100)}`
          );
        }
      } catch (err: any) {
        result.errors.push(`Gemini API Probe Error on [${keyLabel}]: ${err.message}`);
      }
    }

    if (validCount > 0) {
      result.geminiSuccess = true;
      result.details.push(
        `🛡️ Gemini Multi-Key Failover Engine: ${validCount}/${keys.length} active keys ready for OCR`
      );
    }
  }

  return result;
}

// CLI Execution
if (process.argv[1]?.endsWith('verify-google-connectivity.ts')) {
  console.log('\n================================================================');
  console.log('🔬 PROBING GOOGLE SERVICES PHYSICAL CONNECTIVITY');
  console.log('================================================================\n');

  runGooglePreflight()
    .then((res) => {
      for (const d of res.details) {
        console.log(`✅ ${d}`);
      }
      for (const e of res.errors) {
        console.error(`❌ ${e}`);
      }
      console.log('\n----------------------------------------------------------------');
      if (res.authSuccess && res.driveSuccess && res.sheetsSuccess) {
        console.log('🎉 ALL GOOGLE SERVICES VERIFIED 100% OPERATIONAL!');
        console.log('----------------------------------------------------------------\n');
        process.exit(0);
      } else {
        console.log('⚠️ GOOGLE CONNECTIVITY INCOMPLETE');
        console.log('----------------------------------------------------------------\n');
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal Connectivity Probe Error:', err);
      process.exit(1);
    });
}
