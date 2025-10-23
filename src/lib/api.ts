import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 
    (typeof window !== "undefined" 
      ? `${window.location.protocol}//${window.location.hostname}`
      : "http://localhost:7000"),
  withCredentials: true, // ✅ send/receive cookies
});
