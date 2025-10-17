// src/pages/api/ai/chat.ts
import type { NextApiRequest, NextApiResponse } from "next";

type Data = {
  message?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: "No input provided" });
    }

    // Agent API (http://localhost:4111) にリクエストを中継
    const agentUrl = process.env.AGENT_API_URL || "http://localhost:4111";
    const endpoint = `${agentUrl}/v1/chat/completions`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: input,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Agent API error:", text);
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    // OpenAI互換レスポンスから message を取得
    const message = data?.choices?.[0]?.message?.content || "No output";

    return res.status(200).json({ message });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: err.message });
  }
}
