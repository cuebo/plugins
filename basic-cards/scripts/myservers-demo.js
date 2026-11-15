const MYSERVERS_LOGO_URL = "https://myservers.plus/images/logo.png";

function myServersIcon(systemName) {
  return { systemName: systemName || "shippingbox.fill", url: MYSERVERS_LOGO_URL };
}

function demoLabel(ctx) {
  return (ctx.config && ctx.config.host_label) || "NAS";
}

function demoAccent(ctx) {
  const accent = (ctx.config && ctx.config.accent) || "blue";
  if (accent === "green") return "PLUGIN_ACCENT_GREEN";
  if (accent === "purple") return "PLUGIN_ACCENT_PURPLE";
  return "PLUGIN_ACCENT_BLUE";
}

function demoPoints() {
  return [
    { label: "00:00", value: 26 },
    { label: "03:00", value: 31 },
    { label: "06:00", value: 24 },
    { label: "09:00", value: 38 },
    { label: "12:00", value: 28 },
    { label: "15:00", value: 46 },
    { label: "18:00", value: 34 },
    { label: "21:00", value: 52 },
    { label: "24:00", value: 32.4 }
  ];
}

function demoMemoryPoints() {
  return [
    { label: "00:00", value: 38 },
    { label: "04:00", value: 42 },
    { label: "08:00", value: 47 },
    { label: "12:00", value: 45 },
    { label: "16:00", value: 51 },
    { label: "20:00", value: 54 },
    { label: "24:00", value: 56 }
  ];
}

function demoMemorySegments() {
  return [
    { label: "已用", value: 56, appearance: { accent: "PLUGIN_ACCENT_BLUE" } },
    { label: "缓存", value: 28, appearance: { accent: "PLUGIN_ACCENT_TEAL" } },
    { label: "可用", value: 16, appearance: { accent: "PLUGIN_ACCENT_GRAY" } }
  ];
}

function demoMetricSummaries() {
  return [
    { title: "平均", value: { number: 28.6, unit: "%", format: "percent" } },
    { title: "最高", value: { number: 52.1, unit: "%", format: "percent" } },
    { title: "最低", value: { number: 15.3, unit: "%", format: "percent" } },
    { title: "当前", value: { number: 32.4, unit: "%", format: "percent" } }
  ];
}

function prettyCode(component) {
  return JSON.stringify(component, null, 2);
}

function componentCatalogCard(example) {
  return {
    id: example.id + "-catalog-card",
    card: {
      appearance: { accent: "PLUGIN_ACCENT_BLUE", variant: "PLUGIN_COMPONENT_VARIANT_TINTED" },
      onTap: {
        navigate: {
          surface: "sheet",
          route: "component:" + example.id,
          detents: ["medium", "large"],
          initialDetent: "medium"
        }
      },
      children: [
        { id: example.id + "-title", text: { text: example.title, style: "PLUGIN_TEXT_STYLE_TITLE" } },
        { id: example.id + "-subtitle", text: { text: example.subtitle, style: "PLUGIN_TEXT_STYLE_SUBTITLE" } },
        { id: example.id + "-description", text: { text: example.description, style: "PLUGIN_TEXT_STYLE_CAPTION" } }
      ]
    }
  };
}

function bottomSheetComponents(ctx) {
  const route = ctx.route || "";
  const componentId = route.indexOf("component:") === 0 ? route.slice("component:".length) : "component-stack";
  const example = demoComponentCatalog(ctx, demoLabel(ctx)).find(function(item) { return item.id === componentId; });
  if (!example) {
    return [{ id: "sheet-missing", stateBlock: { kind: "PLUGIN_STATE_KIND_ERROR", title: "示例不存在", message: componentId } }];
  }
  return [
    { id: "sheet-title", text: { text: example.title, style: "PLUGIN_TEXT_STYLE_TITLE" } },
    { id: "sheet-subtitle", text: { text: example.subtitle, style: "PLUGIN_TEXT_STYLE_SUBTITLE" } },
    { id: "sheet-description", text: { text: example.description, style: "PLUGIN_TEXT_STYLE_SUBTITLE" } },
    { id: "sheet-render-label", text: { text: "组件详情", style: "PLUGIN_TEXT_STYLE_CAPTION" } },
    example.component,
    {
      id: "sheet-code",
      disclosure: {
        title: "插件代码",
        subtitle: "展开查看可复制的 JSON 示例",
        expanded: false,
        appearance: { accent: "PLUGIN_ACCENT_GRAY", variant: "PLUGIN_COMPONENT_VARIANT_TINTED" },
        children: [
          {
            id: "sheet-code-block",
            codeBlock: {
              title: "JSON",
              language: "json",
              wrap: true,
              code: prettyCode(example.component),
              appearance: { accent: "PLUGIN_ACCENT_GRAY", hideBackground: true }
            }
          }
        ]
      }
    }
  ];
}

