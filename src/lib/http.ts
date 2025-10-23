// src/lib/http.ts
import axios, { InternalAxiosRequestConfig } from "axios";

/** ---------- Config ---------- **/
const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}`
    : "http://localhost:7000");

const isDev = import.meta.env.DEV === true;

/** Normalize values like: ObjectId("..."), quoted strings, stray spaces */
const normalizeCompanyId = (val?: unknown): string | null => {
  if (!val) return null;
  let s = typeof val === "string" ? val : String(val);
  s = s.trim();

  // strip ObjectId("...") wrapper
  const m = s.match(/^ObjectId\(["']?([0-9a-fA-F]{24})["']?\)$/);
  if (m) s = m[1];

  // strip surrounding quotes
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  return s.trim() || null;
};

/** Try to read company id from several places */
const getCompanyId = (): string | null => {
  // 1) localStorage (authoritative after login)
  const fromLS = normalizeCompanyId(localStorage.getItem("companyId"));
  if (fromLS) return fromLS;

  // 2) URL ?companyId= (handy for first boot)
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    const fromQuery = normalizeCompanyId(url.searchParams.get("companyId"));
    if (fromQuery) return fromQuery;
  }

  // 3) Vite env fallback (optional)
  const fromEnv = normalizeCompanyId(
    import.meta.env.VITE_COMPANY_ID as string | undefined
  );
  if (fromEnv) return fromEnv;

  return null;
};

const getToken = (): string | null => {
  const t = localStorage.getItem("token");
  return t && t.trim() ? t : null;
};

/** ---------- Axios Instance ---------- **/
export const http = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  // Kill cache globally to avoid 304 with empty bodies
  headers: {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Expires: "0",
  },
});

/** ---------- Request Interceptor ---------- **/
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Always send Authorization when present
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }

  // Always send x-company-id when we have it
  const companyId = getCompanyId();
  if (companyId) {
    config.headers = config.headers || {};
    (config.headers as any)["x-company-id"] = companyId;
  }

  // Bust cache for /me endpoints explicitly (some browsers cache aggressively)
  const url = (config.url || "").toString();
  const isMeEndpoint =
    url.includes("/api/auth/me") || url.includes("/api/agent/me");
  if (isMeEndpoint) {
    const ts = Date.now();
    // merge params safely
    (config.params as any) = { ...(config.params || {}), _: ts };
  }

  if (isDev) {
    // eslint-disable-next-line no-console
    console.debug(
      "[http] →",
      (config.method || "get").toUpperCase(),
      config.baseURL ? config.baseURL + (config.url || "") : config.url,
      {
        hasToken: !!token,
        companyId: (config.headers as any)?.["x-company-id"] || null,
      }
    );
  }

  return config;
});

/** ---------- Response Interceptor (optional) ---------- **/
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("token");
      // optional redirect to login:
      // window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

/** ---------- Small helpers for auth setup ---------- **/
export const auth = {
  setToken(token: string) {
    localStorage.setItem("token", token);
  },
  clearToken() {
    localStorage.removeItem("token");
  },
  setCompanyId(companyId: string) {
    const normalized = normalizeCompanyId(companyId);
    if (normalized) localStorage.setItem("companyId", normalized);
  },
  clearCompanyId() {
    localStorage.removeItem("companyId");
  },
};

export default http;
