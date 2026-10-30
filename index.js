import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash'];
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function extractText(resp) {
  const text =
    resp?.text ??
    resp?.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
    resp?.candidates?.[0]?.content?.parts?.[0]?.text ??
    resp?.response?.candidates?.[0]?.content?.text;

  return typeof text === 'string' ? text : '';
}

function modelError(resp) {
  return resp?.error?.message || resp?.response?.error?.message || '';
}

async function generateReply(contents) {
  let lastError = 'Model sedang sibuk. Coba lagi sebentar.';

  for (const model of MODELS) {
    try {
      const resp = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction:
            'Kamu adalah YP-AI-Assistant, asisten chatbot yang ramah dan jelas. Balas dalam bahasa yang sama dengan pengguna. Gunakan markdown (judul, daftar, dan blok kode) saat menjelaskan sesuatu.',
        },
      });

      const apiError = modelError(resp);
      const text = extractText(resp);
      if (apiError || !text.trim()) {
        lastError = apiError || lastError;
        continue;
      }

      return text;
    } catch (err) {
      lastError = err.message || lastError;
    }
  }

  const error = new Error(lastError);
  error.status = 503;
  throw error;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages are required.' });
    }

    const contents = messages
      .filter((msg) => msg && typeof msg.text === 'string' && msg.text.trim())
      .map((msg) => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }],
      }));

    if (contents.length === 0) {
      return res.status(400).json({ error: 'Messages are required.' });
    }

    const result = await generateReply(contents);
    res.json({ result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server ready on http://localhost:${PORT}`);
});
