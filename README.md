# 🎮 GameDev Copilot

Overlay AI hỗ trợ phỏng vấn Game Developer theo thời gian thực — dịch EN↔VN + gợi ý câu trả lời chuyên ngành game.

> Inspired by [senseicopilot.com](https://www.senseicopilot.com) — tối ưu cho Game Dev, chạy local trên Windows, ~$0.50/buổi.

---

## Tính năng

- **Nghe audio hệ thống** qua VB-Audio Cable (Google Meet, Zoom, YouTube...)
- **Transcribe real-time** bằng OpenAI Whisper (~1 giây delay)
- **Dịch EN↔VN** tự động
- **3 gợi ý câu trả lời** theo phong cách: Technical Deep-Dive / Concise & Clear / STAR Storytelling
- **Tags chuyên ngành**: Unity, Unreal, ECS, shaders, netcode, frame budget...
- **Always-on-top overlay** — hiện trên mọi cửa sổ, nền trong suốt
- **Resume context** — paste CV để nhận gợi ý cá nhân hóa

---

## Yêu cầu

- Windows 10/11
- [Node.js LTS](https://nodejs.org) (v18+)
- [VB-Audio Virtual Cable](https://vb-audio.com/Cable/) — để capture audio hệ thống
- API keys:
  - [OpenAI](https://platform.openai.com/api-keys) — cho Whisper STT
  - [Anthropic](https://console.anthropic.com/settings/keys) — cho Claude AI

---

## Cài đặt

### 1. Clone & install

```bash
git clone https://github.com/mad-agentic/GameDev-Interview-
cd GameDev-Interview-
npm install
npx @electron/rebuild -f -w naudiodon
```

> `electron-rebuild` bắt buộc vì `naudiodon` là native module.

### 2. Tạo file `.env`

```env
OPENAI_KEY=sk-proj-...
ANTHROPIC_KEY=sk-ant-...
```

### 3. Cài VB-Audio Cable

Tải tại [vb-audio.com/Cable](https://vb-audio.com/Cable/) → cài → restart máy.

### 4. Route audio qua VB-Cable

1. Chuột phải loa → **Sound settings** → **More sound settings**
2. Tab **Playback** → chuột phải **CABLE Input** → **Set as Default Device**
3. Tab **Recording** → **CABLE Output** → **Properties** → tab **Listen**
   - Tick **Listen to this device** → chọn loa thật
4. Set cùng sample rate cho cả CABLE Input và CABLE Output:
   - Properties → Advanced → `16 bit, 48000 Hz`

### 5. Chạy app

```bash
npm start
```

---

## Sử dụng

1. Mở app → chọn **CABLE Output (VB-Audio Virtual Cable)** trong dropdown
2. Nhấn **▶ Start**
3. Mở Google Meet / Zoom / YouTube — audio sẽ được capture tự động
4. Transcript hiện ngay, gợi ý AI xuất hiện sau ~2 giây
5. Click **Resume / Background** để paste CV → gợi ý cá nhân hóa hơn

---

## Cấu trúc project

```
gamedev-copilot/
├── main.js              # Electron main — window, IPC, pipeline
├── preload.js           # Bridge Node ↔ Renderer
├── audio/
│   ├── capture.js       # naudiodon — capture audio theo chunk
│   └── pcm-to-wav.js    # Convert PCM buffer → WAV
├── ai/
│   ├── whisper.js       # OpenAI Whisper — audio → text
│   ├── claude.js        # Claude API — text → JSON gợi ý
│   └── prompt.js        # System prompt game dev
├── ui/
│   ├── index.html       # Overlay UI
│   ├── renderer.js      # IPC handler, render cards
│   └── styles.css       # Dark transparent theme
└── store/
    └── context.js       # In-memory resume store
```

---

## Chi phí ước tính

| Service | Giá | 1 buổi interview (1h) |
|---|---|---|
| OpenAI Whisper | $0.006/phút | ~$0.36 |
| Claude API | ~$0.003/1K tokens | ~$0.15 |
| **Tổng** | | **~$0.50/buổi** |

---

## So sánh với Sensei Copilot

| | Sensei | GameDev Copilot |
|---|---|---|
| Giá | $89/tháng | ~$0.50/buổi |
| Tiếng Việt | ❌ | ✅ |
| Game dev context | ❌ generic | ✅ custom |
| Privacy | Data lên server | ✅ local |
| Resume context | ✅ | ✅ |

---

## Troubleshooting

**`naudiodon` crash khi khởi động**
```bash
npx @electron/rebuild -f -w naudiodon
```

**Không thấy CABLE Output trong dropdown**
- Cài VB-Audio Cable và restart máy
- Kiểm tra Recording devices trong Sound settings

**Loa bị rè khi dùng CABLE**
- Vào Sound settings → set cùng sample rate `48000 Hz` cho cả CABLE Input và CABLE Output

**Claude error: JSON parse**
- Transcript quá ngắn (< 4 từ) sẽ bị bỏ qua tự động

---

## License

MIT © 2026
