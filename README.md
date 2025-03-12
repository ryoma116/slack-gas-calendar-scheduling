# slack-gas-calendar-scheduling

SlackからGoogleカレンダーの予定を調整するためのGoogle Apps Scriptプロジェクト

## デプロイ手順

### 1. 開発環境のセットアップ

1. プロジェクトのクローン
```bash
# リポジトリのクローン
git clone https://github.com/ryoma116/slack-gas-calendar-scheduling.git
cd slack-gas-calendar-scheduling
```

2. nodenvのインストール（まだの場合）
```bash
# macOSの場合
brew install nodenv

# 設定を.zshrcに追加（bash使用の場合は.bashrc）
echo 'eval "$(nodenv init -)"' >> ~/.zshrc
source ~/.zshrc
```

2. Node.jsのインストールと設定
```bash
# Node.js v22.14.0をインストール
nodenv install 22.14.0

# プロジェクトディレクトリの作成と移動
mkdir slack-gas-calendar-scheduling
cd slack-gas-calendar-scheduling

# プロジェクトでNode.js v22.14.0を使用するように設定
nodenv local 22.14.0

# npm初期化
npm init -y
```

3. [clasp](https://github.com/google/clasp)のインストールと認証
```bash
# claspをプロジェクトにインストール
npm install @google/clasp

# claspの認証を実行（プロジェクトのnode_modulesから実行）
npx clasp login
```

4. Google Apps Script APIの有効化
   - [Google Apps Script Settings](https://script.google.com/home/usersettings) にアクセス
   - Google Apps Script APIを有効化

### 2. プロジェクトのセットアップ

```bash
# GASプロジェクトの作成
npx clasp create --type webapp --title "slack-gas-calendar-scheduling"

# GASにプッシュ
npx clasp push
```

### 3. デプロイの実行

```bash
# デプロイを作成
npx clasp deploy --description "Initial deployment"

# デプロイしたバージョンのURLを取得
npx clasp deployments
```

または、GASエディタからデプロイする場合：

1. `npx clasp open` でブラウザでプロジェクトを開く
2. 「デプロイ」→「新しいデプロイ」をクリック
3. 以下の設定を行う：
   - 説明：初回デプロイ
   - 次のユーザーとして実行：自分
   - アクセスできるユーザー：全員（匿名ユーザーを含む）
4. 「デプロイ」をクリック
5. 必要な権限を承認
6. デプロイされたウェブアプリのURLをコピー（後でSlackアプリの設定で使用）

### 4. Slackアプリとの連携

1. [Slack API](https://api.slack.com/apps) にアクセス
2. 「Create New App」をクリック
3. 「From scratch」を選択
4. アプリ名とワークスペースを設定
5. 「Event Subscriptions」を有効化
6. Request URLに、GASのウェブアプリURLを入力
   - チャレンジ認証が成功することを確認
7. アプリをワークスペースにインストール

## 開発時の便利なコマンド

```bash
# ローカルの変更をGASに反映
npx clasp push

# GASの変更をローカルに反映
npx clasp pull

# ブラウザでスクリプトエディタを開く
npx clasp open

# 現在のデプロイ一覧を表示
npx clasp deployments

# 最新のコードをデプロイ
npx clasp deploy
```

## トラブルシューティング

### デプロイ時の注意点
- Node.jsのバージョンが22.14.0であることを確認（`node -v`）
- GASの実行権限は適切に設定されているか確認
- Slackアプリのイベント設定が正しいか確認
- `.clasprc.json`が正しく設定されているか確認

### 一般的なエラー対応
- 401エラー：`npx clasp login`で再認証を試す
- 403エラー：Google Apps Script APIが有効化されているか確認
- タイムアウト：処理時間を確認
- プッシュエラー：`.clasp.json`のscriptIdが正しいか確認
- Node.jsバージョンエラー：`nodenv local 22.14.0`で正しいバージョンを設定