/**
 * Configuration module
 * Loads environment variables and provides configuration
 */

import { config as loadDotenv } from 'dotenv';

// Load .env file
loadDotenv();

export interface Config {
  fecApiKey?: string;
  fecApiBaseUrl: string;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export function loadConfig(): Config {
  const apiKey = process.env.FEC_API_KEY?.trim();

  return {
    fecApiKey: apiKey ? apiKey : undefined,
    fecApiBaseUrl: getOptionalEnv('FEC_API_BASE_URL', 'https://api.open.fec.gov/v1'),
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
