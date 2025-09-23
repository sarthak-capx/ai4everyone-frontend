import { API_ENDPOINTS } from "../config";

export const codeTypeScript = `// Get started with just a few lines of code. Here's how you can use your API key to generate responses using powerful models.

// ===== TEXT GENERATION (Language Models) =====
// Generate text responses using language models like Llama, Mistral, etc.
const response = await fetch("${API_ENDPOINTS.CHAT_COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer your-api-key-here"
  },
  body: JSON.stringify({
    model: "meta-llama/llama-3.1-8b-instruct/fp-16",
    messages: [
      {
        role: "user",
        content: "What is the meaning of life?"
      }
    ],
    max_tokens: 1000,
    temperature: 0.7
  })
});

const data = await response.json();
        if (process.env.NODE_ENV !== 'production') {
          console.log(data.choices[0].message.content);
        }

// ===== IMAGE GENERATION =====
// Generate images from text descriptions using models like Fast-SDXL, Ideogram, etc.
const imageResponse = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer your-api-key-here"
  },
  body: JSON.stringify({
    prompt: "A beautiful sunset over mountains, digital art style",
    max_tokens: 1000,
    temperature: 0.7,
    provider: "capx_ivmodels",
    appId: "fal-ai/fast-sdxl"
  })
});

const imageData = await imageResponse.json();
        if (process.env.NODE_ENV !== 'production') {
          console.log("Image URL:", imageData.choices[0].text);
        }

// ===== VIDEO GENERATION =====
// Generate videos from text descriptions using models like Veo2, Dream Machine, etc.
const videoResponse = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer your-api-key-here"
  },
  body: JSON.stringify({
    prompt: "A cat playing in a garden, cinematic style",
    max_tokens: 1000,
    temperature: 0.7,
    provider: "capx_ivmodels",
    appId: "fal-ai/veo2"
  })
});

const videoData = await videoResponse.json();
        if (process.env.NODE_ENV !== 'production') {
          console.log("Video URL:", videoData.choices[0].text);
        }`
    ;