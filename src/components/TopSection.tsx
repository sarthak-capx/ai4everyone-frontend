import { useState } from 'react';
import { Copy } from 'lucide-react';
import { secureClipboardCopy } from '../utils/secureClipboard';
import { useNavigate } from 'react-router-dom';
import { Highlight, themes } from 'prism-react-renderer';
import { codeTypeScript } from '../constants/landingPageTSCode';
import { codePython } from '../constants/landingPagePythonCode';
import { codeCurl } from '../constants/landingPageCodeUrl';

const TopSection = () => {
  const [activeTab, setActiveTab] = useState('TypeScript');
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

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

  return (
    <section className="flex flex-col md:bg-transparent bg-[#121214]">
      <div className="w-full h-[220px] md:h-[250px] overflow-hidden relative bg-[#142C96]">
        <img
          src="/images/image 8.svg"
          alt="AI4Everyone Banner"
          className="w-full h-full object-cover object-center relative z-[1] hidden md:block"
        />
        <img
          src="/images/Frame 43.png"
          alt="AI4Everyone Mobile Banner"
          className="w-full h-full object-cover object-center md:hidden block relative z-[1]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-black/80 to-transparent z-[2]"></div>
      </div>

      <div className="flex flex-col items-start max-w-[1200px] md:w-[90%] w-full mx-auto md:mt-[-35px] relative z-[3] px-4 md:px-0 md:bg-transparent bg-[#121214]">
        <h1 className="font-black text-[36px] text-white"><span className="text-[40px]">Welcome to</span><br />UNSTOPPABLE</h1>

        <p className="text-sm md:text-base text-[#999999] text-left mb-4 w-full">
          The universal API gateway to the world's best AI models—text, image, audio, video, and beyond.
        </p>

        <p className="text-sm leading-6 text-white text-left mb-10 md:max-w-[70%] max-w-full">
          Unstoppable simplifies the way you interact with multimodal AI. With a single API key, developers can access state-of-the-art models for text generation, image creation, audio synthesis, video generation, and more — all in one place. No need to juggle multiple platforms or manage separate keys.
        </p>

        <div className="w-full bg-black rounded-md overflow-hidden shadow-none mb-10 border border-[#888]">
          <div className="flex lg:flex-row flex-col justify-between lg:items-center items-stretch bg-[#111] px-4 py-2 border-b border-[#888] gap-3">
            <div className="flex border border-[#888] rounded-md w-full lg:w-1/3 h-auto lg:h-8">
              <button
                className={`px-3 py-2 bg-[#111] text-[#888] text-xs rounded-md lg:mr-1 mr-0 w-full lg:w-1/3 transition-colors hover:bg-[#222] hover:text-[#ddd] ${activeTab === 'TypeScript' ? 'bg-[#222] text-white' : ''}`}
                onClick={() => handleTabClick('TypeScript')}
              >
                TypeScript
              </button>
              <button
                className={`px-3 py-2 bg-[#111] text-[#888] text-xs rounded-md lg:mr-1 mr-0 w-full lg:w-1/3 transition-colors hover:bg-[#222] hover:text-[#ddd] ${activeTab === 'Python' ? 'bg-[#222] text-white' : ''}`}
                onClick={() => handleTabClick('Python')}
              >
                Python
              </button>
              <button
                className={`px-3 py-2 bg-[#111] text-[#888] text-xs rounded-md w-full lg:w-1/3 transition-colors hover:bg-[#222] hover:text-[#ddd] ${activeTab === 'Curl' ? 'bg-[#222] text-white' : ''}`}
                onClick={() => handleTabClick('Curl')}
              >
                Curl
              </button>
            </div>
            <div className="flex items-center gap-2 lg:self-auto self-start">
              <div className="relative">
                <button
                  className="bg-[#222] font-mono text-white border-0 px-3 py-2 rounded text-xs transition-colors hover:bg-[#333] flex items-center gap-1"
                  onClick={() => handleCopy(activeTab === 'TypeScript' ? codeTypeScript : activeTab === 'Python' ? codePython : codeCurl)}
                >
                  <Copy size={16} />
                  {copied ? 'Copied !' : 'Copy'}
                </button>
              </div>
              <button className="bg-blue-500 font-mono text-white border-0 px-4 py-2 rounded text-xs transition-colors hover:bg-blue-600" onClick={() => navigate('/api-keys')}>
                View API Key
              </button>
            </div>
          </div>

          <div className="p-4 md:p-5 relative max-h-[320px] md:max-h-[500px] overflow-y-auto bg-black font-mono text-[12px] md:text-[13px] leading-[1.5] max-w-[1200px] w-full mx-auto">
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
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TopSection;