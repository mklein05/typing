/// <reference types="vite/client" />

// Vite inlines `VITE_*` at dev-server start / build time. Declaring them here
// gives `import.meta.env.VITE_*` a type instead of `any`.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_API_URL?: string;
}