function demoComponentCatalog(ctx, label) {
  const stackComponent = {
    id: "render-stack",
    stack: {
      axis: "PLUGIN_LAYOUT_AXIS_HORIZONTAL",
      spacing: 8,
      children: [
        { id: "render-stack-icon", icon: { appearance: { accent: demoAccent(ctx), iconSource: { systemName: "square.stack.3d.up.fill" } } } },
        { id: "render-stack-text", text: { text: "横向/纵向组合容器", style: "PLUGIN_TEXT_STYLE_BODY" } },
        { id: "render-stack-badge", badge: { text: "stack", appearance: { accent: demoAccent(ctx) } } }
      ]
    }
  };
  const gridComponent = {
    id: "render-grid",
    grid: {
      columns: 2,
      spacing: 8,
      appearance: { container: "PLUGIN_CONTAINER_STYLE_NONE" },
      children: [
        { id: "render-grid-cpu", value: { title: "CPU", value: { number: 0.32, format: "PLUGIN_VALUE_FORMAT_PERCENT" }, appearance: { accent: demoAccent(ctx), iconSource: { systemName: "cpu" } } } },
        { id: "render-grid-mem", value: { title: "内存", value: { number: 0.56, format: "PLUGIN_VALUE_FORMAT_PERCENT" }, appearance: { accent: "PLUGIN_ACCENT_GREEN", iconSource: { systemName: "memorychip" } } } }
      ]
    }
  };
  const cardComponent = {
    id: "render-card",
    card: {
      appearance: { accent: "PLUGIN_ACCENT_TEAL", variant: "PLUGIN_COMPONENT_VARIANT_FILLED" },
      children: [
        { id: "render-card-title", text: { text: "Card", style: "PLUGIN_TEXT_STYLE_TITLE" } },
        { id: "render-card-body", text: { text: "卡片容器，可包裹任意子组件并承载点击动作。", style: "PLUGIN_TEXT_STYLE_BODY" } }
      ],
      onTap: { plugin: { actionId: "refresh" } }
    }
  };
  const textComponent = {
    id: "render-text",
    text: { text: "Text：标题、副标题、正文、说明、数值文本", style: "PLUGIN_TEXT_STYLE_BODY", appearance: { accent: demoAccent(ctx) } }
  };
  const valueComponent = {
    id: "render-value",
    value: { title: "Value", subtitle: "标题 + 数值 + 趋势", value: { number: 0.724, format: "PLUGIN_VALUE_FORMAT_PERCENT", trend: 3.4, status: "PLUGIN_STATUS_HEALTHY" }, appearance: { accent: demoAccent(ctx), iconSource: { systemName: "gauge.medium" } } }
  };
  const badgeComponent = {
    id: "render-badge",
    badge: { text: "Badge", value: { text: "运行中", status: "PLUGIN_STATUS_RUNNING" }, appearance: { accent: "PLUGIN_ACCENT_GREEN" } }
  };
  const buttonComponent = {
    id: "render-button",
    button: { title: "Button", subtitle: "点击触发插件 action", appearance: { accent: demoAccent(ctx), iconSource: { systemName: "bolt.circle" }, variant: "PLUGIN_COMPONENT_VARIANT_FILLED" }, onTap: { plugin: { actionId: "refresh" } } }
  };
  const toggleComponent = {
    id: "render-toggle",
    toggle: {
      title: "状态通知",
      subtitle: "切换后将新状态传给插件 Action",
      isOn: true,
      appearance: { accent: "PLUGIN_ACCENT_GREEN", iconSource: { systemName: "bell.badge.fill" }, variant: "PLUGIN_COMPONENT_VARIANT_TINTED" },
      onChange: { plugin: { actionId: "toggleDemo", params: { setting: "notifications" } } }
    }
  };
  const bottomSheetComponent = {
    id: "render-bottom-sheet",
    button: {
      title: "打开半弹层",
      subtitle: "支持紧凑、中等和全屏三档高度",
      appearance: { accent: "PLUGIN_ACCENT_PURPLE", iconSource: { systemName: "rectangle.bottomhalf.inset.filled" }, variant: "PLUGIN_COMPONENT_VARIANT_FILLED" },
      onTap: {
        navigate: {
          surface: "sheet",
          route: "component:component-bottom-sheet",
          detents: ["compact", "medium", "large"],
          initialDetent: "compact"
        }
      }
    }
  };
  const listComponent = {
    id: "render-list",
    list: {
      title: "List",
      items: [
        { title: "第一项", subtitle: "带状态和值", value: { text: "正常", status: "PLUGIN_STATUS_HEALTHY" }, appearance: { accent: "PLUGIN_ACCENT_GREEN", iconSource: { systemName: "checkmark.circle" } } },
        { title: "第二项", subtitle: "可点击", value: { text: "查看" }, appearance: { accent: demoAccent(ctx), iconSource: { systemName: "arrow.right.circle" } }, onTap: { plugin: { actionId: "openDetail" } } }
      ],
      appearance: { accent: demoAccent(ctx), variant: "PLUGIN_COMPONENT_VARIANT_TINTED" }
    }
  };
  const progressComponent = {
    id: "render-progress",
    progress: { title: "Progress", subtitle: "0 到 1 的线性进度", value: { number: 0.58, format: "PLUGIN_VALUE_FORMAT_PERCENT", status: "PLUGIN_STATUS_RUNNING" }, progress: 0.58, appearance: { accent: demoAccent(ctx), iconSource: { systemName: "speedometer" } } }
  };
  const circularProgressComponent = {
    id: "render-circular-progress",
    circularProgress: {
      title: "内存使用率",
      subtitle: "已用 10.2 GB / 16 GB",
      value: { number: 0.64, format: "PLUGIN_VALUE_FORMAT_PERCENT", status: "PLUGIN_STATUS_HEALTHY" },
      progress: 0.64,
      appearance: {
        accent: "PLUGIN_ACCENT_PURPLE",
        size: "PLUGIN_COMPONENT_SIZE_LARGE",
        iconSource: { systemName: "memorychip" }
      }
    }
  };
  const lineChartComponent = {
    id: "render-line-chart",
    chart: { title: "Chart Line", kind: "PLUGIN_CHART_KIND_LINE", points: demoPoints(), options: { min: 0, max: 100, showLabels: true }, appearance: { accent: demoAccent(ctx) } }
  };
  const multiLineChartComponent = {
    id: "render-multi-line-chart",
    multiLineChart: {
      title: "双序列折线图",
      series: [
        {
          id: "cpu",
          name: "CPU",
          points: demoPoints(),
          appearance: { accent: "PLUGIN_ACCENT_BLUE" }
        },
        {
          id: "memory",
          name: "内存",
          points: demoMemoryPoints(),
          appearance: { accent: "PLUGIN_ACCENT_PURPLE" }
        }
      ],
      options: { min: 0, max: 100, showLabels: true },
      appearance: { accent: demoAccent(ctx) }
    }
  };
  const areaChartComponent = {
    id: "render-area-chart",
    chart: { title: "Chart Area", kind: "PLUGIN_CHART_KIND_AREA", points: demoMemoryPoints(), options: { min: 0, max: 100, showLabels: true }, appearance: { accent: "PLUGIN_ACCENT_GREEN" } }
  };
  const barChartComponent = {
    id: "render-bar-chart",
    chart: { title: "Chart Bar", kind: "PLUGIN_CHART_KIND_BAR", points: demoPoints().slice(0, 6), options: { min: 0, max: 100, showLabels: true }, appearance: { accent: "PLUGIN_ACCENT_ORANGE" } }
  };
  const donutChartComponent = {
    id: "render-donut-chart",
    chart: { title: "Chart Donut", kind: "PLUGIN_CHART_KIND_DONUT", points: [{ label: "A", value: 40 }, { label: "B", value: 35 }, { label: "C", value: 25 }], appearance: { accent: "PLUGIN_ACCENT_PURPLE" } }
  };
  const gaugeChartComponent = {
    id: "render-gauge-chart",
    chart: { title: "Chart Gauge", kind: "PLUGIN_CHART_KIND_GAUGE", points: [{ label: "使用率", value: 58 }], options: { min: 0, max: 100, hideRange: true }, appearance: { accent: demoAccent(ctx) } }
  };
  const segmentedGaugeComponent = {
    id: "render-segmented-gauge",
    segmentedGauge: { title: "Segmented Gauge", segments: demoMemorySegments(), centerValue: { number: 0.56, format: "PLUGIN_VALUE_FORMAT_PERCENT" }, showLegend: true, appearance: { accent: demoAccent(ctx) } }
  };
  const tableComponent = {
    id: "render-table",
    table: {
      title: "Table",
      columns: [
        { key: "name", title: "名称" },
        { key: "status", title: "状态", width: "PLUGIN_COMPONENT_SIZE_COMPACT" },
        { key: "usage", title: "占用", format: "PLUGIN_VALUE_FORMAT_PERCENT", width: "PLUGIN_COMPONENT_SIZE_COMPACT" }
      ],
      rows: [
        { id: "row-1", values: { name: { text: "worker" }, status: { text: "运行中", status: "PLUGIN_STATUS_RUNNING" }, usage: { number: 0.32, format: "PLUGIN_VALUE_FORMAT_PERCENT" } }, status: "PLUGIN_STATUS_RUNNING" },
        { id: "row-2", values: { name: { text: "backup" }, status: { text: "空闲" }, usage: { number: 0.04, format: "PLUGIN_VALUE_FORMAT_PERCENT" } }, status: "PLUGIN_STATUS_HEALTHY" }
      ],
      appearance: { accent: demoAccent(ctx), variant: "PLUGIN_COMPONENT_VARIANT_TINTED" }
    }
  };
  const descriptionListComponent = {
    id: "render-description-list",
    descriptionList: {
      title: "Description List",
      columns: 2,
      items: [
        { title: "插件", value: { text: label } },
        { title: "版本", value: { text: "1.0.23" } },
        { title: "入口", value: { text: ctx.surface || "detail" } },
        { title: "动作", value: { text: "受控 Action" } }
      ],
      appearance: { accent: demoAccent(ctx) }
    }
  };
  const formComponent = {
    id: "render-form",
    form: {
      title: "Form",
      submitTitle: "提交",
      fields: [
        { key: "keyword", label: "关键字", input: "PLUGIN_CONFIG_INPUT_TEXT", value: "demo" },
        { key: "enabled", label: "启用", input: "PLUGIN_CONFIG_INPUT_SWITCH", value: "true" }
      ],
      onSubmit: { plugin: { actionId: "refresh" } },
      appearance: { accent: demoAccent(ctx) }
    }
  };
  const actionMenuComponent = {
    id: "render-action-menu",
    actionMenu: { title: "Action Menu", items: [{ title: "刷新", appearance: { iconSource: { systemName: "arrow.clockwise" } }, onTap: { plugin: { actionId: "refresh" } } }, { title: "危险操作", destructive: true, appearance: { iconSource: { systemName: "exclamationmark.triangle" } }, onTap: { plugin: { actionId: "refresh" } } }], appearance: { accent: demoAccent(ctx), iconSource: { systemName: "ellipsis.circle" } } }
  };
  const confirmComponent = {
    id: "render-confirm",
    confirm: { title: "Confirm", message: "确认组件用于危险操作二次确认。", confirmTitle: "确认", cancelTitle: "取消", destructive: true, onConfirm: { plugin: { actionId: "refresh" } }, appearance: { accent: "PLUGIN_ACCENT_RED", iconSource: { systemName: "checkmark.shield" } } }
  };
  const tabsComponent = {
    id: "render-tabs",
    tabs: {
      selectedId: "first",
      tabs: [
        { id: "first", title: "Tab A", children: [{ id: "tab-a-text", text: { text: "Tabs：分段展示一组子组件", style: "PLUGIN_TEXT_STYLE_BODY" } }] },
        { id: "second", title: "Tab B", children: [{ id: "tab-b-badge", badge: { text: "第二页", appearance: { accent: "PLUGIN_ACCENT_PURPLE" } } }] }
      ],
      appearance: { accent: demoAccent(ctx), variant: "PLUGIN_COMPONENT_VARIANT_TINTED" }
    }
  };
  const disclosureComponent = {
    id: "render-disclosure",
    disclosure: {
      title: "Disclosure",
      subtitle: "折叠区块",
      expanded: true,
      children: [{ id: "disclosure-text", text: { text: "这里可以继续组合任意组件。", style: "PLUGIN_TEXT_STYLE_BODY" } }],
      appearance: { accent: demoAccent(ctx) }
    }
  };
  const stateEmptyComponent = {
    id: "render-state-empty",
    stateBlock: { kind: "PLUGIN_STATE_KIND_EMPTY", title: "State Empty", message: "空状态展示。", appearance: { accent: "PLUGIN_ACCENT_GRAY" } }
  };
  const stateLoadingComponent = {
    id: "render-state-loading",
    stateBlock: { kind: "PLUGIN_STATE_KIND_LOADING", title: "State Loading", message: "加载状态展示。", appearance: { accent: demoAccent(ctx) } }
  };
  const stateErrorComponent = {
    id: "render-state-error",
    stateBlock: { kind: "PLUGIN_STATE_KIND_ERROR", title: "State Error", message: "错误状态展示。", appearance: { accent: "PLUGIN_ACCENT_RED" } }
  };
  const stateCustomComponent = {
    id: "render-state-custom",
    stateBlock: {
      kind: "PLUGIN_STATE_KIND_EMPTY",
      title: "自定义状态",
      message: "状态组件支持 HTTP/HTTPS URL 图标，并在加载失败时回退到 SF Symbol。",
      appearance: { accent: demoAccent(ctx), iconSource: myServersIcon("server.rack") }
    }
  };
  const codeBlockComponent = {
    id: "render-code-block",
    codeBlock: { title: "Code Block", language: "json", wrap: true, code: JSON.stringify({ ok: true, component: "codeBlock" }, null, 2), appearance: { accent: demoAccent(ctx) } }
  };
  const iconComponent = {
    id: "render-icon",
    icon: { appearance: { accent: demoAccent(ctx), size: "PLUGIN_COMPONENT_SIZE_LARGE", iconSource: myServersIcon("shippingbox.fill") } }
  };
  const imageComponent = {
    id: "render-image",
    image: { url: "https://dummyimage.com/600x240/2563eb/ffffff.png&text=Plugin+Image", mode: "fit", appearance: { size: "PLUGIN_COMPONENT_SIZE_REGULAR" } }
  };
  const dividerComponent = {
    id: "render-divider",
    divider: {}
  };
  const spacerComponent = {
    id: "render-spacer",
    spacer: { length: 12 }
  };

  return [
    { id: "component-stack", title: "堆栈布局", subtitle: "Stack", description: "横向或纵向组合多个子组件。", component: stackComponent },
    { id: "component-grid", title: "网格布局", subtitle: "Grid", description: "按列数排列指标和内容。", component: gridComponent },
    { id: "component-card", title: "卡片", subtitle: "Card", description: "可承载内容与点击动作的卡片。", component: cardComponent },
    { id: "component-text", title: "文本", subtitle: "Text", description: "展示标题、正文和说明文本。", component: textComponent },
    { id: "component-value", title: "数值", subtitle: "Value", description: "展示数值、单位、趋势和状态。", component: valueComponent },
    { id: "component-badge", title: "徽标", subtitle: "Badge", description: "展示简短状态和值。", component: badgeComponent },
    { id: "component-button", title: "按钮", subtitle: "Button", description: "触发插件受控 Action。", component: buttonComponent },
    { id: "component-toggle", title: "开关", subtitle: "Toggle", description: "切换布尔状态并触发插件 Action。", component: toggleComponent },
    { id: "component-bottom-sheet", title: "半弹层", subtitle: "Bottom Sheet", description: "打开支持多档高度的原生弹层。", component: bottomSheetComponent },
    { id: "component-list", title: "列表", subtitle: "List", description: "展示多行项目及交互动作。", component: listComponent },
    { id: "component-progress", title: "进度条", subtitle: "Progress", description: "展示 0 到 1 的线性进度。", component: progressComponent },
    { id: "component-circular-progress", title: "圆形进度", subtitle: "Circular Progress", description: "用圆环和中心值展示 0 到 1 的单项进度。", component: circularProgressComponent },
    { id: "component-line-chart", title: "折线图", subtitle: "Chart Line", description: "展示连续趋势数据。", component: lineChartComponent },
    { id: "component-multi-line-chart", title: "多序列折线图", subtitle: "Multi-series Line Chart", description: "在同一坐标系对比多组趋势数据。", component: multiLineChartComponent },
    { id: "component-area-chart", title: "面积图", subtitle: "Chart Area", description: "展示面积填充的趋势数据。", component: areaChartComponent },
    { id: "component-bar-chart", title: "柱状图", subtitle: "Chart Bar", description: "展示柱状对比数据。", component: barChartComponent },
    { id: "component-donut-chart", title: "环形图", subtitle: "Chart Donut", description: "展示数据占比分布。", component: donutChartComponent },
    { id: "component-gauge-chart", title: "仪表图", subtitle: "Chart Gauge", description: "展示单项使用率仪表。", component: gaugeChartComponent },
    { id: "component-segmented-gauge", title: "分段仪表", subtitle: "Segmented Gauge", description: "展示多段占比分布。", component: segmentedGaugeComponent },
    { id: "component-table", title: "表格", subtitle: "Table", description: "展示结构化行列数据。", component: tableComponent },
    { id: "component-description-list", title: "描述列表", subtitle: "Description List", description: "展示配置和元数据键值。", component: descriptionListComponent },
    { id: "component-form", title: "表单", subtitle: "Form", description: "展示输入项并提交 Action。", component: formComponent },
    { id: "component-action-menu", title: "操作菜单", subtitle: "Action Menu", description: "展示一组普通或危险操作。", component: actionMenuComponent },
    { id: "component-confirm", title: "确认框", subtitle: "Confirm", description: "为危险操作提供二次确认。", component: confirmComponent },
    { id: "component-tabs", title: "标签页", subtitle: "Tabs", description: "分段切换多组子组件。", component: tabsComponent },
    { id: "component-disclosure", title: "折叠面板", subtitle: "Disclosure", description: "可展开或收起的内容区块。", component: disclosureComponent },
    { id: "component-state-empty", title: "空状态", subtitle: "State Empty", description: "展示无内容的空状态。", component: stateEmptyComponent },
    { id: "component-state-loading", title: "加载状态", subtitle: "State Loading", description: "展示内容加载状态。", component: stateLoadingComponent },
    { id: "component-state-error", title: "错误状态", subtitle: "State Error", description: "展示错误和异常状态。", component: stateErrorComponent },
    { id: "component-state-custom", title: "自定义状态", subtitle: "State Custom", description: "使用 SF Symbol 或 URL 图标展示任意状态。", component: stateCustomComponent },
    { id: "component-code-block", title: "代码块", subtitle: "Code Block", description: "展示可复制的代码片段。", component: codeBlockComponent },
    { id: "component-icon", title: "图标", subtitle: "Icon", description: "展示 SF Symbol 或 HTTP/HTTPS URL 图标。", component: iconComponent },
    { id: "component-image", title: "图片", subtitle: "Image", description: "展示远程图片资源。", component: imageComponent },
    { id: "component-divider", title: "分隔线", subtitle: "Divider", description: "分隔上下内容区域。", component: dividerComponent },
    { id: "component-spacer", title: "间距", subtitle: "Spacer", description: "控制组件之间的留白。", component: spacerComponent }
  ];
}

