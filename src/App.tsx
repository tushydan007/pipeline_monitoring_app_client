import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider } from "react-redux";
import { ToastContainer } from "react-toastify";
import { ThemeProvider } from "./contexts/ThemeContext";
import { store } from "./store/store";
import { useAppSelector } from "./store/hooks";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import "react-toastify/dist/ReactToastify.css";

function PrivateRoute({ children }: { children: React.ReactElement }) {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactElement }) {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <PrivateRoute>
            <Notifications />
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <BrowserRouter>
          <AppRoutes />
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
