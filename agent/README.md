# Agent (OpenAI 互換 / Gemini 直呼び)

- 起動: `npm install && npm run dev`
- エンドポイント:
  - GET  /api/health → {"ok":true}
  - POST /v1/chat/completions （OpenAI互換）

## 環境変数
- GOOGLE_GENERATIVE_AI_API_KEY: Gemini の API キー
- PORT (任意): 既定は 4111
