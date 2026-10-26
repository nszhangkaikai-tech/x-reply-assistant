const persona = document.getElementById("persona");
const apiUrl = document.getElementById("api-url");
const apiKey = document.getElementById("api-key");
const provider = document.getElementById("provider");
const model = document.getElementById("model");
const modelPreset = document.getElementById("model-preset");
const customModelLabel = document.getElementById("custom-model-label");
const replyLanguage = document.getElementById("reply-language");
const deAi = document.getElementById("de-ai");
const deAiPrompt = document.getElementById("de-ai-prompt");
const generationMode = document.getElementById("generation-mode");
const replyContextMode = document.getElementById("reply-context-mode");
const replyContextHint = document.getElementById("reply-context-hint");
const configureContextApi = document.getElementById("configure-context-api");
const file = document.getElementById("file");
const apiStatus = document.getElementById("api-status");
const testApi = document.getElementById("test-api");
const stepfunRoute = document.getElementById("stepfun-route");
const stepfunRouteWrap = document.getElementById("stepfun-route-wrap");
const todayGeneration = document.getElementById("today-generation");
const todayPosts = document.getElementById("today-posts");
const todayReplies = document.getElementById("today-replies");
const totalDuration = document.getElementById("total-duration");
const totalGeneration = document.getElementById("total-generation");
const statsDate = document.getElementById("stats-date");
const homeXRefresh = document.getElementById("home-x-refresh");
const homeXWindow = document.getElementById("home-x-window");
const homeXProgress = document.getElementById("home-x-progress");
const homeXStatus = document.getElementById("home-x-status");
const xClientId = document.getElementById("x-client-id");
const toggleXClientId = document.getElementById("toggle-x-client-id");
const xRedirectUri = document.getElementById("x-redirect-uri");
const xApiStatus = document.getElementById("x-api-status");
const connectXApi = document.getElementById("connect-x-api");
const loadXLists = document.getElementById("load-x-lists");
const xLists = document.getElementById("x-lists");
const xListsEmpty = document.getElementById("x-lists-empty");
const xListPostsStatus = document.getElementById("x-list-posts-status");
const xListPosts = document.getElementById("x-list-posts");
const xTrendBearer = document.getElementById("x-trend-bearer");
const saveXTrendBearer = document.getElementById("save-x-trend-bearer");
const xTrendBearerStatus = document.getElementById("x-trend-bearer-status");
const loadXTrends = document.getElementById("load-x-trends");
const xTrendsStatus = document.getElementById("x-trends-status");
const xTrends = document.getElementById("x-trends");
const githubRepository = document.getElementById("github-repository");
const updateStatus = document.getElementById("update-status");
const openUpdatePage = document.getElementById("open-update-page");
const showUnfollowedBadge = document.getElementById("show-unfollowed-badge");
const unfollowedBadgeStatus = document.getElementById("unfollowed-badge-status");
const interactionRefresh = document.getElementById("interaction-refresh");
const interactionOpenMentions = document.getElementById("interaction-open-mentions");
const interactionUpdatedAt = document.getElementById("interaction-updated-at");
const interactionStatus = document.getElementById("interaction-status");
const interactionList = document.getElementById("interaction-list");
const interactionEmpty = document.getElementById("interaction-empty");
const relationshipRefresh = document.getElementById("relationship-refresh");
const relationshipOpenMentions = document.getElementById("relationship-open-mentions");
const relationshipUpdatedAt = document.getElementById("relationship-updated-at");
const relationshipStatus = document.getElementById("relationship-status");
const relationshipList = document.getElementById("relationship-list");
const relationshipEmpty = document.getElementById("relationship-empty");
const relationshipSearch = document.getElementById("relationship-search");
const relationshipSort = document.getElementById("relationship-sort");
const relationshipPageSize = document.getElementById("relationship-page-size");
const relationshipPrev = document.getElementById("relationship-prev");
const relationshipNext = document.getElementById("relationship-next");
const exportSettings = document.getElementById("export-settings");
const importSettingsFile = document.getElementById("import-settings-file");
const importSettings = document.getElementById("import-settings");
const backupStatus = document.getElementById("backup-status");
const installedVersion = chrome.runtime.getManifest().version;
const defaultGithubRepository = "https://github.com/nszhangkaikai-tech/x-reply-assistant";

