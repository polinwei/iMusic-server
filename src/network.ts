/** 取得本機區域網路的 IPv4 位址(用來顯示連線網址、並寫入 SSL 憑證的 SAN) */
import { networkInterfaces } from 'os';

/** 獲取本機 IP 地址 */
export function getLanAddresses(): string[] {
  const addresses: string[] = [];
  for (const infos of Object.values(networkInterfaces())) { // 取得所有網路介面資訊
    for (const info of infos ?? []) {
      if (info.family === 'IPv4' && !info.internal) {
        addresses.push(info.address);
      }
    }
  }
  return addresses;
}
