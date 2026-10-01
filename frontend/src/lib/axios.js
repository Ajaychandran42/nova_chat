import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3000/api" : "/api");

export const axiosInstance = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});
