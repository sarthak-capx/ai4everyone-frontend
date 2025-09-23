import { API_ENDPOINTS } from '../config';

// Endpoint mapping for categories
export const ENDPOINTS = {
    'Text': API_ENDPOINTS.CHAT_COMPLETIONS,
    'Image': API_ENDPOINTS.COMPLETIONS,
    'Video': API_ENDPOINTS.COMPLETIONS,
    'Audio': API_ENDPOINTS.COMPLETIONS,
    'Audio-to-Audio': API_ENDPOINTS.COMPLETIONS,
    'Image-to-3D': API_ENDPOINTS.COMPLETIONS,
    'Image-to-Image': API_ENDPOINTS.COMPLETIONS,
    'Image-to-Video': API_ENDPOINTS.COMPLETIONS,
    'Audio-to-Text': API_ENDPOINTS.COMPLETIONS,
    'Video-to-Video': API_ENDPOINTS.COMPLETIONS
} as const;

// Parameter definitions for each category
export const PARAMS: Record<string, Array<{ name: string; type: string; required: boolean; description: string }>> = {
    'Text': [
        { name: 'model', type: 'string', required: true, description: 'The specific model identifier' },
        { name: 'messages', type: 'array', required: true, description: 'Array of message objects with role (user/assistant) and content' },
        { name: 'max_tokens', type: 'integer', required: false, description: 'Maximum number of tokens in the response (default: 1000)' },
        { name: 'temperature', type: 'float', required: false, description: 'Controls randomness (0.0-2.0, higher = more creative, default: 0.7)' }
    ],
    'Image': [
        { name: 'prompt', type: 'string', required: true, description: 'Text description of the image to generate' },
        { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels" for image generation' },
        { name: 'appId', type: 'string', required: true, description: 'The specific image generation model to use' },
        { name: 'max_tokens', type: 'integer', required: false, description: 'For API compatibility (not used by image models)' },
        { name: 'temperature', type: 'float', required: false, description: 'Controls creativity and randomness (0.0-1.0)' }
    ],
    'Video': [
        { name: 'prompt', type: 'string', required: true, description: 'Text description of the video to generate' },
        { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels" for video generation' },
        { name: 'appId', type: 'string', required: true, description: 'The specific video generation model to use' },
        { name: 'max_tokens', type: 'integer', required: false, description: 'For API compatibility (not used by video models)' },
        { name: 'temperature', type: 'float', required: false, description: 'Controls creativity and randomness (0.0-1.0)' }
    ],
    'Audio': [
        { name: 'text', type: 'string', required: true, description: 'Text to convert to audio (for TTS) or audio description' },
        { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels" for audio generation' },
        { name: 'appId', type: 'string', required: true, description: 'The specific audio model to use' },
        { name: 'voice', type: 'string', required: false, description: 'Voice selection (for TTS models)' },
        { name: 'stability', type: 'float', required: false, description: 'Voice stability (0.0-1.0, for TTS)' },
        { name: 'similarity_boost', type: 'float', required: false, description: 'Voice similarity boost (0.0-1.0, for TTS)' },
        { name: 'speed', type: 'float', required: false, description: 'Speech speed multiplier (for TTS)' },
        { name: 'duration_seconds', type: 'integer', required: false, description: 'Duration in seconds (for sound effects)' }
    ],
    'Audio-to-Audio': [
        { name: 'audio_url', type: 'string', required: true, description: 'URL or base64 of the input audio' },
        { name: 'tags', type: 'string', required: true, description: 'Tags for the audio transformation' },
        { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
        { name: 'appId', type: 'string', required: true, description: 'The specific audio-to-audio model to use' }
    ],
    'Image-to-3D': [
        { name: 'input_image_url', type: 'string', required: true, description: 'URL or base64 of the input image' },
        { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels" for 3D generation' },
        { name: 'appId', type: 'string', required: true, description: 'The specific 3D generation model to use' }
    ],
    'Image-to-Image': [
        { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
        { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels" for image-to-image' },
        { name: 'appId', type: 'string', required: true, description: 'The specific image-to-image model to use' },
        { name: 'prompt', type: 'string', required: false, description: 'Text description for the transformation (if supported)' }
    ],
    'Image-to-Video': [
        { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
        { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels" for image-to-video' },
        { name: 'appId', type: 'string', required: true, description: 'The specific image-to-video model to use' },
        { name: 'prompt', type: 'string', required: false, description: 'Text description for video generation (if supported)' }
    ],
    'Audio-to-Text': [
        { name: 'audio_url', type: 'string', required: true, description: 'URL of the audio file' },
        { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels" for audio-to-text' },
        { name: 'appId', type: 'string', required: true, description: 'The specific speech-to-text model to use' },
        { name: 'language', type: 'string', required: false, description: 'Language code for transcription' }
    ],
    'Video-to-Video': [
        { name: 'video_url', type: 'string', required: true, description: 'URL of the video file' },
        { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels" for video-to-video' },
        { name: 'appId', type: 'string', required: true, description: 'The specific video-to-video model to use' },
        { name: 'prompt', type: 'string', required: false, description: 'Text description for video transformation (if supported)' }
    ]
};

// Model-specific parameter and code overrides (subset moved for brevity)
export const MODEL_OVERRIDES: Record<string, { params: Array<{ name: string; type: string; required: boolean; description: string }>; example: any }> = {
    // Add overrides as needed; default PARAMS/EXAMPLES will be used otherwise
};

// Generic code example generators per category (uses current API endpoints)
export const EXAMPLES = {
    typescript: (endpoint: string, model: string) => `const response = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    model: "${model}",
    messages: [
      { role: "user", content: "What is the meaning of life?" }
    ],
    max_tokens: 1000,
    temperature: 0.7
  })
});
const data = await response.json();
console.log(data.choices?.[0]?.message?.content || data.choices?.[0]?.text);`,

    python: (endpoint: string, model: string) => `import requests
response = requests.post(
  "${endpoint}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "model": "${model}",
    "messages": [
      {"role": "user", "content": "What is the meaning of life?"}
    ],
    "max_tokens": 1000,
    "temperature": 0.7
  }
)

data = response.json()
print(data.get("choices", [{}])[0].get("message", {}).get("content", data.get("choices", [{}])[0].get("text")))`,

    curl: (endpoint: string, model: string) => `curl ${endpoint} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "${model}",
    "messages": [
      {"role": "user", "content": "What is the meaning of life?"}
    ],
    "max_tokens": 1000,
    "temperature": 0.7
  }'`
}; 