// ESLint 9 flat config:使用 typescript-eslint 最嚴格的「型別感知」規則集,
// 檢查 TypeScript 的各種寫作風格與常見錯誤(如 Promise 未處理、any 濫用、不必要的條件判斷等)。
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'release/**', 'node_modules/**', 'public/**', 'Music/**', 'certs/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 以底線開頭的參數視為「刻意不使用」(例如 Express 錯誤處理的 _next)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // 統一風格:一律使用 === 、大括號、const
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'prefer-const': 'error',
      'no-console': 'off',
    },
  },
  {
    // .mjs 設定/腳本檔不在 tsconfig 內,關閉型別感知規則
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    // .mjs 腳本跑在 Node.js 上,宣告 Node 全域變數,避免 no-undef 誤報(如 console)
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
);
