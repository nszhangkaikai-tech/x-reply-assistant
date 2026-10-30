const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../extension/followback-core.js");

function response(users) {
  return {
    data: {
      user: {
        result: {
          timeline: {
            timeline: {
              instructions: [{
                entries: users.map((user) => ({
                  entryId: `user-${user.rest_id}`,
                  content: { itemContent: { user_results: { result: user } } }
                }))
              }]
            }
          }
        }
      }
    }
  };
}

test("extracts follow-back state from modern and legacy Following rows", () => {
  const rows = core.extractFollowingUsers(response([
    { __typename: "User", rest_id: "1", core: { screen_name: "modern", name: "Modern" }, relationship_perspectives: { following: true, followed_by: false } },
    { __typename: "User", rest_id: "2", legacy: { screen_name: "legacy", name: "Legacy", following: true, followed_by: true } },
    { __typename: "User", rest_id: "3", core: { screen_name: "unknown" }, relationship_perspectives: { following: true } },
    { __typename: "User", rest_id: "4", core: { screen_name: "not_following" }, relationship_perspectives: { following: false, followed_by: false } }
  ]));
  assert.deepEqual(rows.map(({ id, followedBy }) => ({ id, followedBy })), [
    { id: "1", followedBy: false },
    { id: "2", followedBy: true },
    { id: "3", followedBy: null }
  ]);
});

test("stores only confirmed non-followers and records a later follow-back", () => {
  const first = core.mergeRecords({}, [
    { id: "1", handle: "one", name: "One", followedBy: false },
    { id: "2", handle: "two", name: "Two", followedBy: true },
    { id: "3", handle: "three", name: "Three", followedBy: null }
  ], "scan-1", 100);
  assert.deepEqual(Object.keys(first), ["1"]);
  assert.equal(core.recordStatus(first["1"], "scan-1"), "non");

  const second = core.mergeRecords(first, [{ id: "1", handle: "one", name: "One", followedBy: true }], "scan-2", 200);
  assert.equal(second["1"].returnedAt, 200);
  assert.equal(core.recordStatus(second["1"], "scan-2"), "returned");
  assert.equal(core.recordStatus(second["1"], "scan-3"), "pending");
});

test("unknown relationship data never overwrites a confirmed state", () => {
  const record = core.mergeRecords({}, [{ id: "1", handle: "one", name: "One", followedBy: false }], "scan-1", 100);
  const merged = core.mergeRecords(record, [{ id: "1", handle: "one", name: "One", followedBy: null }], "scan-2", 200);
  assert.deepEqual(merged, record);
});
