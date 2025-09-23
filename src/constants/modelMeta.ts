// Centralized model metadata and helpers extracted from pages/ModelsPage.tsx

export const logoMap: { [key: string]: string } = {
    'Mistralai/Mistral-Nemo-12b-instruct/fp-8': '/images/MISTRAL.png',
    'meta-llama/llama-3.1-8b-instruct/fp-16': '/images/5c1ffef3714b93473f3e5972de2ffba7c2536421.png',
    'deepseek/deepseek-r1/fp-8': '/images/DEEPSEEK.png',
    'deepseek/deepseek-r1-0528/fp-8': '/images/DEEPSEEK.png',
    'deepseek/r1-distill-llama-70b/fp-8': '/images/DEEPSEEK.png',
    'deepseek/deepseek-v3-0324/fp-8': '/images/DEEPSEEK.png',
    'meta-llama/llama-3.1-70b-instruct/fp-16': '/images/5c1ffef3714b93473f3e5972de2ffba7c2536421.png',
    'meta-llama/llama-3.2-1b-instruct/fp-16': '/images/5c1ffef3714b93473f3e5972de2ffba7c2536421.png',
    'meta-llama/llama-3.2-3b-instruct/fp-16': '/images/5c1ffef3714b93473f3e5972de2ffba7c2536421.png',
    'meta-llama/llama-3.3-70b-instruct/fp-16': '/images/5c1ffef3714b93473f3e5972de2ffba7c2536421.png',
    'osmosis-ai/osmosis-structure-0.6b/fp-32': '/images/OSMOSIS.png',
    'qwen/qwen3-30b-a3b/fp8': '/images/QWEN.png',
    'minimax/hailuo-02/pro/text-to-video': '/images/HAILUO.png',
    'bytedance/seedance/v1/lite/text-to-video': '/images/BYTEDANCE SEEDANCE V1 PRO.png',
};

export function getModelImage(modelValue: string, category: string): string {
    // Text models
    if (category === 'Text') {
        if (modelValue.includes('deepseek')) return '/images/DEEPSEEK.png';
        if (modelValue.toLowerCase().includes('mistral')) return '/images/MISTRAL.png';
        if (modelValue.includes('llama')) return '/images/5c1ffef3714b93473f3e5972de2ffba7c2536421.png';
        if (modelValue.includes('qwen')) return '/images/QWEN.png';
        if (modelValue.includes('osmosis')) return '/images/OSMOSIS.png';
        return '/images/DEFAULT.png';
    }

    // Image models
    if (category === 'Image') {
        if (modelValue === 'Imagen4/preview/fast') return '/images/IMAGEN4 PREVIEW FAST.png';
        if (modelValue === 'HiDream-i1-full' || modelValue === 'HiDream-I1-Dev') return '/images/HIDREAM.png';
        if (modelValue === 'Ideogram/v2' || modelValue === 'Ideogram/v3') return '/images/IDEOGRAM v2.png';
        if (modelValue === 'Stable-Diffusion-V35-Large') return '/images/STABLE DIFFUSION v35 large.png';
        if (modelValue === 'Fast-SDXL') return '/images/FAST SDXL.png';
        if (modelValue.includes('Flux')) return '/images/FLUX LORA IMPAINTING (1).png';
        return '/images/DEFAULT.png';
    }

    // Video models
    if (category === 'Video') {
        if (modelValue === 'Veo2' || modelValue === 'Veo3') return '/images/GOOGLE GEMMA.png';
        if (modelValue === 'magi') return '/images/MAGI.png';
        if (modelValue.includes('ltx-video') || modelValue === 'LTX-Video-v095') return '/images/LTX DEV.png';
        if (modelValue.includes('kling')) return '/images/KLING.png';
        if (modelValue.includes('hailuo')) return '/images/HAILUO.png';
        if (modelValue.includes('seedance')) return '/images/BYTEDANCE SEEDANCE V1 PRO.png';
        return '/images/DEFAULT.png';
    }

    // Audio models
    if (category === 'Audio' || category === 'Audio-to-Audio' || category === 'Audio-to-Text') {
        if (modelValue === 'ace-step') return '/images/ACE STEP.png';
        if (modelValue.includes('elevenlabs')) return '/images/DIFFRHYTHM.png';
        if (modelValue === 'playai/inpaint/diffusion') return '/images/PLAYAI.png';
        if (modelValue.includes('stable-audio')) return '/images/STABLE DIFFUSION v35 large.png';
        return '/images/DEFAULT.png';
    }

    // 3D models
    if (category === 'Image-to-3D') {
        return '/images/DEFAULT.png';
    }

    // Image-to-Image models
    if (category === 'Image-to-Image') {
        if (modelValue === 'hidream-e1-full') return '/images/HIDREAM.png';
        if (modelValue === 'recraft/vectorize') return '/images/RECRAFT.png';
        if (modelValue === 'gpt-image-1/edit-image/byok') return '/images/d2688984531c52949a15696e09636799867b6257.png';
        return '/images/DEFAULT.png';
    }

    // Image-to-Video models
    if (category === 'Image-to-Video') {
        if (modelValue === 'veo2/image-to-video') return '/images/GOOGLE GEMMA.png';
        if (modelValue.includes('kling')) return '/images/KLING.png';
        if (modelValue.includes('seedance')) return '/images/BYTEDANCE SEEDANCE V1 PRO.png';
        if (modelValue.includes('ltx-video')) return '/images/LTX DEV.png';
        return '/images/DEFAULT.png';
    }

    // Video-to-Video models
    if (category === 'Video-to-Video') {
        if (modelValue.includes('ltx-video')) return '/images/LTX DEV.png';
        return '/images/DEFAULT.png';
    }

    return '/images/DEFAULT.png';
}

