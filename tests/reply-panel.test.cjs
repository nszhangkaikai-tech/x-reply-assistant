const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

function panelHarness(sendMessage = async () => ({ ok: true })) {
  const elements = [];
  const createElement = (tag) => {
    const element = {
      tag, children: [], attrs: {}, handlers: {}, style: {}, hidden: false, isConnected: true,
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      setAttribute(key, value) { this.attrs[key] = value; },
      addEventListener(event, callback) { this.handlers[event] = callback; },
      remove() { this.removed = true; this.isConnected = false; },
      focus() { this.focused = true; }
    };
    elements.push(element);
    return element;
  };
  const body = createElement('body');
  const context = vm.createContext({
    document: { body, createElement, getElementById: (id) => elements.find(e => e.id === id && !e.removed) },
    chrome: { runtime: { sendMessage } }
  });
  vm.runInContext(readFileSync(join(__dirname, '../extension/content.js'), 'utf8').replace('\ninstall();', '\n'), context);
  return { context, elements, byClass: (name) => elements.filter(e => e.className === name) };
}

test('two modes each show three drafts, cache on return, and reuse the same context', async () => {
  const thread = { target: 'Target', contextSource: 'page', contextMessages: [] };
  let requests = 0;
  const { context, elements } = panelHarness(async (message) => {
    requests++;
    assert.equal(message.replyMode, 'perspective');
    assert.equal(message.thread, thread);
    return { ok: true, replies: ['Perspective one', 'Perspective two', 'Perspective three'] };
  });
  context.renderReplies(['Natural one', 'Natural two', 'Natural three'], thread);
  const tabs = elements.filter(e => e.attrs.role === 'tab');
  const panels = elements.filter(e => e.attrs.role === 'tabpanel');
  assert.deepEqual(tabs.map(e => e.textContent), ['自然接话', '补充观点']);
  assert.equal(panels.filter(e => !e.hidden).length, 1);
  assert.equal(panels[0].children.length, 3);
  assert.equal(requests, 0);
  for (const i of [1, 0, 1]) {
    await tabs[i].handlers.click();
    assert.equal(panels.filter(e => !e.hidden).length, 1);
    assert.equal(panels[i].hidden, false);
    assert.equal(panels[i].children.length, 3);
    assert.equal(tabs[i].attrs['aria-selected'], 'true');
    assert.equal(tabs[i].attrs['aria-controls'], panels[i].id);
    assert.equal(panels[i].attrs['aria-labelledby'], tabs[i].id);
  }
  assert.equal(requests, 1);
  tabs[1].handlers.keydown({ key: 'ArrowRight', preventDefault() {} });
  assert.equal(panels[1].hidden, false);
  assert(tabs[0].focused);
  tabs[0].handlers.keydown({ key: 'End', preventDefault() {} });
  assert(tabs[1].focused);
  assert.equal(requests, 1);
});

test('failed mode can retry without losing the other three drafts', async () => {
  let requests = 0;
  const { context, elements } = panelHarness(async () => ++requests === 1
    ? { ok: false, error: 'Model unavailable' }
    : { ok: true, replies: ['One', 'Two', 'Three'] });
  context.renderReplies(['Original one', 'Original two', 'Original three']);
  const tabs = elements.filter(e => e.attrs.role === 'tab');
  const panels = elements.filter(e => e.attrs.role === 'tabpanel');
  await tabs[1].handlers.click();
  assert.equal(panels[1].children[0].textContent, 'Model unavailable');
  assert.equal(panels[0].children.length, 3);
  await panels[1].children[1].handlers.click();
  assert.equal(panels[1].children.length, 3);
  assert.equal(requests, 2);
  await tabs[0].handlers.click();
  assert.equal(panels[0].children[0].children[0].children[1].textContent, 'Original one');
});

test('rapid switching does not duplicate requests or replace the currently selected mode', async () => {
  let resolve, requests = 0;
  const { context, elements } = panelHarness(() => {
    requests++;
    return new Promise(done => { resolve = done; });
  });
  context.renderReplies(['One', 'Two', 'Three']);
  const tabs = elements.filter(e => e.attrs.role === 'tab');
  const panels = elements.filter(e => e.attrs.role === 'tabpanel');
  const pending = tabs[1].handlers.click();
  await tabs[1].handlers.click();
  await tabs[0].handlers.click();
  assert.equal(requests, 1);
  resolve({ ok: true, replies: ['A', 'B', 'C'] });
  await pending;
  assert.equal(panels[0].hidden, false);
  assert.equal(panels[1].hidden, true);
  assert.equal(panels[1].children.length, 3);
});

test('late responses never reopen a closed panel', async () => {
  let resolve;
  const { context, elements, byClass } = panelHarness(() => new Promise(done => { resolve = done; }));
  context.renderReplies(['One', 'Two', 'Three']);
  const pending = elements.filter(e => e.attrs.role === 'tab')[1].handlers.click();
  byClass('xra-close')[0].handlers.click();
  resolve({ ok: true, replies: ['A', 'B', 'C'] });
  await pending;
  assert.equal(elements.filter(e => e.id === 'xra-reply-panel' && !e.removed).length, 0);
});

test('text click and explicit fill both insert the selected draft, never publish', () => {
  const { context, elements, byClass } = panelHarness();
  let inserted;
  context.quickInsertReply = (reply) => { inserted = reply; };
  context.renderReplies(['First', 'Second', 'Third']);
  byClass('xra-candidate-text')[1].handlers.click();
  assert.equal(inserted, 'Second');
  assert(elements.find(e => e.id === 'xra-reply-panel').removed);
});

test('copy-edit and close remain available', async () => {
  const { context, elements, byClass } = panelHarness();
  let copied, toast = false;
  context.copyReply = async (reply) => { copied = reply; };
  context.showCopyToast = () => { toast = true; };
  context.renderReplies(['First', 'Second', 'Third']);
  await byClass('xra-copy-button')[2].handlers.click();
  assert.equal(copied, 'Third');
  assert(toast);
  assert(elements.find(e => e.id === 'xra-reply-panel').removed);
  const other = panelHarness();
  other.context.renderReplies(['First', 'Second', 'Third']);
  other.byClass('xra-close')[0].handlers.click();
  assert(other.elements.find(e => e.id === 'xra-reply-panel').removed);
});

test('fill and copy failures retain an error message, settings entry, and close', async () => {
  const { context, elements, byClass } = panelHarness();
  context.quickInsertReply = () => { throw Error('No editor'); };
  context.renderReplies(['First', 'Second', 'Third']);
  byClass('xra-candidate-text')[0].handlers.click();
  assert.equal(byClass('xra-settings').length, 1);
  assert(byClass('xra-title').some(e => e.textContent === 'No editor'));
  assert(!elements.find(e => e.id === 'xra-reply-panel').removed);
  const other = panelHarness();
  other.context.copyReply = async () => { throw Error('Copy failed'); };
  other.context.renderReplies(['First', 'Second', 'Third']);
  await other.byClass('xra-copy-button')[0].handlers.click();
  assert.equal(other.byClass('xra-settings').length, 1);
});
