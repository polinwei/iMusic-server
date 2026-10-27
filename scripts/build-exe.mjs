// 打包成 Windows 單一 exe(Node.js SEA:Single Executable Application)
// 流程:
// 1. esbuild 把 src/app.ts 與所有相依套件合併為單一 dist/app.cjs
// 2. 產生 SEA 設定,把 public/ 內的網頁檔列為 assets 嵌入
// 3. node --experimental-sea-config 產生 blob
// 4. 複製目前的 node.exe,用 postject 把 blob 注入,得到 release/iMusic-server.exe
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const { inject } = require('postject');

const EXE = 'release/iMusic-server.exe';
// Node 官方文件規定的固定識別字串
const SENTINEL_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

rmSync('dist', { recursive: true, force: true });
rmSync('release', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
mkdirSync('release', { recursive: true });

await build({
  entryPoints: ['src/app.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist/app.cjs',
  logLevel: 'info',
});

const assets = {};
for (const file of readdirSync('public')) {
  assets[`public/${file}`] = `public/${file}`;
}
writeFileSync(
  'dist/sea-config.json',
  JSON.stringify({
    main: 'dist/app.cjs',
    output: 'dist/sea-prep.blob',
    disableExperimentalSEAWarning: true,
    assets,
  }),
);

execFileSync(process.execPath, ['--experimental-sea-config', 'dist/sea-config.json'], {
  stdio: 'inherit',
});

copyFileSync(process.execPath, EXE);
await inject(EXE, 'NODE_SEA_BLOB', readFileSync('dist/sea-prep.blob'), {
  sentinelFuse: SENTINEL_FUSE,
});

console.log(`✔ 已輸出 ${EXE}`);