export const MODEL_DESCRIPTIONS: { [key: string]: string } = {
    // Audio models
    'ace-step': 'Generate music with lyrics from text using ACE-Step',
    'elevenlabs/tts/multilingual-v2': 'Generate multilingual text-to-speech audio using ElevenLabs TTS Multilingual v2.',
    'kokoro/brazilian-portuguese': 'A natural and expressive Brazilian Portuguese text-to-speech model optimized for clarity and fluency.',
    'kokoro/hindi': 'A fast and expressive Hindi text-to-speech model with clear pronunciation and accurate intonation.',
    'mmaudio-v2/text-to-audio': 'MMAudio generates synchronized audio given text inputs. It can generate sounds described by a prompt.',
    'stable-audio': 'Open source text-to-audio model.',
    'elevenlabs/sound-effects': 'Generate sound effects using ElevenLabs advanced audio generation.',

    // Audio-to-Audio models
    'playai/inpaint/diffusion': 'A novel way to perform audio editing, ensuring smooth transitions and consistent speaker characteristics for edits.',
    'ace-step/audio-outpaint': 'Extend the beginning or end of provided audio with lyrics and/or style using ACE-Step',
    'ace-step/audio-inpaint': 'Modify a portion of provided audio with lyrics and/or style using ACE-Step',
    'ace-step/audio-to-audio': 'Generate music from a lyrics and example audio using ACE-Step',

    // 3D models
    'hunyuan3d-v21': 'Hunyuan3D-2.1 is a scalable 3D asset creation system that advances state-of-the-art 3D generation',
    'hunyuan3d/v2': 'Generate 3D models from your images using Hunyuan 3D.',
    'hunyuan3d/v2/turbo': 'Generate 3D models from your images using Hunyuan 3D.',
    'hyper3d/rodin': 'Rodin by Hyper3D generates realistic and production ready 3D models from text or images.',
    'trellis': 'Generate 3D models from your images using Trellis.',
    'triposr': 'State of the art Image to 3D Object generation',

    // Image-to-Image models
    'clarity-upscale': 'Clarity upscaler for upscaling images with high very fidelity.',
    'chain-of-zoom': 'Extreme Super-Resolution via Scale Autoregression and Preference Alignment',
    'pasd': 'Pixel-Aware Diffusion Model for Realistic Image Super-Resolution and Personalized Stylization',
    'object-removal': 'Removes objects and their visual effects using natural language.',
    'recraft/vectorize': 'Converts a given raster image to SVG format using Recraft model.',
    'image-editing/cartoonify': 'transform your photos into vibrant cool cartoons with bold outlines and rich colors.',
    'hidream-e1-full': 'Edit images with natural language',
    'gpt-image-1/edit-image/byok': "OpenAI's latest image generation and editing model: gpt-1-image.",
    'plushify': 'Turn any image into a cute plushie!',
    'ghiblify': 'Reimagine and transform your ordinary photos into enchanting Studio Ghibli style artwork',
    'gemini-flash-edit': 'Gemini Flash Edit is a model that can edit single image using a text prompt and a reference image.',
    'invisible-watermark': 'Invisible Watermark is a model that can add an invisible watermark to an image.',
    'ddcolor': 'Bring colors into old or new black and white photos with DDColor.',
    'codeformer': 'Fix distorted or blurred photos of people with CodeFormer.',

    // Image-to-Video models
    'kling-video/v2/master/image-to-video': 'Generate video clips from your images using Kling 2.0 Master',
    'wan-effects': 'Wan Effects generates high-quality videos with popular effects from images',
    'veo2/image-to-video': 'Veo 2 creates videos from images with realistic motion and very high quality output.',
    'kling-video/v1.6/pro/image-to-video': 'Generate video clips from your images using Kling 1.6 (pro)',
    'minimax/video-01/image-to-video': 'Generate video clips from your images using MiniMax Video mode',
    'bytedance/seedance/v1/lite/image-to-video': 'Seedance 1.0 Lite',
    'ltx-video-13b-dev/image-to-video': 'Generate videos from prompts and images using LTX Video-0.9.7 13B and custom LoRA',
    'pixverse/v4.5/transition': 'Create seamless transition between images using PixVerse v4.5',
    'pika/v2/turbo/image-to-video': 'Pika v2 Turbo creates videos from images with high quality output.',
    'pika/v2.2/pikascenes': 'Pika Scenes v2.2 creates videos from images with high quality output.',
    'pika/v2.1/image-to-video': 'Pika v2.1 creates videos from images with high quality output.',
    'hunyuan-video-image-to-video': 'Image to Video for the high-quality Hunyuan Video I2V model.',
    'ltx-video-v095/image-to-video': 'Generate videos from prompts and images using LTX Video-0.9.5',
    'hunyuan-video-img2vid-lora': 'Image to Video for the Hunyuan Video model using a custom trained LoRA.',
    'stable-video': 'Generate short video clips from your images using SVD v1.1',

    // Audio-to-Text models
    'smart-turn': 'An open source, community-driven and native audio turn detection model by Pipecat AI.',
    'speech-to-text/turbo': 'Leverage the rapid processing capabilities of AI models to enable accurate speech-to-text transcription.',
    'speech-to-text/turbo/stream': 'Leverage the rapid processing capabilities of AI models to enable accurate speech-to-text transcription.',
    'elevenlabs/speech-to-text': 'Generate text from speech using ElevenLabs advanced speech-to-text model.',
    'wizper': 'Whisper v3 Large -- but optimized by our inference wizards.',
    'whisper': 'Whisper is a model for speech transcription and translation.',

    // Video-to-Video models
    'wan-vace-14b/outpainting': 'VACE is a video generation model that uses a source image, mask, and video to create prompted videos',
    'wan-vace-14b/inpainting': 'VACE is a video generation model that uses a source image, mask, and video to create prompted videos',
    'ltx-video-13b-distilled/extend': 'Extend videos using LTX Video-0.9.7 13B Distilled and custom LoRA',
    'ltx-video-13b-dev/extend': 'Extend videos using LTX Video-0.9.7 13B and custom LoRA',
    'ben/v2/video': 'A model for high quality and smooth background removal for videos.',
};

export function getModelDescription(modelValue: string, category: string): string {
    return MODEL_DESCRIPTIONS[modelValue] || `An advanced ${category.toLowerCase()}-generation model.`;
}

export function extractCategoryFromLabel(label: string): string {
    const match = label.match(/\(([^)]+)\)$/);
    return match ? match[1] : 'Other';
} 