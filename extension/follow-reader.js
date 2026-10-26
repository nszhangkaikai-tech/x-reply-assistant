// Runs in X's page world so it can inspect the user data already loaded for visible cards.
export function readFollowStatuses({ observer, url, targets }) {
  if (!/^[A-Za-z0-9_]{1,15}$/.test(observer || "") ||
      !["https://x.com", "https://twitter.com"].includes(location.origin) ||
      location.href !== url || !Array.isArray(targets) || targets.length > 12) return [];

  const profile = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
  if (profile?.getAttribute("href")?.toLowerCase() !== `/${observer.toLowerCase()}`) return [];

  const own = (object, key) => {
    const descriptor = object && typeof object === "object" ? Object.getOwnPropertyDescriptor(object, key) : null;
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  };

  return targets.map(({ marker, handle }) => {
    const result = { marker, handle, notFollowed: false };
    if (!/^[a-f0-9-]{36}$/.test(marker || "") ||
        !/^[A-Za-z0-9_]{1,15}$/.test(handle || "") ||
        handle.toLowerCase() === observer.toLowerCase()) return result;

    const regions = document.querySelectorAll(`[data-xra-follow-target="${marker}"]`);
    if (regions.length !== 1) return result;
    const region = regions[0];
    const links = [...region.querySelectorAll("a[href]")].map((link) => {
      try { return new URL(link.getAttribute("href"), location.origin).pathname.toLowerCase(); }
      catch { return ""; }
    });
    if (!links.includes(`/${handle.toLowerCase()}`) &&
        !(region.dataset.testid === "UserName" && location.pathname.toLowerCase() === `/${handle.toLowerCase()}`)) return result;

    const candidates = [];
    const ids = new Set();
    const visited = new WeakSet();
    const fibers = new Set();
    let visits = 0;
    function inspect(value, depth = 0) {
      if (!value || typeof value !== "object" || depth > 6 || visited.has(value) || ++visits > 2000) return;
      visited.add(value);
      const legacy = own(value, "legacy");
      const core = own(value, "core");
      const name = own(value, "screen_name") ?? own(legacy, "screen_name") ?? own(core, "screen_name");
      const id = own(value, "id_str") ?? own(value, "rest_id");
      if (typeof name === "string" && name.toLowerCase() === handle.toLowerCase() &&
          typeof id === "string" && /^\d{1,25}$/.test(id)) {
        ids.add(id);
        const direct = own(value, "following");
        const old = own(legacy, "following");
        const restricted = own(value, "suspended") === true || own(legacy, "suspended") === true ||
          ["fake_account", "temporarily_restricted"].includes(own(value, "profile_interstitial_type") ?? own(legacy, "profile_interstitial_type"));
        candidates.push({ following: direct ?? old, conflict: typeof direct === "boolean" && typeof old === "boolean" && direct !== old,
          restricted, requested: own(value, "follow_request_sent") === true || own(legacy, "follow_request_sent") === true });
      }
      for (const key of ["user", "author", "user_results", "result", "tweet", "quoted_status", "legacy", "core"]) {
        inspect(own(value, key), depth + 1);
      }
    }

    for (const node of [region, region.closest('[data-testid="tweet"]'), ...region.querySelectorAll("a")].filter(Boolean).slice(0, 8)) {
      const key = Object.keys(node).find((name) => name.startsWith("__reactFiber$"));
      let fiber = key ? own(node, key) : null;
      for (let depth = 0; fiber && depth < 48 && !fibers.has(fiber); depth++, fiber = own(fiber, "return")) {
        fibers.add(fiber);
        inspect(own(fiber, "memoizedProps"));
      }
    }

    const surface = region.dataset.testid === "UserName" ? region.closest('[data-testid="primaryColumn"]') ?? region : region;
    result.notFollowed = visits < 2000 && ids.size === 1 && candidates.length > 0 &&
      candidates.every((item) => item.following === false && !item.conflict && !item.restricted && !item.requested) &&
      !surface.querySelector(`[data-testid="${[...ids][0]}-unfollow"]`) &&
      region.isConnected && location.href === url &&
      profile.getAttribute("href")?.toLowerCase() === `/${observer.toLowerCase()}`;
    return result;
  });
}
