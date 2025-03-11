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
  
  // その他のリクエストの場合（現時点では実装しない）
  const response = {
    "response_type": "in_channel",
    "text": "Hello World!"
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}