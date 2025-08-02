# 🎤 AI Voice Assistant PWA

A voice assistant with offline speech-to-text, optional ChatGPT integration, text-to-speech, and PWA support.

## Features

- 🎙️ **Voice Recording** - Browser microphone capture
- 🗣️ **Speech-to-Text** - Offline Whisper WASM transcription
- 🤖 **AI Toggle** - Enable/disable ChatGPT with one click
- 🔊 **Text-to-Speech** - Browser speech synthesis
- 📱 **PWA** - Install as desktop/mobile app
- 🔄 **Offline Mode** - Works without internet (except AI)

## Quick Setup

1. **Create project:**
   ```bash
   npx create-next-app@latest voice-assistant --typescript --tailwind --eslint
   cd voice-assistant
   ```

2. **Install dependencies:**
   ```bash
   npm install @remotion/whisper-web openai next-pwa
   ```

3. **Add API key (optional):**
   Create `.env.local`:
   ```
   NEXT_PUBLIC_OPENAI_API_KEY=your-openai-key-here
   ```

4. **Update `next.config.ts`:**
   ```typescript
   import withPWA from "next-pwa";
   
   const pwa = withPWA({
     dest: "public",
     register: true,
     skipWaiting: true,
     disable: false,
   });
   
   const nextConfig = {
     reactStrictMode: true,
     async headers() {
       return [{
         source: '/(.*)',
         headers: [
           { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
           { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
         ],
       }];
     },
   };
   
   export default pwa(nextConfig);
   ```

5. **Add `public/manifest.json`:**
   ```json
   {
     "name": "AI Voice Assistant",
     "short_name": "VoiceAI",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#ffffff",
     "theme_color": "#2563eb",
     "icons": [
       { "src": "/window.svg", "sizes": "192x192", "type": "image/svg+xml" }
     ]
   }
   ```

6. **Replace `src/pages/index.tsx`** with the voice assistant code

7. **Run:**
   ```bash
   npm run dev
   ```

## Usage

1. **Toggle AI** - Click the AI toggle button (works without API key when disabled)
2. **Record** - Click "Start Recording" → speak → "Stop Recording"  
3. **Listen** - App transcribes, generates response, and speaks it back

## Browser Support

| Browser | Recording | Transcription | AI | TTS | PWA |
|---------|-----------|---------------|----|----|-----|
| Chrome  | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Firefox | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Edge    | ✅ | ✅ | ✅ | ✅ | ✅ |
| Safari  | ✅ | ✅ | ✅ | ✅ | ✅ |

## Key Files

```
voice-assistant/
├── src/pages/index.tsx     # Main app (AI toggle included)
├── public/manifest.json    # PWA config
├── .env.local             # API key (optional)
├── next.config.ts         # PWA setup
└── package.json           # Dependencies
```

## Troubleshooting

**TTS not working (Linux):**
```bash
sudo apt install espeak espeak-data
```

**No PWA install option:**
- Check `next.config.ts` has `disable: false`
- Restart dev server

**AI not responding:**
- Check API key in `.env.local`
- Verify OpenAI credits
- Toggle AI off to use without API

---

**Built with Next.js + TypeScript + Whisper WASM + OpenAI**
