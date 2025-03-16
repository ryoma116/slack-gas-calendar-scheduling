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
      // ユーザーIDからメールアドレスを取得
      const emailMap = getUserEmailsFromIds(mentionedUsers);
      
      responseText += "\n\n参加者として以下のユーザーが検出されました：";
      mentionedUsers.forEach(userId => {
        responseText += `\n• <@${userId}>`;
        if (emailMap[userId]) {
          responseText += ` (${emailMap[userId]})`;
        }
      });
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
 * @return {Object|null} APIレスポンス、または失敗時はnull
 */
function sendSlackMessage(channel, text, thread_ts) {
  try {
    // SlackのBotトークンを取得（エラーが発生する可能性あり）
    const token = getSlackBotToken();
    
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
    
    // Slack APIを呼び出してメッセージを送信
    const response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', options);
    const responseData = JSON.parse(response.getContentText());
    
    if (!responseData.ok) {
      console.error('Slackメッセージの送信に失敗しました: ' + responseData.error);
    }
    
    return responseData; // レスポンスを返す（必要に応じて使用可能）
  } catch (error) {
    console.error('Slackメッセージの送信中にエラーが発生しました: ' + error);
    
    return null;
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
  const botUserId = PropertiesService.getScriptProperties().getProperty('BOT_USER_ID');
  
  for (const block of blocks) {
    if (!block.elements || !Array.isArray(block.elements)) continue;
    
    for (const element of block.elements) {
      if (!isValidRichTextSection(element)) continue;
      extractUserMentionsFromElements(element.elements, botUserId, mentionedUsers);
    }
  }
  
  return [...new Set(mentionedUsers)];
}

/**
 * rich_text_sectionの要素が有効かチェックする
 * @param {Object} element 要素オブジェクト
 * @return {boolean} 有効な場合はtrue
 */
function isValidRichTextSection(element) {
  return element.type === 'rich_text_section' && 
         element.elements && 
         Array.isArray(element.elements);
}

/**
 * 要素からユーザーメンションを抽出する
 * @param {Array} elements 要素の配列
 * @param {string} botUserId ボットのユーザーID
 * @param {Array} mentionedUsers メンション済みユーザーの配列
 */
function extractUserMentionsFromElements(elements, botUserId, mentionedUsers) {
  for (const item of elements) {
    if (item.type !== 'user' || !item.user_id) continue;
    if (item.user_id === botUserId) continue;
    
    mentionedUsers.push(item.user_id);
  }
}

/**
 * Slack APIを使用して特定のユーザーの情報を取得する
 * @param {string} userId ユーザーID
 * @return {Object|null} ユーザー情報のオブジェクト、またはエラー時はnull
 */
function getSlackUserInfo(userId) {
  try {
    // SlackのBotトークンを取得（エラーが発生する可能性あり）
    const token = getSlackBotToken();
    
    const options = {
      'method': 'get',
      'headers': {
        'Authorization': 'Bearer ' + token
      }
    };
    
    // Slack APIを呼び出してユーザー情報を取得
    const response = UrlFetchApp.fetch(`https://slack.com/api/users.info?user=${userId}`, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (!responseData.ok) {
      console.error('Slackユーザー情報の取得に失敗しました: ' + responseData.error);
      
      return null;
    }
    
    return responseData.user;
  } catch (error) {
    console.error('Slackユーザー情報の取得中にエラーが発生しました: ' + error);
    
    return null;
  }
}

/**
 * ユーザーIDのリストからメールアドレスのマップを取得する
 * @param {string[]} userIds Slackユーザーのリスト
 * @return {Object} ユーザーIDをキー、メールアドレスを値とするオブジェクト
 */
function getUserEmailsFromIds(userIds) {
  const emailMap = {};
  
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return emailMap;
  }
  
  for (const userId of userIds) {
    const userInfo = getSlackUserInfo(userId);
    if (userInfo && userInfo.profile && userInfo.profile.email) {
      emailMap[userId] = userInfo.profile.email;
    }
  }
  
  return emailMap;
}

/**
 * SlackのBotトークンを取得する
 * @return {string} SlackのBotトークン
 * @throws {Error} トークンが設定されていない場合
 */
function getSlackBotToken() {
  const token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  
  if (!token) {
    throw new Error('SLACK_BOT_TOKENが設定されていません。');
  }
  
  return token;
}
