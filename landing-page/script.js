const replies = [
  "是啊，最费时间的就是找回前面聊到哪了。要是回复时能把上文一起带出来，会省事不少。",
  "尤其是同时聊几个话题的时候，光看最后一句很容易串线。先确认自己前面说了什么，比急着回复更重要。"
];
const replyText = document.querySelector("#reply-text");
const tabs = document.querySelectorAll("[data-reply]");
tabs.forEach((button) => {
  button.addEventListener("click", () => {
    tabs.forEach((tab) => tab.setAttribute("aria-pressed", String(tab === button)));
    replyText.textContent = replies[Number(button.dataset.reply)];
  });
});
document.querySelector("#fill-reply").addEventListener("click", () => {
  const draft = document.querySelector("#draft");
  draft.value = replyText.textContent;
  draft.focus();
});
document.querySelector("#copy-address").addEventListener("click", async () => {
  const status = document.querySelector("#copy-status");
  try {
    await navigator.clipboard.writeText("chrome://extensions");
    status.textContent = "已复制，请粘贴到 Chrome 地址栏。";
  } catch {
    status.textContent = "浏览器未允许复制，请手动选择上方地址复制。";
    const range = document.createRange();
    range.selectNodeContents(document.querySelector(".copy-row code"));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
});
const navigationLinks = document.querySelectorAll(".anchor-nav a");
function updateNavigation(hash = location.hash) {
  const section = { "#features": "#story", "#faq": "#start" }[hash] || hash;
  navigationLinks.forEach((link) => {
    if (link.getAttribute("href") === section) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}
navigationLinks.forEach((link) => {
  link.addEventListener("click", () => updateNavigation(link.getAttribute("href")));
});
window.addEventListener("hashchange", () => updateNavigation());
updateNavigation();
