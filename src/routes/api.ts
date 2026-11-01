/**
 * 使用 express v5
 * REST API(給網頁前端使用),掛載在 /api
 *   GET    /api/music                 列出所有音樂(含子目錄)
 *   GET    /api/music/stream?path=    串流播放(支援 Range,可拖曳進度)
 *   GET    /api/music/download?path=  下載
 *   PUT    /api/music/file?path=      上傳(請求本體即檔案內容,以串流寫入磁碟)
 *   DELETE /api/music/file?path=      刪除
 */
import { createWriteStream } from 'node:fs';  // 以串流方式寫入檔案
import { mkdir, rename, rm, stat } from 'node:fs/promises'; // 以串流方式寫入檔案
import { basename, dirname } from 'node:path';    // 取得檔名與目錄名稱
import { pipeline } from 'node:stream/promises';  // 以串流方式寫入檔案
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express'; // Express 框架
import { isAudioFile, scanMusic, type MusicItem } from '@/music-library'; // 音樂目錄 API REST 工具
import { resolveInside } from '@/safe-path'; // 路徑安全工具,防止「路徑穿越」攻擊
/**
 * Express v4 不會自動接住 async 錯誤,這裡統一轉交給錯誤處理中介層
 * 但在 v5 之後,Express 已經可以自動接住 async 錯誤,這裡就不需要了
*/
type AsyncHandler = (req: Request, res: Response) => Promise<void>;
function wrap(handler: AsyncHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}
// 檢查檔案是否存在
async function isFile(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch (error) {
    console.error(`檢查檔案是否存在錯誤:${path}`, error);
    return false;
  }
}
/** 驗證 ?path= 參數;不合法時直接回 400 並回傳 null */
function getTarget(root: string, req: Request, res: Response): { rel: string, abs: string } | null {
  const raw = req.query.path as string; // 取得 ?path= 參數
  if (typeof raw !== 'string' || raw === '') {
    res.status(400).json({ error: '缺少 path 參數' });
    return null;
  }
  const abs = resolveInside(root, raw); // 解析成絕對路徑,並檢查是否在 root 目錄內
  if (abs === null || abs === root || !isAudioFile(abs)) {
    res.status(400).json({ error: '不合法的檔案路徑或不支援的音樂格式' });
    return null;
  }
  return { rel: raw, abs };
}

/**
 * 建立 iMusic-server 的 ApiRouter
 * 傳入存放音樂的目錄
 *
 */
export function createApiRouter(musicRoot: string): Router {
  const router = Router();

  // 取出音樂的目錄裡所有的音樂
  router.get('/music', async (req, res) => {
    const items: MusicItem[] = await scanMusic(musicRoot);  // 取得音樂目錄下的所有音樂檔案與子目錄
    res.json(items);  // 回傳 JSON 格式的音樂列表
  });

  // 串流播放(支援 Range,可拖曳進度)
  router.get('/music/stream', async (req, res) => {
    const target = getTarget(musicRoot, req, res); // 驗證 ?path= 參數;不合法時直接回 400 並回傳 null
    if (target === null) {
      return;
    }
    if (!await isFile(target.abs)) {
      res.status(404).json({ error: '檔案不存在' });
      return;
    }
    // sendfile 會自動處理 Range,支援正確的 content-Type, 與支援拖曳進度
    res.sendFile(target.abs, { dotfiles: 'allow' }, (err?: Error) => {  // 傳送檔案完成後的 callback,若有錯誤則回傳 500
      if (err && !res.headersSent) {
        console.error(`串流播放錯誤:${target.abs}`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
      }
    });
  });

  // 下載音樂檔案
  router.get('/music/download', async (req, res) => {
    const target = getTarget(musicRoot, req, res); // 驗證 ?path= 參數;不合法時直接回 400 並回傳 null
    if (target === null) {
      return;
    }
    if (!await isFile(target.abs)) {
      res.status(404).json({ error: '檔案不存在' });
      return;
    }
    res.download(target.abs, basename(target.abs), (err?: Error) => { // 傳送檔案完成後的 callback,若有錯誤則回傳 500
      if (err && !res.headersSent) {
        console.error(`下載音樂檔案錯誤:${target.abs}`, err);
        res.status(500).json({ error: '伺服器內部錯誤' });
      }
    });
  });

  // 上傳音樂檔案
  router.put('/music/file', async (req, res) => {
    const target = getTarget(musicRoot, req, res); // 驗證 ?path= 參數;不合法時直接回 400 並回傳 null
    if (target === null) {
      return;
    }
    // 建立目錄(若不存在)
    await mkdir(dirname(target.abs), { recursive: true });

    // 先寫到暫存檔 .part,完成後才改名,避免上傳中斷留下壞檔
    const tempFile = target.abs + '.part';

    try {
      // 以串流方式寫入檔案
      await pipeline(req, createWriteStream(tempFile)); // 將請求本體(req)的串流內容寫入檔案(writeStream)
      // 寫入完成後,改名為正式檔案名稱
      await rename(tempFile, target.abs);
    } catch (error) {
      console.error(`上傳音樂檔案錯誤:${target.abs}`, error);
      await rm(tempFile).catch(() => { /* 忽略刪除暫存檔的錯誤 */ });
      throw error; // 交給全域錯誤處理中介層處理,回傳 500
    }
    res.status(201).json({ ok: true, path: target.rel });
  });

  // 刪除音樂檔案
  router.delete('/music/file', async (req, res) => {
    const target = getTarget(musicRoot, req, res); // 驗證 ?path= 參數;不合法時直接回 400 並回傳 null
    if (target === null) {
      return;
    }
    if (!await isFile(target.abs)) {
      res.status(404).json({ error: '檔案不存在' });
      return;
    }
    try {
      await rm(target.abs);
      res.json({ ok:true, message: '刪除成功' });
    } catch (error) {
      console.error(`刪除音樂檔案錯誤:${target.abs}`, error);
      res.status(500).json({ error: '伺服器內部錯誤' });
    }
  });

  return router;
}
