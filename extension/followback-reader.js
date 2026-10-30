(() => {
  "use strict";
  if (window.__xraFollowbackReader) return;
  window.__xraFollowbackReader = true;

  const source = "xra-followback-page";
  const snapshot = new Map();

  function viewerId() {
    return decodeURIComponent(document.cookie.match(/(?:^|;\s*)twid=([^;]+)/)?.[1] || "").replace(/^u=/, "");
  }

  function publish(urlValue, body) {
    try {
      const url = new URL(urlValue, location.origin);
      if (!/^(?:api\.)?(?:x|twitter)\.com$/.test(url.hostname) || !/\/graphql\/[^/]+\/Following$/.test(url.pathname)) return;
      const ownerId = String(JSON.parse(url.searchParams.get("variables") || "{}").userId || "");
      if (!ownerId || ownerId !== viewerId() || body?.errors?.length) return;
      const users = XRAFollowbackCore.extractFollowingUsers(body);
      for (const user of users) snapshot.set(`${ownerId}:${user.id}`, { ownerId, user });
      window.postMessage({ source, type: "XRA_FOLLOWING_PAGE", ownerId, users }, location.origin);
    } catch { /* Unknown data is not evidence that an account did not follow back. */ }
  }

  const originalFetch = window.fetch;
  window.fetch = function xraFollowbackFetch(input, init) {
    const result = Reflect.apply(originalFetch, this, [input, init]);
    const url = input instanceof Request ? input.url : String(input);
    if (/\/Following(?:\?|$)/.test(url)) {
      result.then((response) => {
        if (response.ok) response.clone().json().then((body) => publish(url, body)).catch(() => {});
      }).catch(() => {});
    }
    return result;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const requests = new WeakMap();
  XMLHttpRequest.prototype.open = function xraFollowbackOpen(method, url, ...rest) {
    requests.set(this, String(url));
    return Reflect.apply(originalOpen, this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.send = function xraFollowbackSend(...args) {
    const url = requests.get(this);
    if (url && /\/Following(?:\?|$)/.test(url)) {
      this.addEventListener("load", () => {
        if (this.status < 200 || this.status >= 300) return;
        try { publish(url, this.responseType === "json" ? this.response : JSON.parse(this.responseText)); }
        catch { /* Ignore non-JSON responses. */ }
      }, { once: true });
    }
    return Reflect.apply(originalSend, this, args);
  };

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || message?.source !== "xra-followback-content" || message.type !== "XRA_READ_FOLLOWING") return;
    const ownerId = viewerId();
    const users = [...snapshot.values()].filter((item) => item.ownerId === ownerId).map((item) => item.user);
    window.postMessage({ source, type: "XRA_FOLLOWING_SNAPSHOT", requestId: message.requestId, ownerId, users }, location.origin);
  });
})();
