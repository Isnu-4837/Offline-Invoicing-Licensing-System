// src/api/axios.js

import axios from "axios";

const api = axios.create({
  // baseURL: "http://localhost:8000",
  baseURL: "http://127.0.0.1:8000",
  // baseURL: "http://127.0.0.1:8001",

});

// 🔐 Attach JWT ONLY when needed
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    // Attach token except login/register
    if (
      token &&
      !config.url.includes("/login") &&
      !config.url.includes("/register")
    ) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;