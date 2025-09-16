import React from 'react';
import { ExternalLink } from 'lucide-react';
import '../styles/BottomSection.css';
import { useUser } from './UserContext';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS, API_BASE_URL } from '../config';
import { secureStorage, getCurrentJWTSync } from '../utils/secureStorage';
import { secureClipboardCopy } from '../utils/secureClipboard';

const BottomSection = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const previewCache = {} as Record<string, any>;
  const [showCopied, setShowCopied] = useState(false);

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      setLogs([]);
      let userId = user?.id;
      
      if (userId) {
        try {
          const logsUrl = `${API_ENDPOINTS.LOGS}?user_id=${userId}&limit=10`;
          const logsRes = await fetch(logsUrl);
          const logsData = await logsRes.json();
          // Handle new API response format with logs array and pagination
          if (logsData && logsData.logs && Array.isArray(logsData.logs)) {
            setLogs(logsData.logs);
          } else if (Array.isArray(logsData)) {
            // Fallback for old format
            setLogs(logsData);
          } else {
            setLogs([]);
          }
        } catch (err) {
          setLogs([]);
          console.error('Error fetching logs by user_id:', err);
        } finally {
          setLoading(false);
        }
        return;
      }
      
      // Fallback: fetch API key from secure storage and fetch logs by api_key
      let key = null;
      try {
        const apiKeys = await secureStorage.getApiKeys();
        if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
          key = apiKeys[0].key;
        }
      } catch (err) {
        console.error('Error parsing API keys from secure storage:', err);
      }

      // If no cached key and we have a JWT, repopulate api_keys_cache from server
      const jwt = getCurrentJWTSync();
      if (!key && jwt) {
        try {
          const res = await fetch(API_ENDPOINTS.API_KEYS, {
            headers: { Authorization: `Bearer ${jwt}` }
          });
          if (res.ok) {
            const serverApiKeys = await res.json();
            if (Array.isArray(serverApiKeys) && serverApiKeys.length > 0) {
              await secureStorage.setApiKeys(serverApiKeys);
              key = serverApiKeys[0].key;
            }
          }
        } catch (e) {
          console.error('Failed to repopulate api_keys_cache:', e);
        }
      }
      setApiKey(key);
      
      if (key) {
        try {
          const logsUrl = `${API_ENDPOINTS.LOGS}?api_key=${key}&limit=10`;
          const logsRes = await fetch(logsUrl);
          const logsData = await logsRes.json();
          // Handle new API response format with logs array and pagination
          if (logsData && logsData.logs && Array.isArray(logsData.logs)) {
            setLogs(logsData.logs);
          } else if (Array.isArray(logsData)) {
            // Fallback for old format
            setLogs(logsData);
          } else {
            setLogs([]);
          }
        } catch (err) {
          setLogs([]);
          console.error('Error fetching logs by api_key:', err);
        } finally {
          setLoading(false);
        }
      } else {
        setLogs([]);
        setLoading(false);
      }
    }
    fetchLogs();
  }, [user]);

  const handleCopyApiKey = async () => {
    try {
      const key = await secureStorage.getApiKeys();
      const jwt = getCurrentJWTSync();
      if (!key && jwt) {
        // Fetch API keys if not cached
        const res = await fetch(API_ENDPOINTS.API_KEYS, {
          headers: { Authorization: `Bearer ${jwt}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          const serverApiKeys = Array.isArray(data) ? data : [];
          await secureStorage.setApiKeys(serverApiKeys);
          
          if (serverApiKeys.length > 0) {
            await secureClipboardCopy(serverApiKeys[0].key, { isSensitive: true });
            setShowCopied(true);
            setTimeout(() => setShowCopied(false), 2000);
          }
        }
      } else if (key && key.length > 0) {
        await secureClipboardCopy(key[0].key, { isSensitive: true });
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy API key:', error);
    }
  };

  // Helper to format log data
  function formatTokens(usage: any) {
    if (!usage) return '';
    if (typeof usage === 'string') {
      try { usage = JSON.parse(usage); } catch { return ''; }
    }
    if (usage.total_tokens) return `Total: ${usage.total_tokens}`;
    if (usage.prompt_tokens || usage.completion_tokens)
      return `P: ${usage.prompt_tokens || 0}, C: ${usage.completion_tokens || 0}`;
    return '';
  }
  function formatModel(log: any) {
    // Use the model name from backend (already set to provider names)
    if (log.model) {
      return log.model;
    }
    
    // Fallback logic only if backend doesn't provide model name
    const usage = log.inference_usage_json || {};
    if (usage.model) {
      return usage.model;
    }
    if (usage.model_name) {
      return usage.model_name;
    }
    
    // Check endpoint patterns for fallback
    if (log.endpoint_called?.includes('chat/completions')) return 'capx_textmodels';
    if (log.endpoint_called?.includes('completions/result')) return 'capx_ivmodels';
    if (log.endpoint_called?.includes('completions')) return 'capx_ivmodels';
    
    return 'Unknown Model';
  }
  function formatType(log: any) {
    // Check inference_usage_json for actual content type
    const usage = log.inference_usage_json || {};
    
    // Check for direct URLs in usage
    if (usage.image_url) return 'Image';
    if (usage.video_url) return 'Video';
    if (usage.audio_url) return 'Audio';
    
    // Check for task_id which indicates async generation (image/video/audio)
    if (usage.task_id) {
      // Check endpoint to determine type
      if (log.endpoint?.includes('completions/result')) {
        // This could be image, video, or audio - need to check the actual result
        // For now, we'll check if there's any indication in the usage
        if (usage.model?.toLowerCase().includes('image')) return 'Image';
        if (usage.model?.toLowerCase().includes('video')) return 'Video';
        if (usage.model?.toLowerCase().includes('audio')) return 'Audio';
        // Default for completions/result is usually image
        return 'Image';
      }
    }
    
    // Check endpoint patterns
    if (log.endpoint?.includes('chat/completions')) return 'Text';
    if (log.endpoint?.includes('completions')) return 'Text';
    
    // Default fallback
    return 'Text';
  }
  function formatStatus(code: number) {
    if (!code) return '';
    if (code >= 200 && code < 300) return 'Completed';
    if (code >= 400 && code < 500) return 'Failed';
    return 'In Progress';
  }
  function formatDate(ts: string) {
    return ts ? new Date(ts).toLocaleString() : '';
  }
  function formatCost(cost: number) {
    if (cost == null || cost === 0) return '$0.000000';
    return `$${cost.toFixed(6)}`;
  }

  function PreviewCell({ log, apiKey }: { log: any, apiKey: string | null }) {
    const [preview, setPreview] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [modalOpen, setModalOpen] = React.useState(false);
    const isMounted = useRef(true);
    React.useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

    const usage = log.inference_usage_json || {};
    const imageUrl = typeof usage.image_url === 'string' ? usage.image_url : usage.image_url?.url;
    const videoUrl = typeof usage.video_url === 'string' ? usage.video_url : usage.video_url?.url;
    const audioUrl = typeof usage.audio_url === 'string' ? usage.audio_url : usage.audio_url?.url;
    const taskId = usage.task_id;

    React.useEffect(() => {
      if (imageUrl || videoUrl || audioUrl) return;
      if (!taskId) return;
      if (previewCache[taskId]) {
        setPreview(previewCache[taskId]);
        return;
      }
      setLoading(true);
      setError(null);
      fetch(API_ENDPOINTS.COMPLETIONS_RESULT(taskId), {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      })
        .then(res => res.json())
        .then(result => {
          let img = result.output?.images?.[0]?.url || result.images?.[0]?.url || result.images?.[0];
          let vid = result.output?.video?.url || result.video?.url;
          let aud = result.output?.audio?.url || result.audio?.url;
          const previewObj = { img, vid, aud };
          previewCache[taskId] = previewObj;
          if (isMounted.current) setPreview(previewObj);
          if (!img && !vid && !aud) setError('No preview found in result.');
        })
        .catch((e) => { if (isMounted.current) { setPreview(null); setError('Failed to load preview.'); } })
        .finally(() => { if (isMounted.current) setLoading(false); });
    }, [taskId, imageUrl, videoUrl, audioUrl, apiKey]);

    // Modal for enlarged image
    const renderModal = (url: string) => (
      modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setModalOpen(false)}>
          <img src={url} alt="Full Preview" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 4px 32px #000' }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setModalOpen(false)} style={{ position: 'fixed', top: 32, right: 32, fontSize: 32, color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
        </div>
      )
    );

    if (imageUrl) return <>
      <img src={imageUrl} alt="Generated" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }} onClick={() => setModalOpen(true)} />
      {renderModal(imageUrl)}
    </>;
    if (videoUrl) return <video src={videoUrl} style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} controls={false} muted poster="/images/DEFAULT.png" />;
    if (audioUrl) return <audio src={audioUrl} style={{ width: 48 }} controls={false} />;
    if (loading) return <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="loader" /></div>;
    if (error) return <span style={{ color: 'red', fontSize: 10 }}>{error}</span>;
    if (preview) {
      if (preview.img) return <>
        <img src={preview.img} alt="Generated" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }} onClick={() => setModalOpen(true)} />
        {renderModal(preview.img)}
      </>;
      if (preview.vid) return <video src={preview.vid} style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} controls={false} muted poster="/images/DEFAULT.png" />;
      if (preview.aud) return <audio src={preview.aud} style={{ width: 48 }} controls={false} />;
    }
    return null;
  }

  return (
    <section className="bottom-section">
      <div className="content-container">
        <h2 className="section_heading">RECENT GENERATIONS</h2>
        <p className="section_subtitle">
          Your most recent text and image generations.
        </p>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Model Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th>Tokens</th>
                <th>Cost</th>
                <th>Status Code</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9}>Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={9}>No recent generations found.</td></tr>
              ) : (
                logs.map((log, index) => (
                  <tr key={log.log_id || log.id || index} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                    <td>{`ID-${(index + 1).toString().padStart(2, '0')}`}</td>
                    <td>{formatModel(log) || '-'}</td>
                    <td>{formatType(log) || '-'}</td>
                    <td className={`status ${formatStatus(log.status_code_returned).toLowerCase().replace(' ', '-')}`}>{formatStatus(log.status_code_returned) || '-'}</td>
                    <td>{formatDate(log.timestamp) || '-'}</td>
                    <td>{formatTokens(log.inference_usage_json) || '-'}</td>
                    <td>{formatCost(log.cost) || '-'}</td>
                    <td>{log.status_code_returned || '-'}</td>
                    <td>
                      {(log.inference_usage_json && (log.inference_usage_json.image_url || log.inference_usage_json.video_url || log.inference_usage_json.audio_url || log.inference_usage_json.task_id)) ? (
                        <PreviewCell log={log} apiKey={apiKey} />
                      ) : (
                        <span style={{ color: '#888' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="table-note">
          Only the 10 most recent generations are shown.
        </p>
      </div>
      <div 
        className="docs_box"
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
    </section>
  );
};

export default BottomSection;