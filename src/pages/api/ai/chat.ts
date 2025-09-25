
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * 単純な中継：Mastra(OpenAI互換) → http://localhost:4111/v1/chat/completions
 * body: { input?: string, messages?: [{role, content}] }
 * 返信: { ok: true, reply: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }
  try {
    const { input, messages } = req.body || {};
    const msgs = Array.isArray(messages) && messages.length
      ? messages
      : [{ role: 'user', content: String(input ?? '') }];

    const upstream = await fetch('http://localhost:4111/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: msgs }),
    });

    if (!upstream.ok) {
      const m = await safeText(upstream);
      res.status(502).json({ ok: false, status: upstream.status, message: m });
      return;
    }
    const json: any = await upstream.json();
    const reply =
      json?.choices?.[0]?.message?.content ||
      json?.choices?.[0]?.message?.text ||
      json?.text ||
      json?.reply ||
      '';

    res.status(200).json({ ok: true, reply });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
}

async function safeText(r: Response) {
  try { return await r.text(); } catch { return '(no text)'; }
}
