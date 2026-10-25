/**
 * Centralized API client for CareerSaathi AI.
 * Handles base URL configuration, Bearer token injection, structured error handling,
 * and safe JSON parsing across all backend modules.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:5000/api';

/**
 * Custom error class representing an API or network error.
 */
export class ApiError extends Error {
  constructor(message, status = 500, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Retrieve auth token from memory or browser storage.
 */
let memoryToken = null;

export const setAuthToken = (token) => {
  memoryToken = token;
};

export const getAuthToken = () => {
  if (memoryToken) return memoryToken;
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }
  return null;
};

export const clearAuthToken = () => {
  memoryToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
  }
};

/**
 * Core fetch wrapper with Bearer token injection and defensive error handling.
 *
 * @param {string} endpoint - API path (e.g. '/auth/login' or 'assessments/generate')
 * @param {RequestInit & { token?: string }} [options={}] - Fetch options
 * @returns {Promise<any>}
 */
export async function apiFetch(endpoint, options = {}) {
  const { token, headers = {}, body, ...customOptions } = options;

  // Clean path format
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${path}`;

  const requestHeaders = new Headers(headers);

  // Set default Accept header
  if (!requestHeaders.has('Accept')) {
    requestHeaders.set('Accept', 'application/json');
  }

  // Set Content-Type for JSON body if not multipart
  if (body && !(body instanceof FormData) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  // Attach Bearer token if available
  const effectiveToken = token || getAuthToken();
  if (effectiveToken && !requestHeaders.has('Authorization')) {
    requestHeaders.set('Authorization', `Bearer ${effectiveToken}`);
  }

  const config = {
    ...customOptions,
    headers: requestHeaders,
    body: body && typeof body === 'object' && !(body instanceof FormData)
      ? JSON.stringify(body)
      : body,
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    throw new ApiError(
      networkError?.message?.includes('Failed to fetch')
        ? 'Cannot connect to backend server. Please check your network or verify the backend is running on port 5000.'
        : networkError?.message || 'Network request failed',
      0,
      null
    );
  }

  // Handle empty responses (e.g., 204 No Content)
  if (response.status === 204) {
    return null;
  }

  // Safe response parsing
  const contentType = response.headers.get('content-type') || '';
  let responseData = null;

  try {
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = text ? { message: text } : null;
      }
    }
  } catch {
    responseData = null;
  }

  if (!response.ok) {
    const errorMessage =
      responseData?.message ||
      (typeof responseData === 'string' ? responseData : null) ||
      `Request failed with status ${response.status}`;

    throw new ApiError(errorMessage, response.status, responseData);
  }

  return responseData;
}

/**
 * Convenient HTTP method shortcuts
 */
export const api = {
  get: (endpoint, options = {}) =>
    apiFetch(endpoint, { ...options, method: 'GET' }),

  post: (endpoint, body, options = {}) =>
    apiFetch(endpoint, { ...options, method: 'POST', body }),

  put: (endpoint, body, options = {}) =>
    apiFetch(endpoint, { ...options, method: 'PUT', body }),

  patch: (endpoint, body, options = {}) =>
    apiFetch(endpoint, { ...options, method: 'PATCH', body }),

  delete: (endpoint, options = {}) =>
    apiFetch(endpoint, { ...options, method: 'DELETE' }),
};

export default api;
