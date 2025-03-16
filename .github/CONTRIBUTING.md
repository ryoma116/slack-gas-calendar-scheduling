# Contributing Guidelines

## ブランチ命名規則

ブランチ名は以下の形式に従ってください：

```
<type>/i<issue-number>-<description>
```

### Type
- `feature`: 新機能の追加
- `fix`: バグ修正
- `refactor`: リファクタリング（機能追加やバグ修正を含まない）
- `docs`: ドキュメントのみの変更
- `test`: テストの追加・修正
- `chore`: その他の変更（ビルドスクリプト、開発環境の設定など）

### Issue number
- 必ずGitHub Issue番号を含めてください
- 例: `i1`, `i42`

### Description
- 英語の小文字とハイフンを使用
- 簡潔で分かりやすい説明

### 例
- `feature/i1-slack-challenge-auth`
- `fix/i2-calendar-timezone-bug`
- `refactor/i3-improve-error-handling`

## コミットメッセージ規則

コミットメッセージは以下の形式に従ってください：

```
refs #<issue-number>
<type>: <description>

[optional body]
[optional footer]
```

### Type
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `style`: コードスタイルの変更（スペース、フォーマット、セミコロンの追加など）
- `refactor`: リファクタリング
- `test`: テストの追加・修正
- `chore`: その他の変更

### Issue Reference
- コミットメッセージの先頭に `refs #<issue-number>` を追加
- これによりGitHub上でコミットメッセージからIssueへの自動リンクが生成されます
- 複数のIssueを参照する場合は複数行に分けて記載

### 例
```
refs #1 feat: implement Slack challenge authentication

- Add URL verification endpoint
- Handle challenge parameter
- Update appsscript.json configuration
```

## プルリクエスト（PR）規則

### PRタイトル
- Issue番号を含める
- 変更内容を簡潔に説明

例：`[#1] Implement Slack challenge authentication`

### PR説明
- 変更内容の詳細な説明
- 関連するIssueへのリンク
- テスト手順（必要な場合）
- スクリーンショット（UI変更がある場合）

## プルリクエスト作成フロー

### 1. ブランチの作成と切り替え
```bash
git checkout -b <type>/i<issue-number>-<description> main
```

### 2. 変更の実装
必要な変更を実装します。

### 3. 変更のコミット
```bash
git add .
git commit -m "refs #<issue-number> <type>: <description>"
```

### 4. リモートへのプッシュ
```bash
git push origin <branch-name>
```

### 5. プルリクエストの作成
GitHub CLIを使用してプルリクエストを作成します：
```bash
gh pr create --title "タイトル" --body "プルリクエストの説明"
```

#### プルリクエスト作成のTips
- タイトルは日本語で簡潔に記述
- PRの説明には、.github/pull_request_template.mdのテンプレートが自動的に使用されます
- 必ず`closes #<issue-number>`を含めて、PRとIssueを紐付けます

## コードスタイル

- インデントは2スペースを使用
- セミコロンは必須
- 関数には適切なJSDocコメントを付ける