/**
 * 自製的精簡 WebDAV 伺服器(掛載在 /dav),不依賴第三方套件。
 * 支援方法:OPTIONS、PROPFIND、GET、HEAD、PUT、DELETE、MKCOL、MOVE
 * 可供多數 WebDAV 音樂播放器(iOS/Android App、VLC、Windows「對應網路磁碟機」)使用。
 * 不支援 LOCK/COPY/PROPPATCH(音樂串流與管理用不到)。
 */
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { resolveInside } from '@/safe-path';

const ALLOW = 'OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, MOVE, PROPFIND';

interface DavEntry {
  rel: string; // 相對於 Music 的路徑,以 / 分隔(根目錄為空字串)
  isDir: boolean;
  size: number;
  mtime: Date;
}

async function statOrNull(path: string): Promise<Stats | null> {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRel(root: string, abs: string): string {
  return relative(root, abs).split(sep).join('/');
}

/** 把相對路徑轉成 URL(每一段都做百分比編碼,資料夾結尾補 /) */
function toHref(mountPath: string, rel: string, isDir: boolean): string {
  const segments = rel
    .split('/')
    .filter((s) => s !== '')
    .map(encodeURIComponent);
  let href = `${mountPath}/${segments.join('/')}`;
  if (isDir && !href.endsWith('/')) {
    href += '/';
  }
  return href;
}

function buildMultistatus(mountPath: string, entries: DavEntry[]): string {
  const responses = entries
    .map((e) => {
      const name = e.rel.split('/').pop() ?? '';
      const props = [
        `<D:displayname>${escapeXml(name)}</D:displayname>`,
        `<D:getlastmodified>${e.mtime.toUTCString()}</D:getlastmodified>`,
        e.isDir
          ? '<D:resourcetype><D:collection/></D:resourcetype>'
          : `<D:resourcetype/><D:getcontentlength>${String(e.size)}</D:getcontentlength>`,
      ].join('');
      return (
        `<D:response><D:href>${escapeXml(toHref(mountPath, e.rel, e.isDir))}</D:href>` +
        `<D:propstat><D:prop>${props}</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`
      );
    })
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?><D:multistatus xmlns:D="DAV:">${responses}</D:multistatus>`;
}

function decodeRel(urlPath: string): string | null {
  try {
    return decodeURIComponent(urlPath);
  } catch {
    return null; // 百分比編碼格式錯誤
  }
}

export function createWebDavHandler(root: string, mountPath = '/dav'): RequestHandler {
  // ---- 各 WebDAV 方法的實作 ----

  async function propfind(req: Request, res: Response, abs: string): Promise<void> {
    req.resume(); // 丟棄 PROPFIND 的 XML 請求本體(我們固定回傳基本屬性)
    const info = await statOrNull(abs);
    if (info === null) {
      res.sendStatus(404);
      return;
    }

    const entries: DavEntry[] = [
      { rel: toRel(root, abs), isDir: info.isDirectory(), size: info.size, mtime: info.mtime },
    ];
    // Depth: 0 只回傳自己;1(或 infinity,這裡一律視為 1)連同子項目
    const depth = req.header('Depth') ?? '1';
    if (info.isDirectory() && depth !== '0') {
      for (const name of await readdir(abs)) {
        const childInfo = await statOrNull(join(abs, name));
        if (childInfo !== null && !name.endsWith('.part')) {
          entries.push({
            rel: toRel(root, join(abs, name)),
            isDir: childInfo.isDirectory(),
            size: childInfo.size,
            mtime: childInfo.mtime,
          });
        }
      }
    }

    res
      .status(207)
      .set('Content-Type', 'application/xml; charset=utf-8')
      .send(buildMultistatus(mountPath, entries));
  }

  async function get(res: Response, abs: string): Promise<void> {
    const info = await statOrNull(abs);
    if (info === null) {
      res.sendStatus(404);
      return;
    }
    if (info.isDirectory()) {
      res.status(405).send('這是資料夾,請使用 PROPFIND 瀏覽');
      return;
    }
    res.sendFile(abs, { dotfiles: 'allow' }, (err?: Error) => {
      if (err && !res.headersSent) {
        res.status(500).end();
      }
    });
  }

  async function put(req: Request, res: Response, abs: string): Promise<void> {
    const parent = await statOrNull(dirname(abs));
    if (parent?.isDirectory() !== true) {
      req.resume();
      res.sendStatus(409); // 規範:上層資料夾不存在
      return;
    }
    const existing = await statOrNull(abs);
    if (existing?.isDirectory() === true) {
      req.resume();
      res.sendStatus(405);
      return;
    }
    const tempPath = `${abs}.part`;
    try {
      await pipeline(req, createWriteStream(tempPath));
      await rename(tempPath, abs);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
    res.sendStatus(existing === null ? 201 : 204);
  }

  async function del(res: Response, abs: string): Promise<void> {
    if (abs === root) {
      res.sendStatus(403); // 不允許刪除整個音樂庫
      return;
    }
    if ((await statOrNull(abs)) === null) {
      res.sendStatus(404);
      return;
    }
    await rm(abs, { recursive: true });
    res.sendStatus(204);
  }

  async function mkcol(req: Request, res: Response, abs: string): Promise<void> {
    req.resume();
    if ((await statOrNull(abs)) !== null) {
      res.sendStatus(405); // 已存在
      return;
    }
    if ((await statOrNull(dirname(abs)))?.isDirectory() !== true) {
      res.sendStatus(409);
      return;
    }
    await mkdir(abs);
    res.sendStatus(201);
  }

  async function move(req: Request, res: Response, abs: string): Promise<void> {
    const destHeader = req.header('Destination');
    if (destHeader === undefined || abs === root) {
      res.sendStatus(400);
      return;
    }
    let destRel: string | null;
    try {
      // Destination 是完整 URL,只取路徑部分
      const pathname = new URL(destHeader, 'https://placeholder.invalid').pathname;
      destRel = pathname.startsWith(`${mountPath}/`)
        ? decodeRel(pathname.slice(mountPath.length))
        : null;
    } catch {
      destRel = null;
    }
    const destAbs = destRel === null ? null : resolveInside(root, destRel);
    if (destAbs === null || destAbs === root) {
      res.sendStatus(400);
      return;
    }
    if ((await statOrNull(abs)) === null) {
      res.sendStatus(404);
      return;
    }
    if ((await statOrNull(dirname(destAbs)))?.isDirectory() !== true) {
      res.sendStatus(409);
      return;
    }
    const destExists = (await statOrNull(destAbs)) !== null;
    if (destExists) {
      if (req.header('Overwrite')?.toUpperCase() === 'F') {
        res.sendStatus(412);
        return;
      }
      await rm(destAbs, { recursive: true });
    }
    await rename(abs, destAbs);
    res.sendStatus(destExists ? 204 : 201);
  }

  // ---- 方法分派 ----
  async function handle(req: Request, res: Response): Promise<void> {
    const rel = decodeRel(req.path);
    if (rel === null) {
      res.sendStatus(400);
      return;
    }
    const abs = resolveInside(root, rel);
    if (abs === null) {
      res.sendStatus(403);
      return;
    }

    switch (req.method) {
      case 'OPTIONS':
        res.set({ DAV: '1', 'MS-Author-Via': 'DAV', Allow: ALLOW }).sendStatus(200);
        return;
      case 'PROPFIND':
        await propfind(req, res, abs);
        return;
      case 'GET':
      case 'HEAD':
        await get(res, abs);
        return;
      case 'PUT':
        await put(req, res, abs);
        return;
      case 'DELETE':
        await del(res, abs);
        return;
      case 'MKCOL':
        await mkcol(req, res, abs);
        return;
      case 'MOVE':
        await move(req, res, abs);
        return;
      default:
        res.set('Allow', ALLOW).sendStatus(405);
    }
  }

  return (req, res, next: NextFunction) => {
    handle(req, res).catch(next);
  };
}
