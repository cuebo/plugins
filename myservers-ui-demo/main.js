// The original MyServers demo is loaded from scripts/myservers-demo.js unchanged.
registerTool("show_myservers_demo", function () {
  var config = JSON.parse(host.config());
  var card = dashboard({surface: "dashboard", route: "", config: config});
  var result = JSON.parse(host.ui("show", JSON.stringify({
    id: "myserversDemo", title: "MyServers 组件演示", components: card.components
  })));
  return JSON.stringify({ok: result.ok === true, message: "已展示 MyServers 原版组件演示卡片"});
});
