import { API_ENDPOINTS } from "../config";

export const codeCurl = `# ===== TEXT GENERATION (Language Models) =====
# Generate text responses using language models like Llama, Mistral, etc.
curl ${API_ENDPOINTS.CHAT_COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-api-key-here" \\
  -d '{
    "model": "meta-llama/llama-3.1-8b-instruct/fp-16",
    "messages": [
      {"role": "user", "content": "What is the meaning of life?"}
    ],
    "max_tokens": 1000,
    "temperature": 0.7
  }'

# ===== IMAGE GENERATION =====
# Generate images from text descriptions using models like Fast-SDXL, Ideogram, etc.
curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-api-key-here" \\
  -d '{
    "prompt": "A beautiful sunset over mountains, digital art style",
    "max_tokens": 1000,
    "temperature": 0.7,
    "provider": "capx_ivmodels",
    "appId": "fal-ai/fast-sdxl"
  }'

# ===== VIDEO GENERATION =====
# Generate videos from text descriptions using models like Veo2, Dream Machine, etc.
curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-api-key-here" \\
  -d '{
    "prompt": "A cat playing in a garden, cinematic style",
    "max_tokens": 1000,
    "temperature": 0.7,
    "provider": "capx_ivmodels",
    "appId": "fal-ai/veo2"
  }'`;