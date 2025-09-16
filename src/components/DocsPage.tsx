import React, { useState, useEffect } from 'react';
import { Copy, ExternalLink, Home, Box, Cpu, BarChart2, Key, Settings, FileText, LogOut, ChevronDown, ChevronRight, Code, Info, AlertCircle, CheckCircle } from 'lucide-react';
import { secureClipboardCopy } from '../utils/secureClipboard';
import { Highlight, themes } from 'prism-react-renderer';
import '../styles/DocsPage.css';
import '../styles/TopSection.css';
import { API_ENDPOINTS } from '../config';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from './UserContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDisconnect } from 'wagmi';
import { secureStorage } from '../utils/secureStorage';
import Logger from '../utils/logger';
import { safeNavigate } from '../utils/validation';
import { MODEL_OPTIONS } from '../models';

// Helper: Extract category from label
const extractCategory = (label) => {
  const match = label.match(/\(([^)]+)\)$/);
  return match ? match[1] : 'Other';
};

// Helper: Group models by category
const groupModelsByCategory = (models) => {
  const grouped = {};
  models.forEach((model) => {
    const category = extractCategory(model.label);
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(model);
  });
  return grouped;
};

// Parameter definitions for each category
const PARAMS = {
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

// Endpoint mapping
const ENDPOINTS = {
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
};

// Example payloads for code generation
const EXAMPLES = {
  'Text': {
    typescript: (model) => `const response = await fetch("${API_ENDPOINTS.CHAT_COMPLETIONS}", {
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
        if (process.env.NODE_ENV !== 'production') {
          console.log(data.choices[0].message.content);
        }`,
    python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.CHAT_COMPLETIONS}",
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
print(data["choices"][0]["message"]["content"])`,
    curl: (model) => `curl ${API_ENDPOINTS.CHAT_COMPLETIONS} \
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
  },
  'Image': {
    typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    prompt: "A beautiful sunset over mountains",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
        if (process.env.NODE_ENV !== 'production') {
          console.log("Image URL:", data.choices[0].text);
        }`,
    python: (model) => `import requests
image_response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "prompt": "A beautiful sunset over mountains",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
image_data = image_response.json()
print("Image URL:", image_data["choices"][0]["text"])
`,
    curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
  },
  'Video': {
    typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    prompt: "A robot walking in a futuristic city",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video URL:", data.choices[0].text);`,
    python: (model) => `import requests
video_response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "prompt": "A robot walking in a futuristic city",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
video_data = video_response.json()
print("Video URL:", video_data["choices"][0]["text"])
`,
    curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "prompt": "A robot walking in a futuristic city",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
  },
  'Audio': {
    typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    text: "Hello, world!",
    provider: "capx_ivmodels",
    appId: "${model}",
    voice: "Aria",
    stability: 0.5,
    similarity_boost: 0.75,
    speed: 1
  })
});
const data = await response.json();
console.log("Audio URL:", data.choices[0].text);`,
    python: (model) => `import requests
audio_response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "text": "Hello, world!",
    "provider": "capx_ivmodels",
    "appId": "${model}",
    "voice": "Aria",
    "stability": 0.5,
    "similarity_boost": 0.75,
    "speed": 1
  }
)
audio_data = audio_response.json()
print("Audio URL:", audio_data["choices"][0]["text"])
`,
    curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "text": "Hello, world!",
    "provider": "capx_ivmodels",
    "appId": "${model}",
    "voice": "Aria",
    "stability": 0.5,
    "similarity_boost": 0.75,
    "speed": 1
  }'`
  },
  'Audio-to-Audio': {
    typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    audio_url: "https://your-storage.com/audio.wav",
    tags: "lofi, chill",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Audio Output URL:", data.choices[0].text);`,
    python: (model) => `import requests
audio_response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "audio_url": "https://your-storage.com/audio.wav",
    "tags": "lofi, chill",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
audio_data = audio_response.json()
print("Audio Output URL:", audio_data["choices"][0]["text"])
`,
    curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "audio_url": "https://your-storage.com/audio.wav",
    "tags": "lofi, chill",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
  },
  'Image-to-3D': {
    typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    input_image_url: "https://your-storage.com/image.png",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("3D Model URL:", data.choices[0].text);`,
    python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "input_image_url": "https://your-storage.com/image.png",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("3D Model URL:", data["choices"][0]["text"])
`,
    curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "input_image_url": "https://your-storage.com/image.png",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
  },
  'Image-to-Image': {
    typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_file_base64: "BASE64_IMAGE_STRING",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Image Output URL:", data.choices[0].text);`,
    python: (model) => `import requests
image_response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_file_base64": "BASE64_IMAGE_STRING",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
image_data = image_response.json()
print("Image Output URL:", image_data["choices"][0]["text"])
`,
    curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "image_file_base64": "BASE64_IMAGE_STRING",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
  },
  'Image-to-Video': {
    typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_file_base64: "BASE64_IMAGE_STRING",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video Output URL:", data.choices[0].text);`,
    python: (model) => `import requests
video_response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_file_base64": "BASE64_IMAGE_STRING",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
video_data = video_response.json()
print("Video Output URL:", video_data["choices"][0]["text"])
`,
    curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "image_file_base64": "BASE64_IMAGE_STRING",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
  },
  'Audio-to-Text': {
    typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    audio_file_base64: "BASE64_AUDIO_STRING",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Transcription:", data.choices[0].text);`,
    python: (model) => `import requests
audio_response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "audio_file_base64": "BASE64_AUDIO_STRING",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
audio_data = audio_response.json()
print("Transcription:", audio_data["choices"][0]["text"])
`,
    curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "audio_file_base64": "BASE64_AUDIO_STRING",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
  },
  'Video-to-Video': {
    typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    video_file_base64: "BASE64_VIDEO_STRING",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video Output URL:", data.choices[0].text);`,
    python: (model) => `import requests
video_response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "video_file_base64": "BASE64_VIDEO_STRING",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
video_data = video_response.json()
print("Video Output URL:", video_data["choices"][0]["text"])
`,
    curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "video_file_base64": "BASE64_VIDEO_STRING",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
  }
};

// Model-specific parameter and code overrides
const MODEL_OVERRIDES = {
  // MISSING MODEL: chain-of-zoom (Image-to-Image)
  'chain-of-zoom': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description for the zoom effect' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "chain-of-zoom"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "Create a zoom effect on this image",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Processed Image URL:", data.images?.[0]?.url || data.images?.[0]);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Create a zoom effect on this image",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Processed Image URL:", data["images"][0]["url"] if data["images"] else data["images"][0])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Create a zoom effect on this image",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // MISSING MODEL: recraft/vectorize (Image-to-Image)
  'recraft/vectorize': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image to vectorize' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "recraft/vectorize"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Vectorized Image URL:", data.images?.[0]?.url || data.images?.[0]);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Vectorized Image URL:", data["images"][0]["url"] if data["images"] else data["images"][0])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // MISSING MODEL: gpt-image-1/edit-image/byok (Image-to-Image)
  'gpt-image-1/edit-image/byok': {
    params: [
      { name: 'image_urls', type: 'array', required: true, description: 'Array of image URLs to edit' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the edit to perform' },
      { name: 'openai_api_key', type: 'string', required: true, description: 'Your OpenAI API key' },
      { name: 'image_size', type: 'string', required: false, description: 'Image size (default: "auto")' },
      { name: 'num_images', type: 'integer', required: false, description: 'Number of images to generate (default: 1)' },
      { name: 'quality', type: 'string', required: false, description: 'Image quality (default: "auto")' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "gpt-image-1/edit-image/byok"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_urls: ["https://images.unsplash.com/photo-1506744038136-46273834b3fb"],
    prompt: "Add a sunset sky to this image",
    openai_api_key: "YOUR_OPENAI_API_KEY",
    image_size: "auto",
    num_images: 1,
    quality: "auto",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Edited Image URL:", data.images?.[0]?.url || data.images?.[0]);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_urls": ["https://images.unsplash.com/photo-1506744038136-46273834b3fb"],
    "prompt": "Add a sunset sky to this image",
    "openai_api_key": "YOUR_OPENAI_API_KEY",
    "image_size": "auto",
    "num_images": 1,
    "quality": "auto",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Edited Image URL:", data["images"][0]["url"] if data["images"] else data["images"][0])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_urls": ["https://images.unsplash.com/photo-1506744038136-46273834b3fb"],
    "prompt": "Add a sunset sky to this image",
    "openai_api_key": "YOUR_OPENAI_API_KEY",
    "image_size": "auto",
    "num_images": 1,
    "quality": "auto",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // MISSING MODEL: plushify (Image-to-Image)
  'plushify': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'enable_safety_checker', type: 'boolean', required: false, description: 'Enable safety checker (default: true)' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "plushify"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    enable_safety_checker: true,
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Plushified Image URL:", data.images?.[0]?.url || data.images?.[0]);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "enable_safety_checker": True,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Plushified Image URL:", data["images"][0]["url"] if data["images"] else data["images"][0])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "enable_safety_checker": true,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // MISSING MODEL: ghiblify (Image-to-Image)
  'ghiblify': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'enable_safety_checker', type: 'boolean', required: false, description: 'Enable safety checker (default: true)' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "ghiblify"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    enable_safety_checker: true,
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Ghibli-style Image URL:", data.images?.[0]?.url || data.images?.[0]);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "enable_safety_checker": True,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Ghibli-style Image URL:", data["images"][0]["url"] if data["images"] else data["images"][0])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "enable_safety_checker": true,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // MISSING MODEL: hunyuan-video-image-to-video (Image-to-Video)
  'hunyuan-video-image-to-video': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the video to generate' },
      { name: 'aspect_ratio', type: 'string', required: false, description: 'Aspect ratio (default: "16:9")' },
      { name: 'resolution', type: 'string', required: false, description: 'Resolution (default: "720p")' },
      { name: 'num_frames', type: 'string', required: false, description: 'Number of frames (default: "129")' },
      { name: 'i2v_stability', type: 'boolean', required: false, description: 'Image-to-video stability (default: false)' },
      { name: 'seed', type: 'integer', required: false, description: 'Random seed' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "hunyuan-video-image-to-video"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "A person walking through a beautiful landscape",
    aspect_ratio: "16:9",
    resolution: "720p",
    num_frames: "129",
    i2v_stability: false,
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "aspect_ratio": "16:9",
    "resolution": "720p",
    "num_frames": "129",
    "i2v_stability": False,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "aspect_ratio": "16:9",
    "resolution": "720p",
    "num_frames": "129",
    "i2v_stability": false,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // AUDIO MODELS
  'ace-step': {
    params: [
      { name: 'tags', type: 'string', required: true, description: 'Music tags (e.g., "lofi, hiphop, drum and bass, trap, chill")' },
      { name: 'lyrics', type: 'string', required: true, description: 'Lyrics for the song' },
      { name: 'duration', type: 'integer', required: true, description: 'Duration in seconds' },
      { name: 'number_of_steps', type: 'integer', required: true, description: 'Number of inference steps' },
      { name: 'scheduler', type: 'string', required: true, description: 'Scheduler type (e.g., "euler")' },
      { name: 'guidance_type', type: 'string', required: true, description: 'Guidance type (e.g., "apg")' },
      { name: 'granularity_scale', type: 'integer', required: true, description: 'Granularity scale' },
      { name: 'guidance_interval', type: 'float', required: true, description: 'Guidance interval' },
      { name: 'guidance_interval_decay', type: 'integer', required: true, description: 'Guidance interval decay' },
      { name: 'guidance_scale', type: 'integer', required: true, description: 'Guidance scale' },
      { name: 'minimum_guidance_scale', type: 'integer', required: true, description: 'Minimum guidance scale' },
      { name: 'tag_guidance_scale', type: 'integer', required: true, description: 'Tag guidance scale' },
      { name: 'lyric_guidance_scale', type: 'float', required: true, description: 'Lyric guidance scale' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "ace-step"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    tags: "lofi, hiphop, drum and bass, trap, chill",
    lyrics: "Create a chill beat with smooth vibes",
    duration: 10,
    number_of_steps: 27,
    scheduler: "euler",
    guidance_type: "apg",
    granularity_scale: 10,
    guidance_interval: 0.5,
    guidance_interval_decay: 0,
    guidance_scale: 15,
    minimum_guidance_scale: 3,
    tag_guidance_scale: 5,
    lyric_guidance_scale: 1.5,
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Audio URL:", data.audio?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "tags": "lofi, hiphop, drum and bass, trap, chill",
    "lyrics": "Create a chill beat with smooth vibes",
    "duration": 10,
    "number_of_steps": 27,
    "scheduler": "euler",
    "guidance_type": "apg",
    "granularity_scale": 10,
    "guidance_interval": 0.5,
    "guidance_interval_decay": 0,
    "guidance_scale": 15,
    "minimum_guidance_scale": 3,
    "tag_guidance_scale": 5,
    "lyric_guidance_scale": 1.5,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Audio URL:", data["audio"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "tags": "lofi, hiphop, drum and bass, trap, chill",
    "lyrics": "Create a chill beat with smooth vibes",
    "duration": 10,
    "number_of_steps": 27,
    "scheduler": "euler",
    "guidance_type": "apg",
    "granularity_scale": 10,
    "guidance_interval": 0.5,
    "guidance_interval_decay": 0,
    "guidance_scale": 15,
    "minimum_guidance_scale": 3,
    "tag_guidance_scale": 5,
    "lyric_guidance_scale": 1.5,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // RESTORED: elevenlabs/tts/multilingual-v2 (HAS backend special handling)
  'elevenlabs/tts/multilingual-v2': {
    params: [
      { name: 'text', type: 'string', required: true, description: 'Text to convert to speech' },
      { name: 'voice', type: 'string', required: false, description: 'Voice to use (default: "Aria")' },
      { name: 'stability', type: 'float', required: false, description: 'Voice stability (0.0-1.0)' },
      { name: 'similarity_boost', type: 'float', required: false, description: 'Similarity boost (0.0-1.0)' },
      { name: 'speed', type: 'float', required: false, description: 'Speech speed' },
      { name: 'style', type: 'string', required: false, description: 'Voice style' },
      { name: 'timestamps', type: 'boolean', required: false, description: 'Return timestamps' },
      { name: 'previous_text', type: 'string', required: false, description: 'Previous text for context' },
      { name: 'next_text', type: 'string', required: false, description: 'Next text for context' },
      { name: 'language_code', type: 'string', required: false, description: 'Language code' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "elevenlabs/tts/multilingual-v2"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    text: "Hello, this is a test of the ElevenLabs TTS system.",
    voice: "Aria",
    stability: 0.5,
    similarity_boost: 0.75,
    speed: 1,
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Audio URL:", data.audio?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "text": "Hello, this is a test of the ElevenLabs TTS system.",
    "voice": "Aria",
    "stability": 0.5,
    "similarity_boost": 0.75,
    "speed": 1,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Audio URL:", data["audio"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "text": "Hello, this is a test of the ElevenLabs TTS system.",
    "voice": "Aria",
    "stability": 0.5,
    "similarity_boost": 0.75,
    "speed": 1,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // RESTORED: mmaudio-v2/text-to-audio (HAS backend special handling)
  'mmaudio-v2/text-to-audio': {
    params: [
      { name: 'prompt', type: 'string', required: true, description: 'Text description of the audio to generate' },
      { name: 'negative_prompt', type: 'string', required: false, description: 'Negative prompt' },
      { name: 'seed', type: 'integer', required: false, description: 'Random seed' },
      { name: 'num_steps', type: 'integer', required: false, description: 'Number of inference steps' },
      { name: 'duration', type: 'integer', required: false, description: 'Duration in seconds' },
      { name: 'cfg_strength', type: 'float', required: false, description: 'CFG strength' },
      { name: 'mask_away_clip', type: 'boolean', required: false, description: 'Mask away clip' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "mmaudio-v2/text-to-audio"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    prompt: "A gentle rain falling on leaves",
    num_steps: 25,
    duration: 4,
    cfg_strength: 4.5,
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Audio URL:", data.audio?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "prompt": "A gentle rain falling on leaves",
    "num_steps": 25,
    "duration": 4,
    "cfg_strength": 4.5,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Audio URL:", data["audio"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "prompt": "A gentle rain falling on leaves",
    "num_steps": 25,
    "duration": 4,
    "cfg_strength": 4.5,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // MISSING: elevenlabs/sound-effects (HAS backend special handling)
  'elevenlabs/sound-effects': {
    params: [
      { name: 'text', type: 'string', required: true, description: 'Text description of the sound effect to generate' },
      { name: 'duration_seconds', type: 'integer', required: false, description: 'Duration in seconds (default: 5)' },
      { name: 'prompt_influence', type: 'float', required: false, description: 'Prompt influence (default: 0.3)' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "elevenlabs/sound-effects"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    text: "Rain falling on leaves",
    duration_seconds: 5,
    prompt_influence: 0.3,
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Sound Effect URL:", data.audio?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "text": "Rain falling on leaves",
    "duration_seconds": 5,
    "prompt_influence": 0.3,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Sound Effect URL:", data["audio"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "text": "Rain falling on leaves",
    "duration_seconds": 5,
    "prompt_influence": 0.3,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // MISSING: stable-audio (HAS backend special handling)
  'stable-audio': {
    params: [
      { name: 'prompt', type: 'string', required: true, description: 'Text description of the audio to generate' },
      { name: 'seconds_start', type: 'integer', required: false, description: 'Start time in seconds' },
      { name: 'seconds_total', type: 'integer', required: false, description: 'Total duration in seconds (default: 10)' },
      { name: 'steps', type: 'integer', required: false, description: 'Number of steps (default: 100)' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "stable-audio"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    prompt: "Ambient forest sounds with birds chirping",
    seconds_total: 10,
    steps: 100,
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Audio URL:", data.audio?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "prompt": "Ambient forest sounds with birds chirping",
    "seconds_total": 10,
    "steps": 100,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Audio URL:", data["audio"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "prompt": "Ambient forest sounds with birds chirping",
    "seconds_total": 10,
    "steps": 100,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // AUDIO-TO-AUDIO MODELS
  'ace-step/audio-outpaint': {
    params: [
      { name: 'audio_url', type: 'string', required: true, description: 'URL of the input audio file' },
      { name: 'tags', type: 'string', required: true, description: 'Music tags for the extension' },
      { name: 'extend_before_duration', type: 'integer', required: false, description: 'Duration to extend before (default: 0)' },
      { name: 'extend_after_duration', type: 'integer', required: false, description: 'Duration to extend after (default: 30)' },
      { name: 'lyrics', type: 'string', required: false, description: 'Lyrics for the extension' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "ace-step/audio-outpaint"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    audio_url: "https://your-storage.com/audio.wav",
    tags: "lofi, chill, ambient",
    extend_after_duration: 30,
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Extended Audio URL:", data.audio?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "audio_url": "https://your-storage.com/audio.wav",
    "tags": "lofi, chill, ambient",
    "extend_after_duration": 30,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Extended Audio URL:", data["audio"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "audio_url": "https://your-storage.com/audio.wav",
    "tags": "lofi, chill, ambient",
    "extend_after_duration": 30,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'ace-step/audio-inpaint': {
    params: [
      { name: 'audio_url', type: 'string', required: true, description: 'URL of the input audio file' },
      { name: 'tags', type: 'string', required: true, description: 'Music tags for the inpainting' },
      { name: 'start_time', type: 'integer', required: false, description: 'Start time for inpainting (default: 0)' },
      { name: 'end_time', type: 'integer', required: false, description: 'End time for inpainting (default: 30)' },
      { name: 'lyrics', type: 'string', required: false, description: 'Lyrics for the inpainting' },
      { name: 'variance', type: 'float', required: false, description: 'Variance (default: 0.5)' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "ace-step/audio-inpaint"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    audio_url: "https://your-storage.com/audio.wav",
    tags: "jazz, smooth, saxophone",
    start_time: 10,
    end_time: 20,
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Inpainted Audio URL:", data.audio?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "audio_url": "https://your-storage.com/audio.wav",
    "tags": "jazz, smooth, saxophone",
    "start_time": 10,
    "end_time": 20,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Inpainted Audio URL:", data["audio"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "audio_url": "https://your-storage.com/audio.wav",
    "tags": "jazz, smooth, saxophone",
    "start_time": 10,
    "end_time": 20,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'ace-step/audio-to-audio': {
    params: [
      { name: 'audio_url', type: 'string', required: true, description: 'URL of the input audio file' },
      { name: 'original_tags', type: 'string', required: true, description: 'Tags describing the original audio' },
      { name: 'tags', type: 'string', required: true, description: 'Tags for the target audio style' },
      { name: 'edit_mode', type: 'string', required: false, description: 'Edit mode (default: "remix")' },
      { name: 'original_lyrics', type: 'string', required: false, description: 'Original lyrics' },
      { name: 'lyrics', type: 'string', required: false, description: 'Target lyrics' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "ace-step/audio-to-audio"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    audio_url: "https://your-storage.com/audio.wav",
    original_tags: "pop, upbeat, electronic",
    tags: "lofi, chill, ambient",
    edit_mode: "remix",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Transformed Audio URL:", data.audio?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "audio_url": "https://your-storage.com/audio.wav",
    "original_tags": "pop, upbeat, electronic",
    "tags": "lofi, chill, ambient",
    "edit_mode": "remix",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Transformed Audio URL:", data["audio"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "audio_url": "https://your-storage.com/audio.wav",
    "original_tags": "pop, upbeat, electronic",
    "tags": "lofi, chill, ambient",
    "edit_mode": "remix",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // IMAGE-TO-IMAGE MODELS
  'object-removal': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of what to remove from the image' },
      { name: 'model', type: 'string', required: false, description: 'Model quality (default: "best_quality")' },
      { name: 'mask_expansion', type: 'integer', required: false, description: 'Mask expansion (default: 15)' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "object-removal"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "Remove the person from the image",
    model: "best_quality",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Edited Image URL:", data.images?.[0]?.url || data.images?.[0]);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Remove the person from the image",
    "model": "best_quality",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Edited Image URL:", data["images"][0]["url"] if data["images"] else data["images"][0])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Remove the person from the image",
    "model": "best_quality",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // RESTORED: gemini-flash-edit (HAS backend special handling)
  'gemini-flash-edit': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the edit to perform' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "gemini-flash-edit"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "Make the sky more vibrant and colorful",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Edited Image URL:", data.images?.[0]?.url || data.images?.[0]);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Make the sky more vibrant and colorful",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Edited Image URL:", data["images"][0]["url"] if data["images"] else data["images"][0])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Make the sky more vibrant and colorful",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'codeformer': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'fidelity', type: 'float', required: false, description: 'Fidelity (default: 0.7)' },
      { name: 'upscaling', type: 'integer', required: false, description: 'Upscaling factor (default: 2)' },
      { name: 'aligned', type: 'boolean', required: false, description: 'Whether face is aligned (default: false)' },
      { name: 'only_center_face', type: 'boolean', required: false, description: 'Only process center face (default: false)' },
      { name: 'face_upscale', type: 'boolean', required: false, description: 'Enable face upscaling (default: true)' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "codeformer"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    fidelity: 0.7,
    upscaling: 2,
    face_upscale: true,
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Restored Image URL:", data.images?.[0]?.url || data.images?.[0]);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "fidelity": 0.7,
    "upscaling": 2,
    "face_upscale": True,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Restored Image URL:", data["images"][0]["url"] if data["images"] else data["images"][0])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "fidelity": 0.7,
    "upscaling": 2,
    "face_upscale": true,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'ddcolor': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the black and white input image' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "ddcolor"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Colorized Image URL:", data.images?.[0]?.url || data.images?.[0]);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Colorized Image URL:", data["images"][0]["url"] if data["images"] else data["images"][0])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // IMAGE-TO-VIDEO MODELS
  'kling-video/v2/master/image-to-video': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the video to generate' },
      { name: 'duration', type: 'string', required: false, description: 'Duration (default: "5")' },
      { name: 'negative_prompt', type: 'string', required: false, description: 'Negative prompt' },
      { name: 'cfg_scale', type: 'float', required: false, description: 'CFG scale (default: 0.5)' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "kling-video/v2/master/image-to-video"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "A person walking through a beautiful landscape",
    duration: "5",
    cfg_scale: 0.5,
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "duration": "5",
    "cfg_scale": 0.5,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "duration": "5",
    "cfg_scale": 0.5,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'wan-effects': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'subject', type: 'string', required: true, description: 'Subject description (not prompt)' },
      { name: 'effect_type', type: 'string', required: false, description: 'Effect type (default: "cakeify")' },
      { name: 'num_frames', type: 'integer', required: false, description: 'Number of frames (default: 81)' },
      { name: 'frames_per_second', type: 'integer', required: false, description: 'FPS (default: 16)' },
      { name: 'aspect_ratio', type: 'string', required: false, description: 'Aspect ratio (default: "16:9")' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "wan-effects"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    subject: "a beautiful landscape",
    effect_type: "cakeify",
    num_frames: 81,
    frames_per_second: 16,
    aspect_ratio: "16:9",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "subject": "a beautiful landscape",
    "effect_type": "cakeify",
    "num_frames": 81,
    "frames_per_second": 16,
    "aspect_ratio": "16:9",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "subject": "a beautiful landscape",
    "effect_type": "cakeify",
    "num_frames": 81,
    "frames_per_second": 16,
    "aspect_ratio": "16:9",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'stable-video': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'motion_bucket_id', type: 'integer', required: false, description: 'Motion bucket ID (default: 127)' },
      { name: 'cond_aug', type: 'float', required: false, description: 'Conditioning augmentation (default: 0.02)' },
      { name: 'fps', type: 'integer', required: false, description: 'Frames per second (default: 25)' },
      { name: 'seed', type: 'integer', required: false, description: 'Random seed' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "stable-video"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    motion_bucket_id: 127,
    cond_aug: 0.02,
    fps: 25,
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "motion_bucket_id": 127,
    "cond_aug": 0.02,
    "fps": 25,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "motion_bucket_id": 127,
    "cond_aug": 0.02,
    "fps": 25,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // AUDIO-TO-TEXT MODELS
  'whisper': {
    params: [
      { name: 'audio_url', type: 'string', required: true, description: 'URL of the audio file to transcribe' },
      { name: 'task', type: 'string', required: false, description: 'Task type (default: "transcribe")' },
      { name: 'language', type: 'string', required: false, description: 'Language code' },
      { name: 'diarize', type: 'boolean', required: false, description: 'Enable speaker diarization (default: false)' },
      { name: 'chunk_level', type: 'string', required: false, description: 'Chunk level (default: "segment")' },
      { name: 'version', type: 'string', required: false, description: 'Whisper version (default: "3")' },
      { name: 'batch_size', type: 'integer', required: false, description: 'Batch size (default: 64)' },
      { name: 'prompt', type: 'string', required: false, description: 'Prompt for transcription' },
      { name: 'num_speakers', type: 'integer', required: false, description: 'Number of speakers' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "whisper"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    audio_url: "https://your-storage.com/audio.wav",
    task: "transcribe",
    language: "en",
    diarize: false,
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Transcription:", data.text);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "audio_url": "https://your-storage.com/audio.wav",
    "task": "transcribe",
    "language": "en",
    "diarize": False,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Transcription:", data["text"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "audio_url": "https://your-storage.com/audio.wav",
    "task": "transcribe",
    "language": "en",
    "diarize": false,
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // VIDEO-TO-VIDEO MODELS
  'wan-vace-14b/outpainting': {
    params: [
      { name: 'video_url', type: 'string', required: true, description: 'URL of the input video to outpaint' },
      { name: 'prompt', type: 'string', required: true, description: 'Text description for outpainting' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'The specific video-to-video model to use' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    video_url: "https://your-storage.com/video.mp4",
    prompt: "Expand the scene with a sunset beach",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video Output URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
video_response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "video_url": "https://your-storage.com/video.mp4",
    "prompt": "Expand the scene with a sunset beach",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
video_data = video_response.json()
print("Video Output URL:", video_data["video"]["url"] if video_data["video"] else video_data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "video_url": "https://your-storage.com/video.mp4",
    "prompt": "Expand the scene with a sunset beach",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'wan-vace-14b/inpainting': {
    params: [
      { name: 'video_url', type: 'string', required: true, description: 'URL of the input video' },
      { name: 'mask_video_url', type: 'string', required: true, description: 'URL of the mask video' },
      { name: 'prompt', type: 'string', required: true, description: 'Text description for inpainting' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'The specific video-to-video model to use' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    video_url: "https://your-storage.com/video.mp4",
    mask_video_url: "https://your-storage.com/mask.mp4",
    prompt: "Remove the person from the scene",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video Output URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
video_response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "video_url": "https://your-storage.com/video.mp4",
    "mask_video_url": "https://your-storage.com/mask.mp4",
    "prompt": "Remove the person from the scene",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
video_data = video_response.json()
print("Video Output URL:", video_data["video"]["url"] if video_data["video"] else video_data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "video_url": "https://your-storage.com/video.mp4",
    "mask_video_url": "https://your-storage.com/mask.mp4",
    "prompt": "Remove the person from the scene",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // Image-to-3D models (already correct from previous fix)
  'triposr': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'output_format', type: 'string', required: false, description: 'Output 3D file format (default: "glb")' },
      { name: 'do_remove_background', type: 'boolean', required: false, description: 'Remove background from input image (default: true)' },
      { name: 'foreground_ratio', type: 'float', required: false, description: 'Foreground ratio for segmentation (default: 0.9)' },
      { name: 'mc_resolution', type: 'integer', required: false, description: 'Mesh resolution (default: 256)' },
      { name: 'logs', type: 'boolean', required: false, description: 'Return logs (default: true)' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    appId: "${model}",
    provider: "capx_ivmodels"
  })
});
const data = await response.json();
console.log("3D Model URL:", data.model?.url || data.mesh?.url || data.model_mesh?.url || data.model_url || data.glb?.url || data.obj?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "appId": "${model}",
    "provider": "capx_ivmodels"
  }
)
data = response.json()
print("3D Model URL:", data["model"]["url"] if data["model"] else data["mesh"]["url"] if data["mesh"] else data["model_mesh"]["url"] if data["model_mesh"] else data["model_url"] if data["model_url"] else data["glb"]["url"] if data["glb"] else data["obj"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "appId": "${model}",
    "provider": "capx_ivmodels"
  }'`
    }
  },
  'hunyuan3d-v21': {
    params: [
      { name: 'input_image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'seed', type: 'integer', required: false, description: 'Random seed' },
      { name: 'num_inference_steps', type: 'integer', required: false, description: 'Number of inference steps (default: 50)' },
      { name: 'guidance_scale', type: 'float', required: false, description: 'Guidance scale (default: 7.5)' },
      { name: 'octree_resolution', type: 'integer', required: false, description: 'Octree resolution (default: 256)' },
      { name: 'textured_mesh', type: 'boolean', required: false, description: 'Generate textured mesh (default: false)' },
      { name: 'logs', type: 'boolean', required: false, description: 'Return logs (default: true)' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    input_image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    appId: "${model}",
    provider: "capx_ivmodels"
  })
});
const data = await response.json();
console.log("3D Model URL:", data.model?.url || data.mesh?.url || data.model_mesh?.url || data.model_url || data.glb?.url || data.obj?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "input_image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "appId": "${model}",
    "provider": "capx_ivmodels"
  }
)
data = response.json()
print("3D Model URL:", data["model"]["url"] if data["model"] else data["mesh"]["url"] if data["mesh"] else data["model_mesh"]["url"] if data["model_mesh"] else data["model_url"] if data["model_url"] else data["glb"]["url"] if data["glb"] else data["obj"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "input_image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "appId": "${model}",
    "provider": "capx_ivmodels"
  }'`
    }
  },
  'hunyuan3d/v2': {
    params: [
      { name: 'input_image_url', type: 'string', required: false, description: 'URL of the input image (single view)' },
      { name: 'front_image_url', type: 'string', required: false, description: 'URL of the front view image (multi-view)' },
      { name: 'back_image_url', type: 'string', required: false, description: 'URL of the back view image (multi-view)' },
      { name: 'left_image_url', type: 'string', required: false, description: 'URL of the left view image (multi-view)' },
      { name: 'seed', type: 'integer', required: false, description: 'Random seed' },
      { name: 'num_inference_steps', type: 'integer', required: false, description: 'Number of inference steps (default: 50)' },
      { name: 'guidance_scale', type: 'float', required: false, description: 'Guidance scale (default: 7.5)' },
      { name: 'octree_resolution', type: 'integer', required: false, description: 'Octree resolution (default: 256)' },
      { name: 'textured_mesh', type: 'boolean', required: false, description: 'Generate textured mesh (default: false)' },
      { name: 'logs', type: 'boolean', required: false, description: 'Return logs (default: true)' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    input_image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    appId: "${model}",
    provider: "capx_ivmodels"
  })
});
const data = await response.json();
console.log("3D Model URL:", data.model?.url || data.mesh?.url || data.model_mesh?.url || data.model_url || data.glb?.url || data.obj?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "input_image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "appId": "${model}",
    "provider": "capx_ivmodels"
  }
)
data = response.json()
print("3D Model URL:", data["model"]["url"] if data["model"] else data["mesh"]["url"] if data["mesh"] else data["model_mesh"]["url"] if data["model_mesh"] else data["model_url"] if data["model_url"] else data["glb"]["url"] if data["glb"] else data["obj"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "input_image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "appId": "${model}",
    "provider": "capx_ivmodels"
  }'`
    }
  },
  'hunyuan3d/v2/turbo': {
    params: [
      { name: 'input_image_url', type: 'string', required: false, description: 'URL of the input image (single view)' },
      { name: 'front_image_url', type: 'string', required: false, description: 'URL of the front view image (multi-view)' },
      { name: 'back_image_url', type: 'string', required: false, description: 'URL of the back view image (multi-view)' },
      { name: 'left_image_url', type: 'string', required: false, description: 'URL of the left view image (multi-view)' },
      { name: 'seed', type: 'integer', required: false, description: 'Random seed' },
      { name: 'num_inference_steps', type: 'integer', required: false, description: 'Number of inference steps (default: 50)' },
      { name: 'guidance_scale', type: 'float', required: false, description: 'Guidance scale (default: 7.5)' },
      { name: 'octree_resolution', type: 'integer', required: false, description: 'Octree resolution (default: 256)' },
      { name: 'textured_mesh', type: 'boolean', required: false, description: 'Generate textured mesh (default: false)' },
      { name: 'logs', type: 'boolean', required: false, description: 'Return logs (default: true)' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    input_image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    appId: "${model}",
    provider: "capx_ivmodels"
  })
});
const data = await response.json();
console.log("3D Model URL:", data.model?.url || data.mesh?.url || data.model_mesh?.url || data.model_url || data.glb?.url || data.obj?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "input_image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "appId": "${model}",
    "provider": "capx_ivmodels"
  }
)
data = response.json()
print("3D Model URL:", data["model"]["url"] if data["model"] else data["mesh"]["url"] if data["mesh"] else data["model_mesh"]["url"] if data["model_mesh"] else data["model_url"] if data["model_url"] else data["glb"]["url"] if data["glb"] else data["obj"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "input_image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "appId": "${model}",
    "provider": "capx_ivmodels"
  }'`
    }
  },
  'trellis': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'seed', type: 'integer', required: false, description: 'Random seed' },
      { name: 'ss_guidance_strength', type: 'float', required: false, description: 'Guidance strength (default: 7.5)' },
      { name: 'ss_sampling_steps', type: 'integer', required: false, description: 'Sampling steps (default: 12)' },
      { name: 'slat_guidance_strength', type: 'float', required: false, description: 'SLAT guidance strength (default: 3)' },
      { name: 'slat_sampling_steps', type: 'integer', required: false, description: 'SLAT sampling steps (default: 12)' },
      { name: 'mesh_simplify', type: 'float', required: false, description: 'Mesh simplify ratio (default: 0.95)' },
      { name: 'texture_size', type: 'integer', required: false, description: 'Texture size (default: 1024)' },
      { name: 'logs', type: 'boolean', required: false, description: 'Return logs (default: true)' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    appId: "${model}",
    provider: "capx_ivmodels"
  })
});
const data = await response.json();
console.log("3D Model URL:", data.model?.url || data.mesh?.url || data.model_mesh?.url || data.model_url || data.glb?.url || data.obj?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "appId": "${model}",
    "provider": "capx_ivmodels"
  }
)
data = response.json()
print("3D Model URL:", data["model"]["url"] if data["model"] else data["mesh"]["url"] if data["mesh"] else data["model_mesh"]["url"] if data["model_mesh"] else data["model_url"] if data["model_url"] else data["glb"]["url"] if data["glb"] else data["obj"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "appId": "${model}",
    "provider": "capx_ivmodels"
  }'`
    }
  },
  'trellis/multi': {
    params: [
      { name: 'image_urls', type: 'array', required: true, description: 'Array of image URLs' },
      { name: 'seed', type: 'integer', required: false, description: 'Random seed' },
      { name: 'ss_guidance_strength', type: 'float', required: false, description: 'Guidance strength (default: 7.5)' },
      { name: 'ss_sampling_steps', type: 'integer', required: false, description: 'Sampling steps (default: 12)' },
      { name: 'slat_guidance_strength', type: 'float', required: false, description: 'SLAT guidance strength (default: 3)' },
      { name: 'slat_sampling_steps', type: 'integer', required: false, description: 'SLAT sampling steps (default: 12)' },
      { name: 'mesh_simplify', type: 'float', required: false, description: 'Mesh simplify ratio (default: 0.95)' },
      { name: 'texture_size', type: 'integer', required: false, description: 'Texture size (default: 1024)' },
      { name: 'multiimage_algo', type: 'string', required: false, description: 'Multi-image algorithm (default: "stochastic")' },
      { name: 'logs', type: 'boolean', required: false, description: 'Return logs (default: true)' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_urls: [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
      "https://images.unsplash.com/photo-1465101046530-73398c7f28ca"
    ],
    appId: "${model}",
    provider: "capx_ivmodels"
  })
});
const data = await response.json();
console.log("3D Model URL:", data.model?.url || data.mesh?.url || data.model_mesh?.url || data.model_url || data.glb?.url || data.obj?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_urls": [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
      "https://images.unsplash.com/photo-1465101046530-73398c7f28ca"
    ],
    "appId": "${model}",
    "provider": "capx_ivmodels"
  }
)
data = response.json()
print("3D Model URL:", data["model"]["url"] if data["model"] else data["mesh"]["url"] if data["mesh"] else data["model_mesh"]["url"] if data["model_mesh"] else data["model_url"] if data["model_url"] else data["glb"]["url"] if data["glb"] else data["obj"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_urls": [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
      "https://images.unsplash.com/photo-1465101046530-73398c7f28ca"
    ],
    "appId": "${model}",
    "provider": "capx_ivmodels"
  }'`
    }
  },
  'hyper3d/rodin': {
    params: [
      { name: 'prompt', type: 'string', required: false, description: 'Text prompt for text-to-3D' },
      { name: 'input_image_urls', type: 'array', required: false, description: 'Array of image URLs for image-to-3D' },
      { name: 'condition_mode', type: 'string', required: false, description: 'Condition mode (default: "fuse")' },
      { name: 'seed', type: 'integer', required: false, description: 'Random seed' },
      { name: 'geometry_file_format', type: 'string', required: false, description: 'Geometry file format (default: "glb")' },
      { name: 'material', type: 'string', required: false, description: 'Material (default: "PBR")' },
      { name: 'quality', type: 'string', required: false, description: 'Quality (default: "medium")' },
      { name: 'use_hyper', type: 'boolean', required: false, description: 'Use hyper mode (default: false)' },
      { name: 'tier', type: 'string', required: false, description: 'Tier (default: "Regular")' },
      { name: 'TAPose', type: 'any', required: false, description: 'TAPose (advanced, optional)' },
      { name: 'bbox_condition', type: 'any', required: false, description: 'Bounding box condition (advanced, optional)' },
      { name: 'addons', type: 'any', required: false, description: 'Addons (advanced, optional)' },
      { name: 'logs', type: 'boolean', required: false, description: 'Return logs (default: true)' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    input_image_urls: [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb"
    ],
    appId: "${model}",
    provider: "capx_ivmodels"
  })
});
const data = await response.json();
console.log("3D Model URL:", data.model?.url || data.mesh?.url || data.model_mesh?.url || data.model_url || data.glb?.url || data.obj?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "input_image_urls": [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb"
    ],
    "appId": "${model}",
    "provider": "capx_ivmodels"
  }
)
data = response.json()
print("3D Model URL:", data["model"]["url"] if data["model"] else data["mesh"]["url"] if data["mesh"] else data["model_mesh"]["url"] if data["model_mesh"] else data["model_url"] if data["model_url"] else data["glb"]["url"] if data["glb"] else data["obj"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "input_image_urls": [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb"
    ],
    "appId": "${model}",
    "provider": "capx_ivmodels"
  }'`
    }
  },
  // MISSING AUDIO MODELS
  'kokoro/brazilian-portuguese': {
    params: [
      { name: 'text', type: 'string', required: true, description: 'Text to convert to speech' },
      { name: 'voice', type: 'string', required: false, description: 'Voice to use' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "kokoro/brazilian-portuguese"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    text: "Olá, como você está?",
    voice: "default",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Audio URL:", data.audio?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "text": "Olá, como você está?",
    "voice": "default",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Audio URL:", data["audio"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "text": "Olá, como você está?",
    "voice": "default",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'kokoro/hindi': {
    params: [
      { name: 'text', type: 'string', required: true, description: 'Text to convert to speech' },
      { name: 'voice', type: 'string', required: false, description: 'Voice to use' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "kokoro/hindi"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    text: "नमस्ते, कैसे हैं आप?",
    voice: "default",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Audio URL:", data.audio?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "text": "नमस्ते, कैसे हैं आप?",
    "voice": "default",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Audio URL:", data["audio"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "text": "नमस्ते, कैसे हैं आप?",
    "voice": "default",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'playai/inpaint/diffusion': {
    params: [
      { name: 'audio_url', type: 'string', required: true, description: 'URL of the input audio file' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the audio to generate' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "playai/inpaint/diffusion"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    audio_url: "https://your-storage.com/audio.wav",
    prompt: "Add background music to this audio",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Processed Audio URL:", data.audio?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "audio_url": "https://your-storage.com/audio.wav",
    "prompt": "Add background music to this audio",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Processed Audio URL:", data["audio"]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "audio_url": "https://your-storage.com/audio.wav",
    "prompt": "Add background music to this audio",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // MISSING AUDIO-TO-TEXT MODELS
  'smart-turn': {
    params: [
      { name: 'audio_url', type: 'string', required: true, description: 'URL of the audio file to transcribe' },
      { name: 'language', type: 'string', required: false, description: 'Language code (default: "en")' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "smart-turn"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    audio_url: "https://your-storage.com/audio.wav",
    language: "en",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Transcription:", data.text);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "audio_url": "https://your-storage.com/audio.wav",
    "language": "en",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Transcription:", data["text"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "audio_url": "https://your-storage.com/audio.wav",
    "language": "en",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'speech-to-text/turbo': {
    params: [
      { name: 'audio_url', type: 'string', required: true, description: 'URL of the audio file to transcribe' },
      { name: 'language', type: 'string', required: false, description: 'Language code' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "speech-to-text/turbo"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    audio_url: "https://your-storage.com/audio.wav",
    language: "en",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Transcription:", data.text);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "audio_url": "https://your-storage.com/audio.wav",
    "language": "en",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Transcription:", data["text"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "audio_url": "https://your-storage.com/audio.wav",
    "language": "en",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'speech-to-text/turbo/stream': {
    params: [
      { name: 'audio_url', type: 'string', required: true, description: 'URL of the audio file to transcribe' },
      { name: 'language', type: 'string', required: false, description: 'Language code' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "speech-to-text/turbo/stream"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    audio_url: "https://your-storage.com/audio.wav",
    language: "en",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Transcription:", data.text);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "audio_url": "https://your-storage.com/audio.wav",
    "language": "en",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Transcription:", data["text"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "audio_url": "https://your-storage.com/audio.wav",
    "language": "en",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'elevenlabs/speech-to-text': {
    params: [
      { name: 'audio_url', type: 'string', required: true, description: 'URL of the audio file to transcribe' },
      { name: 'language', type: 'string', required: false, description: 'Language code' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "elevenlabs/speech-to-text"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    audio_url: "https://your-storage.com/audio.wav",
    language: "en",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Transcription:", data.text);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "audio_url": "https://your-storage.com/audio.wav",
    "language": "en",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Transcription:", data["text"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "audio_url": "https://your-storage.com/audio.wav",
    "language": "en",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'wizper': {
    params: [
      { name: 'audio_url', type: 'string', required: true, description: 'URL of the audio file to transcribe' },
      { name: 'language', type: 'string', required: false, description: 'Language code' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "wizper"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    audio_url: "https://your-storage.com/audio.wav",
    language: "en",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Transcription:", data.text);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "audio_url": "https://your-storage.com/audio.wav",
    "language": "en",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Transcription:", data["text"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "audio_url": "https://your-storage.com/audio.wav",
    "language": "en",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // MISSING IMAGE-TO-IMAGE MODELS
  'image-editing/cartoonify': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "image-editing/cartoonify"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Cartoonified Image URL:", data.images?.[0]?.url || data.images?.[0]);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Cartoonified Image URL:", data["images"][0]["url"] if data["images"] else data["images"][0])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'invisible-watermark': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'watermark_text', type: 'string', required: true, description: 'Text to embed as watermark' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "invisible-watermark"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    watermark_text: "AI4Everyone",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Watermarked Image URL:", data.images?.[0]?.url || data.images?.[0]);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "watermark_text": "AI4Everyone",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Watermarked Image URL:", data["images"][0]["url"] if data["images"] else data["images"][0])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "watermark_text": "AI4Everyone",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // MISSING IMAGE-TO-VIDEO MODELS
  'ltx-video-v095/image-to-video': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the video to generate' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "ltx-video-v095/image-to-video"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "A person walking through a beautiful landscape",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'veo2/image-to-video': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the video to generate' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "veo2/image-to-video"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "A person walking through a beautiful landscape",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'kling-video/v1.6/pro/image-to-video': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the video to generate' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "kling-video/v1.6/pro/image-to-video"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "A person walking through a beautiful landscape",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'bytedance/seedance/v1/lite/image-to-video': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the video to generate' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "bytedance/seedance/v1/lite/image-to-video"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "A person walking through a beautiful landscape",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'hunyuan-avatar': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the avatar video to generate' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "hunyuan-avatar"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "Create a talking avatar from this image",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Avatar Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Create a talking avatar from this image",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Avatar Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Create a talking avatar from this image",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'ltx-video-13b-dev/image-to-video': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the video to generate' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "ltx-video-13b-dev/image-to-video"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "A person walking through a beautiful landscape",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'pixverse/v4.5/transition': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the video transition to generate' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "pixverse/v4.5/transition"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "Create a smooth transition effect",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Transition Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Create a smooth transition effect",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Transition Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Create a smooth transition effect",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'pika/v2/turbo/image-to-video': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the video to generate' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "pika/v2/turbo/image-to-video"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "A person walking through a beautiful landscape",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'pika/v2.2/pikascenes': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the video scene to generate' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "pika/v2.2/pikascenes"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "Create a dynamic scene from this image",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Scene Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Create a dynamic scene from this image",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Scene Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Create a dynamic scene from this image",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'pika/v2.1/image-to-video': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the video to generate' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "pika/v2.1/image-to-video"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "A person walking through a beautiful landscape",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'hunyuan-video-img2vid-lora': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the video to generate' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "hunyuan-video-img2vid-lora"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "A person walking through a beautiful landscape",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // MISSING VIDEO-TO-VIDEO MODELS
  'ltx-video-13b-distilled/extend': {
    params: [
      { name: 'video_url', type: 'string', required: true, description: 'URL of the input video to extend' },
      { name: 'prompt', type: 'string', required: true, description: 'Description for video extension' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "ltx-video-13b-distilled/extend"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    video_url: "https://your-storage.com/video.mp4",
    prompt: "Extend this video with more action",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Extended Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "video_url": "https://your-storage.com/video.mp4",
    "prompt": "Extend this video with more action",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Extended Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "video_url": "https://your-storage.com/video.mp4",
    "prompt": "Extend this video with more action",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'ltx-video-13b-dev/extend': {
    params: [
      { name: 'video_url', type: 'string', required: true, description: 'URL of the input video to extend' },
      { name: 'prompt', type: 'string', required: true, description: 'Description for video extension' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "ltx-video-13b-dev/extend"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    video_url: "https://your-storage.com/video.mp4",
    prompt: "Extend this video with more action",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Extended Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "video_url": "https://your-storage.com/video.mp4",
    "prompt": "Extend this video with more action",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Extended Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "video_url": "https://your-storage.com/video.mp4",
    "prompt": "Extend this video with more action",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'ben/v2/video': {
    params: [
      { name: 'video_url', type: 'string', required: true, description: 'URL of the input video' },
      { name: 'prompt', type: 'string', required: true, description: 'Description for video processing' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "ben/v2/video"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    video_url: "https://your-storage.com/video.mp4",
    prompt: "Process this video with special effects",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Processed Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "video_url": "https://your-storage.com/video.mp4",
    "prompt": "Process this video with special effects",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Processed Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "video_url": "https://your-storage.com/video.mp4",
    "prompt": "Process this video with special effects",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  // ADDITIONAL MISSING MODELS
  'clarity-upscale': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image to upscale' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "clarity-upscale"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Upscaled Image URL:", data.images?.[0]?.url || data.images?.[0]);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Upscaled Image URL:", data["images"][0]["url"] if data["images"] else data["images"][0])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'pasd': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description for the image transformation' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "pasd"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "Transform this image with artistic style",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Transformed Image URL:", data.images?.[0]?.url || data.images?.[0]);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Transform this image with artistic style",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Transformed Image URL:", data["images"][0]["url"] if data["images"] else data["images"][0])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Transform this image with artistic style",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'hidream-e1-full': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description for the image transformation' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "hidream-e1-full"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "Transform this image with HiDream style",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Transformed Image URL:", data.images?.[0]?.url || data.images?.[0]);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Transform this image with HiDream style",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Transformed Image URL:", data["images"][0]["url"] if data["images"] else data["images"][0])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "Transform this image with HiDream style",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  },
  'minimax/video-01/image-to-video': {
    params: [
      { name: 'image_url', type: 'string', required: true, description: 'URL of the input image' },
      { name: 'prompt', type: 'string', required: true, description: 'Description of the video to generate' },
      { name: 'provider', type: 'string', required: true, description: 'Set to "capx_ivmodels"' },
      { name: 'appId', type: 'string', required: true, description: 'Set to "minimax/video-01/image-to-video"' }
    ],
    example: {
      typescript: (model) => `const response = await fetch("${API_ENDPOINTS.COMPLETIONS}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    prompt: "A person walking through a beautiful landscape",
    provider: "capx_ivmodels",
    appId: "${model}"
  })
});
const data = await response.json();
console.log("Video URL:", data.video?.url || data.videos?.[0]?.url);`,
      python: (model) => `import requests
response = requests.post(
  "${API_ENDPOINTS.COMPLETIONS}",
  headers={
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  json={
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }
)
data = response.json()
print("Video URL:", data["video"]["url"] if data["video"] else data["videos"][0]["url"])`,
      curl: (model) => `curl ${API_ENDPOINTS.COMPLETIONS} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "prompt": "A person walking through a beautiful landscape",
    "provider": "capx_ivmodels",
    "appId": "${model}"
  }'`
    }
  }
};

const DocsPage = React.memo(() => {
  const [activeTab, setActiveTab] = useState('TypeScript');
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  // Track selected model per category
  const [selectedModels, setSelectedModels] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useUser();
  const { disconnect } = useDisconnect();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 800);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 800);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toggle mobile menu
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const handleNavigation = (path) => { 
    // 🔒 SECURITY: Use safe navigation with validation
    if (safeNavigate(navigate, path)) {
      setMobileMenuOpen(false);
    }
  };
  const isActive = (path) => location.pathname === path;
  const handleLogout = () => { setUser(null); secureStorage.secureLogout(); disconnect(); setMobileMenuOpen(false); };
  const handleTabClick = (tab) => { setActiveTab(tab); setCopied(false); };
  const handleCopy = (code) => { 
  secureClipboardCopy(code, { 
    isSensitive: false, 
    showNotification: false  // DocsPage handles its own notifications
  }); 
  setCopied(true); 
  setTimeout(() => setCopied(false), 2000); 
};
  const toggleSection = (section) => setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  // New: handle model card click
  const handleModelClick = (cat, modelValue) => {
    setSelectedModels(prev => ({ ...prev, [cat]: modelValue }));
    setCopied(false);
  };

  // Group models by category
  const groupedModels = groupModelsByCategory(MODEL_OPTIONS);
  const categories = Object.keys(groupedModels);

  // Map category to readable title
  const categoryTitles = {
    'Text': 'Text Generation Models',
    'Image': 'Image Generation Models',
    'Video': 'Video Generation Models',
    'Audio': 'Audio Generation Models',
    'Audio-to-Audio': 'Audio-to-Audio Models',
    'Image-to-3D': '3D Generation Models',
    'Image-to-Image': 'Image-to-Image Models',
    'Image-to-Video': 'Image-to-Video Models',
    'Audio-to-Text': 'Audio-to-Text Models',
    'Video-to-Video': 'Video-to-Video Models',
    'Other': 'Other Models'
  };

  // Map category to code example generator
  const getExample = (cat, model) => {
    if (EXAMPLES[cat]) return EXAMPLES[cat];
    // Fallback: use Image template for unknowns
    return EXAMPLES['Image'];
  };

  // Helper to get params and example for a model
  const getParamsAndExample = (cat, modelValue) => {
    if (MODEL_OVERRIDES[modelValue]) {
      return {
        params: MODEL_OVERRIDES[modelValue].params,
        example: MODEL_OVERRIDES[modelValue].example
      };
    }
    return {
      params: PARAMS[cat] || PARAMS['Image'],
      example: getExample(cat, modelValue)
    };
  };

  if (isMobile) {
    return (
      <div className="mobile-playground-view">
        <div className="mobile-playground-card">
          <div className="mobile-playground-content">
            <div className="mobile-playground-icon">
              <img src="/images/playground-union-icon.svg" alt="Playground" />
            </div>
            <div className="mobile-playground-text">
              <h2 className="mobile-playground-title">View Docs on desktop</h2>
              <p className="mobile-playground-subtitle">API documentation is best viewed on a larger screen.</p>
            </div>
            <button 
              className="mobile-playground-button"
              onClick={() => navigate('/models')}
            >
              View Models
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <div className="mobile-logo">
          <img 
            src="/images/logo.png" 
            alt="Logo" 
            className="logo-img"
          />
        </div>
        <div className="mobile-menu-icon" onClick={toggleMobileMenu}>
          <img 
            src="/images/menu_alt_02.png" 
            alt="Menu" 
            className="menu-icon-img"
          />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <>
          <div className="mobile-sidebar-backdrop" onClick={toggleMobileMenu}></div>
          <div className="mobile-sidebar">
            <div className="mobile-sidebar-header">
              <img src="/images/logo.png" alt="UNSTOPPABLE" className="mobile-sidebar-logo" />
            </div>
            <nav className="mobile-sidebar-nav">
              <div 
                className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`} 
                onClick={() => handleNavigation('/')}
              >
                <Home size={18} />
                <span>Home</span>
              </div>
              <div 
                className={`mobile-nav-item ${isActive('/models') ? 'active' : ''}`} 
                onClick={() => handleNavigation('/models')}
              >
                <Box size={18} />
                <span>Models</span>
              </div>
              <div 
                className={`mobile-nav-item ${isActive('/playground') ? 'active' : ''}`} 
                onClick={() => handleNavigation('/playground')}
              >
                <Cpu size={18} />
                <span>Playground</span>
              </div>
              <div 
                className={`mobile-nav-item ${isActive('/usage') ? 'active' : ''}`} 
                onClick={() => handleNavigation('/usage')}
              >
                <BarChart2 size={18} />
                <span>Usage</span>
              </div>
              <div 
                className={`mobile-nav-item ${isActive('/api-keys') ? 'active' : ''}`} 
                onClick={() => handleNavigation('/api-keys')}
              >
                <Key size={18} />
                <span>API Keys</span>
              </div>
              <div 
                className={`mobile-nav-item ${isActive('/settings') ? 'active' : ''}`} 
                onClick={() => handleNavigation('/settings')}
              >
                <Settings size={18} />
                <span>Settings</span>
              </div>
              <div 
                className={`mobile-nav-item docs-item ${isActive('/docs') ? 'active' : ''}`} 
                onClick={() => handleNavigation('/docs')}
              >
                <FileText size={18} />
                <span>Docs</span>
                <ExternalLink size={14} className="external-icon" />
              </div>
            </nav>
            <div className="mobile-sidebar-footer">
              <div className="mobile-social-icons">
                <a href="https://t.me/" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M21.944 2.112a1.5 1.5 0 0 0-1.6-.2L2.7 9.1a1.5 1.5 0 0 0 .1 2.8l4.7 1.6 1.7 5.2a1.5 1.5 0 0 0 2.7.3l2.1-3.2 4.6 3.4a1.5 1.5 0 0 0 2.4-1l2-15a1.5 1.5 0 0 0-.526-1.188zM9.7 15.2l-1.2-3.7 8.2-6.2-7 7.6zm2.2 3.1l-1.1-3.3 1.7-1.3 2.1 1.5zm7.1-1.2-4.2-3.1 5.2-7.6z" fill="#9B9797"/>
                  </svg>
                </a>
                <a href="https://discord.gg/" target="_blank" rel="noopener noreferrer" aria-label="Discord">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 0 1 .01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" fill="#9B9797"/>
                  </svg>
                </a>
                <a href="https://x.com/" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#9B9797"/>
                  </svg>
                </a>
              </div>
              <div className="mobile-user-section">
                {user ? (
                  <div className="mobile-user-profile">
                    <div className="mobile-user-info">
                      <div className="mobile-avatar">
                        <span>{user.name ? user.name[0].toUpperCase() : 'U'}</span>
                      </div>
                      <span className="mobile-username">
                        {user.email.length > 15 ? user.email.slice(0, 15) + '...' : user.email}
                      </span>
                    </div>
                    <button className="mobile-logout-btn" onClick={handleLogout} aria-label="Logout">
                      <LogOut size={18} color="#888" />
                    </button>
                  </div>
                ) : (
                  <div className="mobile-connect-section">
                    <ConnectButton />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="docs-page-container">
        {/* Header Section */}
        <div className="docs-header">
          <h1 className="docs-main-heading">UnstoppableAI API Documentation</h1>
          <p className="docs-subtitle">Complete guide to using all AI models with code examples in TypeScript, Python, and cURL</p>
      </div>

        {/* Quick Start Section */}
        <div className="docs-section">
          <h2 className="docs-section-heading">
            <CheckCircle size={20} className="section-icon" />
            Quick Start Guide
          </h2>
          <div className="docs-steps">
      <div className="docs-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Authentication</h3>
                <p>Login with your wallet and create an API key from the API Keys page.</p>
      </div>
            </div>
      <div className="docs-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Choose Your Model</h3>
                <p>Browse available models on the Models page and test them in the Playground.</p>
      </div>
            </div>
      <div className="docs-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Integrate</h3>
                <p>Use the code examples below to integrate AI capabilities into your application.</p>
              </div>
            </div>
          </div>
      </div>

        {/* Model Categories */}
        {categories.map((cat) => {
          const models = groupedModels[cat];
          const selectedModelValue = selectedModels[cat] || models[0]?.value;
          const selectedModel = models.find(m => m.value === selectedModelValue) || models[0];
          const { params, example } = getParamsAndExample(cat, selectedModel?.value);
          const endpoint = ENDPOINTS[cat] || API_ENDPOINTS.COMPLETIONS;
          const isExpanded = expandedSections[cat] ?? (cat === 'Text');
          return (
            <div key={cat} className="docs-section">
              <div className="docs-section-header" onClick={() => toggleSection(cat)}>
                <h2 className="docs-section-heading"><Code size={20} className="section-icon" />{categoryTitles[cat] || cat}</h2>
                <div className="section-toggle">{isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</div>
              </div>
              {isExpanded && (
                <div className="docs-section-content">

                  {/* Available Models */}
                  <div className="models-list">
                    <h3>Available Models:</h3>
                    <div className="models-grid">
                      {models.map((model, idx) => (
                        <div
                          key={idx}
                          className={`model-item${selectedModelValue === model.value ? ' selected' : ''}`}
                          onClick={() => handleModelClick(cat, model.value)}
                          style={{ cursor: 'pointer', borderColor: selectedModelValue === model.value ? '#667eea' : undefined }}
                        >
                          <div className="model-name">{model.label.replace(/ \([^)]+\)$/, '')}</div>
                          <div className="model-value">{model.value}</div>
                          <div className="model-description">Provider: <b>{model.provider}</b></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Parameters */}
                  <div className="parameters-section">
                    <h3>Parameters:</h3>
                    <div className="parameters-table">
                      <div className="parameter-header">
                        <span>Parameter</span><span>Type</span><span>Required</span><span>Description</span>
                      </div>
                      {params.map((param, idx) => (
                        <div key={idx} className="parameter-row">
                          <span className="param-name">{param.name}</span>
                          <span className="param-type">{param.type}</span>
                          <span className="param-required">{param.required ? <CheckCircle size={14} /> : <span>-</span>}</span>
                          <span className="param-description">{param.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Code Examples */}
                  <div className="code-examples-section">
                    <h3>Code Examples:</h3>
      <div className="code-block-container">
        <div className="code-block-header">
          <div className="code-tabs">
                          <button className={`tab ${activeTab === 'TypeScript' ? 'active' : ''}`} onClick={() => handleTabClick('TypeScript')}>TypeScript</button>
                          <button className={`tab ${activeTab === 'Python' ? 'active' : ''}`} onClick={() => handleTabClick('Python')}>Python</button>
                          <button className={`tab ${activeTab === 'Curl' ? 'active' : ''}`} onClick={() => handleTabClick('Curl')}>cURL</button>
          </div>
        </div>
        <div className="code-content">
                        <button className="copy-button" onClick={() => handleCopy(
                          activeTab === 'TypeScript' ? example.typescript(selectedModel?.value) :
                          activeTab === 'Python' ? example.python(selectedModel?.value) :
                          example.curl(selectedModel?.value)
                        )}>{copied ? 'Copied!' : <Copy size={18} />}</button>
          {activeTab === 'TypeScript' && (
            <Highlight
              code={example.typescript(selectedModel?.value)}
              theme={themes.vsDark}
              language="typescript"
            >
              {({ style, tokens, getLineProps, getTokenProps }) => (
                <pre style={style}>
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          )}
          {activeTab === 'Python' && (
            <Highlight
              code={example.python(selectedModel?.value)}
              theme={themes.vsDark}
              language="python"
            >
              {({ style, tokens, getLineProps, getTokenProps }) => (
                <pre style={style}>
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          )}
          {activeTab === 'Curl' && (
            <Highlight
              code={example.curl(selectedModel?.value)}
              theme={themes.vsDark}
              language="bash"
            >
              {({ style, tokens, getLineProps, getTokenProps }) => (
                <pre style={style}>
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          )}
        </div>
      </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Best Practices */}
        <div className="docs-section">
          <h2 className="docs-section-heading">
            <Info size={20} className="section-icon" />
            Best Practices
          </h2>
          <div className="best-practices">
            <div className="practice-item">
              <h3>🔐 Security</h3>
              <p>Never expose your API key in client-side code or public repositories. Use environment variables and secure storage.</p>
            </div>
            <div className="practice-item">
              <h3>⚡ Performance</h3>
              <p>Use appropriate model sizes for your use case. Smaller models are faster but may have lower quality output.</p>
            </div>
            <div className="practice-item">
              <h3>🎯 Prompt Engineering</h3>
              <p>Write clear, specific prompts. Include relevant context and specify the desired output format.</p>
            </div>
            <div className="practice-item">
              <h3>🔄 Error Handling</h3>
              <p>Always implement proper error handling and retry logic for API calls.</p>
            </div>
            <div className="practice-item">
              <h3>💰 Cost Management</h3>
              <p>Monitor your usage and set appropriate limits. Use smaller models for testing and development.</p>
            </div>
          </div>
        </div>



        {/* Support */}
        <div className="docs-section">
          <h2 className="docs-section-heading">
            <ExternalLink size={20} className="section-icon" />
            Support & Resources
          </h2>
          <div className="support-links">
            <a href="https://t.me/" target="_blank" rel="noopener noreferrer" className="support-link">
              <span>💬 Telegram Community</span>
            </a>
            <a href="https://discord.gg/" target="_blank" rel="noopener noreferrer" className="support-link">
              <span>🎮 Discord Server</span>
            </a>
            <a href="https://x.com/" target="_blank" rel="noopener noreferrer" className="support-link">
              <span>🐦 Follow on X (Twitter)</span>
            </a>
            <button onClick={() => navigate('/playground')} className="support-link">
              <span>🧪 Try in Playground</span>
            </button>
          </div>
      </div>
    </div>
    </>
  );
});

export default DocsPage; 