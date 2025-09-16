import React, { useState } from 'react';
import { ExternalLink, Copy, Home, Box, Cpu, BarChart2, Key, Settings, FileText, X, LogOut, MessageCircle, Table, LayoutGrid } from 'lucide-react';
import '../styles/ModelsPage.css';
import '../styles/TopSection.css';
import { MODEL_OPTIONS } from '../models';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getModelPricing, isFalModel } from '../utils/pricing';
import { useUser } from './UserContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDisconnect } from 'wagmi';
import { secureStorage } from '../utils/secureStorage';
import { safeNavigate } from '../utils/validation';

const ModelsPage = React.memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useUser();
  const { disconnect } = useDisconnect();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Handle navigation
  const handleNavigation = (path: string) => {
    // 🔒 SECURITY: Use safe navigation with validation
    if (safeNavigate(navigate, path)) {
      setMobileMenuOpen(false);
    }
  };

  // Check if route is active  
  const isActive = (path: string) => location.pathname === path;

  // Handle logout
  const handleLogout = () => {
    setUser(null);
    // Clear secure storage
    sessionStorage.removeItem('secure_api_keys');
    sessionStorage.removeItem('secure_balance');
    disconnect();
    setMobileMenuOpen(false);
  };

  // Helper function to determine if a model has fixed or usage-based pricing
  const getPricingType = (modelValue: string): string => {
    const pricing = getModelPricing(modelValue);
    if (!pricing) return 'Usage-based'; // Default for models without pricing data (like text models)
    
    // Fixed pricing types
    if (pricing.type === 'flat' || pricing.type === 'image') {
      return 'Fixed';
    }
    
    // Usage-based pricing types
    return 'Usage-based';
  };

  // Helper function to get formatted price for each model - FIXED TO MATCH BACKEND
  const getModelPrice = (modelValue: string): string => {
    const pricing = getModelPricing(modelValue);
    if (!pricing) return 'Token-based'; // Default for text models
    const rate = (pricing.rate * (isFalModel(modelValue) ? 1.2 : 1)).toFixed(3);
    switch (pricing.type) {
      case 'flat':
        return `$${rate} per ${pricing.unit}`;
      case 'image':
        return `$${rate} per image`;
      case 'megapixel':
        return `$${rate} per MP`;
      case 'video_duration':
        return `$${rate} per second`;
      case 'time':
        if (pricing.multiplier === 30) {
          return `$${rate}/30s`;
        } else if (pricing.multiplier === 60) {
          return `$${rate}/minute`;
        }
        return `$${rate} per second`;
      case 'audio_duration':
        if (pricing.multiplier === 60) {
          return `$${rate} per minute`;
        }
        return `$${rate} per second`;
      case 'char':
        return `$${rate} per 1K chars`;
      case 'compute':
        return `$${rate}/comp-s`;
      case 'video_tokens':
        return `$${rate}/M tokens`;
      default:
        return `$${rate}`;
    }
  };

  // Helper function to get model image
  const getModelImage = (modelValue: string, category: string): string => {
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
  };

  // Helper function to get description
  const getModelDescription = (modelValue: string, category: string): string => {
    const descriptions: { [key: string]: string } = {
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

    return descriptions[modelValue] || `An advanced ${category.toLowerCase()}-generation model.`;
  };
  const logoMap: { [key: string]: string } = {
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

  // Helper function to extract category from label
  const extractCategory = (label: string): string => {
    const match = label.match(/\(([^)]+)\)$/);
    return match ? match[1] : 'Other';
  };

  // Generate all models with dynamic pricing
  const models = MODEL_OPTIONS.map(model => {
    const category = extractCategory(model.label);
    const cleanName = model.label.replace(/ \([^)]+\)$/, '');

    return {
      id: model.value,
      name: cleanName,
      provider: model.provider,
      category: category,
      image: getModelImage(model.value, category),
      logo: logoMap[model.value] || '/images/logo.png',
      description: getModelDescription(model.value, category),
      price: getPricingType(model.value), // Dynamic pricing type
      context: getModelPrice(model.value) // Dynamic pricing amount from central DB
    };
  });

  // Filter models by category using dynamic filtering
  const recommendedModels = models.slice(0, 3);
  const textToTextModels = models.filter(model => model.category === 'Text');
  const textToImageModels = models.filter(model => model.category === 'Image');
  const textToVideoModels = models.filter(model => model.category === 'Video');
  const audioModels = models.filter(model => model.category === 'Audio');
  const audioToAudioModels = models.filter(model => model.category === 'Audio-to-Audio');
  const imageTo3DModels = models.filter(model => model.category === 'Image-to-3D');
  const imageToImageModels = models.filter(model => model.category === 'Image-to-Image');
  const imageToVideoModels = models.filter(model => model.category === 'Image-to-Video');
  const audioToTextModels = models.filter(model => model.category === 'Audio-to-Text');
  const videoToVideoModels = models.filter(model => model.category === 'Video-to-Video');

  // Get all unique categories
  const allCategories = Array.from(new Set(models.map(m => m.category)));
  const categories = ['All', ...allCategories];
  // Filter models by selected category
  const filteredModels = selectedCategory === 'All' ? models : models.filter(m => m.category === selectedCategory);

  // Helper to get capx tag for table view
  const getCapxTag = (category: string) => {
    return category === 'Text' ? 'capx_textmodels' : 'capx_ivmodels';
  };

  return (
    <div className="models-page">
      {/* Mobile Header - same as home page */}
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
          {/* Backdrop */}
          <div className="mobile-sidebar-backdrop" onClick={toggleMobileMenu}></div>
          
          {/* Mobile Sidebar */}
          <div className="mobile-sidebar">
            {/* Header */}
            <div className="mobile-sidebar-header">
              <img src="/images/logo.png" alt="UNSTOPPABLE" className="mobile-sidebar-logo" />
            </div>

            {/* Navigation */}
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

            {/* Footer */}
            <div className="mobile-sidebar-footer">
              {/* Social Icons */}
              <div className="mobile-social-icons">
                <a href="https://t.me/" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M21.944 2.112a1.5 1.5 0 0 0-1.6-.2L2.7 9.1a1.5 1.5 0 0 0 .1 2.8l4.7 1.6 1.7 5.2a1.5 1.5 0 0 0 2.7.3l2.1-3.2 4.6 3.4a1.5 1.5 0 0 0 2.4-1l2-15a1.5 1.5 0 0 0-.526-1.188zM9.7 15.2l-1.2-3.7 8.2-6.2-7 7.6zm2.2 3.1l-1.1-3.3 1.7-1.3 2.1 1.5zm7.1-1.2-4.2-3.1 5.2-7.6z" fill="#9B9797"/>
                  </svg>
                </a>
                
                <a href="https://discord.gg/" target="_blank" rel="noopener noreferrer" aria-label="Discord">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" fill="#9B9797"/>
                  </svg>
                </a>
                
                <a href="https://x.com/" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#9B9797"/>
                  </svg>
                </a>
              </div>

              {/* User Section */}
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

      {/* Banner Section - same as home page */}
      <div className="banner-container">
        <img 
          src="/images/image 8.svg" 
          alt="AI4Everyone Banner" 
          className="banner-image desktop-banner" 
        />
        <img 
          src="/images/Frame 43.png" 
          alt="AI4Everyone Mobile Banner" 
          className="banner-image mobile-banner" 
        />
      </div>

      {/* Content Section */}
      <div className="models-page-content">
        <div className={`models-content-header-row${viewMode === 'table' ? ' tab-view-active' : ''}`} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <div style={{ flex: 1 }}>
            <h1 className="mainheading">Explore Models</h1>
            <p className="sub_title">Discover powerful AI models for every modality—text, image, video, audio, and beyond.</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className={`view-switch-btn${viewMode === 'card' ? ' active' : ''}`}
              style={{ background: viewMode === 'card' ? '#fff' : 'transparent', color: viewMode === 'card' ? '#181818' : '#fff', border: '1.5px solid #444', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s', fontSize: 18 }}
              onClick={() => setViewMode('card')}
              aria-label="Card View"
            >
              <LayoutGrid size={20} />
            </button>
            <button
              className={`view-switch-btn${viewMode === 'table' ? ' active' : ''}`}
              style={{ background: viewMode === 'table' ? '#fff' : 'transparent', color: viewMode === 'table' ? '#181818' : '#fff', border: '1.5px solid #444', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s', fontSize: 18 }}
              onClick={() => setViewMode('table')}
              aria-label="Table View"
            >
              <Table size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Card/Table View Switcher */}
      {viewMode === 'card' ? (
        <>
          <section className="recommended-models">
            <div className="models-content-container">
              <h2 className="section-heading-gabriella">RECOMMENDED MODELS</h2>
              <p className="models-section-subtitle">Models curated based on popularity and real-time usage across the platform.
              </p>
            </div>
            <div className="models-grid">
              {recommendedModels.map(model => (
                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="model-card">
                  <div className="model-image">
                    <img src={model.image} alt={model.name} />
                    <img src={model.logo} alt={`${model.name} logo`} className="model-logo" />
                  </div>
                  <div className="model-content">
                    <h3>{model.name}</h3>
                    <div className="model-tags">
                      <span className="provider">{model.provider}</span>
                      <span className="type">{model.category}</span>
                    </div>
                    <p className="model-description">{model.description}</p>
                    <div className="model-footer">
                      <span className="price">{model.price}</span>
                      <span className="context">{model.context}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="text-to-text">
            <div className="text-to-text-content-container">
              <h2 className="section-heading-gabriella">TEXT-TO-TEXT</h2>
              <p className="text-to-text-section-subtitle">Prices shown are per 1 million tokens</p>
            </div>
            <div className="models-grid horizontal-scroll">
              {textToTextModels.map(model => (
                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="model-card">
                  <div className="model-image">
                    <img src={model.image} alt={model.name} />
                    <img src={model.logo} alt={`${model.name} logo`} className="model-logo" />
                  </div>
                  <div className="model-content">
                    <h3>{model.name}</h3>
                    <div className="model-tags">
                      <span className="provider">{model.provider}</span>
                      <span className="type">{model.category}</span>
                    </div>
                    <p className="model-description">{model.description}</p>
                    <div className="model-footer">
                      <span className="price">{model.price}</span>
                      <span className="context">{model.context}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="text-to-image">
            <div className="text-to-image-content-container">
              <h2 className="section-heading-gabriella">TEXT-TO-IMAGE</h2>
              <p className="text-to-image-section-subtitle">High-quality image generation models</p>
            </div>
            <div className="models-grid horizontal-scroll">
              {textToImageModels.map(model => (
                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="model-card">
                  <div className="model-image">
                    <img src={model.image} alt={model.name} />
                    <img src={model.logo} alt={`${model.name} logo`} className="model-logo" />
                  </div>
                  <div className="model-content">
                    <h3>{model.name}</h3>
                    <div className="model-tags">
                      <span className="provider">{model.provider}</span>
                      <span className="type">{model.category}</span>
                    </div>
                    <p className="model-description">{model.description}</p>
                    <div className="model-footer">
                      <span className="price">{model.price}</span>
                      <span className="context">{model.context}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="text-to-video">
            <div className="text-to-video-content-container">
              <h2 className="section-heading-gabriella">TEXT-TO-VIDEO</h2>
              <p className="text-to-video-section-subtitle">High-quality video generation models</p>
            </div>
            <div className="models-grid horizontal-scroll">
              {textToVideoModels.map(model => (
                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="model-card">
                  <div className="model-image">
                    <img src={model.image} alt={model.name} />
                    <img src={model.logo} alt={`${model.name} logo`} className="model-logo" />
                  </div>
                  <div className="model-content">
                    <h3>{model.name}</h3>
                    <div className="model-tags">
                      <span className="provider">{model.provider}</span>
                      <span className="type">{model.category}</span>
                    </div>
                    <p className="model-description">{model.description}</p>
                    <div className="model-footer">
                      <span className="price">{model.price}</span>
                      <span className="context">{model.context}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="text-to-audio">
            <div className="text-to-audio-content-container">
              <h2 className="section-heading-gabriella">TEXT-TO-AUDIO</h2>
              <p className="text-to-audio-section-subtitle">High-quality audio generation models</p>
            </div>
            <div className="models-grid horizontal-scroll">
              {audioModels.map(model => (
                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="model-card">
                  <div className="model-image">
                    <img src={model.image} alt={model.name} />
                  </div>
                  <div className="model-content">
                    <h3>{model.name}</h3>
                    <div className="model-tags">
                      <span className="provider">{model.provider}</span>
                      <span className="type">{model.category}</span>
                    </div>
                    <p className="model-description">{model.description}</p>
                    <div className="model-footer">
                      <span className="price">{model.price}</span>
                      <span className="context">{model.context}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="audio-to-audio">
            <div className="text-to-audio-content-container">
              <h2 className="section-heading-gabriella">AUDIO TO AUDIO MODELS</h2>
              <p className="text-to-audio-section-subtitle">Advanced audio-to-audio generation and editing models</p>
            </div>
            <div className="models-grid horizontal-scroll">
              {audioToAudioModels.map(model => (
                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="model-card">
                  <div className="model-image">
                    <img src={model.image} alt={model.name} />
                  </div>
                  <div className="model-content">
                    <h3>{model.name}</h3>
                    <div className="model-tags">
                      <span className="provider">{model.provider}</span>
                      <span className="type">{model.category}</span>
                    </div>
                    <p className="model-description">{model.description}</p>
                    <div className="model-footer">
                      <span className="price">{model.price}</span>
                      <span className="context">{model.context}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="image-to-3d">
            <div className="text-to-audio-content-container">
              <h2 className="section-heading-gabriella">IMAGE TO 3D MODELS</h2>
              <p className="text-to-audio-section-subtitle">Generate 3D models from images using advanced AI models</p>
            </div>
            <div className="models-grid horizontal-scroll">
              {imageTo3DModels.map(model => (
                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="model-card">
                  <div className="model-image">
                    <img src={model.image} alt={model.name} />
                  </div>
                  <div className="model-content">
                    <h3>{model.name}</h3>
                    <div className="model-tags">
                      <span className="provider">{model.provider}</span>
                      <span className="type">{model.category}</span>
                    </div>
                    <p className="model-description">{model.description}</p>
                    <div className="model-footer">
                      <span className="price">{model.price}</span>
                      <span className="context">{model.context}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="image-to-image">
            <div className="text-to-audio-content-container">
              <h2 className="section-heading-gabriella">IMAGE TO IMAGE MODELS</h2>
              <p className="text-to-audio-section-subtitle">Advanced image-to-image editing and enhancement models</p>
            </div>
            <div className="models-grid horizontal-scroll">
              {imageToImageModels.map(model => (
                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="model-card">
                  <div className="model-image">
                    <img src={model.image} alt={model.name} />
                  </div>
                  <div className="model-content">
                    <h3>{model.name}</h3>
                    <div className="model-tags">
                      <span className="provider">{model.provider}</span>
                      <span className="type">{model.category}</span>
                    </div>
                    <p className="model-description">{model.description}</p>
                    <div className="model-footer">
                      <span className="price">{model.price}</span>
                      <span className="context">{model.context}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="image-to-video">
            <div className="text-to-audio-content-container">
              <h2 className="section-heading-gabriella">IMAGE TO VIDEO MODELS</h2>
              <p className="text-to-audio-section-subtitle">Generate videos from images using advanced AI models</p>
            </div>
            <div className="models-grid horizontal-scroll">
              {imageToVideoModels.map(model => (
                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="model-card">
                  <div className="model-image">
                    <img src={model.image} alt={model.name} />
                  </div>
                  <div className="model-content">
                    <h3>{model.name}</h3>
                    <div className="model-tags">
                      <span className="provider">{model.provider}</span>
                      <span className="type">{model.category}</span>
                    </div>
                    <p className="model-description">{model.description}</p>
                    <div className="model-footer">
                      <span className="price">{model.price}</span>
                      <span className="context">{model.context}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="audio-to-text">
            <div className="text-to-audio-content-container">
              <h2 className="section-heading-gabriella">AUDIO TO TEXT MODELS</h2>
              <p className="text-to-audio-section-subtitle">Convert audio to text using advanced speech-to-text models</p>
            </div>
            <div className="models-grid horizontal-scroll">
              {audioToTextModels.map(model => (
                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="model-card">
                  <div className="model-image">
                    <img src={model.image} alt={model.name} />
                  </div>
                  <div className="model-content">
                    <h3>{model.name}</h3>
                    <div className="model-tags">
                      <span className="provider">{model.provider}</span>
                      <span className="type">{model.category}</span>
                    </div>
                    <p className="model-description">{model.description}</p>
                    <div className="model-footer">
                      <span className="price">{model.price}</span>
                      <span className="context">{model.context}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="video-to-video">
            <div className="text-to-audio-content-container">
              <h2 className="section-heading-gabriella">VIDEO TO VIDEO MODELS</h2>
              <p className="text-to-audio-section-subtitle">Advanced video-to-video generation and editing models</p>
            </div>
            <div className="models-grid horizontal-scroll">
              {videoToVideoModels.map(model => (
                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="model-card">
                  <div className="model-image">
                    <img src={model.image} alt={model.name} />
                  </div>
                  <div className="model-content">
                    <h3>{model.name}</h3>
                    <div className="model-tags">
                      <span className="provider">{model.provider}</span>
                      <span className="type">{model.category}</span>
                    </div>
                    <p className="model-description">{model.description}</p>
                    <div className="model-footer">
                      <span className="price">{model.price}</span>
                      <span className="context">{model.context}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          {/* Category Tabs */}
          <div className="models-category-tabs" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button
                key={cat}
                className={`models-category-tab${selectedCategory === cat ? ' active' : ''}`}
                style={{
                  background: selectedCategory === cat ? '#fff' : 'transparent',
                  color: selectedCategory === cat ? '#181818' : '#fff',
                  border: '1.5px solid #444',
                  borderRadius: 20,
                  padding: '7px 18px',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="models-table-container" style={{ width: '90%', margin: '0 auto', background: '#181818', border: '1.5px solid #444', borderRadius: 18, overflowX: 'auto', boxShadow: '0 2px 16px 0 rgba(0,0,0,0.10)' }}>
            <table className="models-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, color: '#fff', fontFamily: 'Titillium Web, Arial, sans-serif', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#0e0e0e' }}>
                  <th style={{ fontWeight: 900, fontSize: 17, padding: '10px 15px', borderBottom: '1.5px solid #333' }}>Model</th>
                  <th style={{ fontWeight: 900, fontSize: 17, padding: '10px 15px', borderBottom: '1.5px solid #333' }}>Description</th>
                  <th style={{ fontWeight: 900, fontSize: 17, padding: '10px 15px', borderBottom: '1.5px solid #333' }}>Tag</th>
                  <th style={{ fontWeight: 900, fontSize: 17, padding: '10px 15px', borderBottom: '1.5px solid #333' }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {filteredModels.map(model => (
                  <tr key={model.id} style={{ background: '#0e0e0e', borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '10px 15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={model.image} alt={model.name} style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', marginRight: 8 }} />
                      {model.name}
                    </td>
                    <td style={{ padding: '10px 15px', maxWidth: 320 }}>{model.description}</td>
                    <td style={{ padding: '10px 15px' }}>
                      <span className="models-category-tag" style={{
                        display: 'inline-block',
                        background: '#232323',
                        color: '#fff',
                        borderRadius: 16,
                        padding: '4px 14px',
                        fontWeight: 700,
                        fontSize: 13,
                        letterSpacing: 0.2,
                        border: '1px solid #333',
                      }}>{getCapxTag(model.category)}</span>
                    </td>
                    <td className="model-price-cell" style={{ padding: '10px 15px' }}>
                      <span className="model-price-main">{model.context.split(' ')[0]}</span>
                      <span className="model-price-unit">{model.context.split(' ').slice(1).join(' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div 
        className="docs-box"
        onClick={() => navigate('/docs')}
        style={{ cursor: 'pointer' }}
      >
        <img src="/images/Icon.png" alt="Document Icon" className="docs-icon-img" />
        <div className="docs-content">
          <h3 className="docs-heading-gabriella">View Documentation</h3>
          <p className="docs-subtitle">Learn more about how generations and logging work.</p>
        </div>
        <ExternalLink size={24} className="docs-icon" />
      </div>
    </div>
  );
});

export default ModelsPage;