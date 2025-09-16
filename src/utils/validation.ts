import DOMPurify from 'dompurify';
import { z } from 'zod';
import Logger from './logger';

// Playground input schema
export const PlaygroundInputSchema = z.object({
  prompt: z.string()
    .min(1, 'Prompt is required')
    .max(10000, 'Prompt too long')
    .refine(val => val.trim().length > 0, 'Prompt cannot be empty'),
  model: z.string().min(1, 'Model is required'),
  temperature: z.number().min(0).max(2).default(1),
  max_tokens: z.number().int().min(1).max(4000).default(2048),
});

// API Key input schema
export const ApiKeySchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be at most 50 characters')
    .regex(/^[a-zA-Z0-9 _-]+$/, 'Name can only contain letters, numbers, spaces, hyphens, and underscores'),
  description: z.string().max(200, 'Description must be at most 200 characters').optional(),
});

// Secure sanitization utility with comprehensive XSS protection
export function sanitizeInput(input: string): string {
  // Input validation
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Pre-filter dangerous patterns before DOMPurify
  const dangerousPatterns = [
    /javascript:/i,
    /data:text\/html/i,
    /data:application\/javascript/i,
    /data:text\/javascript/i,
    /vbscript:/i,
    /expression\(/i,
    /<!--/,
    /on\w+\s*=/i,
    /<script/i,
    /&#x3C;script/i,
    /\\x3Cscript/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<link/i,
    /<meta/i,
    /<form/i,
    /<input/i,
    /<button/i
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      Logger.warn('Dangerous content pattern detected and blocked:', input);
      return '';
    }
  }

  // First pass: Configure DOMPurify with stricter settings
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['img', 'video', 'audio'], // Reduced allowed tags - removed div, p, span, br
    ALLOWED_ATTR: ['src', 'alt', 'width', 'height'], // Removed style and class attributes
    ALLOWED_URI_REGEXP: /^https?:\/\//i, // Only HTTP/HTTPS protocols - more restrictive
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'link', 'meta', 'form', 'input', 'button', 'div', 'p', 'span', 'br'],
    FORBID_ATTR: [
      'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onmouseenter', 'onmouseleave',
      'onkeydown', 'onkeyup', 'onkeypress', 'onfocus', 'onblur', 'onchange', 'onsubmit',
      'style', 'class', 'background', 'background-image', 'expression'
    ],
    KEEP_CONTENT: false, // Don't keep content of forbidden tags
    SANITIZE_DOM: true, // Clean DOM after sanitizing
    WHOLE_DOCUMENT: false, // Don't allow entire documents
    RETURN_DOM_FRAGMENT: false, // Return string, not DOM
    RETURN_DOM: false, // Return string, not DOM
    FORCE_BODY: false, // Don't force adding body tag
    USE_PROFILES: { html: false } // Don't use HTML profile
  });

  // Second pass: Additional checks for malicious content after sanitization
  if (
    clean.toLowerCase().includes('javascript:') ||
    clean.toLowerCase().includes('data:text/html') ||
    clean.toLowerCase().includes('data:application/javascript') ||
    clean.toLowerCase().includes('data:text/javascript') ||
    clean.toLowerCase().includes('vbscript:') ||
    clean.includes('&lt;script') ||
    clean.includes('&#x3C;script') ||
    clean.includes('\\x3Cscript') ||
    clean.includes('expression(') ||
    clean.includes('<!--') ||
    /on\w+\s*=/.test(clean) || // Detect any 'on*' handlers
    /url\(javascript:/.test(clean) || // CSS-based attacks
    /url\(data:/.test(clean) || // Data URI attacks
    /<script/i.test(clean) || // Additional script tag checks
    /<iframe/i.test(clean) || // iframe checks
    /<object/i.test(clean) || // object checks
    /<embed/i.test(clean) // embed checks
  ) {
    Logger.warn('Potentially malicious content detected after sanitization and blocked:', clean);
    return ''; // Return empty string if malicious content detected
  }

  // Validate URLs in src attributes
  const urlMatch = clean.match(/src=["']([^"']+)["']/i);
  if (urlMatch) {
    const url = urlMatch[1];
    try {
      const urlObj = new URL(url);
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        Logger.warn('Invalid protocol in URL detected and blocked:', url);
        return '';
      }
    } catch (e) {
      Logger.warn('Invalid URL format detected and blocked:', url);
      return '';
    }
  }

  // Final pass: Encode special characters for additional safety
  return clean
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// 🔒 SECURITY: Navigation validation utilities
export const ALLOWED_NAVIGATION_PATHS = [
  '/',
  '/home',
  '/models',
  '/playground',
  '/usage',
  '/api-keys',
  '/settings',
  '/docs'
] as const;

export type AllowedPath = typeof ALLOWED_NAVIGATION_PATHS[number];

/**
 * 🔒 SECURITY: Validate navigation path to prevent open redirect vulnerabilities
 * @param path - The path to validate
 * @returns true if path is safe to navigate to, false otherwise
 */
export const validateNavigationPath = (path: string): path is AllowedPath => {
  // Check if path is in whitelist
  if (!ALLOWED_NAVIGATION_PATHS.includes(path as AllowedPath)) {
    console.error('🔒 Navigation blocked - invalid path:', path);
    return false;
  }

  // Prevent external navigation
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
    console.error('🔒 Navigation blocked - external URL:', path);
    return false;
  }

  // Prevent protocol-based attacks
  if (path.includes('javascript:') || path.includes('data:') || path.includes('vbscript:')) {
    console.error('🔒 Navigation blocked - dangerous protocol:', path);
    return false;
  }

  // Prevent directory traversal
  if (path.includes('..') || path.includes('./') || path.includes('/.')) {
    console.error('🔒 Navigation blocked - directory traversal attempt:', path);
    return false;
  }

  // Prevent null byte injection
  if (path.includes('\0') || path.includes('%00')) {
    console.error('🔒 Navigation blocked - null byte injection:', path);
    return false;
  }

  // Prevent query parameter injection attacks
  if (path.includes('?') && (path.includes('javascript:') || path.includes('data:'))) {
    console.error('🔒 Navigation blocked - query parameter injection:', path);
    return false;
  }

  // Prevent fragment identifier attacks
  if (path.includes('#') && (path.includes('javascript:') || path.includes('data:'))) {
    console.error('🔒 Navigation blocked - fragment injection:', path);
    return false;
  }

  return true;
};

/**
 * 🔒 SECURITY: Safe navigation function that validates path before navigating
 * @param navigate - React Router's navigate function
 * @param path - The path to navigate to
 * @returns true if navigation was successful, false if blocked
 */
export const safeNavigate = (navigate: (path: string) => void, path: string): boolean => {
  if (!validateNavigationPath(path)) {
    console.error('Invalid navigation path blocked:', path);
    return false;
  }

  try {
    navigate(path);
    return true;
  } catch (error) {
    console.error('Navigation failed:', error);
    return false;
  }
}; 