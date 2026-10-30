/**
 * SSL 憑證模組
 * - 若 certs/server.key 與 certs/server.crt 已存在,直接使用
 *   (想用正式憑證,只要把檔案換成自己的即可)
 * - 否則自動產生「自簽憑證」(有效 825 天),並把 localhost 與本機區網 IP 寫入 SAN
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generate, type SubjectAltNameEntry, type SelfsignedOptions } from 'selfsigned';
import { getLanAddresses } from './network';

export interface TlsMaterial {
  key: string;
  cert: string;
}

export async function ensureCertificate(certDir: string): Promise<TlsMaterial> {
  const keyPath = join(certDir, 'server.key');
  const certPath = join(certDir, 'server.crt');

  // 確認是否有憑證檔案
  if (existsSync(keyPath) && existsSync(certPath)) {
    return {
      key: await readFile(keyPath, 'utf8'),
      cert: await readFile(certPath, 'utf8'),
    };
  }
  // 建立存放憑證的目錄:certDir
  await mkdir(certDir, { recursive: true });

  // 取得主機的所有ip
  const altNames: SubjectAltNameEntry[] = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    ...getLanAddresses().map((ip):SubjectAltNameEntry =>({type:7,ip}))
  ];

  /** 用 ...getLanAddresses().map((ip):SubjectAltNameEntry =>({type:7,ip})) 取代下面
    for (const ip of getLanAddresses() as unknown[]) {
      if (typeof ip === 'string') {
        altNames.push({ type: 7, ip });
      }
    }
 */

// 帶入 selfsigned 產生憑證
const attrs = [{ name: 'commonName', value: 'iMusic-server' }];
const options: SelfsignedOptions = {
  notBeforeDate: new Date(),
  keySize: 2048,
  algorithm: 'sha256',
  extensions: [ {name: 'subjectAltName', altNames: altNames}]
};
const pems = await generate(attrs, options);

await writeFile(keyPath, pems.private, 'utf8');
await writeFile(certPath, pems.cert, 'utf8');
console.log(`已產生自簽憑證:${certPath}`);

return { key: pems.private, cert: pems.cert };

}
