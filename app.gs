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

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(
      ContentService.MimeType.JSON
    );
  }

  // スラッシュコマンドの場合（即時レスポンス）
  if (params.command) {
    return handleCommand(params);
  }

  // その他のリクエストの場合
  const response = {
    response_type: 'in_channel',
    text: '未対応のリクエストタイプです。',
  };

  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * Slackのイベントを非同期で処理する
 * @param {Object} event Slackイベントオブジェクト
 */
function processEventAsync(event) {
  // メッセージイベントの場合
  if (event.type === 'app_mention' && !event.subtype) {
    // 自分自身のメッセージを除外
    handleMessage(event);
  }
}

/**
 * Slackのメッセージを処理する
 * @param {Object} message Slackメッセージオブジェクト
 */
function handleMessage(message) {
  const text = message.text || '';
  const mentionedUsers = extractMentionedUsersFromBlocks(message.blocks);

  if (mentionedUsers.length === 0) {
    sendSlackMessage(
      message.channel,
      'メンションされたユーザーがいません。@メンションで予定を確認したいユーザーを指定してください。',
      message.ts
    );

    return;
  }

  // MTGの日程調整リクエストの場合
  if (text.includes('MTG') || text.includes('ミーティング')) {
    const dateRange = extractDateRange(text);
    const duration = extractMeetingDuration(text) || 60; // デフォルトは60分

    if (!dateRange) {
      sendSlackMessage(
        message.channel,
        '日付の指定が見つかりませんでした。「2024/1/1から2024/1/5」のような形式で指定してください。',
        message.ts
      );

      return;
    }

    // メール情報を取得
    const emailMap = getUserEmailsFromIds(mentionedUsers);
    const allEvents = [];

    // 期間内の各日付について予定を取得
    const currentDate = new Date(dateRange.startDate);
    while (currentDate <= dateRange.endDate) {
      for (const email of Object.values(emailMap)) {
        const events = getUserCalendarEvents(email, currentDate);
        allEvents.push({
          date: new Date(currentDate),
          events: events,
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 空き時間を分析
    const startDate = dateRange.startDate.toLocaleDateString('ja-JP');
    const endDate = dateRange.endDate.toLocaleDateString('ja-JP');
    const responseBase = [
      '以下の条件で日程調整を行います：',
      `• 期間: ${startDate} - ${endDate}`,
      `• 所要時間: ${duration}分`,
      '',
      '参加者：',
    ].join('\n');

    let responseText = responseBase;
    mentionedUsers.forEach(userId => {
      responseText += `• <@${userId}>${emailMap[userId] ? ` (${emailMap[userId]})` : ''}\n`;
    });

    // 初期レスポンスを送信
    responseText += '\n空き時間を分析中です...';
    sendSlackMessage(message.channel, responseText, message.ts);

    // 空き時間を分析して提案を生成
    analyzeMeetingSlots(allEvents, dateRange.startDate, dateRange.endDate, duration)
      .then(suggestion => {
        sendSlackMessage(message.channel, suggestion, message.ts);
      })
      .catch(error => {
        console.error('空き時間の分析中にエラーが発生しました:', error);
        sendSlackMessage(
          message.channel,
          '申し訳ありません。空き時間の分析中にエラーが発生しました。',
          message.ts
        );
      });

    return;
  }

  // 空き時間を探すリクエストの場合
  if (text.includes('空き時間') || text.includes('空いている時間')) {
    const emailMap = getUserEmailsFromIds(mentionedUsers);
    const today = new Date();
    let allEvents = [];

    // 各ユーザーの予定を取得
    for (const email of Object.values(emailMap)) {
      const events = getUserCalendarEvents(email);
      allEvents = allEvents.concat(events);
    }

    // 空き時間を分析
    const availableSlots = analyzeAvailableTimeSlots(allEvents, today);

    if (availableSlots.length === 0) {
      sendSlackMessage(
        message.channel,
        '今日は空き時間が見つかりませんでした。別の日を試してみてください。',
        message.ts
      );

      return;
    }

    // デフォルトで1時間の会議を想定
    const requiredDuration = 60;

    // Gemini APIで最適な時間帯を提案
    suggestBestTimeSlot(availableSlots, requiredDuration)
      .then(suggestion => {
        let responseText = '空き時間の分析結果:\n\n';
        responseText += suggestion;
        sendSlackMessage(message.channel, responseText, message.ts);
      })
      .catch(error => {
        console.error('空き時間の分析中にエラーが発生しました:', error);
        sendSlackMessage(
          message.channel,
          '申し訳ありません。空き時間の分析中にエラーが発生しました。',
          message.ts
        );
      });

    return;
  }

  // メンションされたユーザーの予定を取得するリクエストの場合
  if (text.includes('予定確認') || text.includes('予定を確認')) {
    const emailMap = getUserEmailsFromIds(mentionedUsers);
    let responseText = '';

    for (const [userId, email] of Object.entries(emailMap)) {
      const events = getUserCalendarEvents(email);
      responseText += `\n\n<@${userId}>の今日の予定:\n${formatEvents(events)}`;
    }

    if (responseText === '') {
      responseText = 'メンションされたユーザーの予定を取得できませんでした。';
    }

    sendSlackMessage(message.channel, responseText, message.ts);

    return;
  }

  // 予定作成のリクエストかどうかを判断する
  if (text.includes('予定作成') || text.includes('日程調整')) {
    const scheduleRequestMessage = [
      '予定作成のリクエストを受け付けました。',
      '詳細を教えてください（日時、タイトル、参加者など）',
    ].join('\n');

    let responseText = scheduleRequestMessage;

    const emailMap = getUserEmailsFromIds(mentionedUsers);
    responseText += '\n\n参加者として以下のユーザーが検出されました：';

    for (const [userId, email] of Object.entries(emailMap)) {
      responseText += `\n• <@${userId}>`;
      if (email) {
        responseText += ` (${email})`;
      }
    }

    sendSlackMessage(message.channel, responseText, message.ts);

    return;
  }

  // その他のメッセージの場合
  const helpMessage = [
    'こんにちは！予定作成や日程調整をご希望の場合は、「予定作成」または「日程調整」と入力してください。',
    '予定確認をご希望の場合は、「予定確認」と入力してください。',
  ].join('\n');

  sendSlackMessage(message.channel, helpMessage, message.ts);
}

/**
 * Slackのコマンドを処理する
 * @param {Object} command Slackコマンドオブジェクト
 * @return {TextOutput} JSONレスポンス
 */
function handleCommand(command) {
  // 例: /schedule コマンドの処理
  if (command.command === '/schedule') {
    const scheduleMessage = [
      '予定作成のリクエストを受け付けました。',
      '詳細を教えてください（日時、タイトル、参加者など）',
    ].join('\n');

    return ContentService.createTextOutput(
      JSON.stringify({
        response_type: 'in_channel',
        text: scheduleMessage,
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // その他のコマンドの場合
  return ContentService.createTextOutput(
    JSON.stringify({
      response_type: 'in_channel',
      text: '未対応のコマンドです。',
    })
  ).setMimeType(ContentService.MimeType.JSON);
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
      token: token,
      channel: channel,
      text: text,
    };

    // スレッド返信の場合はthread_tsを追加
    if (thread_ts) {
      payload.thread_ts = thread_ts;
    }

    const options = {
      method: 'post',
      payload: payload,
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
  return (
    element.type === 'rich_text_section' && element.elements && Array.isArray(element.elements)
  );
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
      method: 'get',
      headers: {
        Authorization: 'Bearer ' + token,
      },
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

/**
 * 指定された日付のカレンダーイベントを取得する
 * @param {string} email ユーザーのメールアドレス
 * @param {Date} [date] 対象日（指定がない場合は今日）
 * @return {Object[]} 予定の配列
 */
function getUserCalendarEvents(email, date) {
  try {
    const calendar = CalendarApp.getCalendarById(email);
    if (!calendar) {
      console.error(`カレンダーが見つかりません: ${email}`);

      return [];
    }

    const targetDate = date || new Date();
    const startTime = new Date(targetDate);
    startTime.setHours(0, 0, 0, 0);

    const endTime = new Date(targetDate);
    endTime.setHours(23, 59, 59, 999);

    const events = calendar.getEvents(startTime, endTime);

    return events
      .filter(event => {
        // 終日イベントを除外
        if (event.isAllDayEvent()) return false;

        // 長時間イベント（8時間以上）で、特定のキーワードを含むものを除外
        const duration = (event.getEndTime() - event.getStartTime()) / (1000 * 60 * 60); // 時間単位
        const title = event.getTitle().toLowerCase();
        if (
          duration >= 8 &&
          (title.includes('作業') || title.includes('work') || title.includes('予定'))
        ) {
          return false;
        }

        return true;
      })
      .map(event => ({
        title: event.getTitle(),
        startTime: event.getStartTime(),
        endTime: event.getEndTime(),
        isAllDay: event.isAllDayEvent(),
      }));
  } catch (error) {
    console.error(`予定の取得中にエラーが発生しました: ${error}`);

    return [];
  }
}

/**
 * 予定の配列をフォーマットしてテキストに変換する
 * @param {Object[]} events 予定の配列
 * @return {string} フォーマットされた予定テキスト
 */
function formatEvents(events) {
  if (events.length === 0) {
    return '予定はありません';
  }

  return events
    .map(event => {
      const startTime = event.startTime.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const endTime = event.endTime.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return `• ${startTime} - ${endTime}: ${event.title}`;
    })
    .join('\n');
}

/**
 * Gemini APIのアクセストークンを取得する
 * @return {string} GeminiのAPIトークン
 * @throws {Error} トークンが設定されていない場合
 */
function getGeminiApiKey() {
  const token = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!token) {
    throw new Error('GEMINI_API_KEYが設定されていません。');
  }

  return token;
}

/**
 * 予定リストから空き時間を分析する
 * @param {Object[]} events 予定の配列
 * @param {Date} targetDate 対象日
 * @return {Object[]} 空き時間の配列
 */
function analyzeAvailableTimeSlots(events, targetDate) {
  // 営業時間を設定（9:00-18:00）
  const startHour = 9;
  const endHour = 18;

  const start = new Date(targetDate);
  start.setHours(startHour, 0, 0, 0);

  const end = new Date(targetDate);
  end.setHours(endHour, 0, 0, 0);

  // 予定を時間順にソート
  events.sort((a, b) => a.startTime - b.startTime);

  const availableSlots = [];
  let currentTime = start;

  // 各予定間の空き時間を検出
  for (const event of events) {
    if (event.startTime > currentTime) {
      availableSlots.push({
        start: currentTime,
        end: event.startTime,
      });
    }
    currentTime = new Date(Math.max(currentTime.getTime(), event.endTime.getTime()));
  }

  // 最後の予定以降の空き時間
  if (currentTime < end) {
    availableSlots.push({
      start: currentTime,
      end: end,
    });
  }

  return availableSlots;
}

/**
 * 空き時間をGemini APIを使用して分析し、最適な時間帯を提案する
 * @param {Object[]} availableSlots 空き時間の配列
 * @param {number} requiredDuration 必要な時間（分）
 * @return {Promise<string>} 最適な時間帯の提案
 */
async function suggestBestTimeSlot(availableSlots, requiredDuration) {
  try {
    const apiKey = getGeminiApiKey();
    // 最新のAPIバージョン（v1）とエンドポイントを使用
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=${apiKey}`;

    // 空き時間の情報を整形
    const slotsText = availableSlots
      .map(slot => {
        const startTime = slot.start.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const endTime = slot.end.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
        });

        return `${startTime}から${endTime}`;
      })
      .join('、');

    const prompt = `
    以下の条件で最適な会議時間を提案してください：
    
    空き時間枠：${slotsText}
    必要な時間：${requiredDuration}分
    
    以下の点を考慮して提案してください：
    - なるべく朝早い時間帯を優先
    - 必要な時間が確保できる枠を選択
    - 提案は「XX:XXからYY:XXが最適です」という形式で
    `;

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates[0].content.parts[0].text) {
      return result.candidates[0].content.parts[0].text;
    }

    return '申し訳ありませんが、適切な時間帯を提案できませんでした。';
  } catch (error) {
    console.error('Gemini APIでのエラー:', error);

    return '時間帯の分析中にエラーが発生しました。';
  }
}

/**
 * テキストからMTGの期間を抽出する
 * @param {string} text メッセージテキスト
 * @return {Object|null} 開始日と終了日のオブジェクト、または抽出できない場合はnull
 */
function extractDateRange(text) {
  // YYYY/MM/DDからYYYY/MM/DDの間 のパターン
  const rangePattern = /(\d{4}\/\d{1,2}\/\d{1,2})(?:から|〜|-)(\d{4}\/\d{1,2}\/\d{1,2})/;
  const rangeMatch = text.match(rangePattern);

  if (rangeMatch) {
    return {
      startDate: new Date(rangeMatch[1]),
      endDate: new Date(rangeMatch[2]),
    };
  }

  // YYYY/MM/DD のパターン（単日の場合）
  const singlePattern = /(\d{4}\/\d{1,2}\/\d{1,2})/;
  const singleMatch = text.match(singlePattern);

  if (singleMatch) {
    const date = new Date(singleMatch[1]);

    return {
      startDate: date,
      endDate: date,
    };
  }

  return null;
}

/**
 * テキストからMTG時間（分）を抽出する
 * @param {string} text メッセージテキスト
 * @return {number|null} 分単位の時間、または抽出できない場合はnull
 */
function extractMeetingDuration(text) {
  // 時間のパターン（例: 30分, 1時間, 1.5時間）
  const patterns = [
    { regex: /(\d+)分/, multiplier: 1 },
    { regex: /(\d+(?:\.\d+)?)時間/, multiplier: 60 },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      return Math.round(parseFloat(match[1]) * pattern.multiplier);
    }
  }

  return null;
}

/**
 * 複数ユーザーの空き時間を分析して最適な時間帯を提案する
 * @param {Object[]} allEvents 全ユーザーの全日程の予定リスト
 * @param {Date} startDate 開始日
 * @param {Date} endDate 終了日
 * @param {number} duration 必要な時間（分）
 * @return {Promise<string>} 提案メッセージ
 */
async function analyzeMeetingSlots(allEvents, startDate, endDate, duration) {
  // デバッグ情報を収集する配列
  const debugInfo = [];
  debugInfo.push(
    `分析開始: 
    期間 ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}, 
    所要時間: ${duration}分`
  );
  debugInfo.push(`イベント総数: ${allEvents.length}`);

  // 日付ごとの空き時間を分析
  const dateSlots = {};
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    debugInfo.push(`分析中の日付: ${dateStr}`);

    const dayEvents = allEvents
      .filter(e => e.date.toISOString().split('T')[0] === dateStr)
      .map(e => e.events)
      .flat();

    debugInfo.push(`${dateStr}のイベント数: ${dayEvents.length}`);

    // 日付ごとのイベントの詳細をデバッグ出力
    if (dayEvents.length > 0) {
      debugInfo.push(`${dateStr}のイベント詳細:`);
      dayEvents.forEach((event, index) => {
        if (event && event.startTime && event.endTime) {
          debugInfo.push(
            `- イベント${index + 1}: ${event.title} 
            (${event.startTime.toLocaleTimeString()}-${event.endTime.toLocaleTimeString()})`
          );
        } else {
          debugInfo.push(`- イベント${index + 1}: 無効なイベントデータ`);
        }
      });
    }

    const availableSlots = analyzeAvailableTimeSlots(dayEvents, currentDate);
    debugInfo.push(`${dateStr}の空き時間枠: ${availableSlots.length}個`);

    if (availableSlots.length > 0) {
      availableSlots.forEach((slot, index) => {
        debugInfo.push(
          `- 空き時間${index + 1}: ${slot.start.toLocaleTimeString()}-${slot.end.toLocaleTimeString()}`
        );
      });
    }

    // duration分以上の空き時間枠のみを抽出
    const viableSlots = availableSlots.filter(slot => {
      const slotDuration = (slot.end - slot.start) / (1000 * 60); // 分単位に変換

      return slotDuration >= duration;
    });

    debugInfo.push(`${dateStr}の有効な空き時間枠（${duration}分以上）: ${viableSlots.length}個`);

    if (viableSlots.length > 0) {
      dateSlots[dateStr] = viableSlots;
      viableSlots.forEach((slot, index) => {
        debugInfo.push(
          `- 有効時間${index + 1}: ${slot.start.toLocaleTimeString()}-${slot.end.toLocaleTimeString()}`
        );
      });
    }

    // 次の日に進める
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    currentDate.setTime(nextDate.getTime());
  }

  // 候補がない場合
  if (Object.keys(dateSlots).length === 0) {
    debugInfo.push('候補日なし: 適切な空き時間枠が見つかりませんでした');

    // デバッグ情報を返す
    return (
      '指定された期間で、全員が参加可能な時間帯が見つかりませんでした。\n別の期間で試してみてください。\n\n【デバッグ情報】\n' +
      debugInfo.join('\n')
    );
  }

  debugInfo.push(`候補日あり: ${Object.keys(dateSlots).length}日`);

  // Gemini APIで最適な時間帯を提案
  const slotsPrompt = Object.entries(dateSlots)
    .map(([date, slots]) => {
      const formattedDate = new Date(date).toLocaleDateString('ja-JP');
      const timeSlots = slots
        .map(slot => {
          const startTime = slot.start.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const endTime = slot.end.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          });

          return `${startTime}-${endTime}`;
        })
        .join(', ');

      return `${formattedDate}: ${timeSlots}`;
    })
    .join('\n');

  try {
    const apiKey = getGeminiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const prompt = `
    以下の日程で、${duration}分のMTGに最適な時間帯を3つまで提案してください：

    ${slotsPrompt}

    以下の点を考慮して提案してください：
    - 必要な時間（${duration}分）が確保できる枠を選択
    - 各候補は「○月○日 XX:XXから」という形式で箇条書き
    - 最大3つまでの候補を提案
    `;

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    // レスポンスのステータスコードを確認
    if (responseCode !== 200) {
      console.error(`Gemini APIエラー: ステータスコード ${responseCode}, 内容: ${responseText}`);

      return `時間帯の分析中にエラーが発生しました。\n\nエラー詳細:\nステータスコード: ${responseCode}\nレスポンス: ${responseText}`;
    }

    const result = JSON.parse(responseText);

    if (result.candidates && result.candidates[0].content.parts[0].text) {
      return '以下の時間帯を提案します：\n\n' + result.candidates[0].content.parts[0].text;
    }
    // 期待されるレスポンス形式でない場合
    console.error(`Gemini APIの期待外のレスポンス形式: ${JSON.stringify(result)}`);

    return `時間帯の分析中にエラーが発生しました。\n\nAPI応答の形式が予期せぬ形式でした。\nレスポンス: ${JSON.stringify(result)}`;
  } catch (error) {
    console.error('Gemini APIでのエラー:', error);
    const errorMessage = error.toString();
    const errorStack = error.stack ? `\nスタックトレース: ${error.stack}` : '';

    return `時間帯の分析中にエラーが発生しました。\n\nエラー詳細: ${errorMessage}${errorStack}`;
  }
}
