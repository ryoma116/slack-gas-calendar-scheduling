module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended', // Prettierとの連携を追加
  ],
  globals: {
    GoogleAppsScript: true,
    PropertiesService: true,
    Logger: true,
    Calendar: true,
    CalendarApp: true, // CalendarAppを追加
    CardService: true,
    SpreadsheetApp: true,
    UrlFetchApp: true,
    ContentService: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script',
  },
  plugins: ['prettier'], // Prettierプラグインを追加
  overrides: [
    {
      files: ['*.gs'],
      rules: {
        // Google Apps Script特有のルール
        'no-unused-vars': ['warn', { varsIgnorePattern: '^(doGet|doPost)$' }],
      },
    },
  ],
  rules: {
    'prettier/prettier': 'error', // Prettierのルールを適用
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
};
