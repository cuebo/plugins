registerTool("upload_image", function () {
  var config = JSON.parse(host.config());
  var url = String(config.upload_url || "").trim();
  if (!/^https:\/\//i.test(url)) return JSON.stringify({error: "请配置 HTTPS 上传地址"});

  var images = JSON.parse(host.attachments("list", "{}"));
  if (!images.length) return JSON.stringify({error: "请在当前消息中附带图片"});

  var headers = {};
  var token = String(config.token || "");
  if (token) {
    var name = String(config.auth_header || "Authorization").trim();
    if (!/^[A-Za-z0-9-]{1,80}$/.test(name)) return JSON.stringify({error: "鉴权请求头名称无效"});
    var prefix = config.auth_prefix === undefined || config.auth_prefix === "" ?
      (name.toLowerCase() === "authorization" ? "Bearer " : "") : String(config.auth_prefix);
    headers[name] = prefix + token;
  }

  return host.attachments("upload", JSON.stringify({
    attachmentID: images[0].id,
    url: url,
    fieldName: "image",
    headers: headers
  }));
});
