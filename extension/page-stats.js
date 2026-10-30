export function readOwnPageStats() {
  const profileLink = document.querySelector('[data-testid="AppTabBar_Profile_Link"]')?.getAttribute("href");
  const own = profileLink ? new URL(profileLink, location.origin).pathname.split("/")[1]?.toLowerCase() : "";
  if (!own || !new RegExp(`^/${own}(?:/with_replies)?/?$`, "i").test(location.pathname)) {
    throw new Error("请打开自己的 X 主页或回复页，加载需要统计的帖子后重试。");
  }
  const parseCount = (text) => {
    const match = String(text || "").replaceAll(",", "").match(/([\d.]+)\s*([KMB万亿]?)/i);
    return match ? Math.round(Number(match[1]) * ({ K: 1e3, M: 1e6, B: 1e9, 万: 1e4, 亿: 1e8 }[match[2].toUpperCase()] || 1)) : null;
  };
  const follower = [...document.querySelectorAll('a[href]')].find(a => new RegExp(`^/${own}/(?:verified_)?followers/?$`, "i").test(a.getAttribute("href") || ""));
  const followersText = follower?.textContent || "";
  const posts = [...document.querySelectorAll('article[data-testid="tweet"]')].flatMap(article => {
    const time = article.querySelector('time');
    const href = time?.closest('a')?.getAttribute('href') || "";
    const match = href.match(/^\/([^/]+)\/status\/(\d+)/);
    if (!match || match[1].toLowerCase() !== own || /reposted|转帖|转推/.test(article.querySelector('[data-testid="socialContext"]')?.innerText || "")) return [];
    const views = article.querySelector('a[href$="/analytics"]');
    return [{ id: match[2], createdAt: time.getAttribute('datetime'), reply: Boolean(article.innerText.split(article.querySelector('[data-testid="tweetText"]')?.innerText || '\n')[0].match(/Replying to|回复 @|回复给|回复了/)), impressions: views ? parseCount(views.innerText || views.getAttribute('aria-label')) : null }];
  });
  return { username: own, followers: parseCount(followersText), followerApproximate: /[KMB万亿]/i.test(followersText), posts, url: location.href };
}
