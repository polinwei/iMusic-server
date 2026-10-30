/**
 * iMusic-server 主程式進入點
 * 1. 讀取設定 → 2. 準備 Music 目錄與 SSL 憑證 → 3. 組裝 Express → 4. 啟動 HTTPS 伺服器
 *
 * 路由總覽:
 *   /        靜態網頁(public/)
 *   /api/*   網頁用 REST API(列表/串流/下載/上傳/刪除)
 *   /dav/*   WebDAV(給 WebDAV 用戶端)
 */

import express, { type Express, type Request, type Response, type ErrorRequestHandler } from 'express'; // Express 框架
import { isPackaged ,loadConfig } from './config';// 讀取設定檔
import { mkdirSync } from 'fs';                   //  建立目錄
import { join } from 'path';                      // 取得路徑
import { embeddedStatic } from './middlewares/static-assets'; // 內嵌靜態網頁資源
import { createWebRouter } from './routes/web';    // 建立 Web 路由
import { getLocalIPs } from './network'; // 取得本機區域網路的 IPv4 位址
import { basicAuth } from '@/middlewares/auth'; // HTTP Basic 驗證中介層

/** 開發模式的網頁資源位置(exe 模式的網頁已嵌入執行檔內,見 static-assets.ts) */
const webRoot = join(__dirname, '..' ,'public');

const errorHandler: ErrorRequestHandler = (err: unknown, req: Request, res: Response, next) => {
  console.error('請求處理錯誤:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: '伺服器內部錯誤' });
  } else {
    next(err);
  }
}

async function main(): Promise<void> {
  const config = loadConfig(); // 讀取設定檔,若不存在則建立預設值
  mkdirSync(config.musicDir, { recursive: true });

  const app: Express = express(); // 建立 Express 應用程式
  app.disable('x-powered-by');    // 移除 Express 預設的 X-Powered-By 標頭,避免洩漏資訊
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff'); // 防止瀏覽器 MIME 類型嗅探,強制使用 Content-Type 標頭指定的類型
    next();
  });

  app.use(basicAuth(config.auth)); // HTTP Basic 驗證
  app.use(createWebRouter()); // Web 路由
  app.use(isPackaged ? embeddedStatic() : express.static(webRoot)); // 靜態網頁資源
  app.use(errorHandler); // 全域錯誤處理 middleware

  // 啟動伺服器
  await new Promise<void>((resolve, reject) => {
    app.once('error', reject); // 例如連接埠被占用 (EADDRINUSE)
    app.listen(config.port, config.host);
    resolve();
  });

  const localUrl = `http://localhost:${String(config.port)}`;
  console.log('========================================');
  console.log(' iMusic-server 已啟動');
  console.log(` 音樂目錄:${config.musicDir}`);
  console.log(` 網頁:    ${localUrl}`);
  console.log(` 測試網頁:${localUrl}/test`);
  for (const ip of getLocalIPs()) {
    console.log(` 局域網:  http://${ip}:${String(config.port)}`);
  }
  console.log('========================================');
}

// 執行主程式後,若發生錯誤則輸出訊息並延遲退出,避免雙擊執行時視窗瞬間關閉而看不到錯誤訊息
main().catch((error:unknown) => {
  console.error('應用程式執行錯誤:', error);
  console.error('請關閉此視窗,修正問題後再重新執行。');
  // 保持系統執行存活一段時間,避免雙擊執行時視窗瞬間關閉而看不到錯誤訊息
  setTimeout(() => process.exit(1), 10000);
});
