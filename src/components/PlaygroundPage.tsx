import React, { useState, useRef, useEffect } from 'react';
import '../styles/PlaygroundPage.css';
import '../styles/TopSection.css';
import { ChevronDown, ExternalLink, Home, Box, Cpu, BarChart2, Key, Settings, FileText, LogOut } from 'lucide-react';
import { MODEL_OPTIONS } from '../models';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../config';
import { calculatePlaygroundCost, formatCost, hasModelPricing } from '../utils/pricing';
import { useUser } from './UserContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDisconnect } from 'wagmi';
import { secureStorage, getCurrentJWTSync } from '../utils/secureStorage';
import { useApiCall, getErrorMessage } from '../utils/apiClient';
import { fetchApiKeysForUser, fetchUserBalance } from './utils';
import { safeNavigate } from '../utils/validation';

// Import model-viewer
import '@google/model-viewer';

// Declare model-viewer as a valid JSX element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any;
    }
  }
}

const COMPLETIONS_API_URL = API_ENDPOINTS.COMPLETIONS;
const CHAT_API_URL = API_ENDPOINTS.CHAT_COMPLETIONS;

// Add at the top, after imports
import type { RefObject } from 'react';
import type { MODEL_OPTIONS as MODEL_OPTIONS_TYPE } from '../models';
import { PlaygroundInputSchema, sanitizeInput } from '../utils/validation';
import { secureClipboardCopy } from '../utils/secureClipboard';

interface ModelOption {
  value: string;
  label: string;
  provider?: string;
}

interface ModelDropdownProps {
  models: ModelOption[];
  selectedModel: string;
  setSelectedModelAndNavigate: (modelValue: string) => void;
  disabled?: boolean;
}

