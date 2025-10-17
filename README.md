# AI Character Starter (Live2D + VOICEVOX + Chat)

最小構成の **AIキャラクター & チャット** プロジェクトです。地方移住サイト部分は含みません。

## 必要条件
- Node.js 20 (nvm 推奨)
- VOICEVOX ENGINE (ローカル): http://127.0.0.1:50021
  - 公式配布物から取得し、本プロジェクトの `public/scripts/` に置いてください。

## セットアップ
```bash
<<<<<<< HEAD
=======
cd AI_Agent
>>>>>>> 3ed43a26f8d867c5125c753bb4e140940be6765a
nvm use 20.17.0
npm install
npm ci
npm run dev
<<<<<<< HEAD
# http://localhost:3000/studio
=======
# http://localhost:3000/studio ←このページを開いたらAIが出てくる
>>>>>>> 3ed43a26f8d867c5125c753bb4e140940be6765a
```

## 環境変数 (.env.local)
```
# Live2D モデルパス（例：haru greeter pro）
NEXT_PUBLIC_SELECTED_LIVE2D_PATH=/live2d/haru_greeter_pro_jp/runtime/haru_greeter_t05.model3.json

# （必要なら）VOICEVOX のURL (デフォルトは http://127.0.0.1:50021)
# VOICEVOX_URL=http://127.0.0.1:50021
```

## API
- `POST /api/ai/chat` → Mastra(OpenAI互換) の `http://localhost:4111/v1/chat/completions` に中継
- `POST /api/voicevox/tts` → VOICEVOX ENGINE に中継して wav を返す

## ライセンス
- VOICEVOX / Live2D / モデル配布のライセンスに従ってください。
