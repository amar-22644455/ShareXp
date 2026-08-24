import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Search, Bell, MessageSquare, Award, User, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import createSocket from "@/config/socket";

export default function Sidebar({ unreadCountProp }) {
  const location = useLocation();
  const { logout } = useAuth();
  const currentUserId = localStorage.getItem("userId");
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Sync with parent prop if provided (used on the Notifications page)
  useEffect(() => {
    if (unreadCountProp !== undefined) {
      setUnreadCount(unreadCountProp);
    }
  }, [unreadCountProp]);

  // Handle initial fetch & real-time updates when on other pages
  useEffect(() => {
    if (!currentUserId) return;

    const fetchUnreadNotifications = async () => {
      if (unreadCountProp !== undefined) return;
      try {
        const response = await fetch("/api/notifications/all");
        if (response.ok) {
          const data = await response.json();
          const allNotifications = Array.isArray(data) ? data : [];
          const unread = allNotifications.filter(n => !n.read).length;
          setUnreadCount(unread);
        }
      } catch (err) {
        console.error("Error fetching notifications count in Sidebar:", err);
      }
    };

    const fetchUnreadChats = async () => {
      try {
        const response = await fetch("/api/chats/unread-count");
        if (response.ok) {
          const data = await response.json();
          setUnreadChatCount(data.unreadCount || 0);
        }
      } catch (err) {
        console.error("Error fetching unread chat count in Sidebar:", err);
      }
    };

    fetchUnreadNotifications();
    fetchUnreadChats();

    // Setup real-time notifications & chat listeners
    const socket = createSocket();

    socket.emit("join", `user_${currentUserId}`);

    socket.on("new_notification", (notification) => {
      if (!notification.read) {
        setUnreadCount(prev => prev + 1);
      }
    });

    socket.on("receive_message", (message) => {
      // If message is from someone else and current page is not active chat, increment unread count
      if (message.sender?._id !== currentUserId && message.sender !== currentUserId) {
        const isChatPageActive = location.pathname.toLowerCase().includes('/chat');
        if (!isChatPageActive) {
          setUnreadChatCount(prev => prev + 1);
        }
      }
    });

    socket.on("unread_chat_update", (data) => {
      if (typeof data?.unreadCount === 'number') {
        fetchUnreadChats();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUserId, unreadCountProp, location.pathname]);

  const menuItems = [
    {
      name: "Home",
      path: `/home/${currentUserId}`,
      icon: Home
    },
    {
      name: "Search",
      path: `/search/${currentUserId}`,
      icon: Search
    },
    {
      name: "Messages",
      path: `/chat/${currentUserId}`,
      icon: MessageSquare
    },
    {
      name: "Notifications",
      path: `/notification/${currentUserId}`,
      icon: Bell
    },
    {
      name: "Achievements",
      path: `/achievements/${currentUserId}`,
      icon: Award
    },
    {
      name: "Profile",
      path: `/profile/${currentUserId}`,
      icon: User
    }
  ];

  const isActive = (path) => {
    const baseCurrent = location.pathname.toLowerCase();
    const baseTarget = path.split("/")[1].toLowerCase();
    return baseCurrent.includes(baseTarget);
  };

  return (
    <div className="hidden md:flex flex-col w-64 h-screen bg-[#fffaf7] border-r border-[#edd6cc] px-4 py-8 justify-between flex-shrink-0">
      <div className="flex flex-col gap-8">
        {/* Logo */}
        <Link 
          to={`/home/${currentUserId}`} 
          className="text-2xl font-serif font-black bg-gradient-to-r from-[#9e4635] to-[#d0735e] bg-clip-text text-transparent pl-4"
        >
          ShareXP
        </Link>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center justify-between px-4 py-3 rounded-xl font-medium text-[16px] transition-all duration-200 ${
                  active
                    ? "bg-[#edd6cc] text-[#9e4635] shadow-sm font-semibold"
                    : "text-gray-600 hover:bg-[#fcf5f2] hover:text-gray-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${active ? "text-[#9e4635]" : "text-gray-400"}`} />
                  <span>{item.name}</span>
                </div>
                {item.name === "Notifications" && unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-[#9e4635] text-[11px] font-bold text-white shadow-sm animate-pulse">
                    {unreadCount}
                  </span>
                )}
                {item.name === "Messages" && unreadChatCount > 0 && (
                  <span className="flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-[#9e4635] text-[11px] font-bold text-white shadow-sm animate-pulse">
                    {unreadChatCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Logout button in sidebar */}
      <button
        onClick={logout}
        className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-[16px] text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 border-none cursor-pointer bg-transparent"
      >
        <LogOut className="w-5 h-5 text-red-400" />
        Logout
      </button>
    </div>
  );
}
