import { API_ENDPOINTS } from "../config";

export const codePython = `import requests

# ===== TEXT GENERATION (Language Models) =====
# Generate text responses using language models like Llama, Mistral, etc.
response = requests.post(
  "${API_ENDPOINTS.CHAT_COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer your-api-key-here"
  },
  json={
    "model": "meta-llama/llama-3.1-8b-instruct/fp-16",
    "messages": [
      {"role": "user", "content": "What is the meaning of life?"}
    ],
    "max_tokens": 1000,
    "temperature": 0.7
  }
)

data = response.json()
print("Text Response:", data["choices"][0]["message"]["content"])

# ===== IMAGE GENERATION =====
# Generate images from text descriptions using models like Fast-SDXL, Ideogram, etc.
image_response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer your-api-key-here"
  },
  json={
    "prompt": "A beautiful sunset over mountains, digital art style",
    "max_tokens": 1000,
    "temperature": 0.7,
    "provider": "capx_ivmodels",
    "appId": "fal-ai/fast-sdxl"
  }
)

image_data = image_response.json()
print("Image URL:", image_data["choices"][0]["text"])

# ===== VIDEO GENERATION =====
# Generate videos from text descriptions using models like Veo2, Dream Machine, etc.
video_response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer your-api-key-here"
  },
  json={
    "prompt": "A cat playing in a garden, cinematic style",
    "max_tokens": 1000,
    "temperature": 0.7,
    "provider": "capx_ivmodels",
    "appId": "fal-ai/veo2"
  }
)

video_data = video_response.json()
print("Video URL:", video_data["choices"][0]["text"])`;
