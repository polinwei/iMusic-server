/** 音樂庫:遞迴掃描 Music 目錄(含子目錄),回傳所有音樂檔案 */
import { readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

// 音樂檔案的物件屬性
export interface MusicItem {
  /** 相對於 Music 目錄的路徑(一律使用 / 分隔),例如 "Jazz/Blue.mp3" */
  path: string;
  name: string;
  /** 所在子目錄,根目錄為空字串 */
  dir: string;
  size: number;
  /** 最後修改時間(毫秒) */
  mtime: number;
}

/** 允許的音樂副檔名(瀏覽器可直接播放的常見格式) */
export const AUDIO_EXTENSIONS: ReadonlySet<string> = new Set([
  '.mp3',
  '.flac',
  '.wav',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
]);

// 驗證檔案是否符合音樂副檔名
export function isAudioFile(fileName: string): boolean {
  return AUDIO_EXTENSIONS.has(extname(fileName).toLowerCase());
}

export async function scanMusic(root: string, relDir = ''): Promise<MusicItem[]> {
  const entries = await readdir(join(root, relDir), { withFileTypes: true });
  const items: MusicItem[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue; // 略過隱藏檔(含 .gitkeep)
    }

    // 迴圈循迴找子目錄
    const rel = relDir === '' ? entry.name : `${relDir}/${entry.name}`; //如果是根目錄,就直接使用 entry.name,否則加上子目錄路徑

    if (entry.isDirectory()) { // 如果是子目錄,就遞迴掃描
      items.push(...(await scanMusic(root, rel))); // 遞迴掃描子目錄
    } else if (entry.isFile() && isAudioFile(entry.name)) { // 如果是音樂檔案,就加入清單
      const info = await stat(join(root, rel)); // 取得檔案資訊
      items.push({ path: rel, name: entry.name, dir: relDir, size: info.size, mtime: info.mtimeMs });
    }
  }
  return items.sort((a, b) => a.path.localeCompare(b.path, 'zh-Hant')); // 依照路徑排序,中文排序
}
