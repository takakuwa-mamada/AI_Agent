/**
 * AI チャット API エンドポイント
 * 
 * このAPIは、フロントエンドからのチャットリクエストを受け取り、
 * Agent API（Gemini）に中継する役割を果たします。
 * 
 * エンドポイント: POST /api/ai/chat
 * リクエスト: { input: string }
 * レスポンス: { message: string } | { error: string }
 * 
 * アーキテクチャ:
 * フロントエンド → Next.js API Routes (このファイル) → Agent API (localhost:4111) → Gemini API
 * 
 * カスタマイズポイント:
 * - agentUrl: Agent APIのURL（デフォルト: http://localhost:4111）
 * - model: 使用するAIモデル名（OpenAI互換形式）
 * - メッセージの前処理・後処理をここに追加可能
 */

// src/pages/api/ai/chat.ts
import type { NextApiRequest, NextApiResponse } from "next";

type Data = {
  message?: string;  // AIからの返答メッセージ
  error?: string;    // エラーメッセージ
};

/**
 * チャットAPIのハンドラー関数
 * 
 * @param req - Next.jsのリクエストオブジェクト
 * @param res - Next.jsのレスポンスオブジェクト
 * 
 * 処理の流れ:
 * 1. POSTメソッドのみ許可
 * 2. リクエストボディから入力テキストを取得
 * 3. Agent API（localhost:4111）にリクエストを転送
 * 4. Agent APIからの返答を整形してフロントエンドに返す
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  // POSTメソッドのみ許可
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // リクエストボディから入力テキストを取得
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: "No input provided" });
    }

    // Agent APIのURL（環境変数で設定可能）
    // カスタマイズ: .env.localで AGENT_API_URL を設定
    const agentUrl = process.env.AGENT_API_URL || "http://localhost:4111";
    const endpoint = `${agentUrl}/v1/chat/completions`;

    // Agent API（OpenAI互換エンドポイント）にリクエスト
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",  // ダミーのモデル名（Agent側で実際のモデルにマッピング）
        messages: [
          {
            role: "user",
            content: input,
          },
        ],
      }),
    });

    // Agent APIからのエラーレスポンスをハンドリング
    if (!response.ok) {
      const text = await response.text();
      console.error("Agent API error:", text);
      return res.status(response.status).json({ error: text });
    }

    // OpenAI互換レスポンスをパース
    const data = await response.json();
    
    // メッセージを取得（OpenAI形式）
    // カスタマイズ: レスポンス形式が異なる場合はここを調整
    const message = data?.choices?.[0]?.message?.content || "No output";

    // フロントエンドに返答を返す
    return res.status(200).json({ message });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: err.message });
  }
}
