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

function renderDemoCard(action, argsJSON) {
  var args;
  try {
    args = JSON.parse(argsJSON || "{}") || {};
  } catch (error) {
    return JSON.stringify({ ok: false, error: "参数必须是 JSON" });
  }

  var id = typeof args.id === "string" && args.id ? args.id : "demo-card";
  var title = typeof args.title === "string" && args.title ? args.title : "Demo 卡片";
  var content = typeof args.content === "string" ? args.content.trim() : "";
  if (!content) return JSON.stringify({ ok: false, error: "content 不能为空" });

  var status = action === "show" ? "已创建" : "已更新";
  var card = {
    id: id,
    title: title,
    components: [
      { id: "title", component: "Text", text: title, variant: "h3" },
      { id: "status", component: "Text", text: "状态：" + status, variant: "body" },
      { id: "content", component: "Text", text: content, variant: "body" },
      { id: "root", component: "Column", children: ["title", "status", "content"], align: "stretch" }
    ]
  };

  try {
    var result = JSON.parse(host.ui(action, JSON.stringify(card)));
    return JSON.stringify({ ok: result.ok === true, action: action, id: id, title: title, content: content, status: status });
  } catch (error) {
    return JSON.stringify({ ok: false, action: action, id: id, error: String(error) });
  }
}

registerTool("show_card", function (argsJSON) {
  return renderDemoCard("show", argsJSON);
});

registerTool("update_card", function (argsJSON) {
  return renderDemoCard("update", argsJSON);
});
