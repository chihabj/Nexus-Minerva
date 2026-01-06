
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getSmartMappingSuggestions = async (csvHeaders: string[], dbFields: string[]) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Suggest mappings between these CSV headers: [${csvHeaders.join(', ')}] and these database fields: [${dbFields.join(', ')}].`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            dbField: { type: Type.STRING },
            csvColumn: { type: Type.STRING },
            confidence: { type: Type.STRING, enum: ['High', 'Low', 'None'] }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || '[]');
};

export const getSmartReplySuggestions = async (chatHistory: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on this chat history, suggest 3 quick professional replies for a technical service agent: ${chatHistory}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  return JSON.parse(response.text || '[]');
};
