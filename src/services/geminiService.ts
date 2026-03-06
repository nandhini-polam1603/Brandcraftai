import { GoogleGenAI, Type } from "@google/genai";

// Access the API key from environment variables
const apiKey = process.env.GEMINI_API_KEY || "";
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
  console.log("Calling Gemini API for brand assets generation...");
  
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
      tools: [{ googleSearch: {} }], // Using Google Search grounding for better real-world context
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
                availabilityNotes: { type: Type.STRING, description: "Notes on uniqueness or search presence" }
              },
              required: ["name", "availabilityNotes"]
            },
            description: "5 creative brand names with availability context",
          },
          taglines: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3 catchy taglines",
          },
          description: {
            type: Type.STRING,
            description: "A short, compelling brand description",
          },
          logoPrompt: {
            type: Type.STRING,
            description: "A detailed prompt for an image generation model to create a logo",
          },
          socialMediaCaption: {
            type: Type.STRING,
            description: "An engaging social media caption for a launch post",
          },
          toneAnalysis: {
            type: Type.OBJECT,
            properties: {
              sentiment: { type: Type.STRING },
              tone: { type: Type.STRING },
              keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ["sentiment", "tone", "keywords"],
          },
        },
        required: ["brandNames", "taglines", "description", "logoPrompt", "socialMediaCaption", "toneAnalysis"],
      },
    },
  });

  console.log("Gemini API response received successfully.");
  return JSON.parse(response.text || "{}");
};

export const generateLogoImage = async (logoPrompt: string): Promise<string | null> => {
  console.log("Calling Gemini Image API for logo generation...");
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
