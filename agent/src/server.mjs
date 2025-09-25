import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4111;
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ルートの簡易案内
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// OpenAI 互換: POST /v1/chat/completions
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: { message: 'GOOGLE_GENERATIVE_AI_API_KEY is missing.' }
      });
    }

    const {
      model = 'gpt-4o-mini', // 互換のためのダミー。Gemini側にマッピングします
      messages = []
    } = req.body || {};

    // OpenAI形式 messages → プロンプト文字列化（超シンプル）
    const prompt = messages
      .map(m => `${m.role || 'user'}: ${m.content || ''}`)
      .join('\n');

    // Gemini モデルの選択（用途に応じて調整）
    const geminiModelId = process.env.GEMINI_MODEL_ID || 'gemini-2.0-flash-exp';
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelClient = genAI.getGenerativeModel({ model: geminiModelId });

    const result = await modelClient.generateContent(prompt);
    const text =
      result?.response?.text?.() ||
      result?.response?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ||
      '';

    // OpenAI 互換レスポンス
    res.json({
      id: 'chatcmpl-' + Math.random().toString(16).slice(2),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
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

app.listen(PORT, () => {
  console.log(`Agent API on http://localhost:${PORT}`);
});
