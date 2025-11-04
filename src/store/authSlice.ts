import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { authApi } from "@/lib/api";
import { type AuthState } from "@/types";
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "@/lib/jwt";

const initialState: AuthState = {
  user: null,
  accessToken: getAccessToken(),
  refreshToken: getRefreshToken(),
  isAuthenticated: !!getAccessToken(),
};

// Async thunks
export const login = createAsyncThunk(
  "auth/login",
  async ({ username, password }: { username: string; password: string }) => {
    const response = await authApi.login(username, password);
    const { access, refresh } = response.data;
    setTokens(access, refresh);

    const userResponse = await authApi.getCurrentUser();
    return {
      accessToken: access,
      refreshToken: refresh,
      user: userResponse.data,
    };
  }
);

export const register = createAsyncThunk(
  "auth/register",
  async (data: {
    username: string;
    email: string;
    password: string;
    re_password: string;
  }) => {
    await authApi.register(data);
    // Auto-login after registration
    const response = await authApi.login(data.username, data.password);
    const { access, refresh } = response.data;
    setTokens(access, refresh);

    const userResponse = await authApi.getCurrentUser();
    return {
      accessToken: access,
      refreshToken: refresh,
      user: userResponse.data,
    };
  }
);

export const logout = createAsyncThunk("auth/logout", async () => {
  try {
    await authApi.logout();
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    clearTokens();
  }
});

export const fetchCurrentUser = createAsyncThunk(
  "auth/fetchCurrentUser",
  async () => {
    const response = await authApi.getCurrentUser();
    return response.data;
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuth: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      clearTokens();
    },
    setTokens: (
      state,
      action: PayloadAction<{ accessToken: string; refreshToken: string }>
    ) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
      setTokens(action.payload.accessToken, action.payload.refreshToken);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state) => {
        state.accessToken = null;
        state.refreshToken = null;
        state.user = null;
        state.isAuthenticated = false;
        clearTokens();
      })
      .addCase(register.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(register.rejected, (state) => {
        state.accessToken = null;
        state.refreshToken = null;
        state.user = null;
        state.isAuthenticated = false;
        clearTokens();
      })
      .addCase(logout.fulfilled, (state) => {
        state.accessToken = null;
        state.refreshToken = null;
        state.user = null;
        state.isAuthenticated = false;
        clearTokens();
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.accessToken = null;
        state.refreshToken = null;
        state.user = null;
        state.isAuthenticated = false;
        clearTokens();
      });
  },
});

export const { clearAuth, setTokens: setTokensAction } = authSlice.actions;
export default authSlice.reducer;
