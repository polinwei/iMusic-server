/**
 * 路徑安全工具:防止「路徑穿越」攻擊(例如 ../../Windows/System32)
 * 所有使用者提供的路徑,都必須經過 resolveInside 才能碰檔案系統。
 */
import { isAbsolute, relative, resolve } from 'node:path';

/**
 * 把使用者給的相對路徑解析為 root 底下的絕對路徑。
 * 若結果跑出 root 之外,或含有不合法字元,回傳 null。
 * 注意:root 必須是已解析過的絕對路徑。
 */
export function resolveInside(root: string, userPath: string): string | null {
  if ( userPath.includes('\0') ) { // 防止 null byte 攻擊
    return null;
  }
  // 去掉開頭的斜線,避免被當成磁碟根目錄
  userPath = userPath.replace(/^[/\\]+/, '') // 避免被當成磁碟根目錄
  const abs = resolve(root, userPath); // 解析成絕對路徑
  const rel = relative(root, abs); // 計算相對路徑
  if (rel.startsWith('..') || isAbsolute(rel)) { // 跑出 root 之外
    return null;
  }
  return abs;
}
