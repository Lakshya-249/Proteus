/** Single source of truth for the backend URL (was copy-pasted in 5 files). */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000/api";
