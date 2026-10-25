/**
 * iMusic-server 主程式進入點
 * 1. 讀取設定 → 2. 準備 Music 目錄與 SSL 憑證 → 3. 組裝 Express → 4. 啟動 HTTPS 伺服器
 *
 * 路由總覽:
 *   /        靜態網頁(public/)
 *   /api/*   網頁用 REST API(列表/串流/下載/上傳/刪除)
 *   /dav/*   WebDAV(給 WebDAV 用戶端)
 */

import express, { type Express, type Request, type Response } from 'express';
import { loadConfig } from './config';
import { mkdirSync } from 'fs';


const app: Express = express();
const config = loadConfig();
mkdirSync(config.musicDir, { recursive: true });



app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

const localUrl = `http://localhost:3000`;
app.listen(3000, () => {
  console.log(`⚡️[server]: Server is running at ${localUrl}`);
});
