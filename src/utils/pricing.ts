// Dynamic pricing calculator for all model types
export interface PricingResult {
  cost: number;
  details: string;
  breakdown?: string;
}

export interface ModelPricing {
  type: 'time' | 'char' | 'audio_duration' | 'megapixel' | 'compute' | 'flat' | 'video_duration' | 'video_tokens' | 'image';
  rate: number;
  unit: string;
  multiplier?: number;
}

// Comprehensive pricing database with ALL models
export const MODEL_PRICING: { [key: string]: ModelPricing } = {
  // TEXT-TO-VIDEO MODELS
  'Veo2': { type: 'video_duration', rate: 0.50, unit: 'second' },
  'Veo3': { type: 'video_duration', rate: 0.75, unit: 'second' },
  'magi': { type: 'video_duration', rate: 0.25, unit: 'second' },
  'minimax/hailuo-02/pro/text-to-video': { type: 'video_duration', rate: 0.08, unit: 'second' },
  'ltx-video-13b-dev': { type: 'flat', rate: 0.20, unit: 'video' },
  'ltx-video-13b-distilled': { type: 'flat', rate: 0.04, unit: 'video' },
  'LTX-Video-v095': { type: 'flat', rate: 0.04, unit: 'video' },
  'Wan-T2V': { type: 'flat', rate: 0.40, unit: 'video' },
  'Wan-t2v-lora': { type: 'flat', rate: 0.35, unit: 'video' },
  'Fast-svd/text-to-video': { type: 'flat', rate: 0.15, unit: 'video' },
  'Fast-Animatediff/text-to-video': { type: 'flat', rate: 0.15, unit: 'video' },
  'bytedance/seedance/v1/lite/text-to-video': { type: 'video_duration', rate: 0.15, unit: 'second' },
  'Transpixar': { type: 'flat', rate: 0.4, unit: 'video' },
  'Luma-Dream-Machine': { type: 'flat', rate: 0.5, unit: 'video' },
  'mochi-v1': { type: 'flat', rate: 0.4, unit: 'video' },
  'Luma-Dream-Machine/ray-2': { type: 'video_duration', rate: 0.1, unit: 'second' },

  // IMAGE-TO-VIDEO MODELS
  'kling-video/v2/master/image-to-video': { type: 'video_duration', rate: 0.3, unit: 'second' },
  'wan-effects': { type: 'flat', rate: 0.35, unit: 'video' },
  'veo2/image-to-video': { type: 'video_duration', rate: 0.5, unit: 'second' },
  'kling-video/v1.6/pro/image-to-video': { type: 'video_duration', rate: 0.095, unit: 'second' },
  'minimax/video-01/image-to-video': { type: 'flat', rate: 0.5, unit: 'video' },
  'bytedance/seedance/v1/lite/image-to-video': { type: 'video_duration', rate: 0.2, unit: 'second' },
  'ltx-video-13b-dev/image-to-video': { type: 'flat', rate: 0.20, unit: 'video' },
  'pixverse/v4.5/transition': { type: 'flat', rate: 0.8, unit: 'generation' },
  'pika/v2/turbo/image-to-video': { type: 'flat', rate: 0.2, unit: 'video' },
  'pika/v2.2/pikascenes': { type: 'video_duration', rate: 0.1, unit: 'second' },
  'pika/v2.1/image-to-video': { type: 'flat', rate: 0.4, unit: 'video' },
  'hunyuan-video-image-to-video': { type: 'flat', rate: 0.4, unit: 'video' },
  'ltx-video-v095/image-to-video': { type: 'flat', rate: 0.04, unit: 'video' },
  'hunyuan-video-img2vid-lora': { type: 'flat', rate: 0.3, unit: 'video' },
  'stable-video': { type: 'flat', rate: 0.075, unit: 'video' },

  // VIDEO-TO-VIDEO MODELS (newly added)
  'wan-vace-14b/outpainting': { type: 'flat', rate: 1.00, unit: 'video' },
  'wan-vace-14b/inpainting': { type: 'flat', rate: 1.00, unit: 'video' },
  'ltx-video-13b-distilled/extend': { type: 'flat', rate: 0.15, unit: 'video' },
  'ltx-video-13b-dev/extend': { type: 'flat', rate: 0.20, unit: 'video' },
  'ben/v2/video': { type: 'megapixel', rate: 0.001, unit: 'MP' },

  // AUDIO GENERATION MODELS
  'mmaudio-v2/text-to-audio': { type: 'time', rate: 0.001, unit: 'second' },
  'stable-audio': { type: 'time', rate: 0.006, unit: 'second' },
  'ace-step': { type: 'time', rate: 0.0055, unit: 'second' },
  'elevenlabs/sound-effects': { type: 'time', rate: 0.0037, unit: 'second' },
  'elevenlabs/tts/multilingual-v2': { type: 'char', rate: 0.11, unit: '1000_chars', multiplier: 1000 },
  'kokoro/brazilian-portuguese': { type: 'char', rate: 0.022, unit: '1000_chars', multiplier: 1000 },
  'kokoro/hindi': { type: 'char', rate: 0.022, unit: '1000_chars', multiplier: 1000 },

  // AUDIO-TO-AUDIO MODELS
  'playai/inpaint/diffusion': { type: 'flat', rate: 0.50, unit: 'generation' },
  'ace-step/audio-outpaint': { type: 'flat', rate: 1.50, unit: 'generation' },
  'ace-step/audio-inpaint': { type: 'flat', rate: 1.50, unit: 'generation' },
  'ace-step/audio-to-audio': { type: 'flat', rate: 1.50, unit: 'generation' },
  
  // AUDIO-TO-TEXT MODELS (newly added)
  'smart-turn': { type: 'audio_duration', rate: 0.008, unit: 'second' },
  'speech-to-text/turbo': { type: 'audio_duration', rate: 0.0008, unit: 'second' },
  'speech-to-text/turbo/stream': { type: 'audio_duration', rate: 0.0008, unit: 'second' },
  'elevenlabs/speech-to-text': { type: 'audio_duration', rate: 0.03, unit: 'minute', multiplier: 60 },
  'wizper': { type: 'audio_duration', rate: 0.008, unit: 'second' },
  'whisper': { type: 'audio_duration', rate: 0.008, unit: 'second' },

  // IMAGE MODELS  
  'Fast-SDXL': { type: 'flat', rate: 0.04, unit: 'image' },
  'HiDream-i1-full': { type: 'megapixel', rate: 0.05, unit: 'MP' },
  'HiDream-I1-Dev': { type: 'megapixel', rate: 0.03, unit: 'MP' },
  'Flux/dev': { type: 'megapixel', rate: 0.025, unit: 'MP' },
  'Ideogram/v2': { type: 'flat', rate: 0.08, unit: 'image' },
  'Stable-Diffusion-V35-Large': { type: 'megapixel', rate: 0.065, unit: 'MP' },
  'Flux-Lora': { type: 'megapixel', rate: 0.035, unit: 'MP' },
  'Imagen4/preview/fast': { type: 'flat', rate: 0.02, unit: 'image' },
  'Flux-1/schnell': { type: 'megapixel', rate: 0.003, unit: 'MP' },
  'Bagel': { type: 'flat', rate: 0.10, unit: 'image' },
  'Dreamo': { type: 'megapixel', rate: 0.05, unit: 'MP' },
  'Ideogram/v3': { type: 'flat', rate: 0.09, unit: 'image' },
  'Sana/v1.5/1.6b': { type: 'megapixel', rate: 0.0075, unit: 'MP' },
  'sana/v1.5/4.8b': { type: 'megapixel', rate: 0.01, unit: 'MP' },
  'cogview4': { type: 'megapixel', rate: 0.1, unit: 'MP' },
  'Flux-pro/v1.1-ultra': { type: 'flat', rate: 0.06, unit: 'image' },

  // IMAGE-TO-IMAGE MODELS
  'clarity-upscale': { type: 'megapixel', rate: 0.03, unit: 'MP' },
  'chain-of-zoom': { type: 'flat', rate: 0.025, unit: 'image' },
  'pasd': { type: 'megapixel', rate: 0.03, unit: 'MP' },
  'object-removal': { type: 'flat', rate: 0.024, unit: 'generation' },
  'recraft/vectorize': { type: 'flat', rate: 0.04, unit: 'image' },
  'image-editing/cartoonify': { type: 'flat', rate: 0.06, unit: 'image' },
  'hidream-e1-full': { type: 'flat', rate: 0.06, unit: 'image' },
  'gpt-image-1/edit-image/byok': { type: 'flat', rate: 0.40, unit: 'image' },
  'plushify': { type: 'flat', rate: 0.10, unit: 'image' },
  'ghiblify': { type: 'flat', rate: 0.05, unit: 'image' },
  'gemini-flash-edit': { type: 'flat', rate: 0.04, unit: 'image' },
  'invisible-watermark': { type: 'flat', rate: 0.01, unit: 'image' },
  'ddcolor': { type: 'megapixel', rate: 0.001, unit: 'MP' },
  'codeformer': { type: 'megapixel', rate: 0.0021, unit: 'MP' },

  // IMAGE-TO-3D MODELS
  'hunyuan3d-v21': { type: 'flat', rate: 0.30, unit: '3d_model' },
  'hunyuan3d/v2': { type: 'flat', rate: 0.16, unit: '3d_model' },
  'hunyuan3d/v2/turbo': { type: 'flat', rate: 0.14, unit: '3d_model' },
  'hyper3d/rodin': { type: 'flat', rate: 0.40, unit: '3d_model' },
  'trellis': { type: 'flat', rate: 0.02, unit: '3d_model' },
  'triposr': { type: 'flat', rate: 0.07, unit: '3d_model' },

  // Default fallback
  'default': { type: 'flat', rate: 0.20, unit: 'generation' }
};

