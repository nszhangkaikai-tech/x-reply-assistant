const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = (name) => readFileSync(join(__dirname, '../extension', name), 'utf8');

function backgroundContext() {
  const context = vm.createContext({
    URL,
    URLSearchParams,
    chrome: {
      runtime: { onMessage: { addListener() {} } },
      tabs: { onRemoved: { addListener() {} } }
    }
  });
  vm.runInContext(source('background.js').replace(/^import .*;\n/, ''), context);
  return context;
}

function optimizationContext(fetch) {
  const settings = {
    apiUrl: 'https://model.example.test/v1',
    apiKey: 'TEST_ONLY',
    model: 'test-model',
    replyLanguage: 'zh-CN',
    generationMode: 'fast',
    personaMarkdown: '表达直接。',
    deAi: true,
    deAiPrompt: '避免营销腔。'
  };
  const context = vm.createContext({
    URL,
    URLSearchParams,
    fetch,
    chrome: {
      runtime: { onMessage: { addListener() {} } },
      tabs: { onRemoved: { addListener() {} } },
      storage: { local: { get: async () => settings } }
    }
  });
  vm.runInContext(source('background.js').replace(/^import .*;\n/, ''), context);
  return context;
}

test('post optimization scores are bounded and summed locally', () => {
  const context = backgroundContext();
  const result = context.parsePostOptimization(JSON.stringify({
    original: { recall: 12.4, reply: 10, share: 9, dwell: 8, follow: 7, negativeControl: 11 },
    optimized: { text: '更清晰的优化稿', recall: 99, reply: 16, share: 15, dwell: 12, follow: 9, negativeControl: 14 },
    reasons: ['主题更明确', '观点更具体', '减少营销感', '不会显示第四条']
  }));

  assert.equal(result.original.recall, 12);
  assert.equal(result.original.overall, 57);
  assert.equal(result.optimized.recall, 20);
  assert.equal(result.optimized.overall, 86);
  assert.equal(result.optimized.text, '更清晰的优化稿');
  assert.deepEqual([...result.reasons], ['主题更明确', '观点更具体', '减少营销感']);
});

test('post optimization rejects incomplete model scores', () => {
  const context = backgroundContext();
  assert.throws(() => context.parsePostOptimization(JSON.stringify({
    original: { recall: 10 },
    optimized: { text: '优化稿', recall: 12 },
    reasons: []
  })), /评分不完整/);
});

test('post optimization sends the draft once and returns a scored rewrite', async () => {
  let requests = 0;
  const context = optimizationContext(async (url, options) => {
    requests++;
    assert.equal(url, 'https://model.example.test/v1/chat/completions');
    const request = JSON.parse(options.body);
    assert.equal(request.temperature, 0.2);
    assert.match(request.messages[1].content, /原始草稿/);
    assert.match(request.messages[1].content, /not as an official recommendation probability/);
    return {
      ok: true,
      json: async () => ({ choices: [{
        finish_reason: 'stop',
        message: { content: JSON.stringify({
          original: { recall: 10, reply: 10, share: 10, dwell: 8, follow: 6, negativeControl: 12 },
          optimized: { text: '优化后的推文', recall: 16, reply: 15, share: 14, dwell: 12, follow: 8, negativeControl: 13 },
          reasons: ['主题更明确']
        }) }
      }] })
    };
  });

  const result = await context.optimizePost('原始草稿');
  assert.equal(requests, 1);
  assert.equal(result.original.overall, 56);
  assert.equal(result.optimized.overall, 78);
  assert.equal(result.optimized.text, '优化后的推文');
});

test('post optimization button is added only to a new-post composer', () => {
  const created = [];
  const toolbar = {
    button: null,
    querySelector() { return this.button; },
    append(button) { this.button = button; }
  };
  const publish = {};
  const composer = {
    parentElement: null,
    hasArticle: false,
    querySelector(selector) {
      if (selector === '[data-testid="toolBar"]') return toolbar;
      if (selector.includes('tweetButton')) return publish;
      if (selector === 'article[data-testid="tweet"]') return this.hasArticle ? {} : null;
      return null;
    }
  };
  const editor = { isContentEditable: true, parentElement: composer };
  const body = {};
  const document = {
    body,
    querySelectorAll: () => [editor],
    createElement: (tag) => {
      const element = {
        tag,
        attrs: {},
        handlers: {},
        setAttribute(key, value) { this.attrs[key] = value; },
        addEventListener(event, handler) { this.handlers[event] = handler; }
      };
      created.push(element);
      return element;
    }
  };
  const context = vm.createContext({ document, location: { pathname: '/compose/post' }, chrome: {} });
  vm.runInContext(source('content.js').replace('\ninstall();', '\n'), context);

  context.addPostOptimizeButtons();
  assert.equal(toolbar.button.textContent, '发帖优化');
  assert.equal(toolbar.button.attrs['aria-label'], '分析并优化当前推文');

  toolbar.button = null;
  composer.hasArticle = true;
  context.addPostOptimizeButtons();
  assert.equal(toolbar.button, null);
});