const providers = {
  stepfun: { apiUrl: "https://api.stepfun.com/step_plan/v1", model: "step-3.7-flash" },
  xiaomi: { apiUrl: "https://api.xiaomimimo.com/v1", model: "mimo-v2.5" },
  openai: { apiUrl: "https://api.openai.com/v1/chat/completions", model: "gpt-4.1-mini" },
  deepseek: { apiUrl: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" },
  qwen: { apiUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", model: "qwen-turbo" }
};

const defaultDeAiPrompt = "用自然、具体、像真人随手写的表达。避免模板化过渡、空泛赞美、营销黑话、生硬总结、说教和过度工整的句式。长短句交错，直接说人话。";
let providerConfigs = {};
let activeProvider = "custom";
let activeListPostsRequest = 0;
let homeXBusy = false;
let homeXConnected = false;
let interactionRecords = [];
let interactionFilter = "pending";
let interactionLastUpdated = null;
let interactionProfiles = [];
let relationshipFilter = "candidates";
let relationshipPage = 1;

document.getElementById("sidebar-version").textContent = `v${installedVersion} · 2026-10-26`;

chrome.storage.local.get(["personaMarkdown", "apiUrl", "apiKey", "model", "provider", "providerConfigs", "replyLanguage", "deAi", "deAiPrompt", "generationMode", "replyContextMode", "usageDate", "usageCount", "publishDate", "postCount", "replyCount", "totalGenerationCount", "totalGenerationDurationMs", "xApiClientId", "xTrendBearerToken", "githubRepository", "showUnfollowedBadge", "xDailySummary", "interactionRecords", "interactionUpdatedAt", "interactionProfiles"], async (settings) => {
  persona.value = settings.personaMarkdown || "";
  providerConfigs = settings.providerConfigs || {};
  provider.value = settings.provider || detectProvider(settings.apiUrl || "");
  activeProvider = provider.value;
  if (!providerConfigs[provider.value] && settings.apiUrl) {
    providerConfigs[provider.value] = { apiUrl: settings.apiUrl, apiKey: settings.apiKey || "", model: settings.model || "" };
  }
  loadProviderConfig();
  replyLanguage.value = settings.replyLanguage || "follow";
  deAi.checked = settings.deAi !== false;
  deAiPrompt.value = settings.deAiPrompt || defaultDeAiPrompt;
  deAiPrompt.disabled = !deAi.checked;
  generationMode.value = settings.generationMode || "fast";
  replyContextMode.value = settings.replyContextMode === "api" ? "api" : "page";
  replyContextMode.disabled = false;
  updateContextModeHint();
  xClientId.value = settings.xApiClientId || "";
  xTrendBearer.value = settings.xTrendBearerToken || "";
  githubRepository.value = settings.githubRepository || defaultGithubRepository;
  showUnfollowedBadge.checked = settings.showUnfollowedBadge !== false;
  showUnfollowedBadge.disabled = false;
  updateStatus.textContent = settings.githubRepository
    ? "仓库地址已保存。点击“检查更新”读取最新发布版本。"
    : "已配置官方 GitHub 仓库，可直接检查最新版本。";
  xTrendBearerStatus.textContent = settings.xTrendBearerToken ? "趋势令牌已保存在当前浏览器。" : "趋势需要单独配置应用 Bearer Token。";
  xRedirectUri.textContent = chrome.identity.getRedirectURL();
  showDashboard(settings);
  interactionRecords = Array.isArray(settings.interactionRecords) ? settings.interactionRecords : [];
  interactionProfiles = Array.isArray(settings.interactionProfiles) ? settings.interactionProfiles : [];
  interactionLastUpdated = settings.interactionUpdatedAt || null;
  renderInteractions(settings.interactionUpdatedAt);
  await refreshApiStatus();
  await refreshXApiStatus();
  if (!homeXRefresh.disabled) showHomeXStats(settings.xDailySummary);
});

document.querySelectorAll(".nav-item").forEach((item) => item.addEventListener("click", () => showPage(item.dataset.page)));
document.querySelectorAll("[data-open-page]").forEach((item) => item.addEventListener("click", () => showPage(item.dataset.openPage)));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.showUnfollowedBadge && !showUnfollowedBadge.disabled) {
    showUnfollowedBadge.checked = changes.showUnfollowedBadge.newValue !== false;
  }
  if (changes.xDailySummary && !homeXRefresh.disabled) showHomeXStats(changes.xDailySummary.newValue);
  if (changes.interactionRecords || changes.interactionUpdatedAt || changes.interactionProfiles) {
    chrome.storage.local.get(["interactionRecords", "interactionUpdatedAt", "interactionProfiles"]).then((stored) => {
      interactionRecords = Array.isArray(stored.interactionRecords) ? stored.interactionRecords : [];
      interactionProfiles = Array.isArray(stored.interactionProfiles) ? stored.interactionProfiles : [];
      interactionLastUpdated = stored.interactionUpdatedAt || interactionLastUpdated;
      renderInteractions(stored.interactionUpdatedAt);
    });
  }
  if (changes.xApiAuth) {
    void refreshXApiStatus().then(async () => {
      if (!homeXRefresh.disabled) showHomeXStats((await chrome.storage.local.get("xDailySummary")).xDailySummary);
    });
  }
  if (["usageDate", "usageCount", "publishDate", "postCount", "replyCount", "totalGenerationCount", "totalGenerationDurationMs"].some((key) => changes[key])) {
    refreshDashboard();
  }
});
document.getElementById("save-profile").addEventListener("click", saveProfile);
document.getElementById("save-style").addEventListener("click", saveStyle);
replyContextMode.addEventListener("change", updateContextModeHint);
configureContextApi.addEventListener("click", () => showPage("maintenance"));
document.getElementById("save-api").addEventListener("click", () => saveApi(true));
document.getElementById("save-x-api").addEventListener("click", saveXApiConfig);
toggleXClientId.addEventListener("click", () => {
  const visible = xClientId.type === "password";
  xClientId.type = visible ? "text" : "password";
  toggleXClientId.textContent = visible ? "隐藏" : "显示";
  toggleXClientId.setAttribute("aria-pressed", String(visible));
});
connectXApi.addEventListener("click", connectXAccount);
loadXLists.addEventListener("click", loadOwnedLists);
saveXTrendBearer.addEventListener("click", saveTrendBearerToken);
loadXTrends.addEventListener("click", loadTrends);
interactionRefresh.addEventListener("click", refreshInteractions);
interactionOpenMentions.addEventListener("click", () => chrome.tabs.create({ url: "https://x.com/notifications/mentions" }));
relationshipRefresh.addEventListener("click", refreshInteractions);
relationshipOpenMentions.addEventListener("click", () => chrome.tabs.create({ url: "https://x.com/notifications/mentions" }));
document.querySelectorAll("[data-interaction-filter]").forEach((button) => button.addEventListener("click", () => {
  interactionFilter = button.dataset.interactionFilter;
  document.querySelectorAll("[data-interaction-filter]").forEach((item) => item.classList.toggle("active", item === button));
  renderInteractions();
}));
document.querySelectorAll("[data-relationship-filter]").forEach((button) => button.addEventListener("click", () => {
  relationshipFilter = button.dataset.relationshipFilter;
  relationshipPage = 1;
  document.querySelectorAll("[data-relationship-filter]").forEach((item) => item.classList.toggle("active", item === button));
  renderRelationships();
}));
relationshipSearch.addEventListener("input", () => { relationshipPage = 1; renderRelationships(); });
relationshipSort.addEventListener("change", () => { relationshipPage = 1; renderRelationships(); });
relationshipPageSize.addEventListener("change", () => { relationshipPage = 1; renderRelationships(); });
relationshipPrev.addEventListener("click", () => { relationshipPage = Math.max(1, relationshipPage - 1); renderRelationships(); });
relationshipNext.addEventListener("click", () => { relationshipPage += 1; renderRelationships(); });
document.getElementById("refresh-diagnostics").addEventListener("click", refreshDiagnostics);
homeXRefresh.addEventListener("click", async () => {
  homeXBusy = true;
  homeXRefresh.disabled = true;
  homeXStatus.textContent = "正在采集 X 账号数据，请稍候…";
  try {
    const result = await chrome.runtime.sendMessage({ type: "collect-x-daily-stats" });
    if (!result?.ok) throw new Error(result?.error || "采集失败");
    showHomeXStats(result.stats);
  } catch (error) {
    homeXStatus.textContent = `采集失败：${error.message}`;
  } finally {
    homeXBusy = false;
    homeXRefresh.disabled = !homeXConnected;
  }
});
showUnfollowedBadge.addEventListener("change", async () => {
  const enabled = showUnfollowedBadge.checked;
  showUnfollowedBadge.disabled = true;
  unfollowedBadgeStatus.textContent = "保存中…";
  unfollowedBadgeStatus.classList.remove("success");
  try {
    await chrome.storage.local.set({ showUnfollowedBadge: enabled });
    unfollowedBadgeStatus.textContent = "已保存，X 页面上的标签会立即更新。";
    unfollowedBadgeStatus.classList.add("success");
  } catch {
    showUnfollowedBadge.checked = !enabled;
    unfollowedBadgeStatus.textContent = "保存失败，请重试。";
  } finally {
    showUnfollowedBadge.disabled = false;
  }
});
document.getElementById("save-github-repository").addEventListener("click", saveGithubRepository);
document.getElementById("check-update").addEventListener("click", checkForUpdates);
exportSettings.addEventListener("click", exportSettingsBackup);
importSettingsFile.addEventListener("change", () => {
  const selected = importSettingsFile.files?.[0];
  importSettings.disabled = !selected;
  backupStatus.textContent = selected
    ? `已选择 ${selected.name}，点击“导入并合并”后生效。`
    : "导入只覆盖备份中包含的配置，不会清空现有互动数据和密钥。";
});
importSettings.addEventListener("click", importSettingsBackup);
openUpdatePage.addEventListener("click", () => {
  const repo = parseGithubRepository(githubRepository.value);
  if (repo) chrome.tabs.create({ url: `https://github.com/${repo.owner}/${repo.name}/releases/latest` });
});
githubRepository.addEventListener("input", () => {
  openUpdatePage.disabled = true;
  document.getElementById("remote-announcement").classList.add("hidden");
});