// Playground mode hardcoded parameters for cost calculation
export const PLAYGROUND_PARAMS: { [key: string]: any } = {
  // Video generation defaults (from your backend code)
  'ltx-video-13b-dev': { duration: 5, resolution: '720p' }, // Estimate 5 seconds
  'ltx-video-13b-distilled': { duration: 5, resolution: '720p' },
  'Veo2': { duration: 5, resolution: '720p' },
  'magi': { duration: 5, resolution: '720p' },
  'Veo3': { duration: 5, resolution: '720p' },
  'Luma-Dream-Machine/ray-2': { duration: 5, resolution: '720p' },
  'minimax/hailuo-02/pro/text-to-video': { duration: 5, resolution: '720p' },
  'bytedance/seedance/v1/lite/text-to-video': { duration: 5, resolution: '720p' },
  'Fast-svd/text-to-video': { duration: 5, resolution: '720p' },
  'Fast-Animatediff/text-to-video': { duration: 5, resolution: '720p' },
  
  // Audio generation defaults
  'elevenlabs/sound-effects': { duration: 5 },
  'mmaudio-v2/text-to-audio': { duration: 10 },
  'stable-audio': { duration: 10 },
  'ace-step': { duration: 10 },
  
  // Audio-to-text defaults (1 minute audio)
  'smart-turn': { duration: 60 },
  'speech-to-text/turbo': { duration: 60 },
  'speech-to-text/turbo/stream': { duration: 60 },
  'elevenlabs/speech-to-text': { duration: 60 },
  'wizper': { duration: 60 },
  'whisper': { duration: 60 },
  
  // Image generation defaults (1024x1024 = ~1MP)
  'image_default': { width: 1024, height: 1024, megapixels: 1.048576 },

  // Image-to-Video model defaults (5 seconds for duration-based models)
  'kling-video/v2/master/image-to-video': { duration: 5 },
  'veo2/image-to-video': { duration: 5 },
  'kling-video/v1.6/pro/image-to-video': { duration: 5 },
  'bytedance/seedance/v1/lite/image-to-video': { duration: 5 },
  'pika/v2.2/pikascenes': { duration: 5 }
};

