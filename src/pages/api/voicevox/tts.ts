/**
 * VOICEVOX 音声合成 API エンドポイント
 * 
 * このAPIは、VOICEVOXエンジンを使ってテキストを音声（WAVファイル）に変換します。
 * フロントエンドから呼び出され、ブラウザで再生可能なWAVデータを返します。
 * 
 * エンドポイント: POST /api/voicevox/tts
 * リクエスト: { text: string, speaker?: number, speedScale?: number, pitchScale?: number, volumeScale?: number }
 * レスポンス: audio/wav (バイナリデータ)
 * 
 * VOICEVOXの2ステップ処理:
 * 1. audio_query: テキストから音声合成用のクエリを生成
 * 2. synthesis: クエリを使って実際の音声（WAV）を生成
 * 
 * カスタマイズポイント:
 * - BASE: VOICEVOXエンジンのURL（デフォルト: http://127.0.0.1:50021）
 * - speaker: 話者ID（1=四国めたん（ノーマル）、3=ずんだもん など）
 * - speedScale: 話速（0.5〜2.0、デフォルト1.0）
 * - pitchScale: 音高（-0.15〜0.15、デフォルト0.0）
 * - volumeScale: 音量（0.0〜2.0、デフォルト1.0）
 */

// src/pages/api/voicevox/tts.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// VOICEVOXエンジンのベースURL
// カスタマイズ: .env.local で VOICEVOX_URL を設定可能
const BASE =
  process.env.VOICEVOX_URL ||
  process.env.NEXT_PUBLIC_VOICEVOX_URL ||
  'http://127.0.0.1:50021';

/**
 * VOICEVOX TTS APIハンドラー
 * 
 * @param req - リクエストオブジェクト
 * @param res - レスポンスオブジェクト
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // POSTメソッドのみ許可
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }
  
  try {
    // リクエストボディからパラメータを取得
    const {
      text,           // 読み上げるテキスト（必須）
      speaker = 1,    // 話者ID（デフォルト: 1 = 四国めたん）
      speedScale,     // 話速（オプション、例: 1.2 = 1.2倍速）
      pitchScale,     // 音高（オプション、例: 0.1 = 高く）
      volumeScale,    // 音量（オプション、例: 1.5 = 1.5倍）
    } = (req.body || {}) as {
      text?: string;
      speaker?: number;
      speedScale?: number;
      pitchScale?: number;
      volumeScale?: number;
    };

    // テキストのバリデーション
    const utterance = (text ?? '').toString();
    if (!utterance.trim()) {
      res.status(400).json({ ok: false, error: 'text is required' });
      return;
    }
    const speakerId = Number(speaker) || 1;

    // ========== ステップ1: audio_query - 音声合成クエリの生成 ==========
    // VOICEVOXは2つのAPIリクエスト方式をサポート:
    // 1. ボディJSON方式（推奨）: POST { text: "..." }
    // 2. クエリパラメータ方式（旧式）: POST ?text=...&speaker=...
    
    let queryObj: any | null = null;
    
    // まずボディJSON方式を試す
    let aqResp = await fetch(`${BASE}/audio_query?speaker=${speakerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ text: utterance }),
    });

    // ボディ方式が失敗した場合（古いVOICEVOXバージョン）、クエリ方式でリトライ
    if (!aqResp.ok && (aqResp.status === 422 || aqResp.status === 400)) {
      aqResp = await fetch(
        `${BASE}/audio_query?text=${encodeURIComponent(utterance)}&speaker=${speakerId}`,
        { method: 'POST' }
      );
    }

    // audio_queryのエラーハンドリング
    if (!aqResp.ok) {
      const m = await safeText(aqResp);
      res
        .status(502)
        .json({ ok: false, step: 'audio_query', status: aqResp.status, message: m });
      return;
    }

    // クエリオブジェクトを取得
    queryObj = await aqResp.json();

    // オプショナルパラメータを適用
    // カスタマイズ: ここで音声の特性を細かく調整可能
    if (speedScale != null) queryObj.speedScale = Number(speedScale);     // 話速調整
    if (pitchScale != null) queryObj.pitchScale = Number(pitchScale);     // 音高調整
    if (volumeScale != null) queryObj.volumeScale = Number(volumeScale);  // 音量調整

    // ========== ステップ2: synthesis - 音声合成の実行 ==========
    const syn = await fetch(`${BASE}/synthesis?speaker=${speakerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryObj),
    });
    
    // synthesisのエラーハンドリング
    if (!syn.ok) {
      const m = await safeText(syn);
      res
        .status(502)
        .json({ ok: false, step: 'synthesis', status: syn.status, message: m });
      return;
    }

    // WAVファイルをバイナリデータとして取得
    const arr = Buffer.from(await syn.arrayBuffer());
    
    // WAVファイルをレスポンスとして返す
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');  // キャッシュ無効化（毎回新しい音声を生成）
    res.status(200).send(arr);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
}

/**
 * エラーレスポンスからテキストを安全に取得する
 */
async function safeText(r: Response) {
  try {
    return await r.text();
  } catch {
    return '(no text)';
  }
}
