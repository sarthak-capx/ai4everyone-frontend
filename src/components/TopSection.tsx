import React, { useState } from 'react';
import { Copy, ExternalLink, Home, Box, Cpu, BarChart2, Key, Settings, FileText, X, LogOut, MessageCircle } from 'lucide-react';
import { secureClipboardCopy } from '../utils/secureClipboard';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from './UserContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import '../styles/TopSection.css';
import { Highlight, themes } from 'prism-react-renderer';
import { API_ENDPOINTS } from '../config';
import { secureStorage } from '../utils/secureStorage';
import { safeNavigate } from '../utils/validation';

const codeTypeScript = `// Get started with just a few lines of code. Here's how you can use your API key to generate responses using powerful models.

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
        }`;

const codePython = `import requests

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

const codeCurl = `# ===== TEXT GENERATION (Language Models) =====
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

const TopSection = () => {
  const [activeTab, setActiveTab] = useState('TypeScript');
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useUser();
  const { disconnect } = useDisconnect();

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    setCopied(false);
  };

  const handleCopy = (code: string) => {
            secureClipboardCopy(code, { 
          isSensitive: false, 
          showNotification: true 
        });
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleNavigation = (path: string) => {
    // 🔒 SECURITY: Use safe navigation with validation
    if (safeNavigate(navigate, path)) {
      setMobileMenuOpen(false);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    setUser(null);
    // Use secure logout with cross-tab synchronization
    secureStorage.secureLogout();
    disconnect();
    setMobileMenuOpen(false);
  };

  return (
    <section className="top-section">
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
      
      <div className="home-content-container">
        <h1 className="mainheading">Welcome to<br/>UNSTOPPABLE</h1>
        
        <p className="sub_title">
        The universal API gateway to the world's best AI models—text, image, audio, video, and beyond.
        </p>
        
        <p className="description">
        Unstoppable simplifies the way you interact with multimodal AI. With a single API key, developers can access state-of-the-art models for text generation, image creation, audio synthesis, video generation, and more — all in one place. No need to juggle multiple platforms or manage separate keys.
        </p>
        
        <div className="code-block-container">
          <div className="code-block-header">
            <div className="code-tabs">
              <button 
                className={`tab ${activeTab === 'TypeScript' ? 'active' : ''}`}
                onClick={() => handleTabClick('TypeScript')}
              >
                TypeScript
              </button>
              <button 
                className={`tab ${activeTab === 'Python' ? 'active' : ''}`}
                onClick={() => handleTabClick('Python')}
              >
                Python
              </button>
              <button 
                className={`tab ${activeTab === 'Curl' ? 'active' : ''}`}
                onClick={() => handleTabClick('Curl')}
              >
                Curl
              </button>
            </div>
            <button className="view-api-key" onClick={() => navigate('/api-keys')}>
              View API Key
            </button>
          </div>
          
          <div className="code-content">
            {activeTab === 'TypeScript' && (
              <>
                <Highlight 
                  code={codeTypeScript} 
                  language="typescript" 
                  theme={themes.vsDark}
                >
                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre className={className} style={{ ...style, background: '#000', fontSize: 13, margin: 0, padding: '20px' }}>
                      {tokens.map((line, i) => (
                        <div key={i} {...getLineProps({ line, key: i })}>
                          {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token, key })} />
                          ))}
                        </div>
                      ))}
                    </pre>
                  )}
                </Highlight>
                <button className="copy-button" onClick={() => handleCopy(codeTypeScript)}>
                  <Copy size={18} />
                </button>
              </>
            )}
            {activeTab === 'Python' && (
              <>
                <Highlight 
                  code={codePython} 
                  language="python" 
                  theme={themes.vsDark}
                >
                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre className={className} style={{ ...style, background: '#000', fontSize: 13, margin: 0, padding: '20px' }}>
                      {tokens.map((line, i) => (
                        <div key={i} {...getLineProps({ line, key: i })}>
                          {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token, key })} />
                          ))}
                        </div>
                      ))}
                    </pre>
                  )}
                </Highlight>
                <button className="copy-button" onClick={() => handleCopy(codePython)}>
                  <Copy size={18} />
                </button>
              </>
            )}
            {activeTab === 'Curl' && (
              <>
                <Highlight 
                  code={codeCurl} 
                  language="bash" 
                  theme={themes.vsDark}
                >
                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre className={className} style={{ ...style, background: '#000', fontSize: 13, margin: 0, padding: '20px' }}>
                      {tokens.map((line, i) => (
                        <div key={i} {...getLineProps({ line, key: i })}>
                          {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token, key })} />
                          ))}
                        </div>
                      ))}
                    </pre>
                  )}
                </Highlight>
                <button className="copy-button" onClick={() => handleCopy(codeCurl)}>
                  <Copy size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TopSection;