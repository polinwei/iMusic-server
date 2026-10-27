/**
 * 設定檔模組
 * - 執行 .exe 時,設定檔、Music 目錄、憑證都放在「exe 所在資料夾」
 * - 開發模式則放在專案根目錄(目前工作目錄)
 * - 第一次執行若找不到 config.json,會自動產生預設值
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';
import { isSea } from 'node:sea';

/** 建立WebDAV 認證設定: AuthConfig 物件 */
export interface AuthConfig {
  enabled: boolean;
  username: string;
  password: string;
}

/** 建立 AppConfig 物件  */
export interface AppConfig {
  host: string;
  port: number;
  musicDir: string; // 音樂目錄, 已轉成絕對路徑
  certDir: string;  // 憑證目錄, 已轉成絕對路徑
  openBrowser: boolean; // 啟動時自動開啟瀏覽器
  auth: AuthConfig; // WebDAV 認證設定
}
/** 是否為 Node SEA 封裝後的 exe(單一執行檔應用程式) */
export const isPackaged = isSea();

/** 資料根目錄: 執行檔 exe 所在位置或專案目錄 */
export const baseDir = isPackaged ? dirname(process.execPath) : process.cwd();

/** 應用程式運行的預設值 */
const DEFAULTS = {
  host: '0.0.0.0',
  port: 8443,
  musicDir: 'Music',
  certDir: 'certs',
  openBrowser: true,
  auth: {
    enabled: true,
    username: 'admin',
    password: 'admin',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(obj: Record<string, unknown>, key: string, fallback: string): string {
  const value = obj[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function pickNumber(obj: Record<string, unknown>, key: string, fallback: number): number {
  const value = obj[key];
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function pickBoolean(obj: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = obj[key];
  return typeof value === 'boolean' ? value : fallback;
}

function toAbsolute(path: string): string {
  return isAbsolute(path) ? path : resolve(baseDir, path);
}

/** 讀取設定檔 */
export function loadConfig(): AppConfig {
  const configPath = join(baseDir, 'config.json');
  if (!existsSync(configPath)) {
    // 若不存在設定檔,則建立預設值
    writeFileSync(configPath, `${JSON.stringify(DEFAULTS, null, 2)}\n`, 'utf-8');
    console.log(`⚡️[config]已建立預設設定檔: config.json not found. Created default config at ${configPath}`);
    return DEFAULTS;
  }

  const parsed: unknown = JSON.parse(readFileSync(configPath, 'utf-8'));
  const raw = isRecord(parsed) ? parsed : {};
  const rawAuth = isRecord(raw.auth) ? raw.auth : {};

  return {
    host: pickString(raw, 'host', DEFAULTS.host),
    port: pickNumber(raw, 'port', DEFAULTS.port),
    musicDir: toAbsolute(pickString(raw, 'musicDir', DEFAULTS.musicDir)),
    certDir: toAbsolute(pickString(raw, 'certDir', DEFAULTS.certDir)),
    openBrowser: pickBoolean(raw, 'openBrowser', DEFAULTS.openBrowser),
    auth: {
      enabled: pickBoolean(rawAuth, 'enabled', DEFAULTS.auth.enabled),
      username: pickString(rawAuth, 'username', DEFAULTS.auth.username),
      password: pickString(rawAuth, 'password', DEFAULTS.auth.password),
    },
  };

}