function demoComponentShowcase(ctx, label) {
  const catalog = demoComponentCatalog(ctx, label);
  return [
    {
      id: "plugin-detail-notice",
      card: {
        appearance: { accent: demoAccent(ctx), iconSource: { systemName: "puzzlepiece.extension.fill" }, variant: "PLUGIN_COMPONENT_VARIANT_FILLED" },
        children: [
          { id: "plugin-detail-notice-title", text: { text: "本示例详情由插件实现", style: "PLUGIN_TEXT_STYLE_TITLE" } },
          { id: "plugin-detail-notice-body", text: { text: "页面布局、卡片、半弹层与代码展示均由插件动态返回。", style: "PLUGIN_TEXT_STYLE_CAPTION" } }
        ]
      }
    },
    {
      id: "component-catalog",
      grid: {
        columns: 2,
        spacing: 10,
        appearance: { container: "PLUGIN_CONTAINER_STYLE_NONE" },
        children: catalog.map(componentCatalogCard)
      }
    }
  ];
}

function demoNavigationActions(ctx) {
  return [
    {
      title: "刷新示例",
      subtitle: "执行插件 Action 并刷新当前页面",
      appearance: { accent: demoAccent(ctx), iconSource: { systemName: "arrow.clockwise" } },
      onTap: { plugin: { actionId: "refresh" } }
    },
    {
      title: "打开半弹层",
      subtitle: "从菜单打开原生多档半弹层",
      appearance: { accent: "PLUGIN_ACCENT_PURPLE", iconSource: { systemName: "rectangle.bottomhalf.inset.filled" } },
      onTap: {
        navigate: {
          surface: "sheet",
          route: "component:component-action-menu",
          detents: ["medium", "large"],
          initialDetent: "medium"
        }
      }
    },
    {
      title: "危险操作示例",
      subtitle: "通过半弹层进行二次确认",
      destructive: true,
      appearance: { accent: "PLUGIN_ACCENT_RED", iconSource: { systemName: "exclamationmark.triangle.fill" } },
      onTap: {
        navigate: {
          surface: "sheet",
          route: "navigation-danger",
          detents: ["compact", "medium"],
          initialDetent: "compact"
        }
      }
    }
  ];
}

