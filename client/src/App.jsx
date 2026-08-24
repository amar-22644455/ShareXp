import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Achievements from "./pages/Achievements";
import Profile from "./pages/Profile";
import CreateXP from "./pages/CreateXP";
import LoginXP from "./pages/LoginXP";
import Landing from "./pages/Landing";
import Search from "./pages/Search";
import UserProfile from "./pages/UserProfile";
import Skills from "./pages/Skills";
import Notification from "./pages/Notification";
import Post from "./pages/Post";
import Chat from "./pages/Chat";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes — accessible without login */}
          <Route path="/" element={<Landing />} />
          <Route path="/LoginXP" element={<LoginXP />} />
          <Route path="/CreateXP" element={<CreateXP />} />

          {/* Private routes — redirect to /LoginXP if not authenticated */}
          <Route path="/Home/:id"          element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/profile/:id"       element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/achievements/:id"  element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
          <Route path="/search/:id"        element={<ProtectedRoute><Search /></ProtectedRoute>} />
          <Route path="/UserProfile/:id"   element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          <Route path="/skills/:id"        element={<ProtectedRoute><Skills /></ProtectedRoute>} />
          <Route path="/Notification/:id"  element={<ProtectedRoute><Notification /></ProtectedRoute>} />
          <Route path="/post/:id"          element={<ProtectedRoute><Post /></ProtectedRoute>} />
          <Route path="/chat/:id"          element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/chat/:id/:chatId"  element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
