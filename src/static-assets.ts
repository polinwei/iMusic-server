/**
 * exe 模式的靜態網頁伺服:
 * 打包時 public/ 內的檔案會被嵌入 exe(SEA assets),執行時用 getAsset 讀出。
 * (開發模式仍使用 express.static 直接讀 public/ 資料夾)
 */
import { extname } from 'path'; // 取得副檔名
import { getAsset } from 'node:sea'; // 讀取 exe 內嵌的靜態資源
import type { RequestHandler } from 'express'; // express 的 request handler 型別

// 定義 MIME 類型對應表
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html ; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

// 建立處理內嵌靜態資源的 middleware
export function embeddedStatic(): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next(); // 只處理 GET 與 HEAD 請求,其他交給下一個 middleware
      return;
    }
    const name = req.path === '/' ? '/index.html' : req.path.slice(1); // 去掉開頭的 '/'
    let data: ArrayBuffer | undefined;
    try {
      data = getAsset(`public/${name}`); // 從 exe 內嵌資源讀取檔案
    } catch (err) {
      next(err); // 找不到內嵌資源, 交給後面的處理(最後會是404)
      return;
    }
    res.set('Content-Type', MIME_TYPES[extname(name)] ?? 'application/octet-stream'); // 設定 Content-Type
    res.send(Buffer.from(data));  // 傳送檔案內容
  };
}
