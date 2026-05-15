import React, { createContext, useContext, useState, useEffect } from "react";
import { API_BASE_URL } from "../config";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("disc_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const verifySession = async () => {
      // If we are currently handling a Google redirect hash, skip verification 
      // to avoid race conditions clearing the user state prematurely.
      if (window.location.hash && window.location.hash.includes("access_token=")) {
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          method: "GET",
          credentials: "include" 
        });
        
        if (res.ok) {
           const data = await res.json();
           if (data.authenticated && data.user) {
             const userData = {
                 uid: data.user.id,
                 id: data.user.id,
                 name: data.user.name,
                 email: data.user.email,
                 picture: data.user.picture || ""
             };
             setUser(userData);
             localStorage.setItem("disc_user", JSON.stringify(userData));
           } else {
             setUser(null);
             localStorage.removeItem("disc_user");
           }
        } else {
           setUser(null);
           localStorage.removeItem("disc_user");
        }
      } catch(err) {
         console.error("Identity synchronization failed:", err);
      } finally {
        setLoading(false);
      }
    };
    verifySession();
  }, []);

  useEffect(() => {
    const handleGoogleRedirect = async () => {
      const hash = window.location.hash;
      if (hash && hash.includes("access_token=")) {
        setLoading(true);
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");

        if (accessToken) {
          try {
            // Clean the URL hash without reloading the page
            window.history.replaceState(null, null, window.location.pathname);

            const userInfoEndpoint = "https://www.googleapis.com/oauth2/v3/userinfo";
            const response = await fetch(userInfoEndpoint, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (response.ok) {
              const userInfo = await response.json();
              await signInWithGoogle(accessToken, userInfo);
            }
          } catch (err) {
            console.error("Auth redirect error:", err);
          } finally {
            setLoading(false);
          }
        }
      }
    };

    handleGoogleRedirect();
  }, []);

  const signInWithGoogle = async (accessToken, userInfo) => {
    try {
      let info = userInfo;
      if (!info && accessToken) {
        const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        info = await r.json();
      }

      const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: info.email,
          name: info.name,
          googleId: info.sub,
          picture: info.picture,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('❌ Events backend auth rejected:', res.status, err);
        throw new Error(err.message || `Server error ${res.status}`);
      }

      const data = await res.json();
      const userData = {
        uid: data.user.id,
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        picture: info?.picture || data.user.picture || "",
      };
      
      localStorage.setItem("disc_user", JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (error) {
      console.error("Sign in failed:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      localStorage.removeItem("disc_user");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
