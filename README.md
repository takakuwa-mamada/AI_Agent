# AI Character Starter (Live2D + VOICEVOX + Gemini Chat)

Live2Dキャラクターと音声合成（VOICEVOX）を使ったAIチャットアプリケーションです。

## 必要条件

- Node.js 20.x
- VOICEVOX ENGINE (ローカル): http://127.0.0.1:50021
- Google Generative AI API キー（Gemini用）

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/takakuwa-mamada/AI_Agent.git
cd AI_Agent
```

### 2. 依存関係のインストール

```bash
# メインプロジェクトの依存関係
npm install

# Agentサーバーの依存関係
cd agent
npm install
cd ..
```

### 3. 環境変数の設定

#### メインプロジェクト: `.env.local` を作成

```bash
# Live2D モデルパス
NEXT_PUBLIC_SELECTED_LIVE2D_PATH=live2d/hijiki/hijiki.model3.json

# Agent APIのURL（デフォルト）
AGENT_API_URL=http://localhost:4111
```

#### Agentサーバー: `agent/.env` を作成

```bash
# Google Generative AI APIキー（必須）
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here

# 使用するGeminiモデル（オプション）
GEMINI_MODEL_ID=gemini-2.0-flash-exp

# ポート番号（オプション、デフォルト: 4111）
PORT=4111
```

### 4. VOICEVOX ENGINEの起動

[VOICEVOX ENGINE](https://voicevox.hiroshiba.jp/)をダウンロードして起動してください。
デフォルトで `http://127.0.0.1:50021` で起動します。

### 5. Live2Dコアライブラリの配置

`public/scripts/live2dcubismcore.min.js` を配置してください。
[Cubism SDK](https://www.live2d.com/download/cubism-sdk/)からダウンロードできます。

### 6. アプリケーションの起動

**2つのターミナルで別々に起動する必要があります：**

#### ターミナル1: Agentサーバー

```bash
cd agent
npm run dev
```

サーバーが `http://localhost:4111` で起動します。

#### ターミナル2: Next.jsアプリケーション(プロジェクト直下でOK)

```bash
npm run dev
```

アプリケーションが `http://localhost:3000` で起動します。

### 7. アプリケーションへアクセス

ブラウザで `http://localhost:3000/studio` を開いてください。

## 使い方

1. Live2Dキャラクターが画面に表示されます
2. 右側のパネルでパラメータを調整できます：
   - **Speaker**: VOICEVOX の話者ID
   - **Attack/Decay/Gain/Gate**: リップシンクのパラメータ
3. メッセージを入力して「送信」ボタンをクリック
4. AIが返答し、キャラクターが口パクします

## API エンドポイント

### Next.js API (localhost:3000)

- `POST /api/ai/chat` - AIチャットエンドポイント（Agent APIに中継）
  - Body: `{ input: string }`
  - Response: `{ message: string }`

- `POST /api/voicevox/tts` - 音声合成エンドポイント
  - Body: `{ text: string, speaker: number }`
  - Response: WAVファイル

### Agent API (localhost:4111)

- `POST /v1/chat/completions` - OpenAI互換のチャットエンドポイント
  - Body: `{ model: string, messages: [{role, content}] }`
  - Response: OpenAI互換のレスポンス

## トラブルシューティング

### Live2Dモデルが表示されない

- `public/scripts/live2dcubismcore.min.js` が配置されているか確認
- Live2Dモデルファイルが `public/live2d/` 以下に配置されているか確認
- `.env.local` の `NEXT_PUBLIC_SELECTED_LIVE2D_PATH` が正しいか確認

### 音声が再生されない

- VOICEVOX ENGINEが起動しているか確認（http://127.0.0.1:50021）
- ブラウザのコンソールでエラーを確認

### AIが返答しない

- Agentサーバー（localhost:4111）が起動しているか確認
- `agent/.env` に `GOOGLE_GENERATIVE_AI_API_KEY` が設定されているか確認
- APIキーが有効か確認

## プロジェクト構造

```
.
├── src/
│   ├── pages/
│   │   ├── studio.tsx          # メインUI
│   │   └── api/
│   │       ├── ai/chat.ts      # AIチャットAPI
│   │       └── voicevox/tts.ts # 音声合成API
│   └── lib/
│       ├── tts.ts              # 音声再生ロジック
│       └── emotion.ts          # 感情タグ解析
├── agent/
│   └── src/
│       └── server.mjs          # Gemini APIサーバー
├── public/
│   ├── scripts/                # Cubism Core
│   └── live2d/                 # Live2Dモデル
└── package.json
```

## ライセンス

- Live2D Cubism SDK: [Live2D Proprietary Software License Agreement](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)
- VOICEVOX: [VOICEVOX 利用規約](https://voicevox.hiroshiba.jp/term/)
- その他のコード: MIT License
