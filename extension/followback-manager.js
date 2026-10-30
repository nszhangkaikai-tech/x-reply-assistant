(() => {
  "use strict";

  const core = XRAFollowbackCore;
  const recordsPrefix = "followbackRecords:";
  const toolbar = document.createElement("section");
  toolbar.id = "xra-followback-tools";
  toolbar.innerHTML = `<div class="xra-followback-heading"><strong>回关筛选</strong><div><select aria-label="回关筛选"><option value="all">全部</option><option value="non">未回关</option><option value="returned">新增回关</option><option value="pending">待复查</option></select><button type="button">打开管理页</button></div></div><p role="status"></p>`;

  let ownerId = "";
  let ownerHandle = "";
  let loadedOwnerId = "";
  let routeKey = "";
  let scanId = "";
  let filter = "all";
  let records = {};
  let observed = new Map();
  let saveQueue = Promise.resolve();
  let scheduled = false;

  function accountHandle() {
    try {
      const href = document.querySelector('[data-testid="AppTabBar_Profile_Link"]')?.getAttribute("href") || "";
      return /^\/([A-Za-z0-9_]{1,15})\/?$/.exec(new URL(href, location.origin).pathname)?.[1] || "";
    } catch { return ""; }
  }
  const isFollowingPage = () => ownerHandle && new RegExp(`^/${ownerHandle}/following/?$`, "i").test(location.pathname);

  function rowHandle(cell) {
    for (const link of cell.querySelectorAll("a[href]")) {
      try {
        const url = new URL(link.getAttribute("href"), location.origin);
        const handle = /^\/([A-Za-z0-9_]{1,15})$/.exec(url.pathname)?.[1];
        if (url.origin === location.origin && handle) return handle;
      } catch { /* Ignore malformed links. */ }
    }
    return "";
  }

  function currentStatus(record) {
    return core.recordStatus(record, scanId);
  }

  function draw() {
    const counts = { non: 0, returned: 0, pending: 0 };
    for (const record of Object.values(records)) counts[currentStatus(record)]++;
    const status = toolbar.querySelector("p");
    status.textContent = `本次已加载 ${observed.size} 人 · 未回关 ${counts.non} · 新增回关 ${counts.returned} · 待复查 ${counts.pending}。继续滚动可检查更多账号。`;
    const byHandle = new Map(Object.values(records).map((record) => [record.handle.toLowerCase(), record]));
    const current = new Map([...observed.values()].map((user) => [user.handle.toLowerCase(), user]));
    document.querySelectorAll('[data-testid="primaryColumn"] [data-testid="UserCell"]').forEach((cell) => {
      const handle = rowHandle(cell).toLowerCase();
      const record = byHandle.get(handle);
      const user = current.get(handle);
      const state = user?.followedBy === false ? "non" : record ? currentStatus(record) : null;
      const match = filter === "all" || state === filter;
      cell.classList.toggle("xra-followback-hidden", !match);
      let badge = cell.querySelector(".xra-followback-badge");
      const showBadge = user?.followedBy === false || (record && currentStatus(record) === "non");
      if (!showBadge) { badge?.remove(); return; }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "xra-followback-badge";
        badge.textContent = "未回关";
        const anchor = [...cell.querySelectorAll("a[href]")].find((link) => link.textContent.trim().startsWith("@"));
        (anchor || cell.firstElementChild || cell).after(badge);
      }
    });
  }

  async function persist(users) {
    if (!ownerId || !scanId) return;
    const now = Date.now();
    records = core.mergeRecords(records, users, scanId, now);
    const stored = await chrome.storage.local.get("followbackAccounts");
    const accounts = { ...(stored.followbackAccounts || {}) };
    accounts[ownerId] = { ownerId, handle: ownerHandle, scanId, scanStartedAt: accounts[ownerId]?.scanId === scanId ? accounts[ownerId].scanStartedAt : now, updatedAt: now, observedCount: observed.size };
    await chrome.storage.local.set({ [`${recordsPrefix}${ownerId}`]: records, followbackAccounts: accounts });
  }

  async function loadRecords() {
    if (!ownerId || loadedOwnerId === ownerId) return;
    const key = `${recordsPrefix}${ownerId}`;
    const stored = await chrome.storage.local.get(key);
    records = stored[key] && typeof stored[key] === "object" ? stored[key] : {};
    loadedOwnerId = ownerId;
  }

  function consume(message) {
    if (!isFollowingPage() || !message.ownerId || !Array.isArray(message.users)) return;
    if (!ownerId) ownerId = message.ownerId;
    if (message.ownerId !== ownerId) return;
    for (const user of message.users) {
      if (!/^\d+$/.test(user.id || "") || !core.validHandle(user.handle)) continue;
      observed.set(user.id, user);
    }
    saveQueue = saveQueue.catch(() => {}).then(loadRecords).then(() => persist(message.users)).then(draw);
  }

  function requestSnapshot() {
    window.postMessage({ source: "xra-followback-content", type: "XRA_READ_FOLLOWING", requestId: crypto.randomUUID() }, location.origin);
  }

  async function update() {
    const handle = accountHandle();
    const nextRoute = handle && new RegExp(`^/${handle}/following/?$`, "i").test(location.pathname) ? `${location.origin}/${handle.toLowerCase()}/following` : "";
    if (!nextRoute) {
      toolbar.remove();
      document.querySelectorAll(".xra-followback-hidden").forEach((node) => node.classList.remove("xra-followback-hidden"));
      document.querySelectorAll(".xra-followback-badge").forEach((node) => node.remove());
      routeKey = "";
      ownerId = "";
      loadedOwnerId = "";
      ownerHandle = "";
      scanId = "";
      observed = new Map();
      return;
    }
    if (nextRoute !== routeKey) {
      routeKey = nextRoute;
      ownerHandle = handle;
      ownerId = "";
      loadedOwnerId = "";
      scanId = crypto.randomUUID();
      records = {};
      observed = new Map();
    }
    const primary = document.querySelector('[data-testid="primaryColumn"]');
    if (primary && !toolbar.isConnected) {
      primary.prepend(toolbar);
      requestSnapshot();
    }
    draw();
  }

  toolbar.querySelector("select").addEventListener("change", (event) => { filter = event.target.value; draw(); });
  toolbar.querySelector("button").addEventListener("click", () => chrome.runtime.sendMessage({ type: "open-followback-manager" }));
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || message?.source !== "xra-followback-page") return;
    if (message.type === "XRA_FOLLOWING_PAGE" || message.type === "XRA_FOLLOWING_SNAPSHOT") consume(message);
  });
  const pageObserver = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; void update(); });
  });
  if (document.documentElement) pageObserver.observe(document.documentElement, { childList: true, subtree: true });
  else document.addEventListener("DOMContentLoaded", () => pageObserver.observe(document.documentElement, { childList: true, subtree: true }), { once: true });
  setInterval(() => { void update(); }, 1000);
  void update();
})();
