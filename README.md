# iMusic-server

在 Windows 上以 **Node.js + Express + TypeScript** 自建的 **WebDAV 音樂伺服器**(HTTPS),
可封裝成「雙擊即可執行、免安裝 Node.js」的單一 `iMusic-server.exe`。

## 功能
- 網頁:自動列出 `Music/`(含子目錄)所有音樂,點檔名即播放,頁面第一行顯示目前播放曲名
- 管理:網頁可上傳 / 下載 / 刪除音樂
- WebDAV:`https://主機:8443/dav/`(可用 VLC、手機音樂 App、Windows 網路磁碟機連線)
- SSL:首次啟動自動產生自簽憑證,也可換成自己的正式憑證
- 登入:預設啟用 HTTP Basic(帳號 `admin`,密碼見 `config.json`,請務必修改)

## 開發(需安裝 Node.js 20+ 與 VSCode)
```bash
npm install
npm run dev        # 監控 src/ 變更並自動重新執行(tsx watch)
npm run typecheck  # TypeScript 7 (原生編譯器 tsc) 型別檢查
npm run typecheck:ts6 # 用 TypeScript 6 再檢查一次(可選,用於交叉比對)
npm run lint       # ESLint 檢查寫作風格(npm run lint:fix 可自動修正)
```
VSCode 開啟資料夾後,安裝建議的 ESLint 擴充套件,存檔時會自動修正風格問題;按 F5 可啟動開發模式。

## TypeScript 7 說明
- `tsc` 是 TypeScript 7 的原生(Go)編譯器,型別檢查速度約快 8~12 倍。
- TypeScript 7.0 尚未提供穩定的程式化 API(預計 7.1),而 typescript-eslint 需要它,
  因此 `package.json` 依官方建議使用 npm 別名並存:
  `@typescript/native` → TypeScript 7(提供 `tsc`);`typescript` → `@typescript/typescript6`(提供給 ESLint,並附 `tsc6`)。
- VSCode 請安裝建議的「TypeScript Native Preview」擴充套件,編輯器即可使用原生語言服務。
- 待 typescript-eslint 支援 TypeScript 7 後,可移除別名,直接使用 `typescript@7`。

## 打包 exe(在 Windows 上執行;使用 Node 內建 SEA,Node 需 20.12 以上)
```bash
npm run build:exe
```
原理:複製本機的 `node.exe`,再把打包好的程式與網頁注入其中。輸出 `release/iMusic-server.exe`(約 80MB,因為內含 Node 執行環境)。把它放到任何資料夾雙擊即可;
同資料夾會自動產生 `config.json`、`Music/`、`certs/`。

## 設定檔 config.json
| 欄位 | 說明 |
| --- | --- |
| host / port | 監聽位址與連接埠(預設 0.0.0.0 / 8443) |
| musicDir / certDir | 音樂與憑證資料夾(相對路徑以 exe 所在處為準) |
| openBrowser | 雙擊 exe 後是否自動開啟瀏覽器 |
| auth.enabled / username / password | Basic 驗證 |

## 自簽憑證的信任
瀏覽器第一次會警告「不安全」,可選擇繼續前往。若要用 Windows「對應網路磁碟機」連 WebDAV,
需把 `certs/server.crt` 匯入「受信任的根憑證授權單位」:
`certutil -addstore -f Root certs\server.crt`(系統管理員 PowerShell)。
別台電腦要連線時,請用區網 IP 連線,並讓該機也信任憑證;另請在 Windows 防火牆放行 8443 連接埠。

## 專案結構
```
src/index.ts                      進入點
src/config.ts                     設定檔
src/ssl.ts                        SSL 憑證
src/music-library.ts              音樂掃描
src/safe-path.ts                  路徑穿越防護
src/middlewares/auth.ts           Basic 驗證
src/middlewares/error-handler.ts  全域錯誤處理中介層
src/middlewares/static-assets.ts  exe 模式下提供內嵌的網頁檔
src/routes/api.ts                 網頁用 REST API
src/routes/webdav.ts              WebDAV 實作
public/                           前端網頁
scripts/build-exe.mjs             esbuild 打包 + SEA 封裝成 exe

```
