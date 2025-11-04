import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./jwt";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (
  error: AxiosError | null,
  token: string | null = null
) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/jwt/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        setTokens(access, refreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access}`;
        }

        processQueue(null, access);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// Auth endpoints (JWT)
export const authApi = {
  login: (username: string, password: string) =>
    api.post("/auth/jwt/create/", { username, password }),
  register: (data: {
    username: string;
    email: string;
    password: string;
    re_password: string;
  }) => api.post("/auth/users/", data),
  refreshToken: (refresh: string) =>
    api.post("/auth/jwt/refresh/", { refresh }),
  verifyToken: (token: string) => api.post("/auth/jwt/verify/", { token }),
  logout: async () => {
    // JWT doesn't require server-side logout, just clear tokens
    clearTokens();
    return Promise.resolve({ data: { success: true } });
  },
  getCurrentUser: () => api.get("/auth/users/me/"),
};

// Pipeline endpoints
export const pipelineApi = {
  getAll: () => api.get("/pipelines/"),
  getById: (id: string) => api.get(`/pipelines/${id}/`),
  create: (data: FormData) =>
    api.post("/pipelines/", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (id: string, data: FormData) =>
    api.put(`/pipelines/${id}/`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (id: string) => api.delete(`/pipelines/${id}/`),
  getGeoJSON: (id: string) =>
    api.get(`/pipelines/${id}/geojson/`, { responseType: "json" }),
};

// Satellite image endpoints
export const satelliteImageApi = {
  getAll: (params?: { pipeline?: string }) =>
    api.get("/satellite-images/", { params }),
  getById: (id: string) => api.get(`/satellite-images/${id}/`),
  create: (data: FormData) =>
    api.post("/satellite-images/", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (id: string, data: FormData) =>
    api.put(`/satellite-images/${id}/`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (id: string) => api.delete(`/satellite-images/${id}/`),
  convertToCog: (id: string) =>
    api.post(`/satellite-images/${id}/convert_to_cog/`),
  runAnalysis: (id: string) =>
    api.post(`/satellite-images/${id}/run_analysis/`),
  extractBbox: (id: string) =>
    api.post(`/satellite-images/${id}/extract_bbox/`),
};

// Analysis endpoints
export const analysisApi = {
  getAll: (params?: {
    satellite_image?: string;
    pipeline?: string;
    analysis_type?: string;
    severity?: string;
  }) => api.get("/analyses/", { params }),
  getById: (id: string) => api.get(`/analyses/${id}/`),
};

// Anomaly endpoints
export const anomalyApi = {
  getAll: (params?: {
    is_resolved?: boolean;
    severity?: string;
    anomaly_type?: string;
  }) => api.get("/anomalies/", { params }),
  getById: (id: string) => api.get(`/anomalies/${id}/`),
  markResolved: (id: string) => api.post(`/anomalies/${id}/mark_resolved/`),
  markUnresolved: (id: string) => api.post(`/anomalies/${id}/mark_unresolved/`),
};

// Notification endpoints
export const notificationApi = {
  getAll: (params?: { is_read?: boolean }) =>
    api.get("/notifications/", { params }),
  getById: (id: string) => api.get(`/notifications/${id}/`),
  markRead: (id: string) => api.post(`/notifications/${id}/mark_read/`),
  markAllRead: () => api.post("/notifications/mark_all_read/"),
  getUnreadCount: () => api.get("/notifications/unread_count/"),
  delete: (id: string) => api.delete(`/notifications/${id}/`),
};

// User endpoints (using Djoser)
export const userApi = {
  getCurrentUser: () => api.get("/auth/users/me/"),
  updateProfile: (data: {
    username?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  }) => api.patch("/auth/users/me/", data),
  setPassword: (data: {
    current_password: string;
    new_password: string;
    re_new_password: string;
  }) => api.post("/auth/users/set-password/", data),
  resetPassword: (data: { email: string }) =>
    api.post("/auth/users/reset-password/", data),
  resetPasswordConfirm: (data: {
    uid: string;
    token: string;
    new_password: string;
    re_new_password: string;
  }) => api.post("/auth/users/reset-password-confirm/", data),
  activateAccount: (data: { uid: string; token: string }) =>
    api.post("/auth/users/activation/", data),
  resendActivation: (data: { email: string }) =>
    api.post("/auth/users/resend-activation/", data),
  deleteAccount: () => api.delete("/auth/users/me/"),
};
