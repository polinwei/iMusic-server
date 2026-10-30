/**
 * HTTP Basic 驗證中介層
 * - 網頁(瀏覽器會跳出登入視窗)與 WebDAV 用戶端都能使用
 * - 因為上傳/刪除具有破壞性,預設啟用;可在 config.json 關閉
 * - 使用雜湊後再做 timingSafeEqual,避免時序攻擊
 */
import { createHash, timingSafeEqual } from 'crypto'; // 雜湊與時序安全比較
import type { RequestHandler } from 'express';        // express 的 request handler 型別
import { AuthConfig } from '@/config';                // 讀取設定檔的型別

function safeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest(); // 將字串雜湊成 SHA-256 後再比較,避免時序攻擊
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB); // 使用 timingSafeEqual 做時序安全比較,避免時序攻擊
}

/** 建立 HTTP Basic 驗證中介層 */
export function basicAuth(authConfig: AuthConfig): RequestHandler {
  return (req, res, next) => {
    if (!authConfig.enabled) {
      next(); // 若未啟用驗證,直接放行
      return;
    }
    const header = req.headers.authorization;
    if ( header?.startsWith('Basic ') === true ) {
      // 解析 Basic 認證
      const base64Credentials = header.slice(6); // 去掉 "Basic "
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8'); // 解碼成 "username:password"
      const [username, password] = credentials.split(':');  // 分割成使用者名稱與密碼

      // 驗證使用者名稱和密碼
      if (safeEqual(username ?? '', authConfig.username) && safeEqual(password ?? '', authConfig.password)) {
        next(); // 驗證成功,放行
        return;
      }
    }

    res
    .set('WWW-Authenticate', 'Basic realm="iMusic-server", charset="UTF-8"')
    .status(401).json({ error: '未授權的訪問' });
  }
}
