import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { refreshToken } from "./auth";
import { useErrorStore } from "../store/errorStore";

interface ApiErrorResponse {
  detail?: string;
  message?: string;
  error?: string;
}

// Constants
const BASE_URL = "https://muza.bondify.uz/api/v1/";

// Create API instance
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add _retry property to AxiosRequestConfig
declare module "axios" {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("access_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config;

    // If error is 401 and not a retry
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshToken();
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    // Extract error message from response
    let errorMessage = "Произошла ошибка";
    if (error.response?.data) {
      if (typeof error.response.data === "string") {
        errorMessage = error.response.data;
      } else {
        errorMessage =
          error.response.data.detail ||
          error.response.data.message ||
          error.response.data.error ||
          errorMessage;
      }
    }

    // Show error in modal
    useErrorStore.getState().setError(errorMessage);

    return Promise.reject(error);
  },
);

export default api;
