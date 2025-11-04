// JWT token management utilities

export const JWT_ACCESS_TOKEN_KEY = "access_token";
export const JWT_REFRESH_TOKEN_KEY = "refresh_token";

export const getAccessToken = (): string | null => {
  return localStorage.getItem(JWT_ACCESS_TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(JWT_REFRESH_TOKEN_KEY);
};

export const setTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem(JWT_ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(JWT_REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = (): void => {
  localStorage.removeItem(JWT_ACCESS_TOKEN_KEY);
  localStorage.removeItem(JWT_REFRESH_TOKEN_KEY);
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= exp;
  } catch {
    return true;
  }
};