function demoDangerSheet(ctx) {
  return [
    {
      id: "navigation-danger-confirm",
      confirm: {
        title: "执行危险操作？",
        message: "菜单可以标记为危险操作，并在真正执行前用原生半弹层再次确认。",
        confirmTitle: "确认执行",
        cancelTitle: "取消",
        destructive: true,
        onConfirm: { plugin: { actionId: "menuDangerDemo" } },
        appearance: { accent: "PLUGIN_ACCENT_RED", iconSource: { systemName: "exclamationmark.triangle.fill" } }
      }
    }
  ];
}

globalThis.demoBackgroundCount = 0;

globalThis.background = function(ctx) {
  if (ctx.taskId === "refresh-demo") {
    globalThis.demoBackgroundCount = globalThis.demoBackgroundCount + 1;
  }
  return {};
};

globalThis.dashboard = function(ctx) {
  const label = demoLabel(ctx);
  return {
    title: "",
    components: [
      {
        id: "plugin-summary",
        value: {
          title: label + " 示例插件",
          subtitle: "组件 · 半弹层 · 示例代码",
          value: {
            text: "35 个组件",
            status: "PLUGIN_STATUS_RUNNING"
          },
          appearance: {
            accent: demoAccent(ctx),
            iconSource: myServersIcon("shippingbox.fill"),
            hideBackground: true
          },
          onTap: { plugin: { actionId: "openDetail" } }
        }
      }
    ]
  };
};

