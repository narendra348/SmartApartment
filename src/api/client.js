import axios from 'axios';
import { getErrorMessage, isUnauthorized } from '../utils/error';

export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://smartapartment-backend.onrender.com/api/v1';

const client = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Send cookies with every request (cookie-based auth)
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 10_000, // 10 seconds
});

// ---------------------------------------------------------------------------
// Request interceptor — attach CSRF token from cookie if present
// ---------------------------------------------------------------------------
client.interceptors.request.use(
  (config) => {
    // If the server uses double-submit CSRF cookie pattern, read the cookie
    // and forward it as a header. Adapt the cookie/header names as needed.
    const csrfToken = getCookieValue('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor — normalise errors, handle 401 globally
// ---------------------------------------------------------------------------
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Do not expose axios internals or stack traces to the caller.
    // Re-throw a plain Error with an extracted message so components can
    // display it directly without any special Axios knowledge.

    if (isUnauthorized(error)) {
      const currentPath = window.location.pathname;
      const requestUrl = error?.config?.url ?? '';

      // Do NOT auto-redirect for these endpoints:
      //  - /auth/me  (session restoration — AuthContext handles the 401)
      //  - /auth/login (the login page itself shows the error inline)
      const isAuthEndpoint =
        requestUrl.includes('/auth/me') ||
        requestUrl.includes('/auth/login');

      if (!isAuthEndpoint && currentPath !== '/login') {
        window.location.href = '/login';
      }
    }

    const message = getErrorMessage(error);
    const normalised = new Error(message);
    normalised.status = error?.response?.status ?? null;
    normalised.data = error?.response?.data ?? null;
    return Promise.reject(normalised);
  },
);

// ---------------------------------------------------------------------------
// Helper: read a cookie value by name
// ---------------------------------------------------------------------------
function getCookieValue(name) {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export default client;
