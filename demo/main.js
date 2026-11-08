registerTool("hello", function (argsJSON) {
  var args = {};
  if (typeof argsJSON === "string" && argsJSON.length > 0) {
    try {
      args = JSON.parse(argsJSON) || {};
    } catch (error) {
      return JSON.stringify({ ok: false, error: "参数必须是 JSON" });
    }
  }

  var name = typeof args.name === "string" ? args.name.trim() : "";
  if (!name) name = "朋友";
  return JSON.stringify({ ok: true, message: "你好，" + name + "！" });
});
