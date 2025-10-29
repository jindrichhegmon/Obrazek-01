
import { GoogleGenAI, Modality, GenerateContentResponse, Part } from "@google/genai";

export type ImageData = {
  base64Data: string;
  mimeType: string;
};

export type GeneratedImageData = {
  base64Data: string;
  mimeType: string;
}

export const editImageWithGemini = async (
  originalImage: ImageData,
  prompt: string,
  backgroundImage?: ImageData,
  aspectRatio: string = 'original'
): Promise<GeneratedImageData> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const parts: Part[] = [
      {
        inlineData: {
          data: originalImage.base64Data,
          mimeType: originalImage.mimeType,
        },
      },
    ];

    if (backgroundImage) {
      parts.push({
        inlineData: {
          data: backgroundImage.base64Data,
          mimeType: backgroundImage.mimeType,
        },
      });
    }

    let instruction = "\n\nPlease preserve the aspect ratio of the first image.";
    if (aspectRatio === '16:9' || aspectRatio === '4:3') {
        instruction = `\n\nPlease generate the output image with a ${aspectRatio} aspect ratio.`
    }
    const finalPrompt = `${prompt}${instruction}`;
    parts.push({ text: finalPrompt });
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
        return {
            base64Data: part.inlineData.data,
            mimeType: part.inlineData.mimeType
        };
      }
    }

    throw new Error("No image was generated. The model may not have been able to fulfill the request. Please try a different prompt.");
  } catch (error) {
    console.error("Error editing image with Gemini:", error);
    if (error instanceof Error) {
        return Promise.reject(new Error(error.message));
    }
    return Promise.reject(new Error("An unknown error occurred during image generation."));
  }
};
