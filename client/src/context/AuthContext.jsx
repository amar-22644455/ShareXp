import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Check for existing session on initial load
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin', // ensure cookie is sent
          cache: 'no-store'           // never serve a cached session check
        });
        const contentType = response.headers.get('content-type');
        if (response.ok && contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setCurrentUser(data);
          localStorage.setItem('userId', data.id);
        } else {
          setCurrentUser(null);
          localStorage.removeItem('userId');
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
        setCurrentUser(null);
        localStorage.removeItem('userId');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', // ensure cookie is received and stored
        body: JSON.stringify({ email, password })
      });
      
      let data = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: text || `Server error (${response.status})` };
      }

      if (response.ok && data.user) {
        localStorage.setItem('userId', data.user.id);
        setCurrentUser(data.user);
        navigate(`/home/${data.user.id}`);
      } else if (!data.message) {
        data.message = `Login failed (${response.status})`;
      }
      return data;
    } catch (err) {
      console.error("Login error:", err);
      return { message: err.message || "Network error. Please try again." };
    }
  };

  const guestLogin = async () => {
    try {
      const response = await fetch('/api/auth/guest-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      });

      let data = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: text || `Server error (${response.status})` };
      }

      if (response.ok && data.user) {
        localStorage.setItem('userId', data.user.id);
        setCurrentUser(data.user);
        navigate(`/home/${data.user.id}`);
      }
      return data;
    } catch (err) {
      console.error("Guest login error:", err);
      return { message: err.message || "Failed to login as guest" };
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin' // ensure the cookie is sent so server can clear it
    });
    localStorage.removeItem('userId');
    localStorage.removeItem('token'); // clear legacy tokens if any
    setCurrentUser(null);
    navigate('/LoginXP');
  };

  const value = {
    currentUser,
    login,
    guestLogin,
    logout,
    loading
  };
  // The AuthContext.Provider component is used to wrap the children components and provide them with access to the authentication context. The value prop of the provider is set to an object that contains the currentUser, login, logout, and loading state. If the loading state is true, a loading spinner is displayed; otherwise, the children components are rendered.
  return (
    <AuthContext.Provider value={value}>
    {loading ? <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#9e4635]"></div></div> : children}
  </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  return useContext(AuthContext);
}