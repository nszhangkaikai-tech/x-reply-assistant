const provider = document.getElementById("provider");
const model = document.getElementById("model");
const apiStatus = document.getElementById("api-status");
const testApi = document.getElementById("test-api");
const usageCount = document.getElementById("usage-count");
const postCount = document.getElementById("post-count");
const replyCount = document.getElementById("reply-count");
const refreshXStatsButton = document.getElementById("refresh-x-stats");
const xStatsWindow = document.getElementById("x-stats-window");
const xStatsProgress = document.getElementById("x-stats-progress");
const xStatsStatus = document.getElementById("x-stats-status");

const providerNames = {
  stepfun: "阶跃星辰",
  xiaomi: "小米 MiMo",
  openai: "OpenAI",
  deepseek: "DeepSeek",
  qwen: "通义千问",
  custom: "自定义兼容接口"
};

let configs = {};

chrome.storage.local.get(["provider", "providerConfigs", "model", "apiKey", "usageDate", "usageCount", "publishDate", "postCount", "replyCount", "xDailySummary"], async (settings) => {
  configs = settings.providerConfigs || {};
  provider.value = settings.provider || "custom";
  if (!configs[provider.value] && settings.model) {
    configs[provider.value] = { model: settings.model, apiKey: settings.apiKey || "" };
  }
  showConfig();
  showUsage(settings);
  await refreshStatus();
  try {
    const result = await chrome.runtime.sendMessage({ type: "get-x-api-status" });
    if (result?.status?.connected) {
      if (settings.xDailySummary?.periodStart === currentXPeriodStart()) showXStats(settings.xDailySummary);
    } else {
      refreshXStatsButton.disabled = true;
      xStatsStatus.textContent = "请先到完整设置连接 X 账号。";
    }
  } catch {
    xStatsStatus.textContent = "X 账号状态读取失败，请重新加载扩展。";
  }
});

refreshXStatsButton.addEventListener("click", async () => {
  refreshXStatsButton.disabled = true;
  xStatsStatus.textContent = "正在读取 X 账号数据，请稍候…";
  try {
    const result = await chrome.runtime.sendMessage({ type: "collect-x-daily-stats" });
    if (!result?.ok) throw new Error(result?.error || "采集失败");
    showXStats(result.stats);
  } catch (error) {
    xStatsStatus.textContent = `采集失败：${error.message}`;
  } finally {
    refreshXStatsButton.disabled = false;
  }
});

provider.addEventListener("change", async () => {
  const config = configs[provider.value];
  if (!config?.apiUrl || !config?.apiKey || !config?.model) {
    apiStatus.dataset.state = "";
    apiStatus.textContent = `${providerNames[provider.value]}尚未配置`;
    model.textContent = "请在完整设置中填写地址、Key 和模型";
    return;
  }
  await chrome.storage.local.set({
    provider: provider.value,
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    model: config.model
  });
  showConfig();
  await refreshStatus();
});

testApi.addEventListener("click", async () => {
  const config = configs[provider.value];
  if (!config?.apiUrl || !config?.apiKey || !config?.model) {
    apiStatus.dataset.state = "error";
    apiStatus.textContent = "请先完成该服务商的配置";
    return;
  }
  testApi.disabled = true;
  apiStatus.dataset.state = "";
  apiStatus.textContent = "正在测试…";
  try {
    const result = await chrome.runtime.sendMessage({ type: "test-api" });
    await refreshStatus();
    apiStatus.textContent = result?.ok ? "连接测试成功" : "连接测试失败";
    apiStatus.dataset.state = result?.ok ? "success" : "error";
  } catch {
    apiStatus.textContent = "连接测试失败";
    apiStatus.dataset.state = "error";
  } finally {
    testApi.disabled = false;
  }
});

document.getElementById("open-options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

function showConfig() {
  const config = configs[provider.value];
  model.textContent = config?.model || "未配置模型";
}

function showUsage(settings) {
  const today = localDateKey();
  const count = settings.usageDate === today ? Number(settings.usageCount || 0) : 0;
  usageCount.textContent = count;
  const hasTodayPublish = settings.publishDate === today;
  postCount.textContent = hasTodayPublish ? Number(settings.postCount || 0) : 0;
  replyCount.textContent = hasTodayPublish ? Number(settings.replyCount || 0) : 0;
}

function currentXPeriodStart() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8);
  if (now < start) start.setDate(start.getDate() - 1);
  return start.toISOString();
}

function showXStats(stats) {
  const collected = new Date(stats.collectedAt);
  const time = collected.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const periodDate = new Date(stats.periodStart);
  xStatsWindow.textContent = `${localDateKey(periodDate) === localDateKey() ? "今日" : "昨日"} · 08:00 起 · ${time} 采集`;
  document.getElementById("x-post-count").textContent = stats.posts ?? "—";
  document.getElementById("x-reply-count").textContent = stats.replies ?? "—";
  document.getElementById("x-follower-change").textContent = stats.followerChange === null ? "—" : `${stats.followerChange > 0 ? "+" : ""}${stats.followerChange}`;
  document.getElementById("x-impressions").textContent = stats.impressions === null ? "—" : formatCompact(stats.impressions);
  xStatsProgress.textContent = stats.scannedPosts === null ? "" : `曝光已采 ${stats.impressionCoverage}/${stats.scannedPosts} 帖${stats.complete ? "" : " · 发帖/回复尚未采全"}`;
  const notes = [...(stats.errors || [])];
  if (stats.followerBaselineAt && stats.followerChange === null) notes.push("首次采集已记录涨粉基准，下次采集显示变化。");
  if (stats.followerChange !== null) notes.push("涨粉为首次采集以来的净变化。");
  xStatsStatus.textContent = notes.join(" ") || "仅在点击时读取 X API；数据保存在本机。";
}

function formatCompact(value) {
  if (value >= 100_000_000) return `${Number((value / 100_000_000).toFixed(1))}亿`;
  if (value >= 10_000) return `${Number((value / 10_000).toFixed(1))}万`;
  return String(value);
}

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

async function refreshStatus() {
  const config = configs[provider.value];
  if (!config?.apiKey) {
    apiStatus.dataset.state = "";
    apiStatus.textContent = "未配置";
    return;
  }
  const result = await chrome.runtime.sendMessage({ type: "get-api-status", provider: provider.value });
  const status = result?.status;
  apiStatus.dataset.state = status?.state || "";
  if (status?.state === "success") apiStatus.textContent = "连接正常";
  else if (status?.state === "error") apiStatus.textContent = "上次测试失败";
  else apiStatus.textContent = "已配置，未测试";
}