deAi.addEventListener("change", () => { deAiPrompt.disabled = !deAi.checked; });
modelPreset.addEventListener("change", updateCustomModelVisibility);
provider.addEventListener("change", () => {
  cacheCurrentProvider(activeProvider);
  activeProvider = provider.value;
  loadProviderConfig();
  refreshApiStatus();
});
stepfunRoute.addEventListener("change", () => {
  apiUrl.value = stepfunRoute.value === "plan" ? "https://api.stepfun.com/step_plan/v1" : "https://api.stepfun.com/v1";
});
file.addEventListener("change", async () => {
  const selected = file.files?.[0];
  if (!selected) return;
  persona.value = await selected.text();
  setStatus("profile", `已导入 ${selected.name}，请保存人设。`);
});

testApi.addEventListener("click", async () => {
  if (!await saveApi(false)) return;
  testApi.disabled = true;
  apiStatus.dataset.state = "";
  apiStatus.textContent = "正在测试…";
  try {
    const result = await chrome.runtime.sendMessage({ type: "test-api" });
    await refreshApiStatus();
    setStatus("api", result?.ok ? "连通性测试成功，当前 API 可以使用。" : "连通性测试失败，请检查地址、模型和 Key。");
  } catch {
    apiStatus.dataset.state = "error";
    apiStatus.textContent = "API 状态：测试失败";
    setStatus("api", "连通性测试失败，请检查地址、模型和 Key。");
  } finally {
    testApi.disabled = false;
  }
});

function showPage(page) {
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.page === page));
  document.querySelectorAll(".settings-page").forEach((item) => item.classList.toggle("active", item.dataset.page === page));
  if (page === "maintenance") refreshDiagnostics();
  if (page === "interactions") renderInteractions();
  if (page === "relationship") renderRelationships();
}

async function refreshInteractions() {
  interactionRefresh.disabled = true;
  relationshipRefresh.disabled = true;
  interactionRefresh.textContent = "正在读取…";
  relationshipRefresh.textContent = "正在读取…";
  interactionStatus.textContent = "正在读取已打开的 X 评论页面，不会调用 X API。";
  relationshipStatus.textContent = "正在读取已打开的 X 评论页面，不会调用 X API。";
  try {
    const result = await chrome.runtime.sendMessage({ type: "scan-page-interactions" });
    if (!result?.ok) throw new Error(result?.error || "更新失败");
    interactionRecords = Array.isArray(result.records) ? result.records : [];
    interactionProfiles = Array.isArray(result.profiles) ? result.profiles : interactionProfiles;
    interactionLastUpdated = result.updatedAt || Date.now();
    renderInteractions(interactionLastUpdated);
    interactionStatus.textContent = `本次读取 ${result.found} 条，新增 ${result.added} 条。只统计 X 页面已经加载的内容。`;
    relationshipStatus.textContent = `本次读取 ${result.found} 条，新增 ${result.added} 条。累计数据已更新。`;
  } catch (error) {
    interactionStatus.textContent = `更新失败：${error.message}`;
    relationshipStatus.textContent = `更新失败：${error.message}`;
  } finally {
    interactionRefresh.disabled = false;
    relationshipRefresh.disabled = false;
    interactionRefresh.textContent = "从 X 页面更新";
    relationshipRefresh.textContent = "从 X 页面更新";
  }
}

function interactionState(record) {
  if (record.replyState !== "done") return "reply";
  if (record.visitState !== "done") return "visit";
  return "done";
}

function renderInteractions(updatedAt) {
  if (updatedAt) interactionLastUpdated = updatedAt;
  const today = localDateKey();
  const records = interactionRecords.filter((record) => record.day === today);
  const people = new Set(records.map((record) => record.username.toLowerCase()));
  const unreplied = records.filter((record) => record.replyState !== "done");
  const unvisitedPeople = new Set(records.filter((record) => record.replyState === "done" && record.visitState !== "done").map((record) => record.username.toLowerCase()));
  const completePeople = new Set([...people].filter((username) => {
    const personRecords = records.filter((record) => record.username.toLowerCase() === username);
    return personRecords.length > 0 && personRecords.every((record) => record.replyState === "done" && record.visitState === "done");
  }));

  document.getElementById("interaction-date").textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date());
  document.getElementById("interaction-people").textContent = people.size;
  document.getElementById("interaction-complete").textContent = completePeople.size;
  document.getElementById("interaction-unreplied").textContent = unreplied.length;
  document.getElementById("interaction-unvisited").textContent = unvisitedPeople.size;
  document.getElementById("home-interaction-people").textContent = people.size;
  document.getElementById("home-interaction-complete").textContent = completePeople.size;
  document.getElementById("home-interaction-unreplied").textContent = unreplied.length;
  document.getElementById("home-interaction-unvisited").textContent = unvisitedPeople.size;
  interactionUpdatedAt.textContent = interactionLastUpdated
    ? `上次更新：${new Date(interactionLastUpdated).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
    : "尚未更新";
  relationshipUpdatedAt.textContent = interactionUpdatedAt.textContent;

  const visible = records.filter((record) => {
    const state = interactionState(record);
    if (interactionFilter === "all") return true;
    if (interactionFilter === "pending") return state !== "done";
    return state === interactionFilter;
  });
  document.getElementById("interaction-result-count").textContent = `${visible.length} 项记录`;
  interactionList.replaceChildren(...visible.map(createInteractionItem));
  interactionEmpty.style.display = visible.length ? "none" : "block";
  if (!interactionLastUpdated && !interactionStatus.textContent) {
    interactionStatus.textContent = "先在 X 打开“通知 → 提及”或帖子评论详情页，再点击“从 X 页面更新”。";
  }
  renderRelationships();
}

function relationshipState(profile) {
  const outbound = Number(profile.outboundCount || 0);
  const inbound = Number(profile.inboundCount || 0);
  if (outbound > 0 && inbound === 0) return "zero";
  if (outbound >= 3 && inbound * 2 < outbound) return "low";
  return "balanced";
}

function renderRelationships() {
  const profiles = interactionProfiles.filter((profile) => profile.username && Number(profile.outboundCount || 0) > 0);
  const zero = profiles.filter((profile) => relationshipState(profile) === "zero");
  const low = profiles.filter((profile) => relationshipState(profile) === "low");
  const balanced = profiles.filter((profile) => relationshipState(profile) === "balanced");
  document.getElementById("relationship-people").textContent = profiles.length;
  document.getElementById("relationship-zero").textContent = zero.length;
  document.getElementById("relationship-low").textContent = low.length;
  document.getElementById("relationship-balanced").textContent = balanced.length;
  document.getElementById("home-relationship-people").textContent = profiles.length;
  document.getElementById("home-relationship-zero").textContent = zero.length;
  document.getElementById("home-relationship-low").textContent = low.length;

  const query = relationshipSearch.value.trim().replace(/^@/, "").toLowerCase();
  const visible = profiles.filter((profile) => {
    const state = relationshipState(profile);
    const stateMatch = relationshipFilter === "all"
      || (relationshipFilter === "candidates" && (state === "zero" || state === "low"))
      || state === relationshipFilter;
    if (!stateMatch) return false;
    if (!query) return true;
    return String(profile.username || "").toLowerCase().includes(query)
      || String(profile.name || "").toLowerCase().includes(query);
  });
  visible.sort(relationshipProfileSort);
  const pageSize = Number(relationshipPageSize.value) || 20;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  relationshipPage = Math.min(Math.max(1, relationshipPage), pageCount);
  const pageProfiles = visible.slice((relationshipPage - 1) * pageSize, relationshipPage * pageSize);
  document.getElementById("relationship-result-count").textContent = `筛选后 ${visible.length} / 共 ${profiles.length} 个账号`;
  document.getElementById("relationship-page-info").textContent = `第 ${relationshipPage} / ${pageCount} 页`;
  relationshipPrev.disabled = relationshipPage <= 1;
  relationshipNext.disabled = relationshipPage >= pageCount;
  relationshipList.replaceChildren(...pageProfiles.map(createRelationshipItem));
  relationshipEmpty.style.display = visible.length ? "none" : "block";
}

function relationshipProfileSort(left, right) {
  const leftOutbound = Number(left.outboundCount || 0);
  const rightOutbound = Number(right.outboundCount || 0);
  const leftInbound = Number(left.inboundCount || 0);
  const rightInbound = Number(right.inboundCount || 0);
  if (relationshipSort.value === "outbound") return rightOutbound - leftOutbound || rightInbound - leftInbound;
  if (relationshipSort.value === "inbound") return rightInbound - leftInbound || rightOutbound - leftOutbound;
  if (relationshipSort.value === "rate") {
    const leftRate = leftOutbound ? leftInbound / leftOutbound : 0;
    const rightRate = rightOutbound ? rightInbound / rightOutbound : 0;
    return leftRate - rightRate || rightOutbound - leftOutbound;
  }
  const order = { zero: 0, low: 1, balanced: 2 };
  return order[relationshipState(left)] - order[relationshipState(right)] || rightOutbound - leftOutbound;
}

function createRelationshipItem(profile) {
  const outbound = Number(profile.outboundCount || 0);
  const inbound = Number(profile.inboundCount || 0);
  const rate = outbound ? Math.round(inbound / outbound * 100) : 0;
  const state = relationshipState(profile);
  const item = document.createElement("article");
  item.className = "relationship-item";

  const person = document.createElement("div");
  person.className = "relationship-person";
  const name = document.createElement("strong");
  name.textContent = profile.name || profile.username;
  const handle = document.createElement("small");
  handle.textContent = `@${profile.username}`;
  person.append(name, handle);

  const outboundMetric = relationshipMetric("我互动帖子", `${outbound} 条`);
  const inboundMetric = relationshipMetric("对方来互动", `${inbound} 次`);
  const rateMetric = relationshipMetric("回访比例", `${rate}%`, "relationship-rate");

  const actions = document.createElement("div");
  actions.className = "relationship-actions";
  const badge = document.createElement("span");
  badge.className = `interaction-badge ${state}`;
  badge.textContent = state === "zero" ? "零回访" : state === "low" ? "低回访" : "互动正常";
  const open = document.createElement("button");
  open.type = "button";
  open.className = "plain";
  open.textContent = "查看主页";
  open.addEventListener("click", () => chrome.tabs.create({ url: `https://x.com/${encodeURIComponent(profile.username)}` }));
  actions.append(badge, open);

  item.append(person, outboundMetric, inboundMetric, rateMetric, actions);
  return item;
}

function relationshipMetric(label, value, className = "") {
  const metric = document.createElement("div");
  metric.className = "relationship-metric";
  const name = document.createElement("span");
  name.textContent = label;
  const number = document.createElement("strong");
  number.className = className;
  number.textContent = value;
  metric.append(name, number);
  return metric;
}

function createInteractionItem(record) {
  const state = interactionState(record);
  const item = document.createElement("article");
  item.className = `interaction-item${state === "done" ? " is-done" : ""}`;

  const avatar = document.createElement("span");
  avatar.className = "interaction-avatar";
  avatar.textContent = (record.name || record.username || "?").trim().slice(0, 1).toUpperCase();

  const body = document.createElement("div");
  const person = document.createElement("div");
  person.className = "interaction-person";
  const name = document.createElement("strong");
  name.textContent = record.name || record.username;
  const handle = document.createElement("small");
  handle.textContent = `@${record.username}`;
  const badge = document.createElement("span");
  badge.className = `interaction-badge ${state}`;
  badge.textContent = state === "reply" ? "评论未回复" : state === "visit" ? "尚未回访" : "已完成";
  const time = document.createElement("small");
  time.textContent = interactionTime(record);
  person.append(name, handle, badge, time);
  const text = document.createElement("p");
  text.className = "interaction-text";
  text.textContent = record.text;
  const source = document.createElement("p");
  source.className = "interaction-source";
  source.textContent = record.outbound
    ? "记录：你主动回复了对方的帖子"
    : record.source === "mentions" ? "来自：通知 → 提及" : "来自：帖子评论详情页";
  body.append(person, text, source);

  const actions = document.createElement("div");
  actions.className = "interaction-actions";
  const open = document.createElement("button");
  open.className = "secondary";
  open.type = "button";
  open.textContent = state === "visit" ? "查看对方主页" : "打开评论";
  open.addEventListener("click", () => chrome.tabs.create({ url: state === "visit" ? `https://x.com/${encodeURIComponent(record.username)}` : record.url }));
  actions.append(open);
  if (state !== "done") {
    const mark = document.createElement("button");
    mark.className = "plain";
    mark.type = "button";
    mark.textContent = state === "reply" ? "标记已回复" : "标记已回访";
    mark.addEventListener("click", () => updateInteractionState(record, state));
    actions.append(mark);
  }

  item.append(avatar, body, actions);
  return item;
}

function interactionTime(record) {
  const value = record.createdAt || record.firstSeenAt;
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

async function updateInteractionState(record, state) {
  const now = Date.now();
  interactionRecords = interactionRecords.map((item) => {
    if (state === "reply" && item.id === record.id) return { ...item, replyState: "done", repliedAt: now };
    if (state === "visit" && item.day === record.day && item.username.toLowerCase() === record.username.toLowerCase()) {
      return { ...item, visitState: "done", visitedAt: now };
    }
    return item;
  });
  await chrome.storage.local.set({ interactionRecords });
  renderInteractions();
}

async function refreshDiagnostics() {
  const status = document.getElementById("diagnostic-status");
  status.textContent = "正在读取本机状态…";
  try {
    const settings = await chrome.storage.local.get(["apiUrl", "apiKey", "model", "provider", "lastGenerationStatus"]);
    const providerId = settings.provider || "custom";
    const [api, x, bytes] = await Promise.all([
      chrome.runtime.sendMessage({ type: "get-api-status", provider: providerId }),
      chrome.runtime.sendMessage({ type: "get-x-api-status" }),
      chrome.storage.local.getBytesInUse(null)
    ]);
    document.getElementById("diagnostic-version").textContent = `v${installedVersion} · 正在运行`;
    document.getElementById("diagnostic-model").textContent = settings.apiUrl && settings.apiKey && settings.model ? `${providerId} · ${settings.model}` : "未完整配置";
    const apiState = api?.status?.state;
    document.getElementById("diagnostic-api").textContent = apiState === "success" ? "最近测试成功" : apiState === "error" ? "最近测试失败" : "尚未测试";
    document.getElementById("diagnostic-x").textContent = x?.status?.connected ? "已连接" : x?.status?.configured ? "已配置，未连接" : "未配置";
    const generation = settings.lastGenerationStatus;
    document.getElementById("diagnostic-generation").textContent = generation ? `${generation.ok ? "成功" : "失败"} · ${new Date(generation.at).toLocaleString("zh-CN")}` : "暂无记录";
    document.getElementById("diagnostic-storage").textContent = `${Math.ceil(bytes / 1024)} KB`;
    status.textContent = api?.status?.checkedAt ? `API 最近测试：${new Date(api.status.checkedAt).toLocaleString("zh-CN")}。诊断不会发起模型请求。` : "诊断不会发起模型请求。";
  } catch {
    status.textContent = "本机状态读取失败，请重新加载扩展后再试。";
  }
}

async function exportSettingsBackup() {
  const settings = await chrome.storage.local.get([
    "personaMarkdown", "replyLanguage", "deAi", "deAiPrompt", "generationMode", "replyContextMode",
    "provider", "providerConfigs", "apiUrl", "model", "xApiClientId", "githubRepository",
    "showUnfollowedBadge", "replyButtonPosition"
  ]);
  const safeProviderConfigs = {};
  for (const [id, config] of Object.entries(settings.providerConfigs || {})) {
    if (!config || typeof config !== "object") continue;
    safeProviderConfigs[id] = {
      apiUrl: typeof config.apiUrl === "string" ? config.apiUrl : "",
      model: typeof config.model === "string" ? config.model : ""
    };
  }
  const payload = {
    type: "x-reply-assistant-settings",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    extensionVersion: installedVersion,
    settings: {
      personaMarkdown: settings.personaMarkdown || "",
      replyLanguage: settings.replyLanguage || "follow",
      deAi: settings.deAi !== false,
      deAiPrompt: settings.deAiPrompt || defaultDeAiPrompt,
      generationMode: settings.generationMode || "fast",
      replyContextMode: settings.replyContextMode === "api" ? "api" : "page",
      provider: settings.provider || "custom",
      providerConfigs: safeProviderConfigs,
      apiUrl: settings.apiUrl || "",
      model: settings.model || "",
      xApiClientId: settings.xApiClientId || "",
      githubRepository: settings.githubRepository || "",
      showUnfollowedBadge: settings.showUnfollowedBadge !== false,
      replyButtonPosition: settings.replyButtonPosition || null
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `x-reply-settings-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  backupStatus.textContent = "安全备份已导出。密钥、登录令牌和互动记录未包含在文件中。";
  backupStatus.classList.add("success");
}

async function importSettingsBackup() {
  const selected = importSettingsFile.files?.[0];
  if (!selected) return;
  importSettings.disabled = true;
  backupStatus.classList.remove("success");
  backupStatus.textContent = "正在检查并导入备份…";
  try {
    if (selected.size > 1024 * 1024) throw new Error("备份文件不能超过 1 MB");
    const payload = JSON.parse(await selected.text());
    if (payload?.type !== "x-reply-assistant-settings" || payload.schemaVersion !== 1 || !payload.settings || typeof payload.settings !== "object") {
      throw new Error("这不是可识别的 X Reply 配置备份");
    }
    const source = payload.settings;
    const current = await chrome.storage.local.get(["providerConfigs"]);
    const updates = {};
    const setString = (key, limit) => {
      if (typeof source[key] === "string" && source[key].length <= limit) updates[key] = source[key];
    };
    setString("personaMarkdown", 20000);
    setString("deAiPrompt", 10000);
    setString("model", 200);
    setString("xApiClientId", 300);
    if (["follow", "zh-CN", "en", "ja", "ko", "es"].includes(source.replyLanguage)) updates.replyLanguage = source.replyLanguage;
    if (["fast", "balanced", "deep"].includes(source.generationMode)) updates.generationMode = source.generationMode;
    if (["page", "api"].includes(source.replyContextMode)) updates.replyContextMode = source.replyContextMode;
    if (typeof source.deAi === "boolean") updates.deAi = source.deAi;
    if (typeof source.showUnfollowedBadge === "boolean") updates.showUnfollowedBadge = source.showUnfollowedBadge;
    if (typeof source.provider === "string" && source.provider.length <= 50 && /^[\w.-]+$/.test(source.provider)) updates.provider = source.provider;
    if (typeof source.apiUrl === "string" && source.apiUrl.length <= 1000 && (!source.apiUrl || /^https:\/\//i.test(source.apiUrl))) updates.apiUrl = source.apiUrl;
    const repo = typeof source.githubRepository === "string" ? parseGithubRepository(source.githubRepository) : null;
    if (repo) updates.githubRepository = `https://github.com/${repo.owner}/${repo.name}`;
    if (source.replyButtonPosition && Number.isFinite(source.replyButtonPosition.left) && Number.isFinite(source.replyButtonPosition.top)) {
      updates.replyButtonPosition = { left: source.replyButtonPosition.left, top: source.replyButtonPosition.top };
    }
    if (source.providerConfigs && typeof source.providerConfigs === "object" && !Array.isArray(source.providerConfigs)) {
      const merged = { ...(current.providerConfigs || {}) };
      for (const [id, config] of Object.entries(source.providerConfigs)) {
        if (!/^[\w.-]+$/.test(id) || !config || typeof config !== "object") continue;
        const apiUrlValue = typeof config.apiUrl === "string" && config.apiUrl.length <= 1000 && (!config.apiUrl || /^https:\/\//i.test(config.apiUrl)) ? config.apiUrl : "";
        const modelValue = typeof config.model === "string" && config.model.length <= 200 ? config.model : "";
        merged[id] = { ...(merged[id] || {}), apiUrl: apiUrlValue, model: modelValue };
      }
      updates.providerConfigs = merged;
    }
    await chrome.storage.local.set(updates);
    backupStatus.textContent = "配置已导入。现有密钥和互动数据保持不变，页面即将刷新。";
    backupStatus.classList.add("success");
    setTimeout(() => location.reload(), 700);
  } catch (error) {
    backupStatus.textContent = `导入失败：${error.message}`;
    importSettings.disabled = false;
  }
}

function parseGithubRepository(value) {
  try {
    const url = new URL(value.trim());
    const parts = url.pathname.replace(/\/$/, "").split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || parts.length !== 2 || !parts.every((part) => /^[\w.-]+$/.test(part))) return null;
    return { owner: parts[0], name: parts[1] };
  } catch {
    return null;
  }
}

async function saveGithubRepository() {
  const repo = parseGithubRepository(githubRepository.value);
  if (!repo) {
    updateStatus.textContent = "请输入公开 GitHub 仓库地址，格式为 https://github.com/用户名/仓库名。";
    return;
  }
  await chrome.storage.local.set({ githubRepository: `https://github.com/${repo.owner}/${repo.name}` });
  updateStatus.textContent = "仓库地址已保存到当前浏览器。";
}

async function checkForUpdates() {
  const repo = parseGithubRepository(githubRepository.value);
  if (!repo) {
    updateStatus.textContent = "请先填写公开 GitHub 仓库地址。";
    return;
  }
  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: ["https://api.github.com/*"] });
  } catch {
    updateStatus.textContent = "GitHub 访问权限申请失败，请重新加载扩展后再试。";
    return;
  }
  if (!granted) {
    updateStatus.textContent = "未授予 GitHub 版本检查权限。";
    return;
  }
  const button = document.getElementById("check-update");
  button.disabled = true;
  updateStatus.textContent = "正在查询 GitHub 最新发布版本…";
  openUpdatePage.disabled = true;
  try {
    const response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(response.status === 404 ? "仓库不存在，或尚未发布 Release" : `GitHub 返回 HTTP ${response.status}`);
    const release = await response.json();
    const latestVersion = String(release.tag_name || "").replace(/^v/i, "");
    const comparison = compareVersions(latestVersion, installedVersion);
    updateStatus.textContent = comparison === null ? `最新发布为 ${release.tag_name}，版本号无法自动比较，请到下载页核对。` : comparison > 0 ? `发现新版本 v${latestVersion}；当前为 v${installedVersion}。请手动下载安装。` : `已是最新版本 v${installedVersion}。`;
    document.getElementById("remote-announcement-title").textContent = `${release.tag_name || "最新发布"} · GitHub 发布说明`;
    document.getElementById("remote-announcement-body").textContent = String(release.body || "该版本没有发布说明。").slice(0, 3000);
    document.getElementById("remote-announcement").classList.remove("hidden");
    openUpdatePage.disabled = false;
  } catch (error) {
    updateStatus.textContent = `版本检查失败：${error.message}`;
  } finally {
    button.disabled = false;
  }
}

function compareVersions(latest, current) {
  if (!/^\d+(?:\.\d+){1,3}$/.test(latest) || !/^\d+(?:\.\d+){1,3}$/.test(current)) return null;
  const left = latest.split(".").map(Number);
  const right = current.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) > (right[index] || 0) ? 1 : -1;
  }
  return 0;
}

async function refreshDashboard() {
  const settings = await chrome.storage.local.get(["usageDate", "usageCount", "publishDate", "postCount", "replyCount", "totalGenerationCount", "totalGenerationDurationMs"]);
  showDashboard(settings);
}

function showDashboard(settings) {
  const today = localDateKey();
  const isUsageToday = settings.usageDate === today;
  const isPublishToday = settings.publishDate === today;
  todayGeneration.textContent = isUsageToday ? Number(settings.usageCount || 0) : 0;
  todayPosts.textContent = isPublishToday ? Number(settings.postCount || 0) : 0;
  todayReplies.textContent = isPublishToday ? Number(settings.replyCount || 0) : 0;
  totalGeneration.textContent = Number(settings.totalGenerationCount ?? (isUsageToday ? settings.usageCount || 0 : 0));
  totalDuration.textContent = formatDuration(Number(settings.totalGenerationDurationMs || 0));
  statsDate.textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date());
}

function formatDuration(durationMs) {
  const minutes = Math.floor(durationMs / 60_000);
  if (minutes < 1) return "不足 1 分钟";
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function showHomeXStats(stats) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8);
  if (now < start) start.setDate(start.getDate() - 1);
  if (!stats || stats.periodStart !== start.toISOString()) {
    homeXWindow.textContent = "08:00 起 · 尚未采集";
    for (const id of ["home-x-posts", "home-x-replies", "home-x-followers", "home-x-impressions"]) {
      document.getElementById(id).textContent = "—";
    }
    homeXProgress.textContent = "";
    homeXStatus.textContent = "点击“手动采集”读取 X 数据；每次采集可能消耗 X API 额度。";
    return;
  }
  const time = new Date(stats.collectedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  homeXWindow.textContent = `${localDateKey(start) === localDateKey(now) ? "今日" : "昨日"} · 08:00 起 · ${time} 采集`;
  document.getElementById("home-x-posts").textContent = stats.posts ?? "—";
  document.getElementById("home-x-replies").textContent = stats.replies ?? "—";
  document.getElementById("home-x-followers").textContent = stats.followerChange === null ? "—" : `${stats.followerChange > 0 ? "+" : ""}${stats.followerChange}`;
  const impressions = stats.impressions;
  document.getElementById("home-x-impressions").textContent = impressions === null ? "—" : impressions >= 100_000_000 ? `${Number((impressions / 100_000_000).toFixed(1))}亿` : impressions >= 10_000 ? `${Number((impressions / 10_000).toFixed(1))}万` : String(impressions);
  homeXProgress.textContent = stats.scannedPosts === null ? "" : `曝光已采 ${stats.impressionCoverage}/${stats.scannedPosts} 帖${stats.complete ? "" : " · 发帖/回复尚未采全"}`;
  const notes = [...(stats.errors || [])];
  if (stats.followerBaselineAt && stats.followerChange === null) notes.push("首次采集已记录涨粉基准，下次采集显示变化。");
  if (stats.followerChange !== null) notes.push("涨粉为首次采集以来的净变化。");
  homeXStatus.textContent = notes.join(" ") || "仅在点击时读取 X API；数据保存在本机。";
}

async function saveProfile() {
  await chrome.storage.local.set({ personaMarkdown: persona.value.trim() });
  setStatus("profile", "人设已保存到浏览器本地。", true);
}

async function saveStyle() {
  if (replyContextMode.disabled) return;
  await chrome.storage.local.set({
    replyLanguage: replyLanguage.value,
    deAi: deAi.checked,
    deAiPrompt: deAiPrompt.value.trim(),
    generationMode: generationMode.value,
    replyContextMode: replyContextMode.value
  });
  setStatus("style", replyContextMode.value === "api"
    ? "已保存 API 增强模式。请确认已在“维护与更新”配置自己的 X 授权；未配置或读取失败时回退到页面内容。"
    : "已保存页面模式。回复不会调用 X API；AI 模型配置仍然需要。", true);
}