globalThis.widget = function(ctx) {
  const label = demoLabel(ctx);
  const size = ctx.widgetSize || "unspecified";
  const baseChildren = [
    {
      id: "widget-header",
      stack: {
        axis: "PLUGIN_LAYOUT_AXIS_HORIZONTAL",
        spacing: 8,
        children: [
          { id: "widget-icon", icon: { appearance: { accent: demoAccent(ctx), iconSource: myServersIcon("shippingbox.fill") } } },
          { id: "widget-title", text: { text: label + " 在线", style: "PLUGIN_TEXT_STYLE_TITLE" } },
          { id: "widget-state", badge: { text: "健康", value: { status: "PLUGIN_STATUS_HEALTHY" }, appearance: { accent: "PLUGIN_ACCENT_GREEN" } } }
        ]
      }
    },
    {
      id: "widget-summary",
      text: {
        text: size === "small"
          ? "存储 64% · 12 个容器"
          : "存储 64% · 负载 58% · 刷新 " + String(globalThis.demoBackgroundCount) + " 次",
        style: "PLUGIN_TEXT_STYLE_CAPTION",
        appearance: { accent: demoAccent(ctx) }
      }
    }
  ];

  if (size === "medium" || size === "large" || size === "unspecified") {
    baseChildren.push({
      id: "widget-storage",
      progress: {
        title: "主存储池",
        subtitle: "剩余 7.2 TB",
        value: { number: 0.64, format: "PLUGIN_VALUE_FORMAT_PERCENT", status: "PLUGIN_STATUS_HEALTHY" },
        progress: 0.64,
        appearance: { accent: "PLUGIN_ACCENT_TEAL", iconSource: { systemName: "internaldrive.fill" }, hideBackground: true }
      }
    });
  }

  if (size === "large") {
    baseChildren.push({
      id: "widget-resources",
      list: {
        title: "资源概览",
        items: [
          { title: "CPU", subtitle: "过去 5 分钟平均", value: { text: "32%", status: "PLUGIN_STATUS_HEALTHY" }, appearance: { accent: demoAccent(ctx), iconSource: { systemName: "cpu" } } },
          { title: "内存", subtitle: "缓存 28% · 可用 16%", value: { text: "56%", status: "PLUGIN_STATUS_RUNNING" }, appearance: { accent: "PLUGIN_ACCENT_GREEN", iconSource: { systemName: "memorychip" } } },
          { title: "网络", subtitle: "上传下载合计", value: { text: "84 MB/s" }, appearance: { accent: "PLUGIN_ACCENT_ORANGE", iconSource: { systemName: "network" } } }
        ],
        appearance: { accent: demoAccent(ctx), hideBackground: true }
      }
    });
  }

  return {
    title: label + " 小组件",
    components: [
      {
        id: "widget-card",
        card: {
          appearance: { accent: demoAccent(ctx), iconSource: { systemName: "shippingbox.fill" }, variant: "PLUGIN_COMPONENT_VARIANT_TINTED" },
          onTap: { plugin: { actionId: "openDetail" } },
          children: baseChildren
        }
      }
    ]
  };
};

globalThis.detail = function(ctx) {
  const label = demoLabel(ctx);
  return {
    title: "NAS 示例详情",
    navigationActions: demoNavigationActions(ctx),
    components: demoComponentShowcase(ctx, label)
  };
};

globalThis.sheet = function(ctx) {
  if (ctx.route === "navigation-danger") {
    return {
      title: "危险操作示例",
      components: demoDangerSheet(ctx)
    };
  }
  return {
    title: "组件详情",
    components: bottomSheetComponents(ctx)
  };
};

globalThis.actions = {
  openDetail: function(ctx) {
    return {
      effects: [
        { toast: { text: "正在打开插件详情", level: "info" } },
        { navigate: { surface: "detail", route: "detail" } }
      ]
    };
  },
  refresh: function(ctx) {
    return {
      effects: [
        { toast: { text: "插件动作已在 NAS 上执行：" + demoLabel(ctx), level: "success" } },
        { refresh: { surface: "current" } },
        {
          replaceComponents: {
            targetId: "metrics",
            components: [
              {
                id: "last-action",
                value: {
                  title: "最近动作",
                  value: { text: "refresh", status: "PLUGIN_STATUS_HEALTHY" },
                  subtitle: "由 Goja actions.refresh(ctx) 返回",
                  appearance: { accent: demoAccent(ctx), iconSource: { systemName: "bolt.circle" }, variant: "PLUGIN_COMPONENT_VARIANT_TINTED" }
                }
              }
            ]
          }
        }
      ]
    };
  },
  toggleDemo: function(ctx) {
    var enabled = ctx.params && ctx.params.value === "true";
    return {
      effects: [
        { toast: { text: enabled ? "状态通知已开启" : "状态通知已关闭", level: "success" } }
      ]
    };
  },
  sheetRefresh: function(ctx) {
    return {
      effects: [
        { toast: { text: "已刷新半弹层：" + (ctx.route || "sheet-demo"), level: "success" } },
        { refresh: { surface: "sheet" } }
      ]
    };
  },
  menuDangerDemo: function(ctx) {
    return {
      effects: [
        { toast: { text: "危险操作示例已确认（未执行真实变更）", level: "warning" } }
      ]
    };
  }
};
