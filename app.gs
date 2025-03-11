function doPost(e) {
  // リクエストパラメータをJSONとしてパース
  let params = JSON.parse(e.postData.contents);
  
  // Slack Bot用のレスポンス
  let response = {
    "response_type": "in_channel",
    "text": "Hello World!"
  };
  
  // レスポンスを返す
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}