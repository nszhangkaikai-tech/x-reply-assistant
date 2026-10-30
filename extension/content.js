const BUTTON_ID = "xra-generate-button";
const PANEL_ID = "xra-reply-panel";
const LOADING_ID = "xra-loading";
const COPY_TOAST_ID = "xra-copy-toast";
const LIST_DRAFT_PANEL_ID = "xra-list-draft-panel";
const POST_OPTIMIZE_BUTTON_CLASS = "xra-post-optimize-button";
const BUTTON_POSITION_KEY = "replyButtonPosition";
const countedPublishButtons = new WeakSet();
let pendingListDraft = null;
let fillingListDraft = false;
let pendingReplyTarget = null;
let capturedReplyThread = null;

install();

function install() {
  document.addEventListener("click", event => {
    const reply = event.target.closest?.('[data-testid="reply"]');
    const article = reply?.closest('article[data-testid="tweet"]');
    if (!article) return;
    try { capturedReplyThread = readTargetThread(article); } catch { capturedReplyThread = null; }
  }, true);
  trackPublishing();
  addComposerButton();
  addPostOptimizeButtons();
  addQuickButtons();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "list-draft-ready") void loadPendingListDraft();
    if (message.type === "scan-visible-interactions") {
      try {
        sendResponse({ ok: true, snapshot: scanVisibleInteractions() });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "读取当前 X 页面失败。" });
      }
    }
  });
  void loadPendingListDraft();

  new MutationObserver(() => {
    addComposerButton();
    addPostOptimizeButtons();
    addQuickButtons();
    maybeFillListDraft();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

async function loadPendingListDraft() {
  try {
    const result = await chrome.runtime.sendMessage({ type: "get-list-draft" });
    if (!result?.ok || !result.draft?.text) return;
    pendingListDraft = result.draft;
    showListDraftPanel();
    maybeFillListDraft();
  } catch {}
}

function showListDraftPanel() {
  if (document.getElementById(LIST_DRAFT_PANEL_ID)) return;
  const panel = document.createElement("aside");
  panel.id = LIST_DRAFT_PANEL_ID;
  const message = document.createElement("p");
  message.textContent = pendingListDraft.mode === "quote"
    ? "引用文案已准备好。请点原帖的“转发 → 引用”；打开引用框后会自动填入。"
    : "二创草稿已准备好，正在填入 X 发帖框。";
  const fill = document.createElement("button");
  fill.type = "button";
  fill.textContent = "填入当前编辑框";
  fill.addEventListener("click", () => {
    const editor = pendingListDraft?.mode === "remix"
      ? (location.pathname === "/compose/post" ? findReplyEditor() : null)
      : document.querySelector('[role="dialog"] [data-testid="tweetTextarea_0"]');
    const target = editor instanceof HTMLTextAreaElement || editor?.isContentEditable
      ? editor
      : editor?.querySelector('[contenteditable="true"]');
    if (!target) {
      message.textContent = pendingListDraft?.mode === "quote"
        ? "请先在原帖选择“转发 → 引用”，打开引用编辑框后再点填入。"
        : "还没找到 X 发帖框，请等页面加载完成后重试。";
      return;
    }
    void fillListDraft(target);
  });
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "复制草稿";
  copy.addEventListener("click", async () => {
    try {
      await copyReply(pendingListDraft.text);
      message.textContent = "草稿已复制。如 X 编辑框没有自动填入，可粘贴后继续编辑。";
    } catch {
      message.textContent = "复制失败，请再试一次。";
    }
  });
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "取消";
  cancel.addEventListener("click", async () => {
    pendingListDraft = null;
    panel.remove();
    await chrome.runtime.sendMessage({ type: "clear-list-draft" }).catch(() => {});
  });
  panel.append(message, fill, copy, cancel);
  document.body.append(panel);
}

function maybeFillListDraft() {
  if (!pendingListDraft || fillingListDraft) return;
  let editor = null;
  if (pendingListDraft.mode === "remix" && location.pathname === "/compose/post") {
    editor = findReplyEditor();
  } else if (pendingListDraft.mode === "quote") {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find((item) => {
      const hasQuote = item.querySelector('[data-testid="quotedTweet"], [data-testid="quoteTweet"]')
        || [...item.querySelectorAll('a[href]')].some((link) => link.getAttribute("href")?.includes(`/status/${pendingListDraft.postId}`));
      return hasQuote && item.querySelector('[data-testid="tweetTextarea_0"]');
    });
    const root = dialog?.querySelector('[data-testid="tweetTextarea_0"]');
    editor = root instanceof HTMLTextAreaElement || root?.isContentEditable
      ? root
      : root?.querySelector('[contenteditable="true"]');
  }
  if (editor && !(editor instanceof HTMLTextAreaElement ? editor.value.trim() : editor.textContent.trim())) {
    void fillListDraft(editor);
  }
}

async function fillListDraft(editor) {
  if (!pendingListDraft || fillingListDraft) return;
  fillingListDraft = true;
  const text = pendingListDraft.text;
  try {
    if (editor instanceof HTMLTextAreaElement) {
      if (editor.value.trim()) throw new Error("输入框已有文字，请先检查或清空后再填入。");
      editor.focus();
      editor.value = text;
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: text }));
    } else {
      if (editor.textContent.trim()) throw new Error("输入框已有文字，请先检查或清空后再填入。");
      editor.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
      if (!document.execCommand("insertText", false, text)) throw new Error("X 输入框未接受草稿，请重试。");
    }
    pendingListDraft = null;
    document.getElementById(LIST_DRAFT_PANEL_ID)?.remove();
    await chrome.runtime.sendMessage({ type: "clear-list-draft" }).catch(() => {});
    showCopyToast("草稿已填入 X 输入框，可以修改；检查后由你点击发布。");
  } catch (error) {
    const message = document.querySelector(`#${LIST_DRAFT_PANEL_ID} p`);
    if (message) message.textContent = error.message || "填入失败，请重试。";
  } finally {
    fillingListDraft = false;
  }
}

function trackPublishing() {
  document.addEventListener("click", (event) => {
    const replyTrigger = event.target.closest('[data-testid="reply"]');
    if (replyTrigger) {
      const article = replyTrigger.closest('article[data-testid="tweet"]');
      const target = article ? readInteractionArticle(article, "reply-target") : null;
      if (target?.id) pendingReplyTarget = target;
      return;
    }

    const publishButton = event.target.closest('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
    if (!publishButton || publishButton.disabled || countedPublishButtons.has(publishButton)) return;

    countedPublishButtons.add(publishButton);
    const reply = isReplyPublish(publishButton);
    const target = reply ? readPublishTarget(publishButton) : null;
    chrome.runtime.sendMessage({
      type: "record-publish",
      kind: reply ? "reply" : "post",
      target
    });
    if (reply) pendingReplyTarget = null;
  }, true);
}

function readPublishTarget(publishButton) {
  const dialog = publishButton.closest('[role="dialog"]');
  const article = dialog?.querySelector('article[data-testid="tweet"]')
    || publishButton.closest('article[data-testid="tweet"]');
  const direct = article ? readInteractionArticle(article, "reply-target") : null;
  if (direct?.id) return direct;

  const pagePostId = location.pathname.match(/\/status\/(\d+)/)?.[1];
  if (pagePostId) {
    const pageTarget = [...document.querySelectorAll('article[data-testid="tweet"]')]
      .map((item) => readInteractionArticle(item, "reply-target"))
      .find((record) => record?.id === pagePostId);
    if (pageTarget) return pageTarget;
  }
  return pendingReplyTarget;
}

function isReplyPublish(publishButton) {
  if (publishButton.dataset.testid === "tweetButtonInline") return true;

  const dialog = publishButton.closest('[role="dialog"]');
  return Boolean(dialog?.querySelector('article[data-testid="tweet"]'));
}

function scanVisibleInteractions() {
  const profileHref = document.querySelector('[data-testid="AppTabBar_Profile_Link"]')?.getAttribute("href") || "";
  const ownUsername = decodeURIComponent(profileHref.split("/").filter(Boolean)[0] || "").toLowerCase();
  const statusMatch = location.pathname.match(/\/status\/(\d+)/);
  const supported = location.pathname.startsWith("/notifications") || Boolean(statusMatch);
  if (!supported) throw new Error("请先打开 X 的“通知 → 提及”或某条帖子的评论详情页，再返回这里更新。");

  const articles = [...document.querySelectorAll('article[data-testid="tweet"]')];
  if (statusMatch) {
    const root = articles.map((article) => readInteractionArticle(article, "conversation")).find((record) => record?.id === statusMatch[1]);
    if (!ownUsername) throw new Error("暂时无法确认当前登录账号，请打开“通知 → 提及”页面更新新评论。");
    if (!root || root.username.toLowerCase() !== ownUsername) {
      throw new Error("当前打开的是别人的帖子，不会加入你的评论统计。请打开自己的帖子评论页或“通知 → 提及”。");
    }
  }

  const records = [];
  const seen = new Set();
  articles.forEach((article) => {
    const record = readInteractionArticle(article, location.pathname.startsWith("/notifications") ? "mentions" : "conversation");
    if (!record || seen.has(record.id) || record.id === statusMatch?.[1]) return;
    if (ownUsername && record.username.toLowerCase() === ownUsername) return;
    seen.add(record.id);
    records.push(record);
  });

  return {
    pageUrl: location.href,
    pageType: location.pathname.startsWith("/notifications") ? "mentions" : "conversation",
    ownUsername,
    records
  };
}

function readInteractionArticle(article, source) {
  const time = article.querySelector("time");
  const statusLink = time?.closest('a[href*="/status/"]')
    || [...article.querySelectorAll('a[href*="/status/"]')].find((link) => /\/status\/\d+/.test(link.getAttribute("href") || ""));
  const href = statusLink?.getAttribute("href") || "";
  const match = href.match(/^\/([^/]+)\/status\/(\d+)/);
  if (!match) return null;
  const text = article.querySelector('[data-testid="tweetText"]')?.innerText?.trim() || "";
  if (!text) return null;
  const username = decodeURIComponent(match[1]);
  const userNameRoot = article.querySelector('[data-testid="User-Name"]');
  const name = [...(userNameRoot?.querySelectorAll("span") || [])]
    .map((item) => item.textContent?.trim() || "")
    .find((value) => value && !value.startsWith("@") && !/^·$/.test(value)) || username;
  return {
    id: match[2],
    username,
    name,
    text,
    url: new URL(href, location.origin).href,
    createdAt: time?.getAttribute("datetime") || "",
    source
  };
}

function addComposerButton() {
  const isComposePage = location.pathname === "/compose/post";
  const existing = document.getElementById(BUTTON_ID);
  if (isComposePage) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const editor = findReplyEditor();
  if (!editor) return;

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.textContent = "AI 回复";
  button.classList.add("xra-floating-button");
  button.addEventListener("click", () => {
    if (button.dataset.dragged === "true") {
      delete button.dataset.dragged;
      return;
    }
    void generate();
  });
  makeButtonDraggable(button);
  document.body.append(button);
}

function addPostOptimizeButtons() {
  document.querySelectorAll('[data-testid="tweetTextarea_0"]').forEach((editorRoot) => {
    const editor = editorRoot.isContentEditable
      ? editorRoot
      : editorRoot.querySelector('[contenteditable="true"]');
    if (!editor) return;

    let composer = editor.parentElement;
    while (composer && composer !== document.body) {
      const toolbar = composer.querySelector('[data-testid="toolBar"]');
      const publish = composer.querySelector('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
      if (toolbar && publish) {
        if (composer.querySelector('article[data-testid="tweet"]') || toolbar.querySelector(`.${POST_OPTIMIZE_BUTTON_CLASS}`)) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = POST_OPTIMIZE_BUTTON_CLASS;
        button.textContent = "发帖优化";
        button.setAttribute("aria-label", "分析并优化当前推文");
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void optimizePost(editor, button);
        });
        toolbar.append(button);
        return;
      }
      composer = composer.parentElement;
    }
  });
}

async function optimizePost(editor, button) {
  const draft = readEditorText(editor);
  if (!draft) {
    renderError("请先输入需要优化的推文。");
    return;
  }

  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  const recommendationContext = readForYouRecommendations();
  renderPostOptimizationLoading(recommendationContext.posts.length);
  try {
    const response = await chrome.runtime.sendMessage({
      type: "optimize-post",
      draft,
      recommendations: recommendationContext.posts
    });
    if (!response?.ok) throw new Error(response?.error || "优化失败，请重试。");
    renderPostOptimization(response.result, editor, recommendationContext.reason);
  } catch (error) {
    renderError(displayError(error));
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

function readForYouRecommendations() {
  if (location.pathname !== "/home") return { posts: [], reason: "当前不在 X 首页，本次只分析原稿" };
  const selectedTab = document.querySelector('[role="tab"][aria-selected="true"]');
  const tabLabel = selectedTab?.innerText?.trim() || selectedTab?.textContent?.trim() || "";
  if (!/(为你推荐|For you)/i.test(tabLabel)) return { posts: [], reason: "当前不是“为你推荐”时间线，本次只分析原稿" };

  const seen = new Set();
  const posts = [];
  document.querySelectorAll('article[data-testid="tweet"]').forEach((article) => {
    if (posts.length >= 12) return;
    const wholeText = article.innerText || "";
    if (/(^|\n)(推广|Promoted|Ad)(\n|$)/i.test(wholeText)) return;
    const text = article.querySelector('[data-testid="tweetText"]')?.innerText?.trim() || "";
    const href = [...article.querySelectorAll('a[href*="/status/"]')]
      .map((link) => link.getAttribute("href") || "")
      .find((value) => /^\/[A-Za-z0-9_]+\/status\/\d+/.test(value));
    const match = href?.match(/^\/([A-Za-z0-9_]+)\/status\/(\d+)/);
    if (!text || !match || seen.has(match[2])) return;
    seen.add(match[2]);
    posts.push({ id: match[2], username: match[1], text: text.slice(0, 500), rank: posts.length + 1 });
  });
  return posts.length
    ? { posts, reason: `已读取当前“为你推荐”前 ${posts.length} 条` }
    : { posts: [], reason: "“为你推荐”尚未加载可读取的帖子，本次只分析原稿" };
}

function readEditorText(editor) {
  const value = editor instanceof HTMLTextAreaElement ? editor.value : editor.innerText || editor.textContent;
  return String(value || "").replace(/\n{3,}/g, "\n\n").trim();
}

function makeButtonDraggable(button) {
  void chrome.storage.local.get(BUTTON_POSITION_KEY).then(({ [BUTTON_POSITION_KEY]: position }) => {
    if (position && Number.isFinite(position.left) && Number.isFinite(position.top)) {
      button.style.left = `${position.left}px`;
      button.style.top = `${position.top}px`;
      button.style.right = "auto";
      button.style.bottom = "auto";
    }
  });

  let start = null;
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const rect = button.getBoundingClientRect();
    start = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointermove", (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 5) return;
    event.preventDefault();
    start.moved = true;
    const left = Math.max(0, Math.min(window.innerWidth - button.offsetWidth, start.left + dx));
    const top = Math.max(0, Math.min(window.innerHeight - button.offsetHeight, start.top + dy));
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;
    button.style.right = "auto";
    button.style.bottom = "auto";
  });
  button.addEventListener("pointerup", () => {
    if (!start) return;
    if (start.moved) {
      button.dataset.dragged = "true";
      void chrome.storage.local.set({
        [BUTTON_POSITION_KEY]: {
          left: Number.parseFloat(button.style.left),
          top: Number.parseFloat(button.style.top)
        }
      });
    }
    start = null;
  });
  button.addEventListener("pointercancel", () => { start = null; });
}

function addQuickButtons() {
  document.querySelectorAll('[data-testid="reply"]').forEach((replyButton) => {
    const action = replyButton.closest('[role="button"]') || replyButton;
    const row = action.parentElement;
    if (!action || !row || row.querySelector(".xra-quick-button")) return;

    const quickButton = document.createElement("button");
    quickButton.type = "button";
    quickButton.className = "xra-quick-button";
    quickButton.textContent = "AI";
    quickButton.setAttribute("aria-label", "AI 快捷回复");
    quickButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      generate(null, replyButton, replyButton.closest('article[data-testid="tweet"]'));
    });
    action.after(quickButton);
  });
}

async function generate(thread, replyButton, article) {
  showLoading();
  const button = document.getElementById(BUTTON_ID);
  if (button) {
    button.disabled = true;
    button.hidden = true;
  }

  try {
    const targetThread = thread || readTargetThread(article);
    const threadWithApiContext = await enrichThreadContext(targetThread);
    const response = await chrome.runtime.sendMessage({
      type: "generate-replies",
      thread: threadWithApiContext,
      replyMode: "natural"
    });

    if (!response.ok) throw new Error(response.error);
    replyButton?.click();
    renderReplies(response.replies, threadWithApiContext);
  } catch (error) {
    renderError(displayError(error));
  } finally {
    hideLoading();
    if (button) {
      button.disabled = false;
      button.hidden = false;
    }
  }
}

async function enrichThreadContext(thread) {
  const { replyContextMode } = await chrome.storage.local.get("replyContextMode");
  const pageContext = { ...thread, contextSource: "page", contextNotice: "page" };
  if (replyContextMode !== "api") return pageContext;
  if (!thread.targetId) return { ...pageContext, contextNotice: "api-target-missing" };
  try {
    const response = await chrome.runtime.sendMessage({
      type: "get-thread-context",
      targetId: thread.targetId
    });
    if (!response?.ok) {
      return { ...pageContext, contextNotice: response?.reason || "api-failed" };
    }
    if (!Array.isArray(response.contextMessages) || response.contextMessages.length === 0) {
      return { ...pageContext, contextNotice: "api-empty" };
    }
    return {
      ...thread,
      contextSource: "x-api",
      contextNotice: "x-api",
      contextMessages: response.contextMessages,
      tweets: [...response.contextMessages.map((message) => message.text), thread.target]
    };
  } catch {
    return { ...pageContext, contextNotice: "api-failed" };
  }
}

function showLoading() {
  if (document.getElementById(LOADING_ID)) return;

  const loading = document.createElement("div");
  loading.id = LOADING_ID;
  loading.setAttribute("role", "status");
  loading.innerHTML = '<span class="xra-spinner"></span><span>正在生成回复…</span>';
  document.body.append(loading);
}

function hideLoading() {
  document.getElementById(LOADING_ID)?.remove();
}

function displayError(error) {
  const message = String(error?.message || error || "生成失败，请重试。");
  if (/Extension context invalidated/i.test(message)) {
    return "扩展刚刚更新，请刷新当前 X 页面后再试。";
  }
  return message;
}

function readTargetThread(article) {
  const dialog = document.querySelector('[role="dialog"]');
  const targetArticle = article
    || dialog?.querySelector('article[data-testid="tweet"]')
    || document.querySelector('article[data-testid="tweet"]');
  const targetMessage = readThreadMessage(targetArticle);
  if (dialog && capturedReplyThread?.targetId && capturedReplyThread.targetId === targetMessage?.id) {
    return { ...capturedReplyThread, target: targetMessage.text };
  }
  const target = targetMessage?.text;
  const languageText = targetArticle?.querySelector('[data-testid="tweetText"]')?.innerText.trim() || target;

  if (!target) {
    throw new Error("没有读取到当前页面的推文。请先打开一条推文或回复区。");
  }

  const pagePostId = location.pathname.match(/^\/(?:[A-Za-z0-9_]+|i\/web)\/status\/(\d+)(?:\/|$)/)?.[1];
  const detailRoot = document.querySelector('main') || document.querySelector('[role="main"]');
  const articles = pagePostId && detailRoot
    ? [...detailRoot.querySelectorAll('article[data-testid="tweet"]')].filter((item) => !item.closest('[role="dialog"]'))
    : [];
  const messages = articles.map(readThreadMessage).filter(Boolean);
  const rootIndex = messages.findIndex(message => message.id === pagePostId);
  const targetIndex = messages.findIndex(message => message.id === targetMessage?.id);
  // 详情页根帖之前是上文；根帖之后的其他评论不能当作当前评论的父帖。
  const candidates = rootIndex < 0 ? [] : targetMessage?.id === pagePostId
    ? messages.slice(0, rootIndex)
    : targetIndex > rootIndex ? messages.slice(0, rootIndex + 1) : [];
  const seen = new Set([targetMessage?.id].filter(Boolean));
  const contextMessages = candidates.filter(message => {
    if (!message.text || !message.id || seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  }).slice(-8);

  return {
    url: location.href,
    target,
    targetAuthor: targetMessage?.author || "unknown",
    targetId: targetMessage?.id || "",
    languageText,
    contextMessages,
    tweets: [...contextMessages.map((message) => message.text), target]
  };
}

function readThreadMessage(article) {
  if (!article) return null;
  const text = article.innerText.replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return null;

  const timeLink = article.querySelector('time')?.closest('a[href*="/status/"]');
  const statusLink = timeLink?.getAttribute('href') || [...article.querySelectorAll('a[href*="/status/"]')]
    .map((link) => link.getAttribute("href") || "")
    .find((href) => /\/[A-Za-z0-9_]+\/status\/\d+/.test(href));
  const match = statusLink?.match(/\/([A-Za-z0-9_]+)\/status\/(\d+)/);

  return {
    author: match?.[1] ? `@${match[1]}` : "unknown",
    id: match?.[2] || "",
    text
  };
}

function renderPostOptimizationLoading(recommendationCount = 0) {
  const panel = getPanel();
  panel.replaceChildren(panelHeader("发帖优化", recommendationCount ? `正在参考当前为你推荐前 ${recommendationCount} 条` : "正在分析原稿的推荐潜力与负反馈风险"));
  const status = document.createElement("div");
  status.className = "xra-optimize-loading";
  status.setAttribute("role", "status");
  status.innerHTML = '<span class="xra-spinner"></span><span>正在生成优化内容…</span>';
  panel.append(status);
}

function renderPostOptimization(result, editor, recommendationNotice = "") {
  const panel = getPanel();
  panel.replaceChildren(panelHeader("发帖优化", recommendationNotice || "基于公开推荐逻辑的内容潜力评估"));

  const score = document.createElement("section");
  score.className = "xra-score-summary";
  const scoreLabel = document.createElement("p");
  scoreLabel.textContent = "推荐潜力分";
  const scoreValue = document.createElement("strong");
  const delta = result.optimized.overall - result.original.overall;
  scoreValue.textContent = `${result.original.overall} → ${result.optimized.overall}`;
  const scoreDelta = document.createElement("span");
  scoreDelta.className = delta >= 0 ? "xra-score-up" : "xra-score-down";
  scoreDelta.textContent = `${delta >= 0 ? "+" : ""}${delta}`;
  score.append(scoreLabel, scoreValue, scoreDelta);
  panel.append(score);

  const metrics = document.createElement("section");
  metrics.className = "xra-score-metrics";
  const definitions = [
    ["兴趣召回", "recall", 20],
    ["回复潜力", "reply", 20],
    ["分享引用", "share", 20],
    ["停留潜力", "dwell", 15],
    ["关注作者", "follow", 10],
    ["负反馈控制", "negativeControl", 15]
  ];
  definitions.forEach(([label, key, max]) => {
    const row = document.createElement("div");
    row.className = "xra-score-row";
    const name = document.createElement("span");
    name.textContent = label;
    const values = document.createElement("strong");
    values.textContent = `${result.original[key]} → ${result.optimized[key]} / ${max}`;
    row.append(name, values);
    metrics.append(row);
  });
  panel.append(metrics);

  if (result.reasons.length) {
    const reasons = document.createElement("section");
    reasons.className = "xra-optimize-reasons";
    const heading = document.createElement("p");
    heading.textContent = "主要提升";
    const list = document.createElement("ul");
    result.reasons.forEach((reason) => {
      const item = document.createElement("li");
      item.textContent = reason;
      list.append(item);
    });
    reasons.append(heading, list);
    panel.append(reasons);
  }

  const candidate = document.createElement("article");
  candidate.className = "xra-optimized-post";
  const hint = document.createElement("p");
  hint.textContent = "优化后的内容";
  const text = document.createElement("p");
  text.className = "xra-optimized-text";
  text.textContent = result.optimized.text;
  const actions = document.createElement("div");
  actions.className = "xra-optimized-actions";
  const fill = document.createElement("button");
  fill.type = "button";
  fill.className = "xra-optimize-fill";
  fill.textContent = "填入发帖框";
  fill.addEventListener("click", () => {
    try {
      replaceEditorText(editor, result.optimized.text);
      panel.remove();
    } catch (error) {
      renderError(displayError(error));
    }
  });
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "xra-copy-button";
  copy.textContent = "复制编辑";
  copy.addEventListener("click", async () => {
    try {
      await copyReply(result.optimized.text);
      showCopyToast("优化内容已复制，可继续编辑后发布");
    } catch {
      renderError("复制失败，请再试一次。");
    }
  });
  actions.append(fill, copy);
  candidate.append(hint, text, actions);
  panel.append(candidate);

  const footer = document.createElement("p");
  footer.className = "xra-panel-footer";
  footer.textContent = `${result.recommendationCount ? `本次参考 ${result.recommendationCount} 条当前为你推荐 · ` : "未读取当前为你推荐 · "}潜力分不代表 X 官方推荐概率 · 不会自动发布`;
  panel.append(footer);
}

function renderReplies(replies, thread = {}) {
  const panel = getPanel();
  panel.replaceChildren();
  panel.append(panelHeader("AI 回复建议", "选择回复方向，每种提供三条候选"));
  panel.append(contextBadge(thread));

  const directions = [
    { mode: "natural", label: "自然接话" },
    { mode: "perspective", label: "补充观点" }
  ];
  const tabs = document.createElement("div");
  tabs.className = "xra-reply-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "回复方向");
  const tabButtons = [];
  const groups = [];
  const states = ["ready", "idle"];
  const activate = (index) => {
    tabButtons.forEach((tab, tabIndex) => {
      tab.setAttribute("aria-selected", String(tabIndex === index));
      tab.tabIndex = tabIndex === index ? 0 : -1;
      groups[tabIndex].hidden = tabIndex !== index;
    });
    return loadMode(index);
  };
  const loadMode = async (index) => {
    if (states[index] === "ready" || states[index] === "loading") return;
    const group = groups[index];
    states[index] = "loading";
    group.setAttribute("aria-busy", "true");
    const status = document.createElement("p");
    status.className = "xra-mode-status";
    status.setAttribute("role", "status");
    status.textContent = `正在生成三条“${directions[index].label}”回复…`;
    group.replaceChildren(status);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "generate-replies",
        thread,
        replyMode: directions[index].mode
      });
      if (!response?.ok) throw new Error(response?.error || "生成失败，请重试。");
      if (!panel.isConnected) return;
      renderReplyCandidates(group, response.replies, panel);
      states[index] = "ready";
    } catch (error) {
      if (!panel.isConnected) return;
      states[index] = "error";
      status.textContent = displayError(error);
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "xra-settings";
      retry.textContent = "重新生成此方向";
      retry.addEventListener("click", () => loadMode(index));
      group.append(retry);
    } finally {
      group.setAttribute("aria-busy", "false");
    }
  };
  panel.append(tabs);

  directions.forEach((direction, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = `${PANEL_ID}-tab-${index}`;
    tab.textContent = direction.label;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `${PANEL_ID}-group-${index}`);
    tab.addEventListener("click", () => activate(index));
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % directions.length;
      else if (event.key === "ArrowLeft") next = (index + directions.length - 1) % directions.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = directions.length - 1;
      else return;
      event.preventDefault();
      tabButtons[next].focus();
    });
    tabButtons.push(tab);
    tabs.append(tab);

    const group = document.createElement("div");
    group.id = `${PANEL_ID}-group-${index}`;
    group.className = "xra-candidate-group";
    group.setAttribute("role", "tabpanel");
    group.setAttribute("aria-labelledby", tab.id);
    groups.push(group);
    panel.append(group);
  });
  renderReplyCandidates(groups[0], replies, panel);
  activate(0);

  const footer = document.createElement("p");
  footer.className = "xra-panel-footer";
  footer.textContent = "首次切换方向会调用模型 · 仅填入草稿，由你确认发布";
  panel.append(footer);
}

function renderReplyCandidates(group, replies, panel) {
  group.replaceChildren();
  replies.forEach((reply, index) => {
    const candidate = document.createElement("article");
    candidate.className = "xra-candidate";
    const hint = document.createElement("p");
    hint.className = "xra-candidate-hint";
    hint.textContent = `候选 0${index + 1}`;
    const text = document.createElement("button");
    text.type = "button";
    text.className = "xra-candidate-text";
    text.textContent = reply;
    text.title = "点击直接填入 X 输入框";
    text.addEventListener("click", () => fillCandidate(reply, panel));

    const actions = document.createElement("div");
    actions.className = "xra-candidate-actions";

    const copyForEdit = document.createElement("button");
    copyForEdit.type = "button";
    copyForEdit.className = "xra-copy-button";
    copyForEdit.textContent = "复制编辑";
    copyForEdit.title = "复制到剪贴板，粘贴进 X 输入框后修改";
    copyForEdit.addEventListener("click", async () => {
      try {
        await copyReply(reply);
      } catch {
        renderError("复制失败，请再试一次。");
        return;
      }
      panel.remove();
      showCopyToast();
    });

    actions.append(copyForEdit);
    const copy = document.createElement("div");
    copy.className = "xra-candidate-copy";
    copy.append(hint, text);
    candidate.append(copy, actions);
    group.append(candidate);
  });
}

function contextBadge(thread) {
  const badge = document.createElement("div");
  const connected = thread.contextSource === "x-api";
  const messages = (thread.contextMessages || []).filter(message => message?.text?.trim());
  const count = messages.length;
  const fallback = {
    "api-unconfigured": "X 授权未配置，已回退页面模式",
    "api-target-missing": "未识别到帖文 ID，已回退页面模式",
    "api-empty": "API 未返回父帖，已回退页面模式",
    "api-failed": "API 读取失败，已回退页面模式"
  }[thread.contextNotice];
  badge.className = `xra-context-status ${count ? "xra-context-status-success" : "xra-context-status-warning"}`;
  const status = document.createElement("p");
  status.style.margin = "0";
  status.textContent = `${connected ? "API 模式" : "页面模式（未调用 X API）"} · ${count ? `✓ 已读取上下文：${count} 条上文，已用于本次回复` : "⚠ 未读取到上下文：本次仅根据当前帖生成回复"}`;
  badge.append(status);
  if (fallback) {
    const notice = document.createElement("p");
    notice.textContent = fallback;
    badge.append(notice);
  }
  if (count) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "查看本次读取的上下文";
    details.append(summary);
    messages.forEach((message, index) => {
      const item = document.createElement("p");
      item.style.whiteSpace = "pre-wrap";
      item.textContent = `${index + 1}. ${message.author || ""}\n${message.text}`;
      details.append(item);
    });
    badge.append(details);
  } else {
    const hint = document.createElement("p");
    hint.textContent = "如需承接上文，请打开目标评论的详情页，确认原帖和上文已加载后重新生成。";
    badge.append(hint);
  }
  return badge;
}

function fillCandidate(reply, panel) {
  try {
    quickInsertReply(reply);
  } catch (error) {
    renderError(displayError(error));
    return;
  }
  panel.remove();
}

function renderError(message) {
  const panel = getPanel();
  panel.replaceChildren(panelHeader(message));

  const settings = document.createElement("button");
  settings.type = "button";
  settings.className = "xra-settings";
  settings.textContent = "打开设置";
  settings.addEventListener("click", () => chrome.runtime.sendMessage({ type: "open-options" }));
  panel.append(settings);
}

function getPanel() {
  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.setAttribute("aria-label", "X AI 助手");
    document.body.append(panel);
  }
  return panel;
}

function title(text) {
  const heading = document.createElement("p");
  heading.className = "xra-title";
  heading.textContent = text;
  return heading;
}

function panelHeader(text, subtitle = "") {
  const header = document.createElement("div");
  header.className = "xra-header";
  const mark = document.createElement("span");
  mark.className = "xra-panel-mark";
  mark.textContent = "↳";
  mark.setAttribute("aria-hidden", "true");
  const heading = document.createElement("div");
  heading.className = "xra-heading-copy";
  heading.append(title(text));
  if (subtitle) {
    const description = document.createElement("p");
    description.className = "xra-subtitle";
    description.textContent = subtitle;
    heading.append(description);
  }
  header.append(mark, heading);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "xra-close";
  close.textContent = "×";
  close.setAttribute("aria-label", "关闭面板");
  close.addEventListener("click", () => document.getElementById(PANEL_ID)?.remove());
  header.append(close);
  return header;
}

async function copyReply(reply) {
  const text = String(reply).trim();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy failed");
  }
}

function showCopyToast(message = "已复制，点击 X 输入框后按 ⌘V 粘贴并编辑") {
  document.getElementById(COPY_TOAST_ID)?.remove();
  const toast = document.createElement("div");
  toast.id = COPY_TOAST_ID;
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 3600);
}

function quickInsertReply(reply) {
  const editor = findReplyEditor();
  if (!editor) throw new Error("没有找到 X 的回复输入框，请先打开回复框后再试。");

  replaceEditorText(editor, reply);
}

function replaceEditorText(editor, value) {
  if (!editor?.isConnected) throw new Error("发帖框已关闭，请重新打开后再试。");

  const text = String(value).trim();
  editor.focus();
  if (editor instanceof HTMLTextAreaElement) {
    editor.value = text;
  } else {
    editor.replaceChildren(document.createTextNode(text));
  }
  editor.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    composed: true,
    inputType: "insertText",
    data: text
  }));
}

function findReplyEditor() {
  const dialog = document.querySelector('[role="dialog"]');
  const scope = dialog || document;
  const editorRoot = scope.querySelector('[data-testid="tweetTextarea_0"]');
  if (editorRoot?.isContentEditable) return editorRoot;
  return editorRoot?.querySelector('[contenteditable="true"]')
    || scope.querySelector('[contenteditable="true"]')
    || scope.querySelector('textarea');
}
