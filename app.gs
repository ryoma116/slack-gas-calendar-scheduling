/**
 * Slackからのリクエストを処理する
 * @param {Object} e POSTリクエストイベントオブジェクト
 * @return {TextOutput} JSONレスポンス
 */
function doPost(e) {
  // リクエストパラメータをJSONとしてパース
  const params = JSON.parse(e.postData.contents);
  
  // チャレンジ認証の場合
  if (params.type === 'url_verification') {
    return ContentService.createTextOutput(params.challenge);
  }
  
  // イベントの場合（非同期で処理）
  if (params.type === 'event_callback') {
    // まず200 OKを返す
    processEventAsync(params.event);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // スラッシュコマンドの場合（即時レスポンス）
  if (params.command) {
    return handleCommand(params);
  }
  
  // その他のリクエストの場合
  const response = {
    "response_type": "in_channel",
    "text": "未対応のリクエストタイプです。"
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Slackのイベントを非同期で処理する
 * @param {Object} event Slackイベントオブジェクト
 */
function processEventAsync(event) {
  // メッセージイベントの場合
  if (event.type === 'app_mention' && !event.subtype) { // 自分自身のメッセージを除外
    handleMessage(event);
  }
}

/**
 * Slackのメッセージを処理する
 * @param {Object} message Slackメッセージオブジェクト
 */
function handleMessage(message) {
  // メッセージテキストの取得
  const text = message.text || '';
  
  // blocksからメンションされているユーザーのリストを抽出
  const mentionedUsers = extractMentionedUsersFromBlocks(message.blocks);
  
  // 予定作成のリクエストかどうかを判断する（例：予定作成 or 日程調整 という文字列を含む場合）
  if (text.includes('予定作成') || text.includes('日程調整')) {
    // メンションされているユーザーがいる場合は、その情報も含めて応答
    let responseText = "予定作成のリクエストを受け付けました。詳細を教えてください（日時、タイトル、参加者など）";
    
    if (mentionedUsers.length > 0) {
      responseText += "\n\n参加者として以下のユーザーが検出されました：\n• <@" + mentionedUsers.join(">\n• <@") + ">";
    }
    
    // 予定作成リクエストに応答（元のメッセージのスレッドに返信）
    sendSlackMessage(
      message.channel, 
      responseText, 
      message.ts // 元のメッセージのタイムスタンプを指定してスレッド返信
    );
    return;
  }
  
  // その他のメッセージの場合
  sendSlackMessage(
    message.channel, 
    "こんにちは！予定作成や日程調整をご希望の場合は、「予定作成」または「日程調整」と入力してください。", 
    message.ts // 元のメッセージのタイムスタンプを指定してスレッド返信
  );
}

/**
 * Slackのコマンドを処理する
 * @param {Object} command Slackコマンドオブジェクト
 * @return {TextOutput} JSONレスポンス
 */
function handleCommand(command) {
  // 例: /schedule コマンドの処理
  if (command.command === '/schedule') {
    return ContentService.createTextOutput(JSON.stringify({
      "response_type": "in_channel",
      "text": "予定作成のリクエストを受け付けました。詳細を教えてください（日時、タイトル、参加者など）"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // その他のコマンドの場合
  return ContentService.createTextOutput(JSON.stringify({
    "response_type": "in_channel",
    "text": "未対応のコマンドです。"
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Slackにメッセージを送信する（オプションでスレッド返信も可能）
 * @param {string} channel チャンネルID
 * @param {string} text 送信するテキスト
 * @param {string} [thread_ts] スレッドタイムスタンプ（指定するとスレッド返信になります）
 */
function sendSlackMessage(channel, text, thread_ts) {
  // SlackのBotトークンを取得（PropertiesServiceに保存しておく必要があります）
  const token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  
  if (!token) {
    console.error('SLACK_BOT_TOKENが設定されていません。');
    return;
  }
  
  // ペイロードの基本部分
  const payload = {
    'token': token,
    'channel': channel,
    'text': text
  };
  
  // スレッド返信の場合はthread_tsを追加
  if (thread_ts) {
    payload.thread_ts = thread_ts;
  }
  
  const options = {
    'method': 'post',
    'payload': payload
  };
  
  try {
    // Slack APIを呼び出してメッセージを送信
    const response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', options);
    const responseData = JSON.parse(response.getContentText());
    
    if (!responseData.ok) {
      console.error('Slackメッセージの送信に失敗しました: ' + responseData.error);
    }
    
    return responseData; // レスポンスを返す（必要に応じて使用可能）
  } catch (error) {
    console.error('Slackメッセージの送信中にエラーが発生しました: ' + error);
  }
}

/**
 * SlackメッセージのblocksからメンションされているユーザーIDのリストを抽出する
 * @param {Array} blocks Slackメッセージのブロック配列
 * @return {string[]} メンションされているユーザーIDの配列
 */
function extractMentionedUsersFromBlocks(blocks) {
  if (!blocks || !Array.isArray(blocks)) return [];
  
  const mentionedUsers = [];
  // ボット自身のIDを取得
  const botUserId = PropertiesService.getScriptProperties().getProperty('BOT_USER_ID');
  
  for (const block of blocks) {
    // elementsを持たないブロックはスキップ
    if (!block.elements || !Array.isArray(block.elements)) continue;
    
    for (const element of block.elements) {
      // rich_text_section以外はスキップ
      if (element.type !== 'rich_text_section' || !element.elements || !Array.isArray(element.elements)) continue;
      
      for (const item of element.elements) {
        // userタイプ以外はスキップ
        if (item.type !== 'user' || !item.user_id) continue;
        
        // ボット自身は除外
        if (item.user_id === botUserId) continue;
        
        mentionedUsers.push(item.user_id);
      }
    }
  }
  
  // 重複を除去して返す
  return [...new Set(mentionedUsers)];
}
