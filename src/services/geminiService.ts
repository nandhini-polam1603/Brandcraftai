import { GoogleGenAI, Type } from "@google/genai";

// Access the API key from environment variables
// In AI Studio, process.env.GEMINI_API_KEY is available.
// In local development, Vite's 'define' in vite.config.ts replaces process.env.GEMINI_API_KEY
// We use a safe check to avoid "process is not defined" errors in the browser.
const getApiKey = () => {
  try {
    // Vite's 'define' will replace this entire expression if configured
    const key = process.env.GEMINI_API_KEY;
    if (key) return key;
  } catch (e) {
    // process.env might not be defined in some environments
  }
  
  // Fallback to Vite's built-in env handling
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
};

const apiKey = getApiKey();

if (!apiKey) {
  console.warn("Gemini API Key not found. Please set VITE_GEMINI_API_KEY in your .env file.");
} else {
  console.log("Gemini API Key loaded successfully (starts with:", apiKey.substring(0, 6) + "...)");
}

const ai = new GoogleGenAI({ apiKey });

export interface BrandAssets {
  brandNames: { name: string; availabilityNotes: string }[];
  taglines: string[];
  description: string;
  logoPrompt: string;
  socialMediaCaption: string;
  toneAnalysis: {
    sentiment: string;
    tone: string;
    keywords: string[];
  };
}

export const generateBrandAssets = async (businessIdea: string): Promise<BrandAssets> => {
  if (!apiKey) {
    throw new Error("Gemini API Key not found. Please check your environment variables.");
  }

  console.log("Calling Gemini API for brand assets generation...");
  console.log("API Key present:", !!apiKey);
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate branding assets for the following business idea: "${businessIdea}". 
      1. Provide 5 creative brand names. For each name, provide a short note on potential availability or uniqueness based on common knowledge.
      2. Provide 3 catchy taglines.
      3. Provide a short, compelling brand description.
      4. Provide a detailed prompt for an image generation model to create a logo.
      5. Provide an engaging social media caption for a launch post.
      6. Perform a tone and sentiment analysis.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brandNames: {
              type: Type.ARRAY,
              items: { 
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  availabilityNotes: { type: Type.STRING }
                },
                required: ["name", "availabilityNotes"]
              }
            },
            taglines: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            description: { type: Type.STRING },
            logoPrompt: { type: Type.STRING },
            socialMediaCaption: { type: Type.STRING },
            toneAnalysis: {
              type: Type.OBJECT,
              properties: {
                sentiment: { type: Type.STRING },
                tone: { type: Type.STRING },
                keywords: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["sentiment", "tone", "keywords"]
            }
          },
          required: ["brandNames", "taglines", "description", "logoPrompt", "socialMediaCaption", "toneAnalysis"]
        }
      }
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("No response generated. This might be due to safety filters or an invalid prompt.");
    }

    let text = response.text || "{}";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateLogoImage = async (logoPrompt: string): Promise<string | null> => {
  console.log("Calling Gemini Image API for logo generation...");
  console.log("API Key present:", !!apiKey);
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: `Create a professional, modern logo based on this prompt: ${logoPrompt}. Minimalist, high quality, vector style, clean background.` }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        console.log("Logo image generated successfully.");
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error("Error generating logo image via API:", error);
  }
  return null;
};
