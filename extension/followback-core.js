(function (root) {
  "use strict";

  const validHandle = (value) => /^[A-Za-z0-9_]{1,15}$/.test(value || "");

  function extractFollowingUsers(body) {
    const instructions = body?.data?.user?.result?.timeline?.timeline?.instructions
      ?? body?.data?.user?.result?.timeline?.instructions
      ?? [];
    const users = [];
    for (const instruction of instructions) {
      const entries = instruction.entries || (instruction.entry ? [instruction.entry] : []);
      for (const entry of entries) {
        if (!/^user-/.test(entry.entryId || "")) continue;
        let user = entry.content?.itemContent?.user_results?.result;
        if (user?.user) user = user.user;
        if (!user || user.__typename !== "User" || !/^\d+$/.test(user.rest_id || "")) continue;
        const legacy = user.legacy || {};
        const core = user.core || {};
        const relation = user.relationship_perspectives || {};
        const handle = core.screen_name ?? legacy.screen_name;
        if (!validHandle(handle) || (relation.following ?? legacy.following) === false) continue;
        const followedBy = relation.followed_by ?? legacy.followed_by;
        users.push({
          id: user.rest_id,
          handle,
          name: core.name ?? legacy.name ?? handle,
          avatar: String(user.avatar?.image_url ?? legacy.profile_image_url_https ?? ""),
          followedBy: typeof followedBy === "boolean" ? followedBy : null
        });
      }
    }
    return users;
  }

  function mergeRecords(records, users, scanId, now = Date.now()) {
    const result = { ...records };
    for (const user of users) {
      if (!/^\d+$/.test(user.id || "") || !validHandle(user.handle) || typeof user.followedBy !== "boolean") continue;
      const old = result[user.id];
      if (!old && user.followedBy) continue;
      result[user.id] = {
        ...old,
        id: user.id,
        handle: user.handle,
        name: user.name || user.handle,
        avatar: user.avatar || old?.avatar || "",
        firstSeenAt: old?.firstSeenAt || now,
        lastCheckedAt: now,
        lastScanId: scanId,
        followedBy: user.followedBy,
        returnedAt: user.followedBy ? (old?.followedBy === true ? old.returnedAt : now) : null
      };
    }
    return result;
  }

  function recordStatus(record, scanId) {
    if (!record || !scanId || record.lastScanId !== scanId) return "pending";
    return record.followedBy === true ? "returned" : "non";
  }

  const api = Object.freeze({ validHandle, extractFollowingUsers, mergeRecords, recordStatus });
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.XRAFollowbackCore = api;
})(globalThis);
