// spark = الخطة المجانية بدون Cloud Functions (الافتراضي). blaze = وظائف الخادم.
const mode = String(import.meta.env?.VITE_BACKEND_MODE || 'spark').toLowerCase();
export const backendMode = mode === 'blaze' ? 'blaze' : 'spark';
export const isSpark = backendMode === 'spark';
