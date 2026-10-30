const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = (name) => readFileSync(join(__dirname, '../extension', name), 'utf8');

function contentHarness(settings = {}, sendMessage = async () => { throw Error('Unexpected API request'); }) {
  const createElement = () => {
    const node = {
      children: [], style: {}, className: '', _textContent: '',
      append(...children) { this.children.push(...children); },
      setAttribute() {}
    };
    Object.defineProperty(node, 'textContent', {
      get() { return this._textContent + this.children.map(child => typeof child === 'string' ? child : child?.textContent || '').join(''); },
      set(value) { this._textContent = String(value); this.children = []; }
    });
    return node;
  };
  const document = {
    createElement,
    querySelector: () => null
  };
  const context = vm.createContext({
    document,
    location: { href: 'https://x.com/home', pathname: '/home' },
    chrome: { storage: { local: { get: async () => settings } }, runtime: { sendMessage } }
  });
  vm.runInContext(source('content.js').replace('\ninstall();', '\n'), context);
  return context;
}

function backgroundHarness(settings = {}, fetch = async () => { throw Error('Unexpected network request'); }) {
  let listener;
  const context = vm.createContext({
    URL, URLSearchParams, fetch,
    chrome: {
      runtime: { onMessage: { addListener: (fn) => { listener = fn; } } },
      tabs: { onRemoved: { addListener() {} } },
      storage: { local: {
        get: async () => settings,
        set: async (values) => Object.assign(settings, values)
      } }
    }
  });
  vm.runInContext(source('background.js').replace(/^import .*;\n/gm, ''), context);
  return {
    context,
    message: (targetId = '100') => new Promise((resolve) => {
      listener({ type: 'get-thread-context', targetId }, { url: 'https://x.com/example/status/100', frameId: 0 }, resolve);
    })
  };
}

const pageThread = () => ({
  target: 'Latest response', targetId: '100',
  contextMessages: [{ author: '@parent', text: 'Loaded parent' }],
  tweets: ['Loaded parent', 'Latest response']
});
const auth = (userId = '1') => ({ accessToken: 'TEST_ONLY', userId, expiresAt: Date.now() + 3600000 });

test('new and explicitly page-mode users never request API context, even when X is connected', async () => {
  for (const mode of [undefined, 'page']) {
    const settings = { replyContextMode: mode, xApiClientId: 'TEST_CLIENT', xApiAuth: auth() };
    const content = contentHarness(settings);
    const result = await content.enrichThreadContext(pageThread());
    assert.equal(result.contextSource, 'page');
    assert.equal(result.contextNotice, 'page');
    assert.equal(result.contextMessages[0].text, 'Loaded parent');
    const serverResult = await backgroundHarness(settings).message();
    assert.equal(serverResult.reason, 'page');
  }
});

test('API mode requires manual client configuration and an account token', async () => {
  for (const missing of [{}, { xApiClientId: 'TEST_CLIENT' }, { xApiAuth: auth() }]) {
    const settings = { replyContextMode: 'api', ...missing };
    const background = backgroundHarness(settings);
    const content = contentHarness(settings, () => background.message());
    const result = await content.enrichThreadContext(pageThread());
    assert.equal(result.contextNotice, 'api-unconfigured');
    assert.equal(result.contextSource, 'page');
    assert.match(content.contextBadge(result).textContent, /授权未配置/);
  }
});

test('API retrieval failure is shown and preserves page context', async () => {
  const settings = { replyContextMode: 'api', xApiClientId: 'TEST_CLIENT', xApiAuth: auth() };
  const background = backgroundHarness(settings, async () => { throw Error('Network unavailable'); });
  const content = contentHarness(settings, () => background.message());
  const result = await content.enrichThreadContext(pageThread());
  assert.equal(result.contextNotice, 'api-failed');
  assert.equal(result.contextMessages[0].text, 'Loaded parent');
  assert.match(content.contextBadge(result).textContent, /读取失败/);
});

test('empty API context and missing target IDs fall back without implying a complete chain', async () => {
  const content = contentHarness({ replyContextMode: 'api' }, async () => ({ ok: true, contextMessages: [] }));
  assert.equal((await content.enrichThreadContext(pageThread())).contextNotice, 'api-empty');
  const noId = contentHarness({ replyContextMode: 'api' });
  const result = await noId.enrichThreadContext({ ...pageThread(), targetId: '' });
  assert.equal(result.contextNotice, 'api-target-missing');
});

test('API mode reads parents and caches separately for each account', async () => {
  const settings = { replyContextMode: 'api', xApiClientId: 'TEST_CLIENT', xApiAuth: auth() };
  let requests = 0;
  const background = backgroundHarness(settings, async (url) => {
    requests++;
    const target = new URL(url).pathname.endsWith('/100');
    return { ok: true, json: async () => ({
      data: target
        ? { id: '100', text: 'Latest response', referenced_tweets: [{ type: 'replied_to', id: '99' }] }
        : { id: '99', author_id: '1', text: 'API parent' },
      includes: { users: [{ id: '1', username: 'example' }] }
    }) };
  });
  const content = contentHarness(settings, () => background.message());
  const first = await content.enrichThreadContext(pageThread());
  assert.equal(first.contextSource, 'x-api');
  assert.equal(first.contextMessages[0].author, 'you');
  assert.equal(first.contextMessages[0].text, 'API parent');
  assert.match(content.contextBadge(first).textContent, /已读取上下文：1 条上文/);
  await background.message();
  assert.equal(requests, 2);
  settings.xApiAuth = auth('2');
  const second = await background.message();
  assert.equal(requests, 4);
  assert.equal(second.contextMessages[0].author, '@example');
  settings.replyContextMode = 'page';
  assert.equal((await background.message()).reason, 'page');
  assert.equal(requests, 4);
});

