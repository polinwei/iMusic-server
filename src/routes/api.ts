/**
 * 使用 express v5
 * REST API(給網頁前端使用),掛載在 /api
 *   GET    /api/music                 列出所有音樂(含子目錄)
 *   GET    /api/music/stream?path=    串流播放(支援 Range,可拖曳進度)
 *   GET    /api/music/download?path=  下載
 *   PUT    /api/music/file?path=      上傳(請求本體即檔案內容,以串流寫入磁碟)
 *   DELETE /api/music/file?path=      刪除
 */
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { isAudioFile, scanMusic, type MusicItem } from '@/music-library';

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



/**
 * 建立 iMusic-server 的 ApiRouter
 * 傳入存放音樂的目錄
 *
 */
export function createApiRouter(musicRoot: string): Router {
  const router = Router();

  // 取出音樂的目錄裡所有的音樂
  router.get('/music', async (req, res) => {
    const items:MusicItem[] = await scanMusic(musicRoot);
    res.json(items);
  });

  return router;


}
