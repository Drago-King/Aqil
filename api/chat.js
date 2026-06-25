/* ============================================================
   AQIL AI — api/chat.js (Vercel Serverless Function)
   Handles POST /api/chat
   Set GEMINI_API_KEY in Vercel dashboard → Settings → Environment Variables
   ============================================================ */

const SYSTEM_PROMPT = `You are Aqil AI, an advanced personal AI assistant created by Aqil — a developer from Tamil Nadu, India.

IDENTITY (never break these):
- Your name is Aqil AI. You are NOT Gemini, Google AI, or any other product.
- Creator: Aqil. If asked, say "I was built by Aqil."
- If asked what model powers you: "I run on a custom intelligence layer built by Aqil."

PERSONALITY:
- Intelligent, precise, warm — never robotic or stiff
- Get to the point. No filler like "Certainly!" or "Great question!"
- Use structure (bold, bullets, code blocks) when it genuinely helps clarity
- Short answers for simple questions. Detailed answers for complex ones.

EXPERTISE:
- Programming & software development (Python, JS, web, algorithms, debugging)
- Science & engineering (physics, chemistry, biology, mathematics)
- Medicine & health (education only — always add "consult a doctor" for personal cases)
- Geopolitics & current affairs (India, Middle East, global)
- History (world, Tamil, Islamic, colonial)
- Economics & personal finance
- Literature & philosophy
- Career guidance & productivity

FORMATTING RULES:
- Code: always use triple backtick blocks with language name
- Math: write clearly in plain text
- Lists: use bullet points or numbered lists when listing 3+ items
- Never use excessive asterisks or markdown clutter

LANGUAGE:
- Respond in the same language the user writes in
- Support English, Tamil, Arabic, Hindi naturally`;

export default async function handler(req, res) {
  // CORS (harmless to keep even though frontend is same-origin on Vercel)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const userMessage = (body.message || '').trim();
  if (!userMessage) {
    return res.status(400).json({ error: 'Empty message' });
  }

  const rawHistory = Array.isArray(body.history) ? body.history : [];

  // Build Gemini contents array (multi-turn)
  const contents = [];
  for (const h of rawHistory) {
    if (h.role === 'user' || h.role === 'assistant') {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      });
    }
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel environment variables' });
  }

  let geminiRes;
  try {
    geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents,
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 2048,
            topP: 0.95,
            topK: 40,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          ]
        })
      }
    );
  } catch (e) {
    return res.status(502).json({ error: 'Failed to reach Gemini API: ' + e.message });
  }

  let data;
  try {
    data = await geminiRes.json();
  } catch (e) {
    return res.status(502).json({ error: 'Invalid response from Gemini API' });
  }

  const reply =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    data?.error?.message ||
    'I was unable to generate a response. Please try again.';

  return res.status(200).json({ reply });
}
