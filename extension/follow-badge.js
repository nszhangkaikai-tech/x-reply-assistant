(() => {
  const selector = '[data-testid="UserCell"], [data-testid="User-Name"], [data-testid="UserName"], [data-testid="HoverCard"]';
  const records = new Map();
  let timer = null;
  let busy = false;
  let observer = "";
  let pageUrl = "";
  let enabled = false;
  let settingChanged = false;

  function handleOf(region) {
    if (region.dataset.testid === "UserName" && !region.closest('[data-testid="HoverCard"]')) {
      return /^\/([A-Za-z0-9_]{1,15})$/.exec(location.pathname)?.[1] || null;
    }
    for (const link of region.querySelectorAll("a[href]")) {
      try {
        const url = new URL(link.getAttribute("href"), location.origin);
        const handle = /^\/([A-Za-z0-9_]{1,15})$/.exec(url.pathname)?.[1];
        if (url.origin === location.origin && handle && !["home", "search", "explore", "compose", "settings"].includes(handle.toLowerCase())) return handle;
      } catch { /* Ignore invalid links inside X cards. */ }
    }
    return null;
  }

  function clear(record) {
    record.badge?.remove();
    record.region.removeAttribute("data-xra-follow-target");
    records.delete(record.region);
  }

  function schedule(delay = 180) {
    if (timer) return;
    timer = setTimeout(() => { timer = null; void scan(); }, delay);
  }

  function show(record, visible) {
    record.notFollowed = visible;
    if (!visible) { record.badge?.remove(); record.badge = null; return; }
    if (record.badge?.isConnected) return;
    const badge = document.createElement("span");
    badge.className = "xra-unfollowed-badge";
    badge.textContent = "未关注";
    badge.title = "你尚未关注这个账号";
    const anchor = [...record.region.querySelectorAll("a[href]")].find((link) => {
      try { return new URL(link.getAttribute("href"), location.origin).pathname.toLowerCase() === `/${record.handle.toLowerCase()}`; }
      catch { return false; }
    });
    (anchor || record.region.lastElementChild || record.region).after(badge);
    record.badge = badge;
  }

  async function scan() {
    if (busy || !enabled) return;
    const current = /^\/([A-Za-z0-9_]{1,15})$/.exec(document.querySelector('[data-testid="AppTabBar_Profile_Link"]')?.getAttribute("href") || "")?.[1] || "";
    if (current !== observer || location.href !== pageUrl) {
      for (const record of records.values()) clear(record);
      observer = current;
      pageUrl = location.href;
    }
    if (!observer || document.hidden) return;

    for (const [region, record] of records) {
      if (!region.isConnected || handleOf(region)?.toLowerCase() !== record.handle.toLowerCase()) clear(record);
    }

    const batch = [];
    const now = Date.now();
    for (const region of document.querySelectorAll(selector)) {
      if (batch.length >= 12) break;
      if (region.closest('[data-testid="UserCell"]') !== null && region.dataset.testid !== "UserCell") continue;
      if (region.dataset.testid === "UserName" && region.closest('[data-testid="User-Name"]')) continue;
      const rect = region.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) continue;
      const handle = handleOf(region);
      if (!handle || handle.toLowerCase() === observer.toLowerCase()) continue;
      let record = records.get(region);
      if (!record) {
        record = { region, handle, marker: crypto.randomUUID(), checkedAt: 0, badge: null, notFollowed: false };
        region.setAttribute("data-xra-follow-target", record.marker);
        records.set(region, record);
      }
      if (now - record.checkedAt < 120000) { show(record, record.notFollowed); continue; }
      record.checkedAt = now;
      show(record, false);
      batch.push({ marker: record.marker, handle: record.handle });
    }
    if (!batch.length) return;

    busy = true;
    const requestedUrl = pageUrl;
    const requestedObserver = observer;
    try {
      const response = await chrome.runtime.sendMessage({ type: "read-follow-statuses", observer, url: pageUrl, targets: batch });
      if (!enabled || !response?.ok || requestedUrl !== location.href || requestedObserver !== observer) return;
      for (const row of response.rows || []) {
        const record = [...records.values()].find((item) => item.marker === row.marker);
        if (record && record.region.isConnected && record.handle === row.handle) show(record, row.notFollowed === true);
      }
    } catch { /* A reloaded extension or unavailable X card simply shows no badge. */ }
    finally { busy = false; schedule(250); }
  }

  new MutationObserver(() => schedule()).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "data-testid"] });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.showUnfollowedBadge) return;
    settingChanged = true;
    enabled = changes.showUnfollowedBadge.newValue !== false;
    if (!enabled) {
      for (const record of records.values()) clear(record);
    } else {
      schedule();
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest?.('[data-testid$="-follow"], [data-testid$="-unfollow"], [data-testid="confirmationSheetConfirm"]')) return;
    for (const record of records.values()) { record.checkedAt = 0; show(record, false); }
    schedule(700);
  }, true);
  window.addEventListener("focus", () => {
    for (const record of records.values()) { record.checkedAt = 0; show(record, false); }
    schedule();
  });
  chrome.storage.local.get("showUnfollowedBadge").then(({ showUnfollowedBadge }) => {
    if (settingChanged) return;
    enabled = showUnfollowedBadge !== false;
    if (enabled) schedule();
  });
})();
