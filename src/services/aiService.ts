import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in the environment.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export const improveText = async (text: string, action: 'polish' | 'summarize' | 'expand' | 'fix') => {
  const ai = getAI();
  const prompts = {
    polish: "Improve the following text, making it more professional and clear, while keeping its original meaning: ",
    summarize: "Summarize the following text while keeping all key points: ",
    expand: "Expand the following notes into a more detailed and structured text: ",
    fix: "Fix grammar and spelling mistakes in the following text: "
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `${prompts[action]} "${text}"`,
    });
    return response.text || text;
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
};
