/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly GEMINI_API_KEY: string;
    readonly VITE_USE_BACKEND: string;
    readonly VITE_BACKEND_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
