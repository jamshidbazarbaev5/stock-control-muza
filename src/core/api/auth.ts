import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Types
interface LoginCredentials {
  phone_number: string;
  password: string;
}

interface TokenResponse {
  access: string;
  refresh: string;
}

// Constants
const BASE_URL = 'https://muza.bondify.uz/api/v1/'
const TOKEN_ENDPOINT = 'token/';
const REFRESH_ENDPOINT = 'token/refresh/';
const VERIFY_ENDPOINT = 'token/verify/';

// Local storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// API client
const authApi = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper functions
const getAccessToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY);
const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY);
const setTokens = (access: string, refresh: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
};
const clearTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

// Export getAccessToken for use in api.ts
export { getAccessToken };

// Auth functions
export const login = async (credentials: LoginCredentials): Promise<TokenResponse> => {
  const response = await authApi.post<TokenResponse>(TOKEN_ENDPOINT, credentials);
  setTokens(response.data.access, response.data.refresh);
  return response.data;
};

export const refreshToken = async (): Promise<string> => {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error('No refresh token available');

  const response = await authApi.post<{ access: string }>(REFRESH_ENDPOINT, { refresh });
  localStorage.setItem(ACCESS_TOKEN_KEY, response.data.access);
  return response.data.access;
};

export const verifyToken = async (token: string): Promise<boolean> => {
  try {
    await authApi.post(VERIFY_ENDPOINT, { token });
    return true;
  } catch (error) {
    return false;
  }
};

export const logout = (): void => {
  clearTokens();
};

// React Query hooks
export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => login(credentials),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      logout();
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.clear();
    },
  });
};

export const useVerifyToken = (token: string) => {
  return useQuery({
    queryKey: ['verifyToken', token],
    queryFn: () => verifyToken(token),
    enabled: !!token,
    retry: false,
  });
};

// Auth state
export const isAuthenticated = (): boolean => {
  return !!getAccessToken();
};

export default authApi;
