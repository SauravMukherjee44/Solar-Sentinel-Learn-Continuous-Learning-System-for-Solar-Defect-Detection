// Configuration for external Python FastAPI backend
// Update this URL when you deploy your backend

// Default to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export const config = {
  apiUrl: API_BASE_URL,
  wsUrl: WS_BASE_URL,
};

export default config;
