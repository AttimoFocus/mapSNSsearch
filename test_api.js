import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'こんにちは',
      config: {
        tools: [{ googleSearch: {} }],
      }
    });
    console.log("Success:", response.text);
  } catch (e) {
    console.log("Error:", e.message);
    if (e.status) console.log("Status:", e.status);
    console.log(JSON.stringify(e, null, 2));
  }
}
test();