function updateContextModeHint() {
  const apiEnabled = replyContextMode.value === "api";
  configureContextApi.classList.toggle("hidden", !apiEnabled);
  replyContextHint.textContent = apiEnabled
    ? "保存后启用：使用你手动配置的 X 授权补充父帖，可能消耗 X API 额度。未配置或读取失败时回退到页面内容并提示；不保证获得完整对话。两种模式都需要 AI 模型服务。"
    : "页面模式使用当前帖及帖子详情页中已加载的上文，不调用 X API 查找父帖。信息流或通知页不会把相邻帖子当作上文。两种模式都需要 AI 模型服务，生成后由你确认发布。";
}

async function saveApi(showMessage) {
  const selectedModel = modelPreset.value === "custom" ? model.value.trim() : modelPreset.value;
  if (!selectedModel) return setStatus("api", "请选择模型，或填写自定义模型名称。");
  let origin;
  try {
    const url = new URL(apiUrl.value.trim());
    if (url.protocol !== "https:") throw new Error();
    origin = `${url.origin}/*`;
  } catch {
    return setStatus("api", "请输入有效的 HTTPS API 地址。");
  }
  if (!await chrome.permissions.request({ origins: [origin] })) {
    return setStatus("api", "未授予 API 域名访问权限。");
  }
  cacheCurrentProvider();
  await chrome.storage.local.set({
    apiUrl: apiUrl.value.trim(), apiKey: apiKey.value.trim(), provider: provider.value,
    providerConfigs, model: selectedModel
  });
  if (showMessage) setStatus("api", "API 设置已保存到浏览器本地。", true);
  return true;
}

function setStatus(page, message, success = false) {
  const element = document.getElementById(`${page === "api" ? "api-save" : page}-status`);
  element.textContent = message;
  element.classList.toggle("success", success);
}

function updateCustomModelVisibility() {
  const custom = modelPreset.value === "custom";
  model.classList.toggle("hidden", !custom);
  customModelLabel.classList.toggle("hidden", !custom);
}

function detectProvider(url) {
  return Object.entries(providers).find(([, value]) => url.startsWith(value.apiUrl.replace(/\/chat\/completions$/, "")))?.[0] || "custom";
}

function cacheCurrentProvider(providerId = provider.value) {
  providerConfigs[providerId] = {
    apiUrl: apiUrl.value.trim(), apiKey: apiKey.value.trim(),
    model: modelPreset.value === "custom" ? model.value.trim() : modelPreset.value
  };
}

function loadProviderConfig() {
  const config = providerConfigs[provider.value] || providers[provider.value] || { apiUrl: "", apiKey: "", model: "" };
  apiUrl.value = config.apiUrl || "";
  apiKey.value = config.apiKey || "";
  model.value = config.model || "";
  modelPreset.value = ["step-3.7-flash", "step-3.5-flash", "step-5-preview"].includes(config.model) ? config.model : "custom";
  updateCustomModelVisibility();
  const isStepFun = provider.value === "stepfun";
  stepfunRouteWrap.classList.toggle("hidden", !isStepFun);
  if (isStepFun) stepfunRoute.value = /\/step_plan\/v1\/?$/.test(apiUrl.value) ? "plan" : "direct";
}

async function refreshApiStatus() {
  const result = await chrome.runtime.sendMessage({ type: "get-api-status", provider: provider.value });
  const state = result.status?.state;
  apiStatus.dataset.state = state || "";
  if (state === "success") apiStatus.textContent = "连接正常";
  else if (state === "error") apiStatus.textContent = `连接失败${result.status.message ? `：${result.status.message}` : ""}`;
  else apiStatus.textContent = apiKey.value.trim() ? "已配置，未测试" : "未配置";
}

async function saveXApiConfig() {
  const clientId = xClientId.value.trim();
  if (!clientId) return setStatus("x-api", "请先填写 X OAuth Client ID。");
  await chrome.storage.local.set({ xApiClientId: clientId });
  setStatus("x-api", "Client ID 已保存到浏览器本地。", true);
  await refreshXApiStatus();
}

async function connectXAccount() {
  if (!xClientId.value.trim()) return setStatus("x-api", "请先填写并保存 X OAuth Client ID。");
  await saveXApiConfig();
  connectXApi.disabled = true;
  xApiStatus.textContent = "正在打开 X 授权页…";
  try {
    const result = await chrome.runtime.sendMessage({ type: "connect-x-api" });
    if (!result?.ok) throw new Error(result?.error || "授权没有完成");
    setStatus("x-api", `已连接 @${result.account.username}。`, true);
    await refreshXApiStatus();
  } catch (error) {
    setStatus("x-api", error.message || "授权没有完成。");
    await refreshXApiStatus();
  } finally {
    connectXApi.disabled = false;
  }
}

async function refreshXApiStatus() {
  const result = await chrome.runtime.sendMessage({ type: "get-x-api-status" });
  const status = result?.status;
  homeXConnected = Boolean(status?.connected);
  homeXRefresh.disabled = homeXBusy || !homeXConnected;
  if (!homeXConnected) {
    showHomeXStats(null);
    homeXStatus.textContent = "请先到“维护与更新”连接 X 账号。";
  }
  xApiStatus.dataset.state = status?.connected ? "success" : "";
  xApiStatus.textContent = status?.connected ? `已连接 @${status.username}` : (status?.lastError ? `连接失败：${status.lastError}` : (xClientId.value.trim() ? "已配置，未连接" : "未连接"));
}

async function loadOwnedLists() {
  activeListPostsRequest += 1;
  loadXLists.disabled = true;
  xListsEmpty.textContent = "正在读取清单…";
  xListPosts.replaceChildren();
  xListPostsStatus.textContent = "加载清单后，选择一个清单查看最新帖子。";
  try {
    const result = await chrome.runtime.sendMessage({ type: "load-x-lists" });
    if (!result?.ok) throw new Error(result?.error || "读取清单失败");
    renderXLists(result.lists || []);
  } catch (error) {
    xLists.replaceChildren();
    xListsEmpty.textContent = error.message || "读取清单失败。请先连接 X 账号。";
  } finally {
    loadXLists.disabled = false;
  }
}

function renderXLists(lists) {
  xLists.replaceChildren();
  if (!lists.length) {
    xListsEmpty.textContent = "暂时没有可读取的本人清单。";
    return;
  }
  xListsEmpty.textContent = `已读取 ${lists.length} 个本人清单。`;
  lists.forEach((list) => {
    const item = document.createElement("article");
    item.className = "x-list-item";
    const name = document.createElement("strong");
    name.textContent = list.name || "未命名清单";
    const detail = document.createElement("span");
    detail.textContent = [list.description, Number.isFinite(list.member_count) ? `${list.member_count} 位成员` : ""].filter(Boolean).join(" · ") || "没有描述";
    const viewPosts = document.createElement("button");
    viewPosts.className = "secondary x-list-posts-button";
    viewPosts.type = "button";
    viewPosts.textContent = "查看最新帖子";
    viewPosts.disabled = !/^[0-9]{1,19}$/.test(String(list.id || ""));
    viewPosts.addEventListener("click", () => loadListPosts(list, viewPosts));
    item.append(name, detail, viewPosts);
    xLists.append(item);
  });
}

