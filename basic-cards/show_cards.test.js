const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

let shown;
const registered = {};
const context = {
  registerTool(name, handler) { registered[name] = handler; },
  host: { ui(action, raw) {
    assert.equal(action, 'show');
    shown = JSON.parse(raw);
    return JSON.stringify({ok: true});
  } }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname + '/scripts/cuebo-ui-demo.js', 'utf8'), context);
vm.runInContext(fs.readFileSync(__dirname + '/main.js', 'utf8'), context);

assert.deepEqual(Object.keys(registered), ['show_cards']);
const result = JSON.parse(registered.show_cards(JSON.stringify({cards: [
  {title: '日程', headline: '评审会', facts: [{text: '会议室 301'}]},
  {title: '文件', resource: {title: '需求文档.pdf', url: 'https://example.com/doc'}},
  {title: '趋势', headline: '26,480', points: [{label: '周一', value: 12}, {label: '周二', value: 18}]},
  {title: '进度', headline: '运输中', steps: [{title: '已发货'}, {title: '运输中'}], current_step: 1},
  {title: '环境', headline: '12°C', footer: [{text: '湿度 45%'}]},
  {title: '设备', headline: '运行中', detail: '已运行 3 小时'}
]})));
assert.equal(result.shown, true);
assert.equal(result.shortenedCards.length, 0);
assert.equal(shown.components.length, 1);
assert.equal(shown.components[0].grid.columns, 2);
assert.equal(shown.components[0].grid.children.length, 6);
assert.equal(shown.components[0].grid.children.every(node => node.card.aspectRatio === 1), true);
assert.equal(shown.components[0].grid.children.every(node => node.card.expandOnTap === true), true);
assert.equal(shown.components[0].grid.children[0].card.children[1].text.fontSize, 18);
const withFooter = shown.components[0].grid.children[4].card.bottomChildren;
assert.equal(withFooter.length, 1);
assert.equal(withFooter[0].id.endsWith('-footer'), true);
assert.equal(withFooter[0].card.expandOnTap, true);
assert.equal(withFooter[0].card.detailTitle, '环境');
assert.equal(withFooter[0].card.detailChildren.some(node => node.id.endsWith('-headline')), true);
assert.equal(shown.components[0].grid.children[3].card.children.find(node => node.progress).progress.progress, 1);
assert.equal(JSON.parse(registered.show_cards(JSON.stringify({cards: [
  {title: '状态', headline: '正常'}
]}))).count, 1);
assert.equal(shown.components[0].grid.columns, 2);
const longResult = JSON.parse(registered.show_cards(JSON.stringify({cards: [{
  title: '空间主要被什么占用', subtitle: 'NAS 主机的详细磁盘统计',
  facts: [
    {text: '系统盘已用百分之三十五，剩余三十吉字节'},
    {text: '存储池一占用百分之八，剩余空间充足'},
    {text: '存储池二占用百分之七'},
    {text: '另一个测量项目'}
  ],
  footer: [{text: 'inode 使用率低，无需担心'}, {text: '文件数量正常'}, {text: '还有更多信息'}]
}]})));
assert.deepEqual(longResult.shortenedCards, [1]);
const cardNodes = shown.components[0].grid.children[0].card.children;
const detail = shown.components[0].grid.children[0].card;
assert.equal(cardNodes[0].stack.children[0].stack.children[0].text.text.endsWith('…'), true);
assert.equal(cardNodes.filter(node => node.id.includes('-fact-')).length, 2);
assert.equal(detail.bottomChildren[0].card.children[0].stack.children.length, 2);
assert.equal(detail.detailTitle, '空间主要被什么占用');
assert.equal(detail.detailChildren.filter(node => node.id.includes('-fact-')).length, 4);
assert.equal(detail.detailChildren.filter(node => node.id.includes('-footer-') && node.stack).length, 3);
assert.equal(detail.detailChildren.find(node => node.id.endsWith('-fact-0')).stack.children.at(-1).text.text,
  '系统盘已用百分之三十五，剩余三十吉字节');
JSON.parse(registered.show_cards(JSON.stringify({cards: [{
  title: '文件', resource: {title: '报告', url: 'https://example.com/report'},
  actions: [{title: '预览', url: 'https://example.com/report'}],
  footer: [{text: '今天更新'}]
}]})));
const combinedCard = shown.components[0].grid.children[0].card;
assert.equal(combinedCard.bottomChildren[0].id.endsWith('-footer'), true);
assert.equal(combinedCard.children.some(node => node.button || node.id.endsWith('-actions')), false);
assert.equal(combinedCard.children.find(node => node.id.endsWith('-resource')).card.onTap, undefined);
assert.equal(combinedCard.detailChildren.some(node => node.id.endsWith('-actions')), true);
assert.equal(shown.components[0].grid.children[0].card.detailChildren.find(node => node.id.endsWith('-resource')).card.onTap.openURL,
  'https://example.com/report');
