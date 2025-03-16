module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  globals: {
    'GoogleAppsScript': true,
    'PropertiesService': true,
    'Logger': true,
    'Calendar': true,
    'CardService': true,
    'SpreadsheetApp': true,
    'UrlFetchApp': true,
    'ContentService': true  // ContentServiceを追加
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script'
  },
  overrides: [
    {
      files: ['*.gs'],
      rules: {
        // Google Apps Script特有のルール
        'no-unused-vars': ['warn', { 'varsIgnorePattern': '^(doGet|doPost)$' }]
      }
    }
  ],
  rules: {
    'curly': ['error', 'multi-line', 'consistent'],
    'max-depth': ['error', 3],
    'indent': ['error', 2],
    'semi': ['error', 'always'],
    'no-unused-vars': 'warn',
    'prefer-const': 'error',
    'no-nested-ternary': 'error',
    'no-else-return': 'error',
    'newline-before-return': 'error',
    'max-len': ['error', { 'code': 100 }],
    'space-before-function-paren': ['error', {
      'anonymous': 'always',
      'named': 'never',
      'asyncArrow': 'always'
    }]
  }
};