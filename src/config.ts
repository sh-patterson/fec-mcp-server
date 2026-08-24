/**
 * Configuration module
 * Loads environment variables and provides configuration
 */

import { config as loadDotenv } from 'dotenv';

// Load .env file
loadDotenv();

export const DEFAULT_FEC_API_BASE_URL = 'https://api.open.fec.gov/v1';

export interface Config {
  fecApiKey?: string;
  fecApiBaseUrl: string;
  fecApiTimeoutMs?: number;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/**
 * Only official OpenFEC HTTPS hosts (or local mocks) may receive the API key.
 */
export function isAllowedFecApiBaseUrl(baseUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return false;
  }

  if (parsed.username || parsed.password) {
    return false;
  }

  const path = parsed.pathname.replace(/\/+$/, '') || '/';

  if (parsed.protocol === 'https:') {
    const allowedHosts = new Set(['api.open.fec.gov', 'api-stage.open.fec.gov']);
    return allowedHosts.has(parsed.hostname) && path === '/v1';
  }

  if (parsed.protocol === 'http:') {
    return (
      (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') &&
      path.length > 0
    );
  }

  return false;
}

function resolveFecApiBaseUrl(): string {
  const raw = process.env.FEC_API_BASE_URL?.trim();
  if (!raw) {
    return DEFAULT_FEC_API_BASE_URL;
  }

  const normalized = normalizeBaseUrl(raw);
  if (!isAllowedFecApiBaseUrl(normalized)) {
    throw new Error(
      'FEC_API_BASE_URL must be https://api.open.fec.gov/v1 (or api-stage) or an http://localhost mock URL.'
    );
  }

  return normalized;
}

export function loadConfig(): Config {
  const apiKey = process.env.FEC_API_KEY?.trim();

  const timeoutStr = process.env.FEC_API_TIMEOUT_MS?.trim();
  const timeoutMs = timeoutStr ? Number.parseInt(timeoutStr, 10) : undefined;

  return {
    fecApiKey: apiKey ? apiKey : undefined,
    fecApiBaseUrl: resolveFecApiBaseUrl(),
    fecApiTimeoutMs: timeoutMs && !Number.isNaN(timeoutMs) ? timeoutMs : undefined,
  };
}

// Singleton config instance
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

// For testing - allows resetting the config
export function resetConfig(): void {
  configInstance = null;
}
