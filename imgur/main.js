function uploadError(message, status) {
  return JSON.stringify({error: message, status: status});
}

registerTool("upload_image", function () {
  var config = JSON.parse(host.config());
  var clientID = String(config.client_id || "").trim();
  if (!/^[A-Za-z0-9]+$/.test(clientID)) {
    return uploadError("请在插件配置页填写有效的 Imgur Client ID。");
  }

  var images = JSON.parse(host.attachments("list", "{}"));
  if (images.length !== 1) {
    return uploadError("请在当前消息中附带一张图片，每次上传一张。");
  }

  var image = images[0];
  if (image.size > 20 * 1024 * 1024) {
    return uploadError("图片超过 Cuebo 单张图片上传的 20 MB 限制。");
  }

  var response = JSON.parse(host.attachments("upload", JSON.stringify({
    attachmentID: image.id,
    url: "https://api.imgur.com/3/image",
    fieldName: "image",
    headers: {Authorization: "Client-ID " + clientID}
  })));

  if (response.status === 401 || response.status === 403) {
    return uploadError("Imgur 拒绝了请求，请检查 Client ID 和应用权限。", response.status);
  }
  if (response.status === 429) {
    return uploadError("Imgur 已达到请求频率限制，请稍后再试。", response.status);
  }
  if (response.status < 200 || response.status >= 300) {
    return uploadError("Imgur 上传失败。", response.status);
  }

  var payload;
  try {
    payload = JSON.parse(response.body);
  } catch (error) {
    return uploadError("Imgur 返回了无法解析的响应，请核对上传结果后再试。", response.status);
  }

  var data = payload && payload.data;
  if (!payload || payload.success !== true || !data || typeof data.id !== "string" ||
      typeof data.link !== "string" || !/^https?:\/\/i\.imgur\.com\/[A-Za-z0-9]+\.[A-Za-z0-9]+$/.test(data.link)) {
    return uploadError("Imgur 未返回有效的图片直链，请核对上传结果后再试。", response.status);
  }

  return JSON.stringify({id: data.id, link: data.link.replace(/^http:/, "https:")});
});