const catalog = context.detail({route: 'catalog', config: {}});
const catalogEntries = catalog.components.find(node => node.id === 'component-catalog').grid.children;
assert.equal(catalog.components.some(node => node.id === 'composed-cards-grid'), false);
assert.equal(catalogEntries.some(node => node.id.startsWith('composed-card-')), false);
const denseResult = JSON.parse(registered.show_cards(JSON.stringify({cards: [{
  title: '趋势', headline: '上周合计 48,300', detail: '峰值出现在周六',
  facts: [{text: '日均 6,900'}], points: [{label: '周一', value: 12}, {label: '周二', value: 18}],
  footer: [{text: '演示数据'}]
}]})));
assert.deepEqual(denseResult.shortenedCards, [1]);
const denseCard = shown.components[0].grid.children[0].card;
assert.equal(denseCard.children.some(node => node.id.endsWith('-detail') || node.id.includes('-fact-')), false);
assert.equal(denseCard.children.some(node => node.chart), true);
assert.equal(denseCard.bottomChildren.length, 1);
assert.equal(denseCard.detailChildren.some(node => node.id.endsWith('-fact-0')), true);
const informationContent = '第一段引用内容。\n第二段仍然左对齐，并随卡片宽度自动换行。';
const informationResult = JSON.parse(registered.show_cards(JSON.stringify({cards: [
  {type: 'information', title: '重要说明', subtitle: '来源 · 已核实', content: informationContent},
  {title: '状态', headline: '正常'}
]})));
assert.equal(informationResult.count, 2);
assert.deepEqual(informationResult.shortenedCards, []);
assert.equal(shown.components.length, 2);
const information = shown.components[0].card;
assert.equal(information.aspectRatio, undefined);
assert.equal(information.height, undefined);
assert.equal(information.children[0].text.text, '重要说明');
assert.equal(information.children[1].text.text, '来源 · 已核实');
assert.equal(information.children[2].card.appearance.variant, 'PLUGIN_COMPONENT_VARIANT_SUBTLE');
const quoteRow = information.children[2].card.children[0].stack;
assert.equal(quoteRow.children[0].icon.appearance.iconSource.systemName, 'quote.opening');
assert.equal(quoteRow.children[1].text.text, informationContent);
assert.equal(quoteRow.children[1].text.fontSize, 14);
assert.equal(quoteRow.children[1].text.style, 'PLUGIN_TEXT_STYLE_SUBTITLE');
assert.equal(quoteRow.children[1].text.alignment, 'PLUGIN_TEXT_ALIGNMENT_LEADING');
assert.equal(shown.components[1].grid.columns, 2);
assert.equal(shown.components[1].grid.children.length, 1);
JSON.parse(registered.show_cards(JSON.stringify({cards: [
  {title: '前', headline: '一'},
  {type: 'information', title: '中', subtitle: '引用来源', content: '引用内容'},
  {title: '后', headline: '二'}
]})));
assert.equal(shown.components.length, 3);
assert.equal(shown.components[0].grid.children.length, 1);
assert.equal(shown.components[1].card.children[0].text.text, '中');
assert.equal(shown.components[2].grid.children.length, 1);
assert.throws(() => registered.show_cards(JSON.stringify({cards: [
  {type: 'information', title: '缺失内容', subtitle: '来源'}
]})), /引用内容无效/);
assert.throws(() => registered.show_cards(JSON.stringify({cards: [
  {type: 'information', title: '缺失副标题', content: '内容'}
]})), /卡片副标题无效/);
assert.throws(() => registered.show_cards(JSON.stringify({cards: [
  {type: 'information', title: '过长', subtitle: '来源', content: '字'.repeat(1201)}
]})), /引用内容无效/);
assert.throws(() => registered.show_cards(JSON.stringify({cards: [
  {type: 'unknown', title: '未知', content: '内容'}
]})), /卡片类型无效/);
assert.equal(context.dashboard({config: {}}).components[2].card.children[2].card.children[0].stack.children[1].text.text.includes('引用区'), true);
assert.throws(() => registered.show_cards(JSON.stringify({cards: [
  {title: '文件', resource: {title: '秘密', url: 'file:///private/secret'}}
]})), /链接无效/);
assert.throws(() => registered.show_cards(JSON.stringify({cards: [
  {title: '趋势', points: [{label: '周一', value: 1}]}
]})), /至少需要 2 个数据点/);
console.log('show_cards passed');
