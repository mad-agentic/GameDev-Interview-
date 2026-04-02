# 🎮 GameDev Copilot

Overlay AI hỗ trợ phỏng vấn Game Developer theo thời gian thực — gợi ý câu trả lời song ngữ VI/EN được cá nhân hóa theo kinh nghiệm thực của bạn.

> Inspired by [senseicopilot.com](https://www.senseicopilot.com) — tối ưu cho Game Dev, chạy local trên Windows, ~$0.50/buổi.

---

## Tính năng

### Nhập liệu (Input)

| Chế độ | Mô tả |
|---|---|
| 🎙 **Mic / VB-Cable** | Capture audio hệ thống qua VB-Audio Cable (Google Meet, Zoom...) |
| 🖥 **Screen Audio** | Capture audio từ tab/cửa sổ cụ thể bằng Electron desktopCapturer |
| 📋 **Clipboard CC** | Theo dõi clipboard — paste text từ Otter.ai, Google Meet CC... |
| 📺 **Screen Vision OCR** | Screenshot cửa sổ/tab → gpt-4o-mini đọc text CC mỗi 1.8 giây |
| 🎯 **Region CC** | Kéo chọn vùng cụ thể trên màn hình → chỉ OCR phần đó (nhanh, chính xác hơn) |

### Xử lý (Processing)

- **Whisper STT** — transcribe audio với vocabulary game dev (Unity, Unreal, shader, netcode, ECS...)
- **Speaker Diarization** — AssemblyAI phân biệt giọng người phỏng vấn vs bạn, lọc câu hỏi đúng người
- **Transcript Buffer** — gom nhiều chunk thành 1 context, bấm **✨ Suggest** khi sẵn sàng
- **Click-to-edit** — sửa transcript trực tiếp trước khi gửi Claude

### Output

- **Claude AI** (Haiku 4.5) — 3 gợi ý câu trả lời theo style: Spoken / Technical / STAR / All
- **Multi-provider** — chọn Anthropic trực tiếp, 9router, hoặc custom OpenAI-compatible endpoint
- **Song ngữ VI/EN** — tab 🇻🇳 để đọc hiểu, tab 🇬🇧 để speak (A2-B1, < 200 chars)
- **Cá nhân hóa** — câu trả lời mang đúng tone, số liệu, công ty thật của bạn (`store/profile.json`)
- **Keywords + Difficulty** — tag chủ đề và mức độ câu hỏi
- **Save session** — export JSON ra Desktop sau buổi phỏng vấn

### UX

- **Always-on-top overlay** — nền trong suốt, hiện trên mọi cửa sổ
- **Stealth mode** — `Ctrl+Shift+Space` ẩn/hiện toàn bộ app
- **Minimize / Maximize / Hide** — đầy đủ window controls
- **Manual Ask** — gõ câu hỏi bất kỳ để luyện mock interview offline

---

## AI Provider

Settings panel ⚙ có mục **AI Provider** — chọn nguồn gọi AI cho phần gợi ý câu trả lời:

| Provider | Mô tả |
|---|---|
| **Anthropic (.env)** | Mặc định. Gọi thẳng Anthropic API, dùng `ANTHROPIC_KEY` + `CLAUDE_MODEL` từ `.env` |
| **9router (localhost)** | Route qua [9router](https://github.com/decolua/9router) — tự động fallback qua 40+ provider/model miễn phí. Endpoint tự điền `http://localhost:20128/v1` |
| **Custom endpoint** | Bất kỳ endpoint OpenAI-compatible nào (LM Studio, Ollama, OpenRouter, Azure...) |

### Dùng 9router

1. Cài và chạy 9router daemon:
   ```bash
   npm install -g 9router
   9router
   ```
2. Mở dashboard tại `http://localhost:20128` → kết nối provider → tạo API key + combo model
3. Trong Settings ⚙ của app → chọn **9router (localhost)**
4. Nhập API key từ 9router dashboard và model name (tên combo bạn tạo)

> **Lợi ích:** 9router tự động switch sang model miễn phí khi quota hết — không bị gián đoạn giữa buổi phỏng vấn.

### Dùng Custom Endpoint

1. Trong Settings ⚙ → chọn **Custom endpoint**
2. Điền 3 trường:
   - **Endpoint** — base URL, ví dụ `http://localhost:1234/v1` (LM Studio) hoặc `https://openrouter.ai/api/v1`
   - **API Key** — để trống nếu server local không cần xác thực
   - **Model** — tên model, ví dụ `mistral-7b-instruct`, `llama-3.1-8b`

> Custom endpoint phải hỗ trợ định dạng **OpenAI-compatible** (`POST /chat/completions`).

---

## Yêu cầu

- **Windows 10/11**
- [Node.js LTS](https://nodejs.org) (v18+)
- [VB-Audio Virtual Cable](https://vb-audio.com/Cable/) — để capture audio hệ thống (tùy chọn)
- **API Keys:**

| Service | Dùng cho | Bắt buộc |
|---|---|---|
| [OpenAI](https://platform.openai.com/api-keys) | Whisper STT + Vision OCR | ✅ |
| [Anthropic](https://console.anthropic.com/settings/keys) | Claude AI gợi ý | ✅ |
| [AssemblyAI](https://www.assemblyai.com/app/account) | Speaker diarization | Tùy chọn |

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
ASSEMBLYAI_KEY=...          # Tùy chọn — chỉ cần nếu dùng Speaker Detection
CLAUDE_MODEL=claude-haiku-4-5-20251001   # Mặc định nếu không có dòng này
```

### 3. Cá nhân hóa profile _(khuyến nghị)_

Chỉnh file `store/profile.json` — điền kinh nghiệm thật, công ty, dự án, phong cách nói của bạn. Claude sẽ trả lời đúng tone và dùng số liệu thực của bạn.

```json
{
  "name": "Trần Văn Hòa",
  "yearsOfExperience": 8,
  "currentRole": "Senior Unity Developer / Freelance",
  "companies": ["Neko Global", "BLAMEO", "Gamota"],
  "personality": {
    "traits": ["calm", "thoughtful", "optimistic"],
    "fillerWords": ["Yup", "Yah", "Cool"],
    "toneGuide": {
      "prefer": ["Start answers with 'Yup, so...'", "Use real numbers and company names"],
      "avoid": ["passionate developer", "empty adjectives"]
    }
  }
}
```

### 4. Cài VB-Audio Cable _(cho audio capture)_

Tải tại [vb-audio.com/Cable](https://vb-audio.com/Cable/) → cài → restart máy.

**Route audio qua VB-Cable:**
1. Chuột phải loa → **Sound settings** → **More sound settings**
2. Tab **Playback** → chuột phải **CABLE Input** → **Set as Default Device**
3. Tab **Recording** → **CABLE Output** → **Properties** → tab **Listen**
   - Tick **Listen to this device** → chọn loa thật
4. Set sample rate: Properties → Advanced → `16 bit, 48000 Hz` (cả Input lẫn Output)

### 5. Chạy app

```bash
npm start
```

---

## Cách sử dụng

### Chế độ Audio (VB-Cable hoặc Screen Audio)

1. Chọn **CABLE Output** hoặc bấm **🖥** để chọn tab/cửa sổ
2. Nhấn **▶ Start**
3. Transcript tự động hiện ra theo từng chunk
4. Khi muốn gợi ý → nhấn **✨ Suggest** (gom toàn bộ buffer → 1 call Claude)
5. Click vào transcript card để sửa trước khi Suggest

### Chế độ CC (Otter.ai / Google Meet Captions)

**Clipboard CC:**
1. Bật CC trên Otter.ai hoặc Google Meet
2. Nhấn **📋 CC** (không cần chọn screen source)
3. App tự theo dõi clipboard — copy text CC vào là tự nhận

**Screen Vision OCR:**
1. Bấm **🖥** → chọn cửa sổ Otter.ai hoặc tab Google Meet
2. Nhấn **📋 CC** → app screenshot + OCR mỗi 1.8 giây
3. _(Tùy chọn)_ Bấm **🎯** → kéo chọn đúng vùng hiển thị CC → OCR chỉ đọc phần đó, nhanh và chính xác hơn

### Speaker Detection (phân biệt giọng)

1. Bật **Speaker detection** trong Settings ⚙
2. Start capture → câu trả lời hiện badge **A / B / C...**
3. Click vào badge giọng của **bạn** → app bỏ qua giọng đó, chỉ lấy câu hỏi của interviewer

### Mock Interview (offline)

1. Mở **▾ Ask a Question** ở dưới cùng
2. Gõ / paste câu hỏi → nhấn **Ask** hoặc `Ctrl+Enter`
3. Claude trả lời ngay, không cần mic

---

## Phím tắt

| Phím | Tác dụng |
|---|---|
| `Ctrl+Shift+Space` | Ẩn / hiện overlay (stealth mode) |
| `Ctrl+Enter` (trong Ask panel) | Submit câu hỏi manual |
| `Esc` (trong region select) | Hủy chọn vùng CC |

---

## Cấu trúc project

```
gamedev-copilot/
├── main.js                  # Electron main — window, IPC, pipeline
├── preload.js               # contextBridge — expose API cho renderer
├── .env                     # API keys (không commit)
│
├── audio/
│   ├── capture.js           # naudiodon — PCM audio capture theo chunk
│   └── pcm-to-wav.js        # Convert PCM buffer → WAV (cho AssemblyAI)
│
├── ai/
│   ├── whisper.js           # OpenAI Whisper STT (+ game dev vocabulary hint)
│   ├── claude.js            # AI suggestion — Anthropic native + OpenAI-compat (9router/custom)
│   ├── prompt.js            # System prompt builder — inject profile + personality
│   ├── assemblyai.js        # Speaker diarization — detect + filter by speaker
│   └── vision.js            # OpenAI gpt-4o-mini Vision — OCR CC text từ screenshot
│
├── store/
│   ├── context.js           # In-memory state: resume, session, settings
│   └── profile.json         # User profile — kinh nghiệm, personality, tone guide
│
└── ui/
    ├── index.html           # Overlay UI structure
    ├── renderer.js          # Event handlers, IPC, card rendering
    ├── styles.css           # Dark transparent theme
    ├── region-select.html   # Fullscreen overlay — drag to select CC region
    └── region-select.js     # Mouse drag logic → gửi coordinates về main
```

---

## Chi phí ước tính

| Service | Giá | 1 buổi interview (1h) |
|---|---|---|
| OpenAI Whisper | $0.006/phút audio | ~$0.36 |
| OpenAI Vision (Screen CC) | ~$0.001/ảnh | ~$0.04 (nếu dùng) |
| Anthropic Claude Haiku 4.5 | ~$0.003/1K tokens | ~$0.10 |
| AssemblyAI Diarization | $0.012/phút | ~$0.72 (nếu dùng) |
| **Tổng (không diarize)** | | **~$0.50/buổi** |
| **Tổng (có diarize)** | | **~$1.20/buổi** |

> **Tip tiết kiệm:** Dùng Screen Vision OCR thay Whisper nếu meeting có CC sẵn → tiết kiệm ~70% chi phí.

---

## So sánh với Sensei Copilot

| | Sensei | GameDev Copilot |
|---|---|---|
| Giá | $89/tháng | ~$0.50/buổi |
| Tiếng Việt | ❌ | ✅ song ngữ VI/EN |
| Game dev context | ❌ generic | ✅ Unity, Unreal, ECS, shaders... |
| Cá nhân hóa | ❌ | ✅ profile.json + tone guide |
| Speaker filter | ❌ | ✅ AssemblyAI diarization |
| Screen/region OCR | ❌ | ✅ Vision gpt-4o-mini |
| Privacy | Data lên server | ✅ chạy local |
| Manual Suggest | Auto | ✅ bấm khi muốn |

---

## Troubleshooting

**`naudiodon` crash khi khởi động**
```bash
npx @electron/rebuild -f -w naudiodon
```

**Không thấy CABLE Output trong dropdown**
- Cài VB-Audio Cable và restart máy
- Kiểm tra Recording devices trong Sound settings

**Loa bị rè / mất tiếng khi dùng CABLE**
- Vào Sound settings → set cùng sample rate `48000 Hz` cho cả CABLE Input và CABLE Output

**AssemblyAI lỗi 400**
- Thường do buffer quá nhỏ — tăng Delay lên `Slow (~2s)` trong Settings
- Kiểm tra `ASSEMBLYAI_KEY` trong `.env`

**Claude trả về lỗi model**
- Kiểm tra `CLAUDE_MODEL` trong `.env` — phải là `claude-haiku-4-5-20251001`

**9router không kết nối được**
- Đảm bảo `9router` daemon đang chạy (`9router` trong terminal)
- Kiểm tra port 20128 chưa bị chặn bởi firewall
- Mở `http://localhost:20128` trên browser — nếu thấy dashboard là OK

**Custom endpoint trả lỗi 401/403**
- Kiểm tra API Key đúng và chưa hết hạn
- Một số server local (LM Studio, Ollama) không cần key — để trống ô API Key

**Custom endpoint trả về lỗi parse JSON**
- Provider không trả đúng format JSON theo prompt — thử chuyển về Anthropic hoặc 9router
- Kiểm tra model có đủ mạnh để follow instruction JSON (khuyến nghị ≥ 7B params)

**Whisper nhận sai từ** (ví dụ "difficult button" thay vì "debug")
- Đây là lỗi audio chất lượng thấp — tăng sample rate VB-Cable lên `48000 Hz`
- Dùng Screen CC mode thay vì audio nếu meeting có caption sẵn

**Claude trả về prose thay vì JSON**
- Transcript quá ngắn → tăng Min words lên `6` trong Settings
- Kiểm tra `ANTHROPIC_KEY` hợp lệ

**Screen CC không đọc được text**
- Dùng **🎯 Region** để crop đúng vùng chứa caption — tránh OCR background noise
- Đảm bảo font CC đủ lớn (≥ 14px trên màn hình)

---

## License

MIT © 2026
