/**
 * Agent API Server - Gemini APIとのブリッジサーバー
 * 
 * このサーバーは、Google Gemini APIとNext.jsアプリケーションの間に立ち、
 * OpenAI互換のAPIインターフェースを提供します。
 * 
 * 主な機能:
 * 1. OpenAI形式のリクエストを受け取る
 * 2. Google Gemini APIに変換して転送
 * 3. GeminiのレスポンスをOpenAI形式に変換して返す
 * 
 * エンドポイント:
 * - GET /: サービス情報
 * - GET /api/health: ヘルスチェック
 * - POST /v1/chat/completions: チャットAPI（OpenAI互換）
 * 
 * 環境変数:
 * - GOOGLE_GENERATIVE_AI_API_KEY: Gemini APIキー（必須）
 * - GEMINI_MODEL_ID: 使用するモデル（デフォルト: gemini-2.0-flash-exp）
 * - PORT: サーバーポート（デフォルト: 4111）
 * 
 * カスタマイズポイント:
 * - モデルの選択（geminiModelId）
 * - プロンプトの前処理・後処理
 * - ログの追加・削除
 * - レート制限の実装
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

// サーバー設定
const PORT = process.env.PORT ? Number(process.env.PORT) : 4111;
const app = express();

// ミドルウェア設定
app.use(cors());  // CORS有効化（フロントエンドからのリクエストを許可）
app.use(express.json({ limit: '1mb' }));  // JSONボディのパース（最大1MB）

/**
 * ルートエンドポイント - サービス情報を返す
 */
app.get('/', (req, res) => {
  res.json({
    service: 'Minimal Agent API',
    endpoints: {
      health: 'GET /api/health',
      chat: 'POST /v1/chat/completions  (OpenAI互換)'
    },
    model: 'gemini-2.0-flash-exp (default)',
    note: 'Set GOOGLE_GENERATIVE_AI_API_KEY to use Gemini.'
  });
});

/**
 * ヘルスチェックエンドポイント
 */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

/**
 * チャットAPI - OpenAI互換エンドポイント
 * 
 * リクエスト形式（OpenAI互換）:
 * {
 *   "model": "gpt-4o-mini",  // ダミー（実際はGeminiを使用）
 *   "messages": [
 *     { "role": "user", "content": "こんにちは" }
 *   ]
 * }
 * 
 * レスポンス形式（OpenAI互換）:
 * {
 *   "id": "chatcmpl-xxx",
 *   "object": "chat.completion",
 *   "created": 1234567890,
 *   "model": "gpt-4o-mini",
 *   "choices": [
 *     {
 *       "index": 0,
 *       "message": { "role": "assistant", "content": "こんにちは！" },
 *       "finish_reason": "stop"
 *     }
 *   ],
 *   "usage": { "prompt_tokens": null, "completion_tokens": null, "total_tokens": null }
 * }
 */
app.post('/v1/chat/completions', async (req, res) => {
  try {
    // APIキーの確認
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: { message: 'GOOGLE_GENERATIVE_AI_API_KEY is missing.' }
      });
    }

    // リクエストボディからパラメータを取得
    const {
      model = 'gpt-4o-mini', // OpenAI互換のダミーモデル名
      messages = []
    } = req.body || {};

    // OpenAI形式のmessagesをプロンプト文字列に変換
    // カスタマイズ: より高度なメッセージフォーマットに対応可能
    // 例: システムメッセージ、アシスタントメッセージの処理など
    const prompt = messages
      .map(m => `${m.role || 'user'}: ${m.content || ''}`)
      .join('\n');

    console.log('📨 Received prompt:', prompt);

    // Gemini モデルの選択
    // カスタマイズ: 環境変数 GEMINI_MODEL_ID で変更可能
    // 利用可能なモデル:
    // - gemini-2.0-flash-exp: 最新の高速モデル（推奨）
    // - gemini-1.5-pro: より高機能なモデル
    // - gemini-1.5-flash: バランス型
    const geminiModelId = process.env.GEMINI_MODEL_ID || 'gemini-2.0-flash-exp';
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelClient = genAI.getGenerativeModel({ model: geminiModelId });

    // Gemini APIにリクエスト
    const result = await modelClient.generateContent(prompt);
    console.log('📤 Gemini raw result:', JSON.stringify(result.response, null, 2));
    
    // Geminiのレスポンスからテキストを抽出
    // 複数の形式に対応（バージョンによって構造が異なる可能性があるため）
    const text =
      result?.response?.text?.() ||
      result?.response?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ||
      '';
    
    console.log('💬 Extracted text:', text);

    // OpenAI互換のレスポンス形式に変換
    res.json({
      id: 'chatcmpl-' + Math.random().toString(16).slice(2),  // ランダムなID生成
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),  // Unix timestamp
      model,  // リクエストで指定されたモデル名をそのまま返す
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: text },
          finish_reason: 'stop'
        }
      ],
      usage: { prompt_tokens: null, completion_tokens: null, total_tokens: null }
    });
  } catch (e) {
    res.status(500).json({
      error: { message: e?.message ?? String(e) }
    });
  }
});

/**
 * サーバー起動
 */
app.listen(PORT, () => {
  console.log(`Agent API on http://localhost:${PORT}`);
});
