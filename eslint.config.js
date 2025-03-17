// eslint.config.js - ESLint v9 形式の設定ファイル
/**
 * @type {import('eslint').Linter.FlatConfig[]}
 */
export default [
  // 無視するファイルとディレクトリの設定
  {
    ignores: [
      '**/.history/**',
      '**/node_modules/**',
      '.git/**',
      'eslint.config.js', // ESLint自身の設定ファイルを無視
    ],
  },

  // 基本設定
  {
    files: ['**/*.{js,gs}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        GoogleAppsScript: true,
        PropertiesService: true,
        Logger: true,
        Calendar: true,
        CalendarApp: true,
        CardService: true,
        SpreadsheetApp: true,
        UrlFetchApp: true,
        ContentService: true,
      },
    },
    rules: {
      curly: ['error', 'multi-line', 'consistent'],
      'max-depth': ['error', 3],
      indent: ['error', 2],
      semi: ['error', 'always'],
      'no-unused-vars': 'warn',
      'prefer-const': 'error',
      'no-nested-ternary': 'error',
      'no-else-return': 'error',
      'newline-before-return': 'error',
      'max-len': ['error', { code: 100 }],
      'space-before-function-paren': [
        'error',
        {
          anonymous: 'always',
          named: 'never',
          asyncArrow: 'always',
        },
      ],
    },
  },

  // Google Apps Script特有の設定
  {
    files: ['*.gs'],
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^(doGet|doPost)$' }],
    },
  },
];
