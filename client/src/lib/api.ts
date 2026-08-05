import axios, { type AxiosInstance } from "axios";

// Call sites pass server-relative paths ("/tickets"). withCredentials sends
// the better-auth session cookie — forgetting it used to mean a silent 401.
export const api: AxiosInstance = axios.create({
  baseURL: "/api",
  withCredentials: true,
});
