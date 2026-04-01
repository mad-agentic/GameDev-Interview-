# GameDev Copilot — Workspace Instructions

## Project Overview
Electron desktop overlay app that provides real-time AI interview coaching for Vietnamese game developers. Always-on-top, transparent window. Runs locally on Windows.

- **Stack**: Electron v28, Node.js (CommonJS), naudiodon (native audio), OpenAI Whisper + Vision, Anthropic Claude Haiku, AssemblyAI
- **Target OS**: Windows 10/11 only
- **Language**: Vietnamese/English bilingual UI and AI outputs

## Commands

| Task | Command |
|---|---|
| Start app | `npm start` |
| Build installer | `npm run build` |
| Rebuild native modules | `npx @electron/rebuild -f -w naudiodon` |

> After any `npm install`, run the rebuild command — `naudiodon` is a native module and must be compiled against Electron's Node version.

## Architecture

```
main.js          ← Electron main process: window, IPC handlers, audio/CC pipeline
preload.js       ← contextBridge: exposes safe API from main → renderer
ui/
  index.html     ← Overlay UI structure
  renderer.js    ← All UI event handlers, IPC listeners, card rendering
  styles.css     ← Dark transparent theme
  region-select.html / .js  ← Fullscreen drag-to-select overlay for CC region
audio/
  capture.js     ← naudiodon PCM audio capture, chunked streaming
  pcm-to-wav.js  ← PCM buffer → WAV for AssemblyAI upload
ai/
  whisper.js     ← OpenAI Whisper STT
  claude.js      ← Anthropic Claude — returns structured JSON suggestions
  prompt.js      ← System prompt builder, injects profile + answer style
  assemblyai.js  ← Speaker diarization, filters interviewer vs candidate voice
  vision.js      ← GPT-4o-mini Vision OCR for screen captions
store/
  context.js     ← In-memory state: profile, resume, session history, settings
  profile.json   ← User identity, personality, companies, tone guide
  portfolio.json ← Project portfolio referenced in STAR answers
```

### IPC Pattern
All communication between main and renderer goes through `preload.js` contextBridge.
- **main → renderer**: `win.webContents.send('event-name', payload)`
- **renderer → main**: `window.electronAPI.methodName(args)` → calls `ipcMain.handle()`

Never use `nodeIntegration: true`. Always go through preload.

### State Management
Pure in-memory state in `store/context.js`. No database. State resets on app restart.
Key state objects: `settings`, `transcriptBuffer`, `sessionHistory`, `profile`.

### AI Pipeline Flow
1. Audio/CC input → raw text chunk
2. `pushTranscript()` in main.js filters by `minWords`, buffers chunks
3. User clicks **Suggest** → `transcriptBuffer` flushed to `analyze()` in `ai/claude.js`
4. Claude returns JSON: `{ translation, suggestions[3], keywords, difficulty }`
5. Renderer renders suggestion cards with VI/EN tabs

## Conventions

### Module System
CommonJS only (`require`/`module.exports`). No ES modules, no `import`.

### Error Handling
- Claude responses: always strip markdown fences, extract JSON with regex before parsing
- Audio pipeline: errors sent to renderer via `win.webContents.send('error', msg)`
- Native module errors: catch and show user-facing message, never crash silently

### Environment Variables (`.env`)
```
OPENAI_KEY=sk-proj-...
ANTHROPIC_KEY=sk-ant-...
ASSEMBLYAI_KEY=...          # Optional
CLAUDE_MODEL=claude-haiku-4-5-20251014
```
Never hardcode API keys. Always read from `process.env`.

### Profile Personalization
`store/profile.json` is the source of truth for personalizing Claude prompts. Always pass `getProfile()` into `buildSystemPrompt()`. The profile includes real company names, YoE, personality traits, and tone guide — Claude uses these to generate authentic, non-generic answers.

### Answer Styles
Four modes in `ai/prompt.js`: `spoken` (< 200 chars), `technical` (< 300 chars), `star` (STAR format), `all` (one of each). All output bilingual VI+EN.

### Window Behavior
- `alwaysOnTop: true`, `transparent: true`, `frame: false`
- Stealth toggle: `Ctrl+Shift+Space` via `globalShortcut`
- Region select window: separate `BrowserWindow` (fullscreen, transparent) for CC region drag

## Common Pitfalls

- **naudiodon not rebuilt**: Native crash on start → run `npx @electron/rebuild -f -w naudiodon`
- **Claude returns prose**: Transcript too short → `minWords` setting filters it; check prompt forces JSON-only output
- **AssemblyAI 400 error**: Audio buffer too small → increase chunk delay in Settings
- **Screen CC misses text**: Use Region CC (`🎯`) to crop exactly the caption area
- **VB-Cable sample rate**: Must be `48000 Hz` on both Input and Output devices to avoid garbled audio

## Key Files to Reference
- [main.js](../main.js) — full IPC handler list and pipeline orchestration
- [ai/prompt.js](../ai/prompt.js) — all prompt templates and style configs
- [store/context.js](../store/context.js) — settings schema and defaults
- [store/profile.json](../store/profile.json) — personalization data structure
- [ui/renderer.js](../ui/renderer.js) — UI event handling patterns