async function loadListPosts(list, button) {
  const requestId = ++activeListPostsRequest;
  button.disabled = true;
  xListPosts.replaceChildren();
  xListPostsStatus.textContent = `正在读取「${list.name || "未命名清单"}」的最新帖子…`;
  try {
    const result = await chrome.runtime.sendMessage({ type: "load-x-list-posts", listId: list.id });
    if (requestId !== activeListPostsRequest) return;
    if (!result?.ok) throw new Error(result?.error || "读取清单帖子失败。");
    const posts = result.posts || [];
    const users = new Map((result.users || []).map((user) => [user.id, user]));
    xListPostsStatus.textContent = posts.length
      ? `「${list.name || "未命名清单"}」最近 ${posts.length} 条帖子`
      : `「${list.name || "未命名清单"}」暂时没有帖子。`;
    posts.forEach((post) => {
      const item = document.createElement("article");
      item.className = "x-list-item x-post-item";
      const author = users.get(post.author_id);
      const heading = document.createElement("strong");
      heading.textContent = author ? `${author.name || author.username || "未知作者"}${author.username ? ` @${author.username}` : ""}` : "未知作者";
      const body = document.createElement("p");
      body.textContent = post.text || "（无文字内容）";
      item.append(heading, body);
      const footer = document.createElement("div");
      footer.className = "x-post-footer";
      if (post.created_at && !Number.isNaN(Date.parse(post.created_at))) {
        const time = document.createElement("time");
        time.dateTime = post.created_at;
        time.textContent = new Date(post.created_at).toLocaleString("zh-CN");
        footer.append(time);
      }
      if (/^[0-9]{1,19}$/.test(String(post.id || ""))) {
        const link = document.createElement("a");
        link.href = `https://x.com/i/web/status/${post.id}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "打开原帖";
        footer.append(link);
      }
      item.append(footer);
      if (/^[0-9]{1,19}$/.test(String(post.id || "")) && post.text?.trim()) {
        const actions = document.createElement("div");
        actions.className = "x-post-actions";
        for (const [mode, label] of [["remix", "二创"], ["quote", "引用转发"]]) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "secondary";
          button.textContent = label;
          button.addEventListener("click", () => generateListPostDraft(post, author?.username || "", mode, item));
          actions.append(button);
        }
        item.append(actions);
      }
      xListPosts.append(item);
    });
  } catch (error) {
    if (requestId === activeListPostsRequest) xListPostsStatus.textContent = error.message || "读取清单帖子失败。";
  } finally {
    button.disabled = false;
  }
}

async function generateListPostDraft(post, username, mode, item) {
  let editor = item.querySelector(".x-post-draft");
  if (!editor) {
    editor = document.createElement("div");
    editor.className = "x-post-draft";
    const heading = document.createElement("strong");
    heading.className = "x-post-draft-heading";
    const textarea = document.createElement("textarea");
    textarea.rows = 5;
    textarea.setAttribute("aria-label", "可编辑的帖子草稿");
    const status = document.createElement("p");
    status.className = "hint x-post-draft-status";
    status.setAttribute("role", "status");
    const open = document.createElement("button");
    open.type = "button";
    open.className = "primary";
    open.addEventListener("click", async () => {
      const draft = textarea.value.trim();
      if (!draft) return;
      open.disabled = true;
      try {
        const result = await chrome.runtime.sendMessage({ type: "open-list-draft", mode: editor.dataset.mode, postId: post.id, draft });
        if (!result?.ok) throw new Error(result?.error || "打开 X 失败。");
        status.textContent = editor.dataset.mode === "quote"
          ? "已打开原帖。点击 X 的“转发 → 引用”，草稿会填入引用框；检查后由你发布。"
          : "已打开 X 发帖框。草稿会直接填入，你可以修改后发布。";
      } catch (error) {
        status.textContent = `打开 X 失败：${error.message}`;
      } finally {
        open.disabled = false;
      }
    });
    editor.append(heading, textarea, status, open);
    item.append(editor);
  }
  editor.dataset.mode = mode;
  editor.querySelector(".x-post-draft-heading").textContent = mode === "quote" ? "引用转发文案" : "独立二创草稿";
  const openButton = editor.querySelector("button");
  openButton.textContent = mode === "quote" ? "去引用转发" : "去发布二创";
  openButton.disabled = true;
  editor.querySelector("textarea").value = "";
  const status = editor.querySelector(".x-post-draft-status");
  status.textContent = "正在生成草稿…";
  const buttons = item.querySelectorAll(".x-post-actions button");
  buttons.forEach((button) => { button.disabled = true; });
  try {
    const result = await chrome.runtime.sendMessage({ type: "generate-list-draft", mode, post: { text: post.text, username } });
    if (!item.isConnected) return;
    if (!result?.ok) throw new Error(result?.error || "生成失败，请重试。");
    const sourceUrl = `https://x.com/i/web/status/${post.id}`;
    editor.querySelector("textarea").value = mode === "remix" ? `${result.draft.trim()}\n\n来源：${sourceUrl}` : result.draft.trim();
    openButton.disabled = false;
    status.textContent = mode === "quote"
      ? "可以先修改。点击“去引用转发”，草稿会带到 X 的引用框；不会自动发布。"
      : "可以先修改。点击“去发布二创”，草稿会带到 X 发帖框；不会自动发布。";
  } catch (error) {
    if (item.isConnected) status.textContent = error.message || "生成失败，请重试。";
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

async function saveTrendBearerToken() {
  const token = xTrendBearer.value.trim();
  if (!token) {
    xTrendBearerStatus.textContent = "请填写 X 应用 Bearer Token。";
    return false;
  }
  await chrome.storage.local.set({ xTrendBearerToken: token });
  xTrendBearerStatus.textContent = "趋势令牌已保存到当前浏览器。";
  return true;
}

async function loadTrends() {
  if (!await saveTrendBearerToken()) return;
  loadXTrends.disabled = true;
  xTrendsStatus.textContent = "正在读取全球中文热点…";
  xTrends.replaceChildren();
  try {
    const result = await chrome.runtime.sendMessage({ type: "load-x-trends" });
    if (!result?.ok) throw new Error(result?.error || "读取趋势失败");
    const trends = result.trends || [];
    xTrendsStatus.textContent = trends.length
      ? `全球榜单前 ${result.scanned} 条中，显示 ${trends.length} 条中文热点。`
      : `全球榜单前 ${result.scanned} 条中没有中文热点；不代表全网没有。`;
    trends.forEach((trend, index) => {
      const item = document.createElement("article");
      item.className = "x-list-item";
      const name = document.createElement("strong");
      name.textContent = `${index + 1}. ${trend.trend_name}`;
      item.append(name);
      const rank = document.createElement("span");
      rank.textContent = `全球榜第 ${trend.global_rank} 位`;
      item.append(rank);
      if (Number.isFinite(trend.tweet_count)) {
        const count = document.createElement("span");
        count.textContent = `${trend.tweet_count.toLocaleString()} 条帖子`;
        item.append(count);
      }
      xTrends.append(item);
    });
  } catch (error) {
    xTrendsStatus.textContent = `趋势加载失败：${error.message || "未知错误"}`;
  } finally {
    loadXTrends.disabled = false;
  }
}
