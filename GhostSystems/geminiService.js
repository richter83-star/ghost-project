import axios from 'axios';
import config from './config.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
  };
}

function extractTextCandidate(response) {
  const text = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return '';
  return text.replace(/^\s*["']|["']\s*$/g, '').trim();
}

async function generateDescription(jobData) {
  const userPieces = [
    `Title: ${jobData.title}`,
    `Product Type: ${jobData.productType}`,
  ];
  if (jobData.description) {
    userPieces.push(`Existing Description: ${jobData.description}`);
  }
  const userQuery = userPieces.join('\n');

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: {
      parts: [{ text: config.gemini.descriptionPrompt }],
    },
  };

  try {
    const response = await axios.post(
      `${GEMINI_BASE_URL}/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`,
      payload,
      { headers: buildHeaders() }
    );
    const text = extractTextCandidate(response);
    if (!text) throw new Error('Empty description returned by Gemini');
    return text;
  } catch (error) {
    const message = error?.response?.data?.error?.message || error.message;
    console.error(`[GhostSystems][Gemini] Failed to generate description: ${message}`);
    throw new Error(message);
  }
}

async function generateImage(prompt) {
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  };

  try {
    const response = await axios.post(
      `${GEMINI_BASE_URL}/models/${config.gemini.imageModel}:generateContent?key=${config.gemini.apiKey}`,
      payload,
      { headers: buildHeaders() }
    );

    const inlineData = response?.data?.candidates?.[0]?.content?.parts?.find(
      (part) => part.inline_data || part.inlineData
    );
    const base64 = inlineData?.inline_data?.data || inlineData?.inlineData?.data;
    if (!base64) {
      throw new Error('Imagen did not return inline image data');
    }
    return base64;
  } catch (error) {
    const message = error?.response?.data?.error?.message || error.message;
    console.error(`[GhostSystems][Gemini] Failed to generate image: ${message}`);
    throw new Error(message);
  }
}

export { generateDescription, generateImage };
export default { generateDescription, generateImage };
