// src/pages/api/voicevox/tts.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const BASE =
  process.env.VOICEVOX_URL ||
  process.env.NEXT_PUBLIC_VOICEVOX_URL ||
  'http://127.0.0.1:50021';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }
  try {
    const {
      text,
      speaker = 1,
      speedScale,
      pitchScale,
      volumeScale,
    } = (req.body || {}) as {
      text?: string;
      speaker?: number;
      speedScale?: number;
      pitchScale?: number;
      volumeScale?: number;
    };

    const utterance = (text ?? '').toString();
    if (!utterance.trim()) {
      res.status(400).json({ ok: false, error: 'text is required' });
      return;
    }
    const speakerId = Number(speaker) || 1;

    // ------- 1) まず「ボディJSON方式」を試す -------
    let queryObj: any | null = null;
    let aqResp = await fetch(`${BASE}/audio_query?speaker=${speakerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ text: utterance }),
    });

    // ボディ方式がダメ（422/400 など）なら「クエリ方式」でリトライ
    if (!aqResp.ok && (aqResp.status === 422 || aqResp.status === 400)) {
      // ------- 2) フォールバック：クエリ方式 -------
      aqResp = await fetch(
        `${BASE}/audio_query?text=${encodeURIComponent(utterance)}&speaker=${speakerId}`,
        { method: 'POST' }
      );
    }

    if (!aqResp.ok) {
      const m = await safeText(aqResp);
      res
        .status(502)
        .json({ ok: false, step: 'audio_query', status: aqResp.status, message: m });
      return;
    }

    queryObj = await aqResp.json();

    // 任意のパラメータ
    if (speedScale != null) queryObj.speedScale = Number(speedScale);
    if (pitchScale != null) queryObj.pitchScale = Number(pitchScale);
    if (volumeScale != null) queryObj.volumeScale = Number(volumeScale);

    // ------- 3) 合成 -------
    const syn = await fetch(`${BASE}/synthesis?speaker=${speakerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryObj),
    });
    if (!syn.ok) {
      const m = await safeText(syn);
      res
        .status(502)
        .json({ ok: false, step: 'synthesis', status: syn.status, message: m });
      return;
    }

    const arr = Buffer.from(await syn.arrayBuffer());
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(arr);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
}

async function safeText(r: Response) {
  try {
    return await r.text();
  } catch {
    return '(no text)';
  }
}