// Helper to determine if a model is a FAL model (not text-to-text)
import { MODEL_OPTIONS } from '../models';
import Logger from './logger';

export function isFalModel(modelValue: string): boolean {
  const model = MODEL_OPTIONS.find(m => m.value === modelValue);
  return !!(model && model.provider === 'capx_ivmodels');
}

// Calculate cost for playground mode (before API call)
export const calculatePlaygroundCost = (modelValue: string, inputText?: string): PricingResult => {
  const pricing = MODEL_PRICING[modelValue] || MODEL_PRICING['default'];
  const params = PLAYGROUND_PARAMS[modelValue];
  
  try {
    switch (pricing.type) {
      case 'video_duration':
        const duration = params?.duration || 5; // Default 5 seconds
        const cost = duration * pricing.rate;
        return {
          cost: cost * (isFalModel(modelValue) ? 1.2 : 1), // NO ROUNDING - PRECISE BILLING!
          details: `${duration}s video × $${pricing.rate}/second`,
          breakdown: `Estimated duration: ${duration}s, Rate: $${pricing.rate}/second`
        };
        
      case 'video_tokens':
        // For bytedance/seedance: 720p 5 second = specific cost
        if (modelValue === 'bytedance/seedance/v1/lite/text-to-video') {
          return {
            cost: 0.18 * (isFalModel(modelValue) ? 1.2 : 1),
            details: '720p 5s video = $0.18',
            breakdown: 'Fixed cost for 720p 5-second video'
          };
        }
        break;
        
      case 'time':
        const audioDuration = params?.duration || 10;
        const timeCost = audioDuration * pricing.rate;  // Simplified since most models are now per-second
        return {
          cost: timeCost * (isFalModel(modelValue) ? 1.2 : 1), // NO ROUNDING - PRECISE BILLING!
          details: `${audioDuration}s × $${pricing.rate}/second`,
          breakdown: `Estimated duration: ${audioDuration}s, Rate: $${pricing.rate}/second`
        };
        
      case 'audio_duration':
        const audioTranscriptionDuration = params?.duration || 60; // Default 1 minute for transcription
        const transcriptionCost = pricing.unit === 'minute' 
          ? (audioTranscriptionDuration / 60) * pricing.rate  // Convert to minutes for elevenlabs
          : audioTranscriptionDuration * pricing.rate;       // Per second for others
        return {
          cost: transcriptionCost * (isFalModel(modelValue) ? 1.2 : 1), // NO ROUNDING - PRECISE BILLING!
          details: `${audioTranscriptionDuration}s audio × $${pricing.rate}/${pricing.unit}`,
          breakdown: `Audio duration: ${audioTranscriptionDuration}s, Rate: $${pricing.rate}/${pricing.unit}`
        };
        
      case 'megapixel':
        const megapixels = PLAYGROUND_PARAMS.image_default.megapixels;
        const mpCost = megapixels * pricing.rate;
        return {
          cost: mpCost * (isFalModel(modelValue) ? 1.2 : 1), // NO ROUNDING - PRECISE BILLING!
          details: `${megapixels.toFixed(2)}MP × $${pricing.rate}/MP`,
          breakdown: `1024×1024 image (${megapixels.toFixed(2)}MP), Rate: $${pricing.rate}/MP`
        };
        
      case 'image':
        return {
          cost: pricing.rate * (isFalModel(modelValue) ? 1.2 : 1),
          details: `$${pricing.rate} per image`,
          breakdown: `Fixed cost per image: $${pricing.rate}`
        };
        
      case 'char':
        if (inputText) {
          const charCount = inputText.length;
          const charCost = (charCount / (pricing.multiplier || 1)) * pricing.rate;
          return {
            cost: charCost * (isFalModel(modelValue) ? 1.2 : 1), // NO ROUNDING - PRECISE BILLING!
            details: `${charCount} chars × $${pricing.rate}/${pricing.unit}`,
            breakdown: `Characters: ${charCount}, Rate: $${pricing.rate}/${pricing.unit}`
          };
        }
        // Fallback estimate
        const estimatedChars = 100;
        const estimatedCharCost = (estimatedChars / (pricing.multiplier || 1)) * pricing.rate;
        return {
          cost: estimatedCharCost * (isFalModel(modelValue) ? 1.2 : 1), // NO ROUNDING - PRECISE BILLING!
          details: `~${estimatedChars} chars × $${pricing.rate}/${pricing.unit}`,
          breakdown: `Estimated characters: ${estimatedChars}, Rate: $${pricing.rate}/${pricing.unit}`
        };
        
      case 'compute':
        // Estimate 30 seconds processing time
        const processingTime = 30;
        const computeCost = processingTime * pricing.rate;
        return {
          cost: computeCost * (isFalModel(modelValue) ? 1.2 : 1), // NO ROUNDING - PRECISE BILLING!
          details: `~${processingTime}s compute × $${pricing.rate}/second`,
          breakdown: `Estimated processing: ${processingTime}s, Rate: $${pricing.rate}/second`
        };
        
      case 'flat':
      default:
        return {
          cost: pricing.rate * (isFalModel(modelValue) ? 1.2 : 1),
          details: `Flat rate: $${pricing.rate}`,
          breakdown: `Fixed cost per ${pricing.unit}: $${pricing.rate}`
        };
    }
  } catch (error) {
    Logger.error('Error calculating playground cost:', error);
  }
  
  // Fallback
  return {
    cost: pricing.rate * (isFalModel(modelValue) ? 1.2 : 1) || 0.20,
    details: 'Standard rate',
    breakdown: 'Using fallback pricing'
  };
};

// Format cost for display - NO ROUNDING, PRECISE DISPLAY!
export const formatCost = (cost: number): string => {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(8)}¢`; // Show 8 decimal places in cents
  }
  return `$${cost.toFixed(8)}`; // Show 8 decimal places in dollars
};

// Get model pricing info
export const getModelPricing = (modelValue: string): ModelPricing | null => {
  return MODEL_PRICING[modelValue] || null;
};

// Check if model has pricing data
export const hasModelPricing = (modelValue: string): boolean => {
  return modelValue in MODEL_PRICING;
}; 