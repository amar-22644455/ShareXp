import { io } from "socket.io-client";

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (import.meta.env.DEV) {
    return "http://localhost:5000";
  }
  return window.location.origin;
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