function ModelDropdown({ models, selectedModel, setSelectedModelAndNavigate, disabled }: ModelDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const selected = models.find((m: ModelOption) => m.value === selectedModel);
  const dropdownRef: RefObject<HTMLDivElement> = React.useRef(null);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = models.filter((m: ModelOption) => m.label.toLowerCase().includes(search.toLowerCase()));

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      setOpen(o => !o);
      e.preventDefault();
    }
    if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div
      className="custom-chain-dropdown"
      tabIndex={0}
      ref={dropdownRef}
      onKeyDown={disabled ? undefined : handleKeyDown}
      style={{ position: 'relative', width: '100%', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      <div
        className="custom-chain-dropdown-selected"
        onClick={disabled ? undefined : () => setOpen(o => !o)}
        style={{
          background: '#1A1D21',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          padding: '12px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 40,
        }}
      >
        <span>{selected?.label || 'Select model'}</span>
        <span style={{ marginLeft: 8, fontSize: 18, userSelect: 'none' }}>▼</span>
      </div>
      {open && (
        <div
          className="custom-chain-dropdown-menu"
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            right: 0,
            background: '#1A1D21',
            color: 'white',
            borderRadius: 8,
            boxShadow: '0 4px 16px #0008',
            zIndex: 1000,
            border: '1px solid #444',
            overflow: 'hidden',
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              // 🔒 SECURITY: Add length validation to prevent DoS
              const value = e.target.value;
              if (value.length <= 100) { // Reasonable limit for search input
                setSearch(value);
              }
            }}
            maxLength={100} // HTML attribute for additional protection
            style={{
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              outline: 'none',
              background: '#23232a',
              color: '#fff',
              fontSize: 15,
              borderBottom: '1px solid #333',
              marginBottom: 4,
            }}
          />
          {filteredModels.map((model: ModelOption) => (
            <div
              key={model.value}
              className="custom-chain-dropdown-option"
              onClick={() => {
                setSelectedModelAndNavigate(model.value);
                setOpen(false);
                setSearch('');
              }}
              style={{
                padding: '12px',
                cursor: 'pointer',
                background: model.value === selectedModel ? '#2a2d30' : 'transparent',
                fontWeight: model.value === selectedModel ? 600 : 400,
              }}
              tabIndex={0}
              onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedModelAndNavigate(model.value);
                  setOpen(false);
                  setSearch('');
                }
              }}
            >
              {model.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PlaygroundPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const { disconnect } = useDisconnect();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [outputLength, setOutputLength] = useState(2048);
  const [temperature, setTemperature] = useState(1);
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS[0].value);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelNameCopied, setModelNameCopied] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [requestStartTime, setRequestStartTime] = useState<number | null>(null);
  const [ttft, setTtft] = useState<number | null>(null);
  const [tps, setTps] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatHistoryContainerRef = useRef<HTMLDivElement | null>(null);
  const [attachedAudioFile, setAttachedAudioFile] = useState<File | null>(null);
  const [attachedImageFile, setAttachedImageFile] = useState<File | null>(null);
  const [attachedImageFiles, setAttachedImageFiles] = useState<File[]>([]);
  const [attachedVideoFile, setAttachedVideoFile] = useState<File | null>(null);
  const [attachedVideoFiles, setAttachedVideoFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const multiImageFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const multiVideoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Repopulate API key cache and balance if missing
    const checkAndFetchCache = async () => {
      const jwt = getCurrentJWTSync();
      if (user?.id && jwt) {
        try {
          // Check and repopulate API keys cache if missing
          if (!sessionStorage.getItem('api_keys_cache')) {
            // Fetch fresh API keys from server (same as API Keys page)
            const res = await fetch(API_ENDPOINTS.API_KEYS, {
              headers: {
                'Authorization': `Bearer ${jwt}`
              }
            });
            
            if (res.ok) {
              const data = await res.json();
              const serverApiKeys = Array.isArray(data) ? data : [];
              await secureStorage.setApiKeys(serverApiKeys);
            }
          }
          
          // Check and repopulate balance cache if missing
          if (!sessionStorage.getItem('balance_cache')) {
            if (user?.email) {
              const newBalance = await fetchUserBalance(user.email, jwt);
              secureStorage.setBalance(newBalance);
            }
          }
        } catch (err) {
          // Optionally handle error - cache repopulation is not critical for playground functionality
          console.warn('Cache repopulation failed:', err);
        }
      }
    };
    
    checkAndFetchCache();

    // Existing code for modelFromUrl
    const params = new URLSearchParams(location.search);
    const modelFromUrl = params.get('model');
    if (modelFromUrl && MODEL_OPTIONS.some(m => m.value === modelFromUrl)) {
      setSelectedModel(modelFromUrl);
    }
  }, [location, user?.id, user?.email]);

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
    // Use secure logout with cross-tab synchronization
    secureStorage.secureLogout();
    disconnect();
    setMobileMenuOpen(false);
  };

  const selectedModelObj = MODEL_OPTIONS.find(m => m.value === selectedModel);

  const getResponseFormat = () => {
    if (!selectedModelObj?.label) return 'Unknown';
    if (selectedModelObj.label.includes('(Text)')) return 'text-to-text';
    if (selectedModelObj.label.includes('(Image-to-Image)')) return 'image-to-image';
    if (selectedModelObj.label.includes('(Image-to-Video)')) return 'image-to-video';
    if (selectedModelObj.label.includes('(Image-to-3D)')) return 'image-to-3d';
    if (selectedModelObj.label.includes('(Image)')) return 'text-to-image';
    if (selectedModelObj.label.includes('(Video)')) return 'text-to-video';
    if (selectedModelObj.label.includes('(Audio-to-Audio)')) return 'audio-to-audio';
    if (selectedModelObj.label.includes('(Audio-to-Text)')) return 'audio-to-text';
    if (selectedModelObj.label.includes('(Audio)')) return 'text-to-audio';
    if (selectedModelObj.label.includes('(Video-to-Video)')) return 'video-to-video';
    return 'Unknown';
  };

  const calculateTokenCost = (inputTokens: number, outputTokens: number, model: string) => {
    // Simplified cost calculation - you can adjust these rates based on actual pricing
    const costPerInputToken = 0.000001; // $0.001 per 1K input tokens
    const costPerOutputToken = 0.000003; // $0.003 per 1K output tokens
    
    return (inputTokens * costPerInputToken) + (outputTokens * costPerOutputToken);
  };

  const getImageModelCost = () => {
    // Use the actual system deduction amount for image/video generation
    return 0.20; // $0.20 as per your existing system
  };

  const handleCopyModelName = () => {
    if (selectedModelObj?.value) {
              secureClipboardCopy(selectedModelObj.value, { 
          isSensitive: false, 
          showNotification: true 
        });
      setModelNameCopied(true);
      setTimeout(() => {
        setModelNameCopied(false);
      }, 2000);
    }
  };

  const handleRestartChat = () => {
    setChatHistory([]);
    setInput('');
    setError(null);
    setLoading(false);
    setTotalTokens(0);
    setTotalCost(0);
    setTtft(null);
    setTps(null);
  };

  useEffect(() => {
    // Auto-scroll to bottom only when new messages are added
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  useEffect(() => {
    setChatHistory([]);
    setInput('');
  }, [selectedModel]);

  const handleSend = async () => {
    // Validate and sanitize input for text-to-text, text-to-image, etc.
    const sanitizedPrompt = sanitizeInput(input);
    const validationResult = PlaygroundInputSchema.safeParse({
      prompt: sanitizedPrompt,
      model: selectedModel,
      temperature,
      max_tokens: outputLength,
    });
    if (!validationResult.success) {
      setError(validationResult.error.errors[0].message);
      return;
    }
    // Special handling for Image-to-Image models (clarity-upscale, chain-of-zoom, etc.)
    if (selectedModelObj?.label.includes('(Image-to-Image)')) {
      if (!attachedImageFile) {
        setError('Please attach an image file.');
        return;
      }
      // object-removal, hidream-e1-full, and gemini-flash-edit require both image and text prompt
      if (selectedModelObj?.value === 'object-removal' && !input.trim()) {
        setError('Please enter a description of what to remove from the image.');
        return;
      }
      if (selectedModelObj?.value === 'hidream-e1-full' && !input.trim()) {
        setError('Please enter an edit instruction for the image.');
        return;
      }
      if (selectedModelObj?.value === 'gpt-image-1/edit-image/byok' && !input.trim()) {
        setError('Please enter your OpenAI API key and edit instruction in format: OPENAI_KEY:sk-your-key | PROMPT:your edit instruction');
        return;
      }
      if (selectedModelObj?.value === 'gemini-flash-edit' && !input.trim()) {
        setError('Please enter an edit instruction for the image.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read image file.');
          setLoading(false);
          return;
        }
        // Prepare payload
        const payload: any = {
          image_file_base64: base64,
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: selectedModelObj.value
        };
        // Add prompt for object-removal, hidream-e1-full, gpt-image-1/edit-image/byok, and gemini-flash-edit
        if (selectedModelObj?.value === 'object-removal' || selectedModelObj?.value === 'hidream-e1-full' || selectedModelObj?.value === 'gpt-image-1/edit-image/byok' || selectedModelObj?.value === 'gemini-flash-edit') {
          payload.prompt = input.trim();
          
          // For gpt-image-1/edit-image/byok, we need an OpenAI API key
          // For now, ask user to provide it in a specific format: "OPENAI_KEY:sk-... | PROMPT:edit instruction"
          if (selectedModelObj?.value === 'gpt-image-1/edit-image/byok') {
            const inputText = input.trim();
            const keyMatch = inputText.match(/OPENAI_KEY:\s*(sk-[^\s|]+)/);
            const promptMatch = inputText.match(/PROMPT:\s*(.+)/);
            
            if (keyMatch && promptMatch) {
              payload.openai_api_key = keyMatch[1];
              payload.prompt = promptMatch[1].trim();
            } else {
              // If no special format, show error with instructions
              setError('For GPT Image 1, please format your input as: OPENAI_KEY:sk-your-key | PROMPT:your edit instruction');
              setLoading(false);
              return;
            }
          }
        }
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        const userMessage = selectedModelObj?.value === 'object-removal' 
          ? `Remove "${input.trim()}" from image: ${attachedImageFile.name}`
          : selectedModelObj?.value === 'hidream-e1-full'
          ? `Edit image "${attachedImageFile.name}": ${input.trim()}`
          : selectedModelObj?.value === 'gpt-image-1/edit-image/byok'
          ? `GPT Image 1 edit "${attachedImageFile.name}": ${payload.prompt || input.trim()}`
          : selectedModelObj?.value === 'gemini-flash-edit'
          ? `Gemini Flash edit "${attachedImageFile.name}": ${input.trim()}`
          : `Uploaded image: ${attachedImageFile.name}`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedImageFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Processing image...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (process.env.NODE_ENV !== 'production') {
          console.log('Image-to-Image API Response:', data); // Debug logging
        }
          let resultUrl = null;
          // Check for upscaled image (clarity-upscale returns image)
          if (data.image && data.image.url) {
            resultUrl = `<img src="${data.image.url}" alt="Upscaled image" style="max-width: 100%; border-radius: 12px;" />`;
          }
          // Check for chain-of-zoom images (returns multiple images array)
          else if (data.images && Array.isArray(data.images) && data.images.length > 0) {
            const imageElements = data.images.map((img: any, index: number) => 
              `<img src="${img.url}" alt="Zoom step ${index + 1}" style="max-width: 100%; border-radius: 12px; margin-bottom: 8px;" />`
            ).join('');
            resultUrl = `<div style="display: flex; flex-direction: column; gap: 8px;">${imageElements}</div>`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Processing image...') {
              newHistory.pop();
            }
            if (resultUrl) {
              newHistory.push({ role: 'model', content: resultUrl });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to process image.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to generate response.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedImageFile);
      return;
    }

    // Special handling for hunyuan-avatar (requires both audio file and image file)
    if (selectedModelObj?.value === 'hunyuan-avatar') {
      if (!attachedAudioFile) {
        setError('Please attach an audio file for hunyuan-avatar.');
        return;
      }
      if (!attachedImageFile) {
        setError('Please attach an image file for hunyuan-avatar.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read both files as base64
      const audioReader = new FileReader();
      const imageReader = new FileReader();
      
      Promise.all([
        new Promise<string>((resolve, reject) => {
          audioReader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === 'string') {
              resolve(result);
            } else {
              reject(new Error('Failed to read audio file'));
            }
          };
          audioReader.onerror = () => reject(new Error('Audio file reading failed'));
          audioReader.readAsDataURL(attachedAudioFile);
        }),
        new Promise<string>((resolve, reject) => {
          imageReader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === 'string') {
              resolve(result);
            } else {
              reject(new Error('Failed to read image file'));
            }
          };
          imageReader.onerror = () => reject(new Error('Image file reading failed'));
          imageReader.readAsDataURL(attachedImageFile);
        })
      ]).then(async ([audioBase64, imageBase64]) => {
        // Prepare payload
        const payload = {
          audio_file_base64: audioBase64,
          image_file_base64: imageBase64,
          prompt: input.trim() || "", // Optional text prompt
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'hunyuan-avatar'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        const userMessage = `Generate avatar animation from "${attachedImageFile.name}" and "${attachedAudioFile.name}"${input.trim() ? `: ${input.trim()}` : ''}`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedImageFile(null);
        setAttachedAudioFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Generating avatar animation...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (process.env.NODE_ENV !== 'production') {
          console.log('Hunyuan Avatar API Response:', data); // Debug logging
        }
          let resultUrl = null;
          // Check for video file
          if (data.video && data.video.url) {
            resultUrl = `<video controls style="max-width: 100%; border-radius: 12px;"><source src="${data.video.url}" type="video/mp4">Your browser does not support the video tag.</video>`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Generating avatar animation...') {
              newHistory.pop();
            }
            if (resultUrl) {
              newHistory.push({ role: 'model', content: resultUrl });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to generate avatar animation.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to generate response.');
          setLoading(false);
        }
      }).catch((err) => {
        setError('Failed to read files.');
        setLoading(false);
      });
      return;
    }

    // Special handling for Image-to-Video models
    if (selectedModelObj?.label.includes('(Image-to-Video)')) {
      if (!attachedImageFile) {
        setError('Please attach an image file.');
        return;
      }
             // ltx-video-v095/image-to-video, kling-video/v2/master/image-to-video, wan-effects, veo2/image-to-video, kling-video/v1.6/pro/image-to-video, minimax/video-01/image-to-video, bytedance/seedance/v1/lite/image-to-video, ltx-video-13b-dev/image-to-video, pika/v2/turbo/image-to-video, pika/v2.1/image-to-video, hunyuan-video-image-to-video, and hunyuan-video-img2vid-lora require both image and text prompt
       if ((selectedModelObj?.value === 'ltx-video-v095/image-to-video' || selectedModelObj?.value === 'kling-video/v2/master/image-to-video' || selectedModelObj?.value === 'wan-effects' || selectedModelObj?.value === 'veo2/image-to-video' || selectedModelObj?.value === 'kling-video/v1.6/pro/image-to-video' || selectedModelObj?.value === 'minimax/video-01/image-to-video' || selectedModelObj?.value === 'bytedance/seedance/v1/lite/image-to-video' || selectedModelObj?.value === 'ltx-video-13b-dev/image-to-video' || selectedModelObj?.value === 'pika/v2/turbo/image-to-video' || selectedModelObj?.value === 'pika/v2.1/image-to-video' || selectedModelObj?.value === 'hunyuan-video-image-to-video' || selectedModelObj?.value === 'hunyuan-video-img2vid-lora') && !input.trim()) {
         const errorMsg = selectedModelObj?.value === 'wan-effects' 
           ? 'Please enter a subject description for the effect (e.g., "a cute kitten").'
           : selectedModelObj?.value === 'veo2/image-to-video'
           ? 'Please enter a prompt describing how the image should be animated.'
           : 'Please enter a prompt describing what should happen in the video.';
         setError(errorMsg);
         return;
       }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read image file.');
          setLoading(false);
          return;
        }
        // Prepare payload
        const payload: any = {
          image_file_base64: base64,
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: selectedModelObj.value
        };
                 // Add prompt for ltx-video-v095/image-to-video, kling-video/v2/master/image-to-video, wan-effects, veo2/image-to-video, kling-video/v1.6/pro/image-to-video, minimax/video-01/image-to-video, bytedance/seedance/v1/lite/image-to-video, ltx-video-13b-dev/image-to-video, pika/v2/turbo/image-to-video, pika/v2.1/image-to-video, hunyuan-video-image-to-video, and hunyuan-video-img2vid-lora
         if (selectedModelObj?.value === 'ltx-video-v095/image-to-video' || selectedModelObj?.value === 'kling-video/v2/master/image-to-video' || selectedModelObj?.value === 'wan-effects' || selectedModelObj?.value === 'veo2/image-to-video' || selectedModelObj?.value === 'kling-video/v1.6/pro/image-to-video' || selectedModelObj?.value === 'minimax/video-01/image-to-video' || selectedModelObj?.value === 'bytedance/seedance/v1/lite/image-to-video' || selectedModelObj?.value === 'ltx-video-13b-dev/image-to-video' || selectedModelObj?.value === 'pika/v2/turbo/image-to-video' || selectedModelObj?.value === 'pika/v2.1/image-to-video' || selectedModelObj?.value === 'hunyuan-video-image-to-video' || selectedModelObj?.value === 'hunyuan-video-img2vid-lora') {
           payload.prompt = input.trim();
         }
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
                 const userMessage = (selectedModelObj?.value === 'ltx-video-v095/image-to-video' || selectedModelObj?.value === 'kling-video/v2/master/image-to-video' || selectedModelObj?.value === 'wan-effects' || selectedModelObj?.value === 'veo2/image-to-video' || selectedModelObj?.value === 'kling-video/v1.6/pro/image-to-video' || selectedModelObj?.value === 'minimax/video-01/image-to-video' || selectedModelObj?.value === 'bytedance/seedance/v1/lite/image-to-video' || selectedModelObj?.value === 'ltx-video-13b-dev/image-to-video' || selectedModelObj?.value === 'pika/v2/turbo/image-to-video' || selectedModelObj?.value === 'pika/v2.1/image-to-video' || selectedModelObj?.value === 'hunyuan-video-image-to-video' || selectedModelObj?.value === 'hunyuan-video-img2vid-lora')
           ? selectedModelObj?.value === 'wan-effects'
             ? `Apply effect to "${attachedImageFile.name}" with subject: ${input.trim()}`
             : selectedModelObj?.value === 'veo2/image-to-video'
             ? `Animate "${attachedImageFile.name}": ${input.trim()}`
             : `Generate video from "${attachedImageFile.name}": ${input.trim()}`
           : `Generate video from: ${attachedImageFile.name}`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedImageFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Generating video...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (process.env.NODE_ENV !== 'production') {
          console.log('Image-to-Video API Response:', data); // Debug logging
        }
          let resultUrl = null;
          // Check for video file
          if (data.video && data.video.url) {
            resultUrl = `<video controls style="max-width: 100%; border-radius: 12px;"><source src="${data.video.url}" type="video/mp4">Your browser does not support the video tag.</video>`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Generating video...') {
              newHistory.pop();
            }
            if (resultUrl) {
              newHistory.push({ role: 'model', content: resultUrl });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to generate video.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to generate response.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedImageFile);
      return;
    }

    // Special handling for pika/v2.2/pikascenes (Multi-Image-to-Video model that requires multiple images and prompt)
    if (selectedModelObj?.value === 'pika/v2.2/pikascenes') {
      if (!attachedImageFiles || attachedImageFiles.length === 0) {
        setError('Please attach at least one image file.');
        return;
      }
      if (!input.trim()) {
        setError('Please enter a prompt describing what should happen in the video.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      
      // Read all files as base64
      const readFilePromises = attachedImageFiles.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result;
            if (base64 && typeof base64 === 'string') {
              resolve(base64);
            } else {
              reject(new Error('Failed to read file'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      try {
        const base64Files = await Promise.all(readFilePromises);
        
        // Prepare payload
        const payload = {
          image_files_base64: base64Files,
          prompt: input.trim(),
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'pika/v2.2/pikascenes'
        };
        
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        
        setChatHistory(prev => [...prev, { role: 'user', content: `Generate Pika Scenes video from ${attachedImageFiles.length} image${attachedImageFiles.length > 1 ? 's' : ''}: ${input.trim()}` }]);
        setInput('');
        setAttachedImageFiles([]);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Generating Pika Scenes video from multiple images...' }]);
        
        const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (process.env.NODE_ENV !== 'production') {
          console.log('Pika Scenes API Response:', data); // Debug logging
        }
        let resultUrl = null;
        
        // Check for video file
        if (data.video && data.video.url) {
          resultUrl = `<video controls style="max-width: 100%; border-radius: 12px;"><source src="${data.video.url}" type="video/mp4">Your browser does not support the video tag.</video>`;
        }
        
        setLoading(false);
        setChatHistory(prev => {
          const newHistory = [...prev];
          if (newHistory.length && newHistory[newHistory.length - 1].content === 'Generating Pika Scenes video from multiple images...') {
            newHistory.pop();
          }
          if (resultUrl) {
            newHistory.push({ role: 'model', content: resultUrl });
          } else {
            newHistory.push({ role: 'model', content: 'Failed to generate video.' });
          }
          return newHistory;
        });
        // Add cost update
        const backendCost = data._cost_info?.cost_usd || getImageModelCost();
        setTotalCost(prev => prev + backendCost);
        // ... existing code ...
      } catch (err) {
        setError('Failed to generate response.');
        setLoading(false);
      }
      return;
    }

    // Special handling for single-image 3D models (hunyuan3d-v21, trellis, triposr)
    if ((selectedModelObj?.value === 'hunyuan3d-v21' || selectedModelObj?.value === 'trellis' || selectedModelObj?.value === 'triposr') && selectedModelObj.label.includes('(Image-to-3D)')) {
      if (!attachedImageFile) {
        setError('Please attach an image file.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read image file.');
          setLoading(false);
          return;
        }
        // Prepare payload
        const payload = {
          image_file_base64: base64,
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: selectedModelObj.value // Use the actual model value (hunyuan3d-v21, trellis, or triposr)
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        setChatHistory(prev => [...prev, { role: 'user', content: `Generated 3D model from: ${attachedImageFile.name}` }]);
        setInput('');
        setAttachedImageFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Generating 3D model...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (process.env.NODE_ENV !== 'production') {
          console.log('3D Model API Response:', data); // Debug logging
        }
          let resultUrl = null;
          // Check for 3D model files (different models return different field names)
          if (data.model_glb && data.model_glb.url) {
            // hunyuan3d-v21 returns model_glb
            const modelData = {
              type: '3d_model_hunyuan',
              url: data.model_glb.url,
              file_size: data.model_glb.file_size,
              title: '3D Model Generated Successfully!',
              model_glb_pbr: data.model_glb_pbr,
              model_mesh: data.model_mesh
            };
            resultUrl = JSON.stringify(modelData);
          } else if (data.model_mesh && data.model_mesh.url) {
            // trellis and triposr return model_mesh
            const modelData = {
              type: '3d_model',
              url: data.model_mesh.url,
              file_size: data.model_mesh.file_size,
              title: '3D Model Generated Successfully!'
            };
            resultUrl = JSON.stringify(modelData);
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Generating 3D model...') {
              newHistory.pop();
            }
            if (resultUrl) {
              newHistory.push({ role: 'model', content: resultUrl });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to generate 3D model.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to generate response.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedImageFile);
      return;
    }

    // Special handling for multi-image 3D models playground
    if ((selectedModelObj?.value === 'trellis/multi' || selectedModelObj?.value === 'hunyuan3d/v2' || selectedModelObj?.value === 'hunyuan3d/v2/turbo') && selectedModelObj.label.includes('(Image-to-3D)')) {
      if (!attachedImageFiles || attachedImageFiles.length === 0) {
        setError('Please attach multiple image files (at least 1).');
        return;
      }
    }
    
    // Special handling for hyper3d/rodin (supports both text-to-3D and image-to-3D)
    if (selectedModelObj?.value === 'hyper3d/rodin' && selectedModelObj.label.includes('(Image-to-3D)')) {
      // Allow either text prompt OR images (or both)
      if ((!attachedImageFiles || attachedImageFiles.length === 0) && !input.trim()) {
        setError('Please provide either a text prompt or attach image files (or both).');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      
      // Read all files as base64
      const readFilePromises = attachedImageFiles.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result;
            if (base64 && typeof base64 === 'string') {
              resolve(base64);
            } else {
              reject(new Error('Failed to read file'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      try {
        const base64Files = await Promise.all(readFilePromises);
        
        // Prepare payload
        const payload = {
          image_files_base64: base64Files,
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: selectedModelObj.value // Use the actual model value (trellis/multi, hunyuan3d/v2, etc.)
        };
        
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        
        setChatHistory(prev => [...prev, { role: 'user', content: `Generated 3D model from ${attachedImageFiles.length} images: ${attachedImageFiles.map(f => f.name).join(', ')}` }]);
        setInput('');
        setAttachedImageFiles([]);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Generating 3D model from multiple images...' }]);
        
        const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (process.env.NODE_ENV !== 'production') {
          console.log('Multi-image 3D Model API Response:', data); // Debug logging
        }
        let resultUrl = null;
        
        // Check for 3D model files (trellis/multi returns model_mesh)
        if (data.model_mesh && data.model_mesh.url) {
          // Store the 3D model data for React component rendering
          const modelData = {
            type: '3d_model',
            url: data.model_mesh.url,
            file_size: data.model_mesh.file_size,
            title: '3D Model Generated Successfully!'
          };
          resultUrl = JSON.stringify(modelData);
        }
        
        setLoading(false);
        setChatHistory(prev => {
          const newHistory = [...prev];
          if (newHistory.length && newHistory[newHistory.length - 1].content === 'Generating 3D model from multiple images...') {
            newHistory.pop();
          }
          if (resultUrl) {
            newHistory.push({ role: 'model', content: resultUrl });
          } else {
            newHistory.push({ role: 'model', content: 'Failed to generate 3D model.' });
          }
          return newHistory;
        });
        // Add cost update
        const backendCost = data._cost_info?.cost_usd || getImageModelCost();
        setTotalCost(prev => prev + backendCost);
        // ... existing code ...
      } catch (err) {
        setError('Failed to generate response.');
        setLoading(false);
      }
      return;
    }

    // Special handling for hyper3d/rodin playground (supports both text-to-3D and image-to-3D)
    if (selectedModelObj?.value === 'hyper3d/rodin' && selectedModelObj.label.includes('(Image-to-3D)')) {
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      
      let apiKey = '';
      try {
        const apiKeys = await secureStorage.getApiKeys();
        if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
          apiKey = apiKeys[0].key;
        }
      } catch {}
      if (!apiKey) {
        setError('No API key found. Please create an API key first.');
        setLoading(false);
        return;
      }

      // Handle both text-to-3D and image-to-3D modes
      if (attachedImageFiles && attachedImageFiles.length > 0) {
        // Image-to-3D mode (with optional text prompt)
        const base64Files = await Promise.all(
          attachedImageFiles.map(file => {
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                const result = e.target?.result;
                if (typeof result === 'string') {
                  resolve(result);
                } else {
                  reject(new Error('Failed to read file'));
                }
              };
              reader.onerror = () => reject(new Error('File reading failed'));
              reader.readAsDataURL(file);
            });
          })
        );

        const payload = {
          image_files_base64: base64Files,
          prompt: input.trim() || "", // Optional prompt for Image-to-3D
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'hyper3d/rodin'
        };

        setChatHistory(prev => [...prev, { role: 'user', content: input || `[${attachedImageFiles.length} image${attachedImageFiles.length > 1 ? 's' : ''} uploaded]` }]);
        setInput('');
        setAttachedImageFiles([]);
                          setChatHistory(prev => [...prev, { role: 'model', content: `Generating 3D model from ${attachedImageFiles.length} image${attachedImageFiles.length > 1 ? 's' : ''}${input.trim() ? ' and text prompt' : ''}...` }]);

         try {
           const response = await fetch(COMPLETIONS_API_URL, {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${apiKey}`,
             },
             body: JSON.stringify(payload),
           });

           const data = await response.json();
           if (process.env.NODE_ENV !== 'production') {
          console.log('Hyper3D/Rodin Image-to-3D API Response:', data); // Debug logging
        }
           let resultUrl = null;

          // Check for 3D model files (hyper3d/rodin returns model_mesh)
          if (data.model_mesh && data.model_mesh.url) {
            // Store the 3D model data for React component rendering
            const modelData = {
              type: '3d_model',
              url: data.model_mesh.url,
              file_size: data.model_mesh.file_size,
              title: '3D Model Generated Successfully!'
            };
            resultUrl = JSON.stringify(modelData);
          }

          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content.includes('Generating 3D model from')) {
              newHistory.pop();
            }
            if (resultUrl) {
              newHistory.push({ role: 'model', content: resultUrl });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to generate 3D model.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
        } catch (err) {
          setError('Failed to generate response.');
          setLoading(false);
        }
      } else {
        // Text-to-3D mode (text prompt only)
        const payload = {
          prompt: input,
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'hyper3d/rodin'
        };

        setChatHistory(prev => [...prev, { role: 'user', content: input }]);
        setInput('');
                          setChatHistory(prev => [...prev, { role: 'model', content: 'Generating 3D model from text prompt...' }]);

         try {
           const response = await fetch(COMPLETIONS_API_URL, {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${apiKey}`,
             },
             body: JSON.stringify(payload),
           });

           const data = await response.json();
           if (process.env.NODE_ENV !== 'production') {
          console.log('Hyper3D/Rodin Text-to-3D API Response:', data); // Debug logging
        }
           let resultUrl = null;

          // Check for 3D model files (hyper3d/rodin returns model_mesh)
          if (data.model_mesh && data.model_mesh.url) {
            // Store the 3D model data for React component rendering
            const modelData = {
              type: '3d_model',
              url: data.model_mesh.url,
              file_size: data.model_mesh.file_size,
              title: '3D Model Generated Successfully!'
            };
            resultUrl = JSON.stringify(modelData);
          }

          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Generating 3D model from text prompt...') {
              newHistory.pop();
            }
            if (resultUrl) {
              newHistory.push({ role: 'model', content: resultUrl });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to generate 3D model.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
        } catch (err) {
          setError('Failed to generate response.');
          setLoading(false);
        }
      }
      return;
    }

    // Special handling for playai/inpaint/diffusion playground
    if (selectedModelObj?.value === 'playai/inpaint/diffusion' && selectedModelObj.label.includes('(Audio-to-Audio)')) {
      if (!attachedAudioFile) {
        setError('Please attach an audio file.');
        return;
      }
      if (!input.trim()) {
        setError('Please enter the output text.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read audio file.');
          setLoading(false);
          return;
        }
        // Prepare payload
        const payload = {
          audio_file_base64: base64,
          prompt: input,
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'playai/inpaint/diffusion'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        setChatHistory(prev => [...prev, { role: 'user', content: input }]);
        setInput('');
        setAttachedAudioFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Generating audio...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultUrl = null;
          if (data.audio && data.audio.url) {
            resultUrl = `<audio src="${data.audio.url}" controls style="max-width: 100%; border-radius: 12px; background: #000;" />`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Generating audio...') {
              newHistory.pop();
            }
            if (resultUrl) {
              newHistory.push({ role: 'model', content: resultUrl });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to generate audio.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to generate response.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedAudioFile);
      return;
    }

    // Special handling for ace-step/audio-outpaint playground
    if (selectedModelObj?.value === 'ace-step/audio-outpaint' && selectedModelObj.label.includes('(Audio-to-Audio)')) {
      if (!attachedAudioFile) {
        setError('Please attach an audio file.');
        return;
      }
      if (!input.trim()) {
        setError('Please enter the tags (e.g., "lofi, hiphop, chill").');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read audio file.');
          setLoading(false);
          return;
        }
        // Prepare payload
        const payload = {
          audio_file_base64: base64,
          prompt: input,
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'ace-step/audio-outpaint'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        setChatHistory(prev => [...prev, { role: 'user', content: input }]);
        setInput('');
        setAttachedAudioFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Generating audio...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultUrl = null;
          if (data.audio && data.audio.url) {
            resultUrl = `<audio src="${data.audio.url}" controls style="max-width: 100%; border-radius: 12px; background: #000;" />`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Generating audio...') {
              newHistory.pop();
            }
            if (resultUrl) {
              newHistory.push({ role: 'model', content: resultUrl });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to generate audio.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to generate response.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedAudioFile);
      return;
    }

    // Special handling for ace-step/audio-inpaint playground
    if (selectedModelObj?.value === 'ace-step/audio-inpaint' && selectedModelObj.label.includes('(Audio-to-Audio)')) {
      if (!attachedAudioFile) {
        setError('Please attach an audio file.');
        return;
      }
      if (!input.trim()) {
        setError('Please enter the tags (e.g., "lofi, hiphop, chill").');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read audio file.');
          setLoading(false);
          return;
        }
        // Prepare payload
        const payload = {
          audio_file_base64: base64,
          prompt: input,
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'ace-step/audio-inpaint'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        setChatHistory(prev => [...prev, { role: 'user', content: input }]);
        setInput('');
        setAttachedAudioFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Generating audio...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultUrl = null;
          if (data.audio && data.audio.url) {
            resultUrl = `<audio src="${data.audio.url}" controls style="max-width: 100%; border-radius: 12px; background: #000;" />`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Generating audio...') {
              newHistory.pop();
            }
            if (resultUrl) {
              newHistory.push({ role: 'model', content: resultUrl });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to generate audio.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to generate response.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedAudioFile);
      return;
    }

    // Special handling for ace-step/audio-to-audio playground
    if (selectedModelObj?.value === 'ace-step/audio-to-audio' && selectedModelObj.label.includes('(Audio-to-Audio)')) {
      if (!attachedAudioFile) {
        setError('Please attach an audio file.');
        return;
      }
      if (!input.trim()) {
        setError('Please enter the new style tags (e.g., "jazz, smooth, relaxing").');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read audio file.');
          setLoading(false);
          return;
        }
        // Prepare payload
        const payload = {
          audio_file_base64: base64,
          prompt: input,
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'ace-step/audio-to-audio'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        setChatHistory(prev => [...prev, { role: 'user', content: input }]);
        setInput('');
        setAttachedAudioFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Generating audio...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultUrl = null;
          if (data.audio && data.audio.url) {
            resultUrl = `<audio src="${data.audio.url}" controls style="max-width: 100%; border-radius: 12px; background: #000;" />`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Generating audio...') {
              newHistory.pop();
            }
            if (resultUrl) {
              newHistory.push({ role: 'model', content: resultUrl });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to generate audio.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to generate response.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedAudioFile);
      return;
    }

    // Special handling for smart-turn (Audio-to-Text model for turn detection)
    if (selectedModelObj?.value === 'smart-turn' && selectedModelObj.label.includes('(Audio-to-Text)')) {
      if (!attachedAudioFile) {
        setError('Please attach an audio file for turn detection.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read audio file.');
          setLoading(false);
          return;
        }
        // Prepare payload
        const payload = {
          audio_file_base64: base64,
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'smart-turn'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        const userMessage = `Analyze turn detection for "${attachedAudioFile.name}"`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedAudioFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Analyzing audio for turn detection...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultText = null;
          // Handle smart-turn response format: { prediction: 1, probability: 0.85 }
          if (data.prediction !== undefined && data.probability !== undefined) {
            const turnType = data.prediction === 1 ? 'Complete' : 'Incomplete';
            const confidence = (data.probability * 100).toFixed(1);
            resultText = `**Turn Detection Results:**\n\n🎯 **Turn Type:** ${turnType}\n📊 **Confidence:** ${confidence}%\n\n${data.prediction === 1 ? '✅ The speaker has finished their turn' : '⏳ The speaker has not finished their turn'}`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Analyzing audio for turn detection...') {
              newHistory.pop();
            }
            if (resultText) {
              newHistory.push({ role: 'model', content: resultText });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to analyze audio for turn detection.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to analyze audio.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedAudioFile);
      return;
    }

    // Special handling for speech-to-text/turbo (Audio-to-Text model for speech transcription)
    if (selectedModelObj?.value === 'speech-to-text/turbo' && selectedModelObj.label.includes('(Audio-to-Text)')) {
      if (!attachedAudioFile) {
        setError('Please attach an audio file for speech transcription.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read audio file.');
          setLoading(false);
          return;
        }
        // Prepare payload
        const payload = {
          audio_file_base64: base64,
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'speech-to-text/turbo'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        const userMessage = `Transcribe speech from "${attachedAudioFile.name}"`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedAudioFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Transcribing audio...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultText = null;
          // Handle speech-to-text/turbo response format: { output: "transcribed text", partial: false }
          if (data.output !== undefined) {
            resultText = `**Speech Transcription:**\n\n📝 **Text:** ${data.output}\n\n${data.partial ? '⏳ Partial transcription (processing...)' : '✅ Complete transcription'}`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Transcribing audio...') {
              newHistory.pop();
            }
            if (resultText) {
              newHistory.push({ role: 'model', content: resultText });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to transcribe audio.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to transcribe audio.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedAudioFile);
      return;
    }

    // Special handling for speech-to-text/turbo/stream (Streaming Audio-to-Text model for speech transcription)
    if (selectedModelObj?.value === 'speech-to-text/turbo/stream' && selectedModelObj.label.includes('(Audio-to-Text)')) {
      if (!attachedAudioFile) {
        setError('Please attach an audio file for streaming speech transcription.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read audio file.');
          setLoading(false);
          return;
        }
        // Prepare payload
        const payload = {
          audio_file_base64: base64,
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'speech-to-text/turbo/stream'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        const userMessage = `Stream transcribe speech from "${attachedAudioFile.name}"`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedAudioFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Streaming speech transcription...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultText = null;
          // Handle speech-to-text/turbo/stream response format - similar to regular turbo but optimized for streaming
          if (data.output !== undefined) {
            resultText = `**Streaming Speech Transcription:**\n\n📝 **Text:** ${data.output}\n\n🚀 **Streaming Mode:** Optimized for real-time processing\n${data.partial ? '⏳ Partial transcription (processing...)' : '✅ Complete transcription'}`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Streaming speech transcription...') {
              newHistory.pop();
            }
            if (resultText) {
              newHistory.push({ role: 'model', content: resultText });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to transcribe audio with streaming.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to transcribe audio with streaming.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedAudioFile);
      return;
    }

    // Special handling for elevenlabs/speech-to-text (Advanced Audio-to-Text model with speaker identification)
    if (selectedModelObj?.value === 'elevenlabs/speech-to-text' && selectedModelObj.label.includes('(Audio-to-Text)')) {
      if (!attachedAudioFile) {
        setError('Please attach an audio file for advanced speech transcription.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      
      // Extract audio duration for accurate billing
      const getAudioDuration = (file: File): Promise<number> => {
        return new Promise((resolve) => {
          const audio = document.createElement('audio');
          const url = URL.createObjectURL(file);
          audio.src = url;
          audio.addEventListener('loadedmetadata', () => {
            URL.revokeObjectURL(url);
            resolve(audio.duration || 60); // Default to 60 seconds if duration can't be determined
          });
          audio.addEventListener('error', () => {
            URL.revokeObjectURL(url);
            resolve(60); // Default to 60 seconds on error
          });
        });
      };
      
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read audio file.');
          setLoading(false);
          return;
        }
        
        // Get audio duration for billing
        const audioDuration = await getAudioDuration(attachedAudioFile);
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔍 [FRONTEND] ElevenLabs audio duration detected:', audioDuration, 'seconds');
        }
        
        // Prepare payload with duration for accurate billing
        const payload = {
          audio_file_base64: base64,
          duration: audioDuration, // CRITICAL: Include actual audio duration for billing
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'elevenlabs/speech-to-text'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        const userMessage = `Advanced transcribe speech from "${attachedAudioFile.name}" (${audioDuration.toFixed(1)}s)`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedAudioFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Advanced speech transcription with ElevenLabs...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultText = null;
          // Handle elevenlabs/speech-to-text response format: { text: "...", language_code: "eng", language_probability: 0.95, words: [...] }
          if (data.text !== undefined) {
            const wordCount = data.words ? data.words.length : 0;
            const languageInfo = data.language_code ? `${data.language_code.toUpperCase()}` : 'Unknown';
            const confidence = data.language_probability ? `${(data.language_probability * 100).toFixed(1)}%` : 'N/A';
            
            // Check for speaker information
            const hasSpeakers = data.words && data.words.some((word: any) => word.speaker_id);
            const speakerCount = hasSpeakers ? new Set(data.words.filter((word: any) => word.speaker_id).map((word: any) => word.speaker_id)).size : 0;
            
            resultText = `**ElevenLabs Speech Transcription:**\n\n📝 **Text:** ${data.text}\n\n🌍 **Language:** ${languageInfo} (${confidence} confidence)\n📊 **Words:** ${wordCount} words detected\n${hasSpeakers ? `👥 **Speakers:** ${speakerCount} speaker${speakerCount !== 1 ? 's' : ''} identified` : '👤 **Speakers:** Single speaker mode'}\n🎯 **Features:** Word-level timestamps, speaker diarization, audio events\n⏱️ **Duration:** ${audioDuration.toFixed(1)} seconds`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Advanced speech transcription with ElevenLabs...') {
              newHistory.pop();
            }
            if (resultText) {
              newHistory.push({ role: 'model', content: resultText });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to transcribe audio with ElevenLabs.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to transcribe audio with ElevenLabs.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedAudioFile);
      return;
    }

    // Special handling for wizper (Whisper-based Audio-to-Text model with chunking)
    if (selectedModelObj?.value === 'wizper' && selectedModelObj.label.includes('(Audio-to-Text)')) {
      if (!attachedAudioFile) {
        setError('Please attach an audio file for Whisper transcription.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      
      // Extract audio duration for accurate billing
      const getAudioDuration = (file: File): Promise<number> => {
        return new Promise((resolve) => {
          const audio = document.createElement('audio');
          const url = URL.createObjectURL(file);
          audio.src = url;
          audio.addEventListener('loadedmetadata', () => {
            URL.revokeObjectURL(url);
            resolve(audio.duration || 60); // Default to 60 seconds if duration can't be determined
          });
          audio.addEventListener('error', () => {
            URL.revokeObjectURL(url);
            resolve(60); // Default to 60 seconds on error
          });
        });
      };
      
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read audio file.');
          setLoading(false);
          return;
        }
        
        // Get audio duration for billing
        const audioDuration = await getAudioDuration(attachedAudioFile);
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔍 [FRONTEND] Wizper audio duration detected:', audioDuration, 'seconds');
        }
        
        // Prepare payload with duration for accurate billing
        const payload = {
          audio_file_base64: base64,
          duration: audioDuration, // CRITICAL: Include actual audio duration for billing
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'wizper'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        const userMessage = `Whisper transcribe speech from "${attachedAudioFile.name}" (${audioDuration.toFixed(1)}s)`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedAudioFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Transcribing with Whisper (Wizper)...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultText = null;
          // Handle wizper response format: { text: "...", chunks: [{ timestamp: [start, end], text: "..." }] }
          if (data.text !== undefined) {
            const chunkCount = data.chunks ? data.chunks.length : 0;
            let chunksInfo = '';
            
            if (data.chunks && data.chunks.length > 0) {
              // Show first few chunks as examples
              const sampleChunks = data.chunks.slice(0, 3);
              const chunkSamples = sampleChunks.map((chunk: any, index: number) => {
                const start = chunk.timestamp ? chunk.timestamp[0] : 0;
                const end = chunk.timestamp ? chunk.timestamp[1] : 0;
                return `${index + 1}. [${start.toFixed(1)}s-${end.toFixed(1)}s] "${chunk.text}"`;
              }).join('\n');
              
              chunksInfo = `\n\n📋 **Chunks (${chunkCount} total):**\n${chunkSamples}${chunkCount > 3 ? '\n...' : ''}`;
            }
            
            resultText = `**Whisper (Wizper) Transcription:**\n\n📝 **Text:** ${data.text}\n\n🔧 **Model:** Whisper Large v3 (optimized)\n📊 **Segments:** ${chunkCount} timestamp chunks\n⏱️ **Duration:** ${audioDuration.toFixed(1)} seconds${chunksInfo}`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Transcribing with Whisper (Wizper)...') {
              newHistory.pop();
            }
            if (resultText) {
              newHistory.push({ role: 'model', content: resultText });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to transcribe audio with Wizper.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to transcribe audio with Wizper.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedAudioFile);
      return;
    }

    // Special handling for whisper (Audio-to-Text model with transcription and translation)
    if (selectedModelObj?.value === 'whisper' && selectedModelObj.label.includes('(Audio-to-Text)')) {
      if (!attachedAudioFile) {
        setError('Please attach an audio file for Whisper transcription.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      
      // Extract audio duration for accurate billing
      const getAudioDuration = (file: File): Promise<number> => {
        return new Promise((resolve) => {
          const audio = document.createElement('audio');
          const url = URL.createObjectURL(file);
          audio.src = url;
          audio.addEventListener('loadedmetadata', () => {
            URL.revokeObjectURL(url);
            resolve(audio.duration || 60); // Default to 60 seconds if duration can't be determined
          });
          audio.addEventListener('error', () => {
            URL.revokeObjectURL(url);
            resolve(60); // Default to 60 seconds on error
          });
        });
      };
      
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read audio file.');
          setLoading(false);
          return;
        }
        
        // Get audio duration for billing
        const audioDuration = await getAudioDuration(attachedAudioFile);
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔍 [FRONTEND] Whisper audio duration detected:', audioDuration, 'seconds');
        }
        
        // Prepare payload with duration for accurate billing
        const payload = {
          audio_file_base64: base64,
          duration: audioDuration, // CRITICAL: Include actual audio duration for billing
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'whisper'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        const userMessage = `Whisper transcribe speech from "${attachedAudioFile.name}" (${audioDuration.toFixed(1)}s)`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedAudioFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Transcribing with Whisper...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultText = null;
          // Handle whisper response format: { text: "...", chunks: [...], inferred_languages: [...], diarization_segments: [...] }
          if (data.text !== undefined) {
            const chunkCount = data.chunks ? data.chunks.length : 0;
            const languages = data.inferred_languages ? data.inferred_languages.join(', ') : 'Auto-detected';
            let chunksInfo = '';
            let diarizationInfo = '';
            
            if (data.chunks && data.chunks.length > 0) {
              // Show first few chunks as examples
              const sampleChunks = data.chunks.slice(0, 3);
              const chunkSamples = sampleChunks.map((chunk: any, index: number) => {
                const start = chunk.timestamp ? chunk.timestamp[0] : 0;
                const end = chunk.timestamp ? chunk.timestamp[1] : 0;
                const speaker = chunk.speaker ? ` (${chunk.speaker})` : '';
                return `${index + 1}. [${start.toFixed(1)}s-${end.toFixed(1)}s]${speaker} "${chunk.text}"`;
              }).join('\n');
              
              chunksInfo = `\n\n📋 **Chunks (${chunkCount} total):**\n${chunkSamples}${chunkCount > 3 ? '\n...' : ''}`;
            }
            
            if (data.diarization_segments && data.diarization_segments.length > 0) {
              const speakerCount = new Set(data.diarization_segments.map((seg: any) => seg.speaker)).size;
              diarizationInfo = `\n🎭 **Speakers:** ${speakerCount} detected`;
            }
            
            resultText = `**Whisper Transcription:**\n\n📝 **Text:** ${data.text}\n\n🌍 **Language:** ${languages}\n🔧 **Model:** Whisper Large v3\n📊 **Segments:** ${chunkCount} timestamp chunks\n⏱️ **Duration:** ${audioDuration.toFixed(1)} seconds${diarizationInfo}${chunksInfo}`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Transcribing with Whisper...') {
              newHistory.pop();
            }
            if (resultText) {
              newHistory.push({ role: 'model', content: resultText });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to transcribe audio with Whisper.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to transcribe audio with Whisper.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedAudioFile);
      return;
    }

    // Special handling for wan-vace-14b/outpainting (Video-to-Video model for outpainting)
    if (selectedModelObj?.value === 'wan-vace-14b/outpainting' && selectedModelObj.label.includes('(Video-to-Video)')) {
      if (!attachedVideoFile) {
        setError('Please attach a video file for outpainting.');
        return;
      }
      if (!input.trim()) {
        setError('Please enter a prompt describing the outpainting expansion.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read video file.');
          setLoading(false);
          return;
        }
        // Prepare payload
        const payload = {
          video_file_base64: base64,
          prompt: input.trim(),
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'wan-vace-14b/outpainting'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        const userMessage = `Outpaint video "${attachedVideoFile.name}": ${input.trim()}`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedVideoFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Generating outpainted video...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultText = null;
          // Handle wan-vace-14b/outpainting response format: { video: { url: "..." }, prompt: "...", seed: number }
          if (data.video && data.video.url) {
            const videoUrl = data.video.url;
            const promptUsed = data.prompt || input.trim();
            const seed = data.seed || 'N/A';
            
            resultText = `**Video Outpainting Complete:**\n\n🎬 **Video:** [Click to view](${videoUrl})\n\n📝 **Prompt:** ${promptUsed}\n🎲 **Seed:** ${seed}\n🔧 **Model:** WAN-VACE-14B Outpainting\n\n<video controls style="max-width: 100%; border-radius: 12px;"><source src="${videoUrl}" type="video/mp4">Your browser does not support the video tag.</video>`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Generating outpainted video...') {
              newHistory.pop();
            }
            if (resultText) {
              newHistory.push({ role: 'model', content: resultText });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to generate outpainted video.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to generate outpainted video.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedVideoFile);
      return;
    }

    // Special handling for ltx-video-13b-distilled/extend (Video-to-Video model for extending videos)
    if (selectedModelObj?.value === 'ltx-video-13b-distilled/extend' && selectedModelObj.label.includes('(Video-to-Video)')) {
      if (!attachedVideoFile) {
        setError('Please attach a video file to extend.');
        return;
      }
      if (!input.trim()) {
        setError('Please enter a prompt describing how to extend the video.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read video file.');
          setLoading(false);
          return;
        }
        // Prepare payload
        const payload = {
          video_file_base64: base64,
          prompt: input.trim(),
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'ltx-video-13b-distilled/extend'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        const userMessage = `Extend video "${attachedVideoFile.name}": ${input.trim()}`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedVideoFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Extending video...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultText = null;
          // Handle ltx-video-13b-distilled/extend response format: { video: { url: "..." }, prompt: "...", seed: number }
          if (data.video && data.video.url) {
            const videoUrl = data.video.url;
            const promptUsed = data.prompt || input.trim();
            const seed = data.seed || 'N/A';
            
            resultText = `<video controls style="max-width: 100%; border-radius: 12px;"><source src="${videoUrl}" type="video/mp4">Your browser does not support the video tag.</video>`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Extending video...') {
              newHistory.pop();
            }
            if (resultText) {
              newHistory.push({ role: 'model', content: resultText });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to extend video.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to extend video.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedVideoFile);
      return;
    }

    // Special handling for ltx-video-13b-dev/extend (Video-to-Video model for extending videos - dev version)
    if (selectedModelObj?.value === 'ltx-video-13b-dev/extend' && selectedModelObj.label.includes('(Video-to-Video)')) {
      if (!attachedVideoFile) {
        setError('Please attach a video file to extend.');
        return;
      }
      if (!input.trim()) {
        setError('Please enter a prompt describing how to extend the video.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read video file.');
          setLoading(false);
          return;
        }
        // Prepare payload
        const payload = {
          video_file_base64: base64,
          prompt: input.trim(),
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'ltx-video-13b-dev/extend'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        const userMessage = `Extend video "${attachedVideoFile.name}" (Dev Model): ${input.trim()}`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedVideoFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Extending video with dev model...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultText = null;
          // Handle ltx-video-13b-dev/extend response format: { video: { url: "..." }, prompt: "...", seed: number }
          if (data.video && data.video.url) {
            const videoUrl = data.video.url;
            const promptUsed = data.prompt || input.trim();
            const seed = data.seed || 'N/A';
            
            resultText = `<video controls style="max-width: 100%; border-radius: 12px;"><source src="${videoUrl}" type="video/mp4">Your browser does not support the video tag.</video>`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Extending video with dev model...') {
              newHistory.pop();
            }
            if (resultText) {
              newHistory.push({ role: 'model', content: resultText });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to extend video.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to extend video.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedVideoFile);
      return;
    }

    // Special handling for wan-vace-14b/inpainting (Video-to-Video model for inpainting with mask)
    if (selectedModelObj?.value === 'wan-vace-14b/inpainting' && selectedModelObj.label.includes('(Video-to-Video)')) {
      if (!attachedVideoFiles || attachedVideoFiles.length < 2) {
        setError('Please attach exactly 2 video files for inpainting (source video and mask video).');
        return;
      }
      if (attachedVideoFiles.length > 2) {
        setError('Please attach exactly 2 video files for inpainting (source video and mask video). You have attached more than 2.');
        return;
      }
      if (!input.trim()) {
        setError('Please enter a prompt describing what should be inpainted in the masked area.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read both video files as base64
      const sourceVideoReader = new FileReader();
      const maskVideoReader = new FileReader();
      
      Promise.all([
        new Promise<string>((resolve, reject) => {
          sourceVideoReader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === 'string') {
              resolve(result);
            } else {
              reject(new Error('Failed to read source video file'));
            }
          };
          sourceVideoReader.onerror = () => reject(new Error('Source video file reading failed'));
          sourceVideoReader.readAsDataURL(attachedVideoFiles[0]);
        }),
        new Promise<string>((resolve, reject) => {
          maskVideoReader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === 'string') {
              resolve(result);
            } else {
              reject(new Error('Failed to read mask video file'));
            }
          };
          maskVideoReader.onerror = () => reject(new Error('Mask video file reading failed'));
          maskVideoReader.readAsDataURL(attachedVideoFiles[1]);
        })
      ]).then(async ([sourceVideoBase64, maskVideoBase64]) => {
        // Prepare payload
        const payload = {
          video_file_base64: sourceVideoBase64,
          mask_video_file_base64: maskVideoBase64,
          prompt: input.trim(),
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'wan-vace-14b/inpainting'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        const sourceFileName = attachedVideoFiles[0].name;
        const maskFileName = attachedVideoFiles[1].name;
        const userMessage = `Inpaint video "${sourceFileName}" with mask "${maskFileName}": ${input.trim()}`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedVideoFiles([]);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Generating inpainted video...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultText = null;
          // Handle wan-vace-14b/inpainting response format: { video: { url: "..." }, prompt: "...", seed: number }
          if (data.video && data.video.url) {
            const videoUrl = data.video.url;
            const promptUsed = data.prompt || input.trim();
            const seed = data.seed || 'N/A';
            
            resultText = `**Video Inpainting Complete:**\n\n🎬 **Video:** [Click to view](${videoUrl})\n\n📝 **Prompt:** ${promptUsed}\n🎲 **Seed:** ${seed}\n🔧 **Model:** WAN-VACE-14B Inpainting\n📂 **Source:** ${sourceFileName}\n🎭 **Mask:** ${maskFileName}\n\n<video controls style="max-width: 100%; border-radius: 12px;"><source src="${videoUrl}" type="video/mp4">Your browser does not support the video tag.</video>`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Generating inpainted video...') {
              newHistory.pop();
            }
            if (resultText) {
              newHistory.push({ role: 'model', content: resultText });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to generate inpainted video.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to generate inpainted video.');
          setLoading(false);
        }
      }).catch((err) => {
        setError('Failed to read video files.');
        setLoading(false);
      });
      return;
    }

    // Special handling for ben/v2/video (Video-to-Video model for background removal - requires only video file, no prompt)
    if (selectedModelObj?.value === 'ben/v2/video' && selectedModelObj.label.includes('(Video-to-Video)')) {
      if (!attachedVideoFile) {
        setError('Please attach a video file for background removal.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result;
        if (!base64 || typeof base64 !== 'string') {
          setError('Failed to read video file.');
          setLoading(false);
          return;
        }
        // Prepare payload
        const payload = {
          video_file_base64: base64,
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'ben/v2/video'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        const userMessage = `Remove background from video "${attachedVideoFile.name}"`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedVideoFile(null);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Removing background from video...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          let resultText = null;
          // Handle ben/v2/video response format: { video: { url: "..." }, seed: number }
          if (data.video && data.video.url) {
            const videoUrl = data.video.url;
            const seed = data.seed || 'N/A';
            
            resultText = `<video controls style="max-width: 100%; border-radius: 12px;"><source src="${videoUrl}" type="video/mp4">Your browser does not support the video tag.</video>`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Removing background from video...') {
              newHistory.pop();
            }
            if (resultText) {
              newHistory.push({ role: 'model', content: resultText });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to remove background from video.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to remove background from video.');
          setLoading(false);
        }
      };
      reader.readAsDataURL(attachedVideoFile);
      return;
    }

    // Special handling for pixverse/v4.5/transition (requires two image files and prompt)
    if (selectedModelObj?.value === 'pixverse/v4.5/transition') {
      if (!attachedImageFiles || attachedImageFiles.length < 2) {
        setError('Please attach exactly 2 image files for pixverse/v4.5/transition (first and last frame).');
        return;
      }
      if (attachedImageFiles.length > 2) {
        setError('Please attach exactly 2 image files for pixverse/v4.5/transition (first and last frame). You have attached more than 2.');
        return;
      }
      if (!input.trim()) {
        setError('Please enter a prompt describing the transition between the images.');
        return;
      }
      setError(null);
      setLoading(true);
      setRequestStartTime(Date.now());
      // Read both image files as base64
      const firstImageReader = new FileReader();
      const lastImageReader = new FileReader();
      
      Promise.all([
        new Promise<string>((resolve, reject) => {
          firstImageReader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === 'string') {
              resolve(result);
            } else {
              reject(new Error('Failed to read first image file'));
            }
          };
          firstImageReader.onerror = () => reject(new Error('First image file reading failed'));
          firstImageReader.readAsDataURL(attachedImageFiles[0]);
        }),
        new Promise<string>((resolve, reject) => {
          lastImageReader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === 'string') {
              resolve(result);
            } else {
              reject(new Error('Failed to read last image file'));
            }
          };
          lastImageReader.onerror = () => reject(new Error('Last image file reading failed'));
          lastImageReader.readAsDataURL(attachedImageFiles[1]);
        })
      ]).then(async ([firstImageBase64, lastImageBase64]) => {
        // Prepare payload
        const payload = {
          first_image_file_base64: firstImageBase64,
          last_image_file_base64: lastImageBase64,
          prompt: input.trim(),
          source: 'playground',
          provider: 'capx_ivmodels',
          appId: 'pixverse/v4.5/transition'
        };
        let apiKey = '';
        try {
          const apiKeys = await secureStorage.getApiKeys();
          if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
            apiKey = apiKeys[0].key;
          }
        } catch {}
        if (!apiKey) {
          setError('No API key found. Please create an API key first.');
          setLoading(false);
          return;
        }
        const userMessage = `Create transition from "${attachedImageFiles[0].name}" to "${attachedImageFiles[1].name}": ${input.trim()}`;
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setAttachedImageFiles([]);
        setChatHistory(prev => [...prev, { role: 'model', content: 'Generating transition video...' }]);
        try {
          const res = await fetch(API_ENDPOINTS.COMPLETIONS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (process.env.NODE_ENV !== 'production') {
          console.log('Pixverse Transition API Response:', data); // Debug logging
        }
          let resultUrl = null;
          // Check for video file
          if (data.video && data.video.url) {
            resultUrl = `<video controls style="max-width: 100%; border-radius: 12px;"><source src="${data.video.url}" type="video/mp4">Your browser does not support the video tag.</video>`;
          }
          setLoading(false);
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length && newHistory[newHistory.length - 1].content === 'Generating transition video...') {
              newHistory.pop();
            }
            if (resultUrl) {
              newHistory.push({ role: 'model', content: resultUrl });
            } else {
              newHistory.push({ role: 'model', content: 'Failed to generate transition video.' });
            }
            return newHistory;
          });
          // Add cost update
          const backendCost = data._cost_info?.cost_usd || getImageModelCost();
          setTotalCost(prev => prev + backendCost);
          // ... existing code ...
        } catch (err) {
          setError('Failed to generate response.');
          setLoading(false);
        }
      }).catch((err) => {
        setError('Failed to read image files.');
        setLoading(false);
      });
      return;
    }

    if (!input.trim() || loading) return;
    setError(null);
    // Get latest API key from secure storage
    let apiKey = '';
    try {
      const apiKeys = await secureStorage.getApiKeys();
      if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
        apiKey = apiKeys[0].key;
      }
    } catch {}
    if (!apiKey) {
      setError('No API key found. Please create an API key first.');
      return;
    }
    const userMessage = { role: 'user' as const, content: input };
    setChatHistory(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setRequestStartTime(Date.now());
    try {
      let payload: any;
      let url = CHAT_API_URL;

      // Handle fal.ai image models
      if (selectedModelObj?.provider === 'capx_ivmodels') {
        url = COMPLETIONS_API_URL;
        payload = {
          prompt: input,
          max_tokens: outputLength,
          temperature,
          provider: 'capx_ivmodels',
          appId: selectedModelObj.value,
        };
        // Add this for ace-step
        if (selectedModelObj.value === 'ace-step') {
          payload.source = 'playground';
        }
        // Special case for elevenlabs/sound-effects: use 'text' and hardcode duration_seconds to 5 for playground
        if (selectedModelObj.value === 'elevenlabs/sound-effects') {
          payload = {
            text: input,
            provider: 'capx_ivmodels',
            appId: selectedModelObj.value,
            source: 'playground',
            duration_seconds: 5
          };
        }
        // Special case for elevenlabs/tts/multilingual-v2: use 'text' from chatbox and hardcode demo values for playground
        if (selectedModelObj.value === 'elevenlabs/tts/multilingual-v2') {
          payload = {
            text: input,
            provider: 'capx_ivmodels',
            appId: selectedModelObj.value,
            source: 'playground',
            voice: 'Aria',
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1
          };
        }
        // Special case for kokoro/hindi: use 'prompt' from chatbox and hardcode voice and speed for playground
        if (selectedModelObj.value === 'kokoro/hindi') {
          payload = {
            prompt: input,
            provider: 'capx_ivmodels',
            appId: selectedModelObj.value,
            source: 'playground',
            voice: 'hf_alpha',
            speed: 1
          };
        }

        // Special async polling for Fal.ai image, video, audio, and 3D models
        let generatingMsg = 'Generating response...';
        if (selectedModelObj?.label.includes('(Video)') || selectedModelObj?.label.includes('(Video-to-Video)')) {
          generatingMsg = 'Generating video...';
        } else if (selectedModelObj?.label.includes('(Image)')) {
          generatingMsg = 'Generating image...';
        } else if (selectedModelObj?.label.includes('(Audio)')) {
          generatingMsg = 'Generating audio...';
        } else if (selectedModelObj?.label.includes('(Image-to-3D)')) {
          generatingMsg = 'Generating 3D model...';
        }
        setChatHistory(prev => [...prev, { role: 'model', content: generatingMsg }]);
        try {
          // 1. Submit the generation request
          const submitRes = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const submitData = await submitRes.json();
          
          // Handle synchronous models that return results immediately
          let resultUrl: string | null = null;
          
          // Check for direct audio response
          if (submitData.audio && submitData.audio.url) {
            const audioUrl = submitData.audio.url;
            resultUrl = `<audio src="${audioUrl}" controls style="max-width: 100%; border-radius: 12px; background: #000;" />`;
          }
          // Check for direct audio_file response (for stable-audio)
          else if (submitData.audio_file && submitData.audio_file.url) {
            const audioUrl = submitData.audio_file.url;
            resultUrl = `<audio src="${audioUrl}" controls style="max-width: 100%; border-radius: 12px; background: #000;" />`;
          }
          // Check for direct video response
          else if (submitData.video && submitData.video.url) {
            const videoUrl = submitData.video.url;
            resultUrl = `<video controls style="max-width: 100%; border-radius: 12px;"><source src="${videoUrl}" type="video/mp4">Your browser does not support the video tag.</video>`;
          }
          else if (submitData.videos && Array.isArray(submitData.videos) && submitData.videos[0]) {
            const videoUrl = typeof submitData.videos[0] === 'string' ? submitData.videos[0] : submitData.videos[0].url;
            resultUrl = `<video controls style="max-width: 100%; border-radius: 12px;"><source src="${videoUrl}" type="video/mp4">Your browser does not support the video tag.</video>`;
          }
          // Check for direct image response
          else if (submitData.images && Array.isArray(submitData.images) && submitData.images[0]) {
            const imageUrl = typeof submitData.images[0] === 'string' ? submitData.images[0] : submitData.images[0].url;
            resultUrl = `<img src="${imageUrl}" alt="Generated image" style="max-width: 100%; border-radius: 12px;" />`;
          }
          
          // If we have a direct result, handle it immediately
          if (resultUrl) {
            // Use backend-calculated cost instead of frontend estimate
            const backendCost = submitData._cost_info?.cost_usd || getImageModelCost();
            setTotalCost(prev => prev + backendCost);
            const responseTime = requestStartTime ? Date.now() - requestStartTime : 0;
            setTtft(responseTime / 1000);
            const estimatedTokens = input.length / 4;
            setTotalTokens(prev => prev + estimatedTokens);
            
            // Update chat history
            setLoading(false);
            setChatHistory(prev => {
              const newHistory = [...prev];
              if (newHistory.length && 
                (newHistory[newHistory.length - 1].content === 'Generating image...' ||
                 newHistory[newHistory.length - 1].content === 'Generating video...' ||
                 newHistory[newHistory.length - 1].content === 'Generating audio...' ||
                 newHistory[newHistory.length - 1].content === 'Generating response...')) {
                newHistory.pop();
              }
              newHistory.push({ role: 'model', content: resultUrl });
              return newHistory;
            });
            return;
          }
          
          // Handle async models that return task_id
          if (!submitData || !submitData.task_id) {
            throw new Error(submitData?.error || JSON.stringify(submitData));
          }
          // 2. Poll for status
          let pollCount = 0;
          const maxPolls = (selectedModelObj?.label.includes('(Video)') || selectedModelObj?.label.includes('(Video-to-Video)')) ? 60 : 30;
          let pollingResultUrl = null;
          let completed = false;
          while (pollCount < maxPolls && !completed) {
            await new Promise(res => setTimeout(res, 2000));
            const statusRes = await fetch(
              API_ENDPOINTS.COMPLETIONS_STATUS(submitData.task_id),
              { headers: { 'Authorization': `Bearer ${apiKey}` } }
            );
            const statusData = await statusRes.json();
            if (statusData.status === 'COMPLETED') {
              completed = true;
              break;
            }
            if (statusData.status === 'FAILED' || statusData.status === 'failed') {
              break;
            }
            pollCount++;
          }
          if (completed) {
            // Fetch the final result from backend, not Fal.ai directly
            try {
              const resultRes = await fetch(API_ENDPOINTS.COMPLETIONS_RESULT(submitData.task_id), {
                headers: { 'Authorization': `Bearer ${apiKey}` },
              });
              const resultData = await resultRes.json();
              // Always set total cost from backend _cost_info if present (for async models)
              if (resultData._cost_info?.cost_usd !== undefined) {
                setTotalCost(resultData._cost_info.cost_usd);
                if (process.env.NODE_ENV !== 'production') {
          console.log('Sidebar cost updated:', resultData._cost_info.cost_usd);
        }
              } else {
                console.warn('Sidebar cost not updated, _cost_info missing:', resultData);
              }
              // Video support
              if (selectedModelObj?.label.includes('(Video)') || selectedModelObj?.label.includes('(Video-to-Video)')) {
                let videoUrl = null;
                if (resultData.video && resultData.video.url) {
                  videoUrl = resultData.video.url;
                }
                if (!videoUrl && resultData.output && Array.isArray(resultData.output.videos) && resultData.output.videos[0]) {
                  videoUrl = resultData.output.videos[0];
                } else if (!videoUrl && Array.isArray(resultData.videos) && (typeof resultData.videos[0] === 'string' || (resultData.videos[0] && resultData.videos[0].url))) {
                  videoUrl = typeof resultData.videos[0] === 'string' ? resultData.videos[0] : resultData.videos[0].url;
                }
                if (videoUrl) {
                  pollingResultUrl = `<video controls style="max-width: 100%; border-radius: 12px;"><source src="${videoUrl}" type="video/mp4">Your browser does not support the video tag.</video>`;
                }
              } else if (selectedModelObj?.label.includes('(Audio)')) {
                // Audio support
                let audioUrl = null;
                if (resultData.audio && resultData.audio.url) {
                  audioUrl = resultData.audio.url;
                }
                // Add support for audio_file (for stable-audio)
                if (!audioUrl && resultData.audio_file && resultData.audio_file.url) {
                  audioUrl = resultData.audio_file.url;
                }
                if (!audioUrl && resultData.output && Array.isArray(resultData.output.audios) && resultData.output.audios[0]) {
                  audioUrl = resultData.output.audios[0];
                } else if (!audioUrl && Array.isArray(resultData.audios) && (typeof resultData.audios[0] === 'string' || (resultData.audios[0] && resultData.audios[0].url))) {
                  audioUrl = typeof resultData.audios[0] === 'string' ? resultData.audios[0] : resultData.audios[0].url;
                }
                if (audioUrl) {
                  pollingResultUrl = `<audio src="${audioUrl}" controls style="max-width: 100%; border-radius: 12px; background: #000;" />`;
                }
              } else {
                // Image support (default)
                if (
                  resultData.output &&
                  Array.isArray(resultData.output.images) &&
                  resultData.output.images[0]
                ) {
                  pollingResultUrl = resultData.output.images[0];
                } else if (
                  Array.isArray(resultData.images) &&
                  (typeof resultData.images[0] === 'string' || (resultData.images[0] && resultData.images[0].url))
                ) {
                  pollingResultUrl = typeof resultData.images[0] === 'string' ? resultData.images[0] : resultData.images[0].url;
                }
                if (pollingResultUrl) {
                  pollingResultUrl = `<img src="${pollingResultUrl}" alt="Generated image" style="max-width: 100%; border-radius: 12px;" />`;
                }
              }
            } catch (err) {
              console.error('Fal.ai fetch final result error:', err);
            }
          }
          // Handle successful generation
          if (pollingResultUrl) {
            // Calculate timing metrics
            const responseTime = requestStartTime ? Date.now() - requestStartTime : 0;
            setTtft(responseTime / 1000);
            // For these models, we don't have token counts, so we'll estimate
            const estimatedTokens = input.length / 4; // Rough estimate: 4 chars per token
            setTotalTokens(prev => prev + estimatedTokens);
          }
        } catch (err) {
          console.error('Fal.ai error:', err);
          setError('Failed to generate response.');
          setChatHistory(prev => {
            const newHistory = [...prev];
            let lastIdx = newHistory.length - 1;
            while (lastIdx >= 0 && !['Generating image...', 'Generating video...', 'Generating audio...', 'Generating 3D model...'].includes(newHistory[lastIdx].content)) lastIdx--;
            if (lastIdx >= 0) newHistory.splice(lastIdx, 1);
            newHistory.push({ role: 'model', content: `Error: ${err instanceof Error ? err.message : JSON.stringify(err)}` });
            return newHistory;
          });
        }
        setLoading(false);
        return;
      }

      // Handle text models with chat endpoint
      payload = {
        messages: [
          ...chatHistory.map(msg => ({
            role: msg.role === 'model' ? 'assistant' : msg.role,
            content: msg.content
          })),
          { role: 'user', content: input },
        ],
        max_tokens: outputLength,
        temperature,
        model: selectedModelObj?.value,
      };
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      
      // Calculate timing metrics
      const responseTime = requestStartTime ? Date.now() - requestStartTime : 0;
      
      let modelContent = '';
      if (data.choices && data.choices[0] && data.choices[0].message) {
        modelContent = data.choices[0].message?.content || '';
      } else if (data.images && data.images[0] && data.images[0].url) {
        modelContent = data.images[0].url;
      } else if (data.error) {
        modelContent = `Error: ${
          typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
        }`;
      } else {
        modelContent = 'No response.';
      }
      
      // Extract usage data if available (only for text models, not image models)
      if (data.usage && selectedModelObj?.provider !== 'capx_ivmodels') {
        const inputTokens = data.usage.prompt_tokens || 0;
        const outputTokens = data.usage.completion_tokens || 0;
        const totalRequestTokens = data.usage.total_tokens || (inputTokens + outputTokens);
        
        // Update total tokens
        setTotalTokens(prev => prev + totalRequestTokens);
        
        // Use backend-calculated cost instead of frontend calculation
        const backendCost = data._cost_info?.cost_usd || calculateTokenCost(inputTokens, outputTokens, selectedModel);
        
        // Update total cost with backend value
        setTotalCost(prev => prev + backendCost);
        
        // Calculate TTFT (Time to First Token) - using response time as approximation
        setTtft(responseTime / 1000);
        
        // Calculate TPS (Tokens Per Second)
        if (responseTime > 0) {
          const calculatedTps = Math.round((outputTokens / (responseTime / 1000)) * 100) / 100;
          setTps(calculatedTps);
        }
      }
      
      setChatHistory(prev => [...prev, { role: 'model', content: modelContent }]);
    } catch (err: any) {
      setError('Failed to get response.');
      setChatHistory(prev => [...prev, { role: 'model', content: 'Error: Failed to get response.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  // Add this helper function inside PlaygroundPage
  const fetchRecentGenerationCost = async (userId: string, taskId: string) => {
    try {
      const res = await fetch(`/api/recent-generation-cost?user_id=${userId}&task_id=${taskId}`);
      const data = await res.json();
      if (data.final_cost_usd_cents !== undefined) {
        setTotalCost(data.final_cost_usd_cents / 100);
        if (process.env.NODE_ENV !== 'production') {
          console.log('Sidebar cost updated from log:', data.final_cost_usd_cents / 100);
        }
      } else {
        console.warn('Sidebar cost not updated from log:', data);
      }
    } catch (err) {
      console.error('Failed to fetch recent generation cost:', err);
    }
  };

  useEffect(() => {
    if (user?.id && user?.email) {
      const jwt = getCurrentJWTSync();
      if (jwt) {
        fetchUserBalance(user.email, jwt).then(bal => {
          if (bal !== null) {
            // Don't set total cost to balance - it should start at 0
            // setTotalCost(bal);
            secureStorage.setBalance(bal);
          }
        });
      }
    }
  }, [location, user?.id, user?.email]);

  // Reset total cost to 0 when user changes or page loads
  useEffect(() => {
    setTotalCost(0);
  }, [user?.id]);

  return (
    <div className="playground-page-outer">
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
      
      {/* Mobile Playground View */}
      <div className="mobile-playground-view">
        <div className="mobile-playground-card">
          <div className="mobile-playground-content">
            <div className="mobile-playground-icon">
              <img src="/images/playground-union-icon.svg" alt="Playground" />
            </div>
            <div className="mobile-playground-text">
              <h2 className="mobile-playground-title">View Playground on desktop</h2>
              <p className="mobile-playground-subtitle">Playground is best viewed on a larger screen</p>
            </div>
            <button 
              className="mobile-playground-button"
              onClick={() => handleNavigation('/models')}
            >
              View Models
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Playground View */}
      <div className="desktop-playground-view">
      <div className="playground-flex-layout">
        {/* Main Section (Contains everything except right panel) */}
        <div className="playground-main-section">
          {/* Top Bar */}
          <div className="playground-topbar">
            <div className="playground-topbar-left">
              <div className="playground-model-repo">
                <span className="playground-model-repo-text">{selectedModelObj?.label || 'Select Model'}</span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <img
                    src="/images/copy.png"
                    alt="Copy"
                    className="playground-topbar-ext"
                    width={24}
                    height={24}
                    onClick={handleCopyModelName}
                    style={{ cursor: 'pointer' }}
                  />
                  {modelNameCopied && (
                    <span
                      style={{
                        position: 'absolute',
                        left: '28px',
                        background: '#333',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Copied!
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="playground-topbar-right">
              <div className="playground-topbar-icon" onClick={handleRestartChat} style={{ cursor: 'pointer' }}>
                <img src="/images/coolicon.svg" alt="Refresh" width={20} height={20} />
              </div>
            </div>
          </div>

          {/* Center Content (Chat History) */}
          <div className="playground-center-content" style={{ width: '100%', maxWidth: 700, margin: '0 auto', paddingTop: 32 }}>
            <div className="playground-chat-history" ref={chatHistoryContainerRef}>
              {chatHistory.length === 0 && (
                <div style={{ textAlign: 'center', color: '#bbb', marginTop: 40 }}>
                  Start a conversation with <b>{selectedModelObj?.label}</b>
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  margin: '12px 0',
                }}>
                  <div style={{
                    background: msg.role === 'user' ? '#232323' : '#181818',
                    color: '#fff',
                    borderRadius: 12,
                    padding: '12px 18px',
                    maxWidth: '80%',
                    fontSize: 16,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {(() => {
                    // Handle 3D model data (trellis/multi and hunyuan3d/v2)
                    if (msg.content.startsWith('{') && msg.content.includes('"type":"3d_model"')) {
                      try {
                        const modelData = JSON.parse(msg.content);
                        return (
                          <div style={{ padding: 16, background: '#232323', borderRadius: 12, color: '#fff' }}>
                            <p style={{ margin: '0 0 12px 0', fontWeight: 'bold' }}>{modelData.title}</p>
                            
                            {/* 3D Model Viewer */}
                            <div style={{ margin: '12px 0', background: '#000', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                              {/* Try model-viewer first */}
                              <model-viewer 
                                src={modelData.url}
                                alt="Generated 3D Model"
                                auto-rotate="true"
                                camera-controls="true"
                                style={{ 
                                  width: '100%', 
                                  height: '400px', 
                                  background: 'linear-gradient(135deg, #1e1e1e, #2a2a2a)',
                                  display: 'block'
                                }}
                                loading="eager"
                                reveal="auto"
                                shadow-intensity="1"
                                environment-image="neutral"
                                exposure="1"
                              />

                              
                              {/* Loading indicator */}
                              <div style={{ 
                                position: 'absolute', 
                                top: '50%', 
                                left: '50%', 
                                transform: 'translate(-50%, -50%)', 
                                color: '#666', 
                                fontSize: '14px',
                                pointerEvents: 'none',
                                textAlign: 'center'
                              }}>
                                Loading 3D Model...
                              </div>
                            </div>
                            
                            {/* Download Links */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                              <a 
                                href={modelData.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                style={{ 
                                  color: '#4CAF50', 
                                  textDecoration: 'none', 
                                  padding: '8px 12px', 
                                  background: '#333', 
                                  borderRadius: 6, 
                                  display: 'inline-block' 
                                }}
                              >
                                📦 Download 3D Model ({Math.round(modelData.file_size / 1024)}KB)
                              </a>
                            </div>
                          </div>
                        );
                      } catch (e) {
                        return msg.content;
                      }
                    }
                    
                    // Handle 3D model data (hunyuan3d-v21)
                    if (msg.content.startsWith('{') && msg.content.includes('"type":"3d_model_hunyuan"')) {
                      try {
                        const modelData = JSON.parse(msg.content);
                        return (
                          <div style={{ padding: 16, background: '#232323', borderRadius: 12, color: '#fff' }}>
                            <p style={{ margin: '0 0 12px 0', fontWeight: 'bold' }}>{modelData.title}</p>
                            
                            {/* 3D Model Viewer */}
                            <div style={{ margin: '12px 0', background: '#000', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                              <model-viewer 
                                src={modelData.url}
                                alt="Generated 3D Model"
                                auto-rotate="true"
                                camera-controls="true"
                                style={{ 
                                  width: '100%', 
                                  height: '400px', 
                                  background: 'linear-gradient(135deg, #1e1e1e, #2a2a2a)',
                                  display: 'block'
                                }}
                                loading="eager"
                                reveal="auto"
                                shadow-intensity="1"
                                environment-image="neutral"
                                exposure="1"
                              />
                              
                              {/* Loading indicator */}
                              <div style={{ 
                                position: 'absolute', 
                                top: '50%', 
                                left: '50%', 
                                transform: 'translate(-50%, -50%)', 
                                color: '#666', 
                                fontSize: '14px',
                                pointerEvents: 'none',
                                textAlign: 'center'
                              }}>
                                Loading 3D Model...
                              </div>
                            </div>
                            
                            {/* Download Links */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                              <a 
                                href={modelData.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                style={{ 
                                  color: '#4CAF50', 
                                  textDecoration: 'none', 
                                  padding: '8px 12px', 
                                  background: '#333', 
                                  borderRadius: 6, 
                                  display: 'inline-block' 
                                }}
                              >
                                📦 Download GLB Model ({Math.round(modelData.file_size / 1024)}KB)
                              </a>
                              {modelData.model_glb_pbr && modelData.model_glb_pbr.url && (
                                <a 
                                  href={modelData.model_glb_pbr.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  style={{ 
                                    color: '#2196F3', 
                                    textDecoration: 'none', 
                                    padding: '8px 12px', 
                                    background: '#333', 
                                    borderRadius: 6, 
                                    display: 'inline-block' 
                                  }}
                                >
                                  ✨ Download PBR Model (Enhanced)
                                </a>
                              )}
                              {modelData.model_mesh && modelData.model_mesh.url && (
                                <a 
                                  href={modelData.model_mesh.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  style={{ 
                                    color: '#FF9800', 
                                    textDecoration: 'none', 
                                    padding: '8px 12px', 
                                    background: '#333', 
                                    borderRadius: 6, 
                                    display: 'inline-block' 
                                  }}
                                >
                                  🗂️ Download Mesh Assets
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      } catch (e) {
                        return msg.content;
                      }
                    }
                    
                    // Handle other HTML content
                    if (msg.content.trim().startsWith('<img') || msg.content.trim().startsWith('<video') || msg.content.trim().startsWith('<audio') || msg.content.trim().startsWith('<div')) {
                      // Use content directly for AI-generated responses
                      const content = msg.content;
                      
                      // Use safer rendering approach for media content
                      if (content.includes('<img')) {
                        const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
                        if (imgMatch) {
                          return (
                            <img 
                              src={imgMatch[1]} 
                              alt="Generated content" 
                              style={{ 
                                display: 'block', 
                                maxWidth: '100%', 
                                width: '100%', 
                                borderRadius: 10,
                                maxHeight: '400px',
                                objectFit: 'contain'
                              }} 
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const nextSibling = e.currentTarget.nextSibling as HTMLElement;
                                if (nextSibling) {
                                  nextSibling.style.display = 'block';
                                }
                              }}
                            />
                          );
                        }
                      }
                      
                      if (content.includes('<video')) {
                        const videoMatch = content.match(/<video[^>]+src=["']([^"']+)["'][^>]*>/i);
                        if (videoMatch) {
                          return (
                            <video 
                              src={videoMatch[1]} 
                              controls
                              style={{ 
                                display: 'block', 
                                maxWidth: '100%', 
                                width: '100%', 
                                borderRadius: 10,
                                maxHeight: '400px'
                              }}
                            />
                          );
                        }
                      }
                      
                      if (content.includes('<audio')) {
                        const audioMatch = content.match(/<audio[^>]+src=["']([^"']+)["'][^>]*>/i);
                        if (audioMatch) {
                          return (
                            <audio 
                              src={audioMatch[1]} 
                              controls
                              style={{ 
                                display: 'block', 
                                maxWidth: '100%', 
                                width: '100%',
                                borderRadius: 10
                              }}
                            />
                          );
                        }
                      }
                      
                      // Fallback to dangerouslySetInnerHTML for AI-generated content
                      return (
                        <span
                          dangerouslySetInnerHTML={{ __html: content }}
                          style={{ display: 'block', maxWidth: '100%', width: '100%', borderRadius: 10 }}
                        />
                      );
                    }
                    
                    // Handle direct URLs
                    if (msg.content.startsWith('http')) {
                      return <img src={msg.content} alt="Generated" style={{ maxWidth: 320, maxHeight: 240, borderRadius: 10, width: '100%', height: 'auto' }} />;
                    }
                    
                    // Handle regular text
                    return msg.content;
                  })()}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
              {loading && (
                <div style={{ color: '#bbb', textAlign: 'center', marginTop: 16 }}>Generating response...</div>
              )}
              {error && (
                <div style={{ color: 'red', textAlign: 'center', marginTop: 16 }}>{error}</div>
              )}
            </div>
          </div>

          {/* Chat Input Bar at the bottom */}
          <div className="playground-chatbar-outer">
            {/* Show attached files for hunyuan-avatar (both audio and image) */}
            {selectedModelObj?.value === 'hunyuan-avatar' && (attachedAudioFile || attachedImageFile) && (
              <div style={{ marginBottom: 8 }}>
                {attachedAudioFile && (
                  <div style={{ display: 'flex', alignItems: 'center', background: '#232323', color: '#fff', borderRadius: 8, padding: '6px 12px', marginBottom: 4, maxWidth: 320 }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎵 {attachedAudioFile.name}</span>
                    <button
                      onClick={() => { setAttachedAudioFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      style={{ marginLeft: 12, background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                      title="Remove audio file"
                      aria-label="Remove attached audio file"
                    >
                      ×
                    </button>
                  </div>
                )}
                {attachedImageFile && (
                  <div style={{ display: 'flex', alignItems: 'center', background: '#232323', color: '#fff', borderRadius: 8, padding: '6px 12px', marginBottom: 4, maxWidth: 320 }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🖼️ {attachedImageFile.name}</span>
                    <button
                      onClick={() => { setAttachedImageFile(null); if (imageFileInputRef.current) imageFileInputRef.current.value = ""; }}
                      style={{ marginLeft: 12, background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                      title="Remove image file"
                      aria-label="Remove attached image file"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* Show attached audio file above chatbox for Audio-to-Audio and Audio-to-Text models */}
            {(selectedModelObj?.label.includes('(Audio-to-Audio)') || selectedModelObj?.label.includes('(Audio-to-Text)')) && selectedModelObj?.value !== 'hunyuan-avatar' && attachedAudioFile && (
              <div style={{ display: 'flex', alignItems: 'center', background: '#232323', color: '#fff', borderRadius: 8, padding: '6px 12px', marginBottom: 8, maxWidth: 320 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedAudioFile.name}</span>
                <button
                  onClick={() => { setAttachedAudioFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  style={{ marginLeft: 12, background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                  title="Remove file"
                  aria-label="Remove attached file"
                >
                  ×
                </button>
              </div>
            )}
            {/* Show attached image file above chatbox for single image models (Image-to-3D, Image-to-Image, and Image-to-Video) */}
            {(selectedModelObj?.label.includes('(Image-to-3D)') || selectedModelObj?.label.includes('(Image-to-Image)') || selectedModelObj?.label.includes('(Image-to-Video)')) && selectedModelObj?.value !== 'trellis/multi' && selectedModelObj?.value !== 'hunyuan3d/v2' && selectedModelObj?.value !== 'hunyuan3d/v2/turbo' && selectedModelObj?.value !== 'hyper3d/rodin' && selectedModelObj?.value !== 'hunyuan-avatar' && selectedModelObj?.value !== 'pika/v2.2/pikascenes' && attachedImageFile && (
              <div style={{ display: 'flex', alignItems: 'center', background: '#232323', color: '#fff', borderRadius: 8, padding: '6px 12px', marginBottom: 8, maxWidth: 320 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedImageFile.name}</span>
                <button
                  onClick={() => { setAttachedImageFile(null); if (imageFileInputRef.current) imageFileInputRef.current.value = ""; }}
                  style={{ marginLeft: 12, background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                  title="Remove file"
                  aria-label="Remove attached file"
                >
                  ×
                </button>
              </div>
            )}
            {/* Show attached video file above chatbox for Video-to-Video models */}
            {selectedModelObj?.label.includes('(Video-to-Video)') && attachedVideoFile && (
              <div style={{ display: 'flex', alignItems: 'center', background: '#232323', color: '#fff', borderRadius: 8, padding: '6px 12px', marginBottom: 8, maxWidth: 320 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎬 {attachedVideoFile.name}</span>
                <button
                  onClick={() => { setAttachedVideoFile(null); if (videoFileInputRef.current) videoFileInputRef.current.value = ""; }}
                  style={{ marginLeft: 12, background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                  title="Remove video file"
                  aria-label="Remove attached video file"
                >
                  ×
                </button>
              </div>
            )}
            {/* Show attached multiple video files above chatbox for multi-video models */}
            {selectedModelObj?.value === 'wan-vace-14b/inpainting' && attachedVideoFiles.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {attachedVideoFiles.map((file, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', background: '#232323', color: '#fff', borderRadius: 8, padding: '6px 12px', marginBottom: 4, maxWidth: 320 }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {index === 0 ? '🎬 Source: ' : '🎭 Mask: '}{file.name}
                    </span>
                    <button
                      onClick={() => { setAttachedVideoFiles(prev => prev.filter((_, i) => i !== index)); if (multiVideoFileInputRef.current) multiVideoFileInputRef.current.value = ""; }}
                      style={{ marginLeft: 12, background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                      title="Remove video file"
                      aria-label="Remove attached video file"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Show attached multiple image files above chatbox for multi-image models */}
            {(selectedModelObj?.value === 'trellis/multi' || selectedModelObj?.value === 'hunyuan3d/v2' || selectedModelObj?.value === 'hunyuan3d/v2/turbo' || selectedModelObj?.value === 'hyper3d/rodin' || selectedModelObj?.value === 'pika/v2.2/pikascenes') && attachedImageFiles.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {attachedImageFiles.map((file, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', background: '#232323', color: '#fff', borderRadius: 8, padding: '6px 12px', marginBottom: 4, maxWidth: 320 }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {index + 1}. {file.name}
                    </span>
                    <button
                      onClick={() => { setAttachedImageFiles(prev => prev.filter((_, i) => i !== index)); if (multiImageFileInputRef.current) multiImageFileInputRef.current.value = ""; }}
                      style={{ marginLeft: 12, background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                      title="Remove file"
                      aria-label="Remove attached file"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="playground-chatbar">
              {/* Special attachment buttons for hunyuan-avatar (both audio and image) */}
              {selectedModelObj?.value === 'hunyuan-avatar' && (
                <>
                  <button
                    className="playground-chatbar-attach"
                    style={{ marginRight: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach audio file"
                    disabled={loading}
                  >
                    <img src="/images/key.png" alt="Attach Audio" style={{ width: 24, height: 24 }} />
                  </button>
                  <input
                    type="file"
                    accept="audio/*"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setAttachedAudioFile(e.target.files[0]);
                      }
                    }}
                  />
                  <button
                    className="playground-chatbar-attach"
                    style={{ marginRight: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => imageFileInputRef.current?.click()}
                    title="Attach image file"
                    disabled={loading}
                  >
                    <img src="/images/key.png" alt="Attach Image" style={{ width: 24, height: 24 }} />
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    ref={imageFileInputRef}
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setAttachedImageFile(e.target.files[0]);
                      }
                    }}
                  />
                </>
              )}
              {/* Audio file attach button for Audio-to-Audio and Audio-to-Text models */}
              {(selectedModelObj?.label.includes('(Audio-to-Audio)') || selectedModelObj?.label.includes('(Audio-to-Text)')) && selectedModelObj?.value !== 'hunyuan-avatar' && (
                <>
                  <button
                    className="playground-chatbar-attach"
                    style={{ marginRight: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach audio file"
                    disabled={loading}
                  >
                    <img src="/images/key.png" alt="Attach" style={{ width: 24, height: 24 }} />
                  </button>
                  <input
                    type="file"
                    accept="audio/*"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setAttachedAudioFile(e.target.files[0]);
                      }
                    }}
                  />
                </>
              )}
              {/* Image file attach button for single image models (Image-to-3D, Image-to-Image, and Image-to-Video) */}
              {(selectedModelObj?.label.includes('(Image-to-3D)') || selectedModelObj?.label.includes('(Image-to-Image)') || selectedModelObj?.label.includes('(Image-to-Video)')) && selectedModelObj?.value !== 'trellis/multi' && selectedModelObj?.value !== 'hunyuan3d/v2' && selectedModelObj?.value !== 'hunyuan3d/v2/turbo' && selectedModelObj?.value !== 'hyper3d/rodin' && selectedModelObj?.value !== 'hunyuan-avatar' && selectedModelObj?.value !== 'pika/v2.2/pikascenes' && (
                <>
                  <button
                    className="playground-chatbar-attach"
                    style={{ marginRight: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => imageFileInputRef.current?.click()}
                    title="Attach image file"
                    disabled={loading}
                  >
                    <img src="/images/key.png" alt="Attach" style={{ width: 24, height: 24 }} />
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    ref={imageFileInputRef}
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setAttachedImageFile(e.target.files[0]);
                      }
                    }}
                  />
                </>
              )}
              {/* Video file attach button for Video-to-Video models */}
              {selectedModelObj?.label.includes('(Video-to-Video)') && selectedModelObj?.value !== 'wan-vace-14b/inpainting' && (
                <>
                  <button
                    className="playground-chatbar-attach"
                    style={{ marginRight: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => videoFileInputRef.current?.click()}
                    title="Attach video file"
                    disabled={loading}
                  >
                    <img src="/images/key.png" alt="Attach Video" style={{ width: 24, height: 24 }} />
                  </button>
                  <input
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    ref={videoFileInputRef}
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setAttachedVideoFile(e.target.files[0]);
                      }
                    }}
                  />
                </>
              )}
              {/* Multiple video files attach button for wan-vace-14b/inpainting */}
              {selectedModelObj?.value === 'wan-vace-14b/inpainting' && (
                <>
                  <button
                    className="playground-chatbar-attach"
                    style={{ marginRight: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => multiVideoFileInputRef.current?.click()}
                    title="Attach 2 video files (source video and mask video)"
                    disabled={loading}
                  >
                    <img src="/images/key.png" alt="Attach Videos" style={{ width: 24, height: 24 }} />
                  </button>
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    style={{ display: 'none' }}
                    ref={multiVideoFileInputRef}
                    onChange={e => {
                      if (e.target.files) {
                        const newFiles = Array.from(e.target.files);
                        setAttachedVideoFiles(prev => [...prev, ...newFiles]);
                      }
                    }}
                  />
                </>
              )}
              {/* Multiple image files attach button for multi-image models */}
              {(selectedModelObj?.value === 'trellis/multi' || selectedModelObj?.value === 'hunyuan3d/v2' || selectedModelObj?.value === 'hunyuan3d/v2/turbo' || selectedModelObj?.value === 'hyper3d/rodin' || selectedModelObj?.value === 'pika/v2.2/pikascenes') && (
                <>
                  <button
                    className="playground-chatbar-attach"
                    style={{ marginRight: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => {
                      const ref = multiImageFileInputRef.current;
                      if (ref && typeof ref.click === 'function') ref.click();
                    }}
                    title="Attach multiple image files"
                    disabled={loading}
                  >
                    <img src="/images/key.png" alt="Attach" style={{ width: 24, height: 24 }} />
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    ref={multiImageFileInputRef}
                    onChange={e => {
                      if (e.target.files) {
                        const newFiles = Array.from(e.target.files);
                        setAttachedImageFiles(prev => [...prev, ...newFiles]);
                      }
                    }}
                  />
                </>
              )}

              <input
                className="playground-chatbar-input"
                placeholder="Start typing"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                ref={inputRef}
                disabled={loading}
              />
              <button className="playground-chatbar-send" onClick={handleSend} disabled={loading}>
                <img src="/images/paper-plane.png" alt="Send" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel Section */}
        <div className="playground-right-panel-section">
          <div className="playground-panel-settings-bar">
            
          </div>
          <aside className="playground-right-panel">
            <div className="playground-panel-content">
              {/* Model Selector */}
              <div className="playground-panel-section">
                <label className="playground-label">Model</label>
                <div className="playground-dropdown" style={{ padding: 0 }}>
                  <ModelDropdown
                    models={MODEL_OPTIONS}
                    selectedModel={selectedModel}
                    setSelectedModelAndNavigate={(modelValue) => {
                      setSelectedModel(modelValue);
                      navigate(`/playground?model=${encodeURIComponent(modelValue)}`);
                    }}
                    disabled={loading} // Pass loading as disabled prop
                  />
                </div>
              </div>
              {/* Stats 2x2 Grid */}
              <div className="playground-stats-grid">
                <div className="playground-stat-box">
                  <div className="playground-stat-label">Total Cost</div>
                  <div className="playground-stat-value">{totalCost.toFixed(7)} USD</div>
                  <div className="playground-stat-sub">AI4Everyone</div>
                </div>
                <div className="playground-stat-box">
                  <div className="playground-stat-label">TTFT</div>
                  <div className="playground-stat-value">{ttft ? `${ttft.toFixed(2)}s` : '-'}</div>
                </div>
                <div className="playground-stat-box">
                  <div className="playground-stat-label">TPS</div>
                  <div className="playground-stat-value">{tps ? `${tps.toFixed(1)}` : '-'}</div>
                </div>
                <div className="playground-stat-box">
                  <div className="playground-stat-label">Total Tokens</div>
                  <div className="playground-stat-value">{totalTokens}</div>
                </div>
              </div>
              {/* Settings */}
              <div className="playground-panel-section">
                <div className="playground-panel-heading">Settings</div>
             
                <div className="playground-form-group">
                  <label className="playground-label">Output Length</label>
                  <div className="playground-slider-row">
                    <input
                      type="range"
                      min="256"
                      max="4096"
                      value={outputLength}
                      onChange={e => setOutputLength(Number(e.target.value))}
                      className="playground-slider"
                    />
                    <div className="playground-slider-value">{outputLength}</div>
                  </div>
                  <div className="playground-slider-desc">Set the maximum token length of generated text</div>
                </div>
                <div className="playground-form-group">
                  <label className="playground-label">Temperature</label>
                  <div className="playground-slider-row">
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.01"
                      value={temperature}
                      onChange={e => setTemperature(Number(e.target.value))}
                      className="playground-slider"
                    />
                    <div className="playground-slider-value">{temperature === 0 ? '0' : temperature === 2 ? '2' : temperature.toFixed(2)}</div>
                  </div>
                  <div className="playground-slider-desc">Control how creative you'd like the model to be when responding to you</div>
                </div>
                <div className="playground-form-group">
                  <label className="playground-label">Response Format</label>
                  <div className="playground-dropdown">
                    <span>{getResponseFormat()}</span>
                  </div>
                </div>
              </div>
              {/* Sampling & Safety */}
              <div className="playground-panel-section">
                <div className="playground-panel-heading">Sampling</div>
                <div className="playground-form-group">
                  <label className="playground-label">Safety Models</label>
                  <div className="playground-dropdown">
                    <span>{selectedModelObj?.label || 'No model selected'}</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      </div>
    </div>
  );
};

export default PlaygroundPage; 
