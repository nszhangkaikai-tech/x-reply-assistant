# X Reply Assistant

Chrome extension that reads the X posts visible in the current tab, applies a locally stored persona Markdown file, and calls an OpenAI-compatible Chat Completions API for three reply drafts. It fills a selected draft into X's native reply editor but never publishes it.

## 1. Load the extension

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click **Load unpacked** and choose the `extension` directory.
4. Open the extension's **Options** page and paste or import your persona Markdown file.
5. Enter an HTTPS OpenAI-compatible API base URL (or a full Chat Completions URL), API Key, and model name. The extension appends `/chat/completions` when you enter only a base URL. When saved, Chrome asks permission for that API domain.

## 2. Use on X

Open an X post or reply thread, click **AI 回复**, then select a draft. The extension only inserts text into the reply box. Review it and press X's native publish button yourself.

### Reply context modes

Choose **语言与风格 → 回复上下文模式**, then click **保存语言与风格**:

- **页面模式** (default): no X developer app or X authorization is required for replies. Uses the target post and earlier posts loaded in its detail view; feed/notification neighbors are not treated as conversation history. Open the target's detail page to make earlier context available.
- **API 增强模式** (opt-in): manually configure your own OAuth Client ID and connect X under **维护与更新**. Attempts to retrieve up to three parent posts using your X API access. This may use your API credits. Missing authorization or failed/empty retrieval falls back to page context with an explicit notice.

Both modes require your configured AI model service, may incur model charges, and only generate editable drafts. Connecting X for Lists or statistics does not automatically enable API context. No shared developer credentials or unified service are provided. Existing installations without a saved mode also default to page mode; select API mode explicitly if desired.

## Persona Markdown example

```md
# Identity
Independent AI product founder.

# Tone
Direct, calm, and specific. Use English.

# Viewpoint
Prefer concrete operator lessons over abstract startup advice.

# Avoid
Generic praise, fake personal stories, and marketing jargon.
```

## Notes

- The persona Markdown, API URL, API Key, and model name are stored in Chrome extension local storage. Never install an extension you do not trust alongside it.
- Page mode sends relevant loaded page content and your persona to the configured model provider. API mode additionally sends retrieved parent-post context. Neither mode guarantees a complete conversation.
- X frequently changes its DOM. If the extension stops finding posts or the reply editor, update the selectors in `extension/content.js`.
