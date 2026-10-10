/**
 * Backend address.
 * - On this computer (localhost) the local backend is used: `uvicorn main:app --reload --port 8001`.
 * - Once published, the backend deployed on Render is used.
 *
 * IMPORTANT: set PRODUCTION_API to your Render service URL (without a trailing "/").
 */
const LOCAL_API = 'http://127.0.0.1:8001';
const PRODUCTION_API = 'https://TU-SERVICIO.onrender.com';

const isLocal =
  typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

export const API_URL = isLocal ? LOCAL_API : PRODUCTION_API;
