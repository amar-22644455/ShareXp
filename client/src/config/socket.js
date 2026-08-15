import { io } from "socket.io-client";

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (import.meta.env.DEV) {
    return "http://localhost:5000";
  }
  // In production, fallback to deployed Render backend URL if VITE_SOCKET_URL is missing
  return "https://semester1-backend-of1b.onrender.com";
};

export const createSocket = (options = {}) => {
  const url = getSocketUrl();
  return io(url, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    ...options,
  });
};

export default createSocket;
