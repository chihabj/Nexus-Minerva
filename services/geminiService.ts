
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Uses Gemini AI to suggest mappings between CSV headers and database fields
 * Used in ImportData for smart column mapping
 */
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
