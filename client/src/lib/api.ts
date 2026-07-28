import axios, { type AxiosInstance } from "axios";

/**
 * Shared axios instance for all helpdesk API calls.
 *
 * `baseURL: "/api"` means call sites pass server-relative paths ("/tickets"),
 * and `withCredentials` is on by default so the better-auth session cookie is
 * always sent — forgetting it on a new call used to mean a silent 401.
 */
export const api: AxiosInstance = axios.create({
  baseURL: "/api",
  withCredentials: true,
});
