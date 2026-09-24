import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GoogleAuthConfig } from './types.js';

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

export class GoogleAuthManager {
  private config: GoogleAuthConfig;
  private cachedUserToken: CachedToken | null = null;
  private cachedSaToken: Map<string, CachedToken> = new Map();

  constructor(config: GoogleAuthConfig = {}) {
    this.config = { ...config };
    if (!this.config.skipAutoDiscovery) {
      this.autoDiscoverCredentials();
    }
  }

  private autoDiscoverCredentials(): void {
    // 1. Auto-discover OAuth2 tokens file
    const candidateTokensPath = [
      this.config.tokensJsonPath,
      resolve(process.cwd(), 'google-oauth-tokens.json'),
    ].filter(Boolean) as string[];

    for (const p of candidateTokensPath) {
      if (existsSync(p)) {
        try {
          const raw = JSON.parse(readFileSync(p, 'utf8'));
          this.config.oauthClientId = this.config.oauthClientId || raw.client_id || process.env.GOOGLE_OAUTH_CLIENT_ID;
          this.config.oauthClientSecret = this.config.oauthClientSecret || raw.client_secret || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
          this.config.oauthRefreshToken = this.config.oauthRefreshToken || raw.refresh_token || process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
          break;
        } catch {}
      }
    }

    // Fallback to process.env if not set
    this.config.oauthClientId = this.config.oauthClientId || process.env.GOOGLE_OAUTH_CLIENT_ID;
    this.config.oauthClientSecret = this.config.oauthClientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    this.config.oauthRefreshToken = this.config.oauthRefreshToken || process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

    // 2. Auto-discover Service Account JSON
    const candidateSaPaths = [
      this.config.jsonKeyPath,
      resolve(process.cwd(), 'service-account.json'),
      resolve(process.cwd(), 'alsaada-smart-bot-key.json'),
    ].filter(Boolean) as string[];

    for (const p of candidateSaPaths) {
      if (existsSync(p)) {
        try {
          const raw = JSON.parse(readFileSync(p, 'utf8'));
          this.config.serviceAccountEmail = this.config.serviceAccountEmail || raw.client_email;
          this.config.privateKey = this.config.privateKey || raw.private_key;
          break;
        } catch {}
      }
    }

    this.config.serviceAccountEmail =
      this.config.serviceAccountEmail ||
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      process.env.GDRIVE_SERVICE_ACCOUNT_EMAIL;
    this.config.privateKey =
      this.config.privateKey ||
      process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') ||
      process.env.GDRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    this.config.driveFolderId =
      this.config.driveFolderId ||
      process.env.GOOGLE_DRIVE_FOLDER_ID ||
      process.env.GDRIVE_FOLDER_ID ||
      '1PQYOWNDH5aG93lm9OY2C2UfDd-YGnbbR';

    this.config.sheetsSpreadsheetId =
      this.config.sheetsSpreadsheetId ||
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
      '1zhWF8d9KocbfxYiMrtu38-SEp-D82uaLIpJajXD5NLw';
  }

  getDriveFolderId(): string {
    return this.config.driveFolderId || '1PQYOWNDH5aG93lm9OY2C2UfDd-YGnbbR';
  }

  getSheetsSpreadsheetId(): string {
    return this.config.sheetsSpreadsheetId || '1zhWF8d9KocbfxYiMrtu38-SEp-D82uaLIpJajXD5NLw';
  }

  /**
   * Derives an OAuth2 user access token using the refresh_token.
   * Auto-refreshes if token is missing or expiring within 60 seconds.
   */
  async getUserAccessToken(): Promise<string | null> {
    const now = Date.now();
    if (this.cachedUserToken && this.cachedUserToken.expiresAtMs > now + 60000) {
      return this.cachedUserToken.token;
    }

    const { oauthClientId, oauthClientSecret, oauthRefreshToken } = this.config;
    if (!oauthClientId || !oauthClientSecret || !oauthRefreshToken) {
      return null;
    }

    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: oauthClientId,
          client_secret: oauthClientSecret,
          refresh_token: oauthRefreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!data.access_token) return null;

      const expiresIn = data.expires_in ?? 3600;
      this.cachedUserToken = {
        token: data.access_token,
        expiresAtMs: now + expiresIn * 1000,
      };

      return data.access_token;
    } catch {
      return null;
    }
  }

  /**
   * Derives an access token using Service Account JWT assertion.
   */
  async getServiceAccountAccessToken(
    scope = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets'
  ): Promise<string | null> {
    const now = Date.now();
    const cached = this.cachedSaToken.get(scope);
    if (cached && cached.expiresAtMs > now + 60000) {
      return cached.token;
    }

    const { serviceAccountEmail, privateKey } = this.config;
    if (!serviceAccountEmail || !privateKey || privateKey.length < 20) {
      return null;
    }

    try {
      const nowSec = Math.floor(now / 1000);
      const header = { alg: 'RS256', typ: 'JWT' };
      const claimSet = {
        iss: serviceAccountEmail,
        scope,
        aud: 'https://oauth2.googleapis.com/token',
        exp: nowSec + 3600,
        iat: nowSec,
      };

      const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
      const base64Claim = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
      const signatureInput = `${base64Header}.${base64Claim}`;

      const sign = createSign('RSA-SHA256');
      sign.update(signatureInput);
      sign.end();
      const signature = sign.sign(privateKey, 'base64url');
      const jwt = `${signatureInput}.${signature}`;

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!data.access_token) return null;

      const expiresIn = data.expires_in ?? 3600;
      this.cachedSaToken.set(scope, {
        token: data.access_token,
        expiresAtMs: now + expiresIn * 1000,
      });

      return data.access_token;
    } catch {
      return null;
    }
  }

  /**
   * Resolves the best token for Google Drive operations:
   * 1. User OAuth token (preferred: can create files under personal quota).
   * 2. Service account token (fallback: read/update existing shared files).
   */
  async getDriveAccessToken(): Promise<string | null> {
    const userToken = await this.getUserAccessToken();
    if (userToken) return userToken;
    return this.getServiceAccountAccessToken('https://www.googleapis.com/auth/drive');
  }

  /**
   * Resolves the best token for Google Sheets operations.
   */
  async getSheetsAccessToken(): Promise<string | null> {
    const saToken = await this.getServiceAccountAccessToken('https://www.googleapis.com/auth/spreadsheets');
    if (saToken) return saToken;
    return this.getUserAccessToken();
  }
}

export const googleAuthManager = new GoogleAuthManager();