test('mode changes during a request cannot bypass the background page-mode gate', async () => {
  const content = contentHarness({ replyContextMode: 'api' }, () => backgroundHarness({ replyContextMode: 'page' }).message());
  const result = await content.enrichThreadContext(pageThread());
  assert.equal(result.contextNotice, 'page');
  assert.equal(result.contextSource, 'page');
});

function article(id, text, inDialog = false) {
  return {
    innerText: text,
    querySelector: (selector) => selector === 'time'
      ? { closest: () => ({ getAttribute: () => `/example/status/${id}` }) }
      : { innerText: text },
    querySelectorAll: () => [{ getAttribute: () => `/example/status/${id}` }],
    closest: () => inDialog ? {} : null
  };
}

test('page mode ignores neighbors in feeds, notifications, and other reply branches', () => {
  const content = contentHarness();
  const parent = article('99', 'Unrelated feed post');
  const target = article('100', 'Latest response');
  const detailRoot = { querySelectorAll: () => [parent, target] };
  content.document.querySelector = (selector) => selector === 'main' ? detailRoot : null;
  for (const pathname of ['/home', '/notifications', '/example/status/98']) {
    content.location.pathname = pathname;
    const thread = content.readTargetThread(target);
    assert.equal(thread.contextMessages.length, 0);
    assert.equal(thread.target, 'Latest response');
  }
});

test('detail view keeps loaded earlier messages and deduplicates reply dialog clones', () => {
  const content = contentHarness();
  const target = article('100', 'Latest response');
  const clone = article('100', 'Latest response', true);
  const items = [article('96', 'Oldest'), article('97', 'First'), article('98', 'Second'), article('99', 'Third'), target, clone];
  content.location.pathname = '/example/status/100';
  content.document.querySelector = (selector) => selector === 'main' ? { querySelectorAll: () => items } : null;
  const thread = content.readTargetThread(clone);
  assert.equal(thread.contextMessages.length, 4);
  assert.equal(thread.contextMessages[0].text, 'Oldest');
  assert.equal(thread.contextMessages[3].text, 'Third');
  assert.equal(thread.tweets[4], 'Latest response');
});

test('page badges distinguish loaded context from target-only replies', () => {
  const content = contentHarness();
  assert.match(content.contextBadge({ contextSource: 'page', contextMessages: [] }).textContent, /未读取到上下文/);
  assert.match(content.contextBadge({ contextSource: 'page', contextMessages: [{ text: 'Loaded parent' }] }).textContent, /已读取上下文：1 条上文/);
});

test('page mode can generate three drafts with only model configuration and no X credentials', async () => {
  const settings = {
    replyContextMode: 'page', personaMarkdown: 'Be direct.',
    apiUrl: 'https://model.example.test/v1', apiKey: 'TEST_ONLY', model: 'test-model',
    replyLanguage: 'en', generationMode: 'fast'
  };
  let requests = 0;
  const { context } = backgroundHarness(settings, async (url, options) => {
    requests++;
    assert.equal(url, 'https://model.example.test/v1/chat/completions');
    const prompt = JSON.parse(options.body).messages[1].content;
    assert(prompt.includes('Loaded parent'));
    assert(prompt.includes('Latest response'));
    assert(prompt.includes('ALL THREE replies must'));
    assert(prompt.includes(requests === 1 ? 'SELECTED REPLY MODE: Natural response' : 'SELECTED REPLY MODE: Additional perspective'));
    assert(!prompt.includes('继续交流'));
    return { ok: true, json: async () => ({ choices: [{
      finish_reason: 'stop', message: { content: JSON.stringify({ replies: ['First draft.', 'Second draft.', 'Third draft.'] }) }
    }] }) };
  });
  const replies = await context.generateReplies(pageThread());
  assert.equal(replies.length, 3);
  assert.equal(requests, 1);
  const perspectives = await context.generateReplies(pageThread(), 'perspective');
  assert.equal(perspectives.length, 3);
  assert.equal(requests, 2);
  await assert.rejects(context.generateReplies(pageThread(), 'invalid-mode'), /回复方向无效/);
  assert.equal(requests, 2);
});

test('settings persist mode without requiring or modifying X credentials', async () => {
  const settings = { xApiClientId: 'TEST_CLIENT' };
  const nodes = new Map();
  const element = (id) => {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', disabled: false, checked: false, textContent: '',
      dataset: {},
      classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {}
    });
    return nodes.get(id);
  };
  const context = vm.createContext({
    document: { getElementById: element, querySelectorAll: () => [] },
    chrome: {
      runtime: { getManifest: () => ({ version: '0.1.55' }), sendMessage: async () => ({ configured: false }) },
      storage: {
        onChanged: { addListener() {} },
        local: { get() {}, set: async (values) => Object.assign(settings, values) }
      }
    }
  });
  vm.runInContext(source('options.js'), context);
  element('reply-context-mode').value = 'api';
  await context.saveStyle();
  assert.equal(settings.replyContextMode, 'api');
  assert.equal(settings.xApiClientId, 'TEST_CLIENT');
  assert.match(element('style-status').textContent, /API 增强/);
  element('reply-context-mode').value = 'page';
  await context.saveStyle();
  assert.equal(settings.replyContextMode, 'page');
  assert.match(element('style-status').textContent, /不会调用 X API/);
});
