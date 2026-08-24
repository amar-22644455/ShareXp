import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import profileFallback from "@/assets/profile.jpg";
import createSocket from "@/config/socket";
import { 
  Search, 
  Send, 
  Paperclip, 
  X, 
  MessageSquare, 
  User, 
  Check, 
  CheckCheck,
  ArrowLeft,
  GraduationCap
} from "lucide-react";

export default function Chat() {
  const { id: routeUserId, chatId: routeChatId } = useParams();
  const currentUserId = localStorage.getItem("userId") || routeUserId;
  const navigate = useNavigate();

  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [recipientTyping, setRecipientTyping] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom of messages container
  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom("auto");
  }, [messages]);

  // Connect socket
  useEffect(() => {
    if (!currentUserId) return;

    socketRef.current = createSocket();
    socketRef.current.emit("join", `user_${currentUserId}`);

    socketRef.current.on("receive_message", (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === newMsg._id)) return prev;
        return [...prev, newMsg];
      });

      // Update chats list lastMessage & unread count
      setChats((prevChats) =>
        prevChats.map((c) => {
          if (c._id === newMsg.conversationId) {
            return {
              ...c,
              lastMessage: newMsg,
              updatedAt: newMsg.createdAt,
              unreadCount:
                c._id === activeChat?._id
                  ? 0
                  : (c.unreadCount || 0) + 1
            };
          }
          return c;
        })
      );
    });

    socketRef.current.on("user_typing", ({ chatId }) => {
      if (activeChat && chatId === activeChat._id) {
        setRecipientTyping(true);
      }
    });

    socketRef.current.on("user_stop_typing", ({ chatId }) => {
      if (activeChat && chatId === activeChat._id) {
        setRecipientTyping(false);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [currentUserId, activeChat?._id]);

  // Fetch initial conversations list
  useEffect(() => {
    const fetchChats = async () => {
      setIsLoadingChats(true);
      try {
        const res = await fetch("/api/chats");
        if (res.status === 401) {
          navigate("/LoginXP");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setChats(data);

          // If routeChatId is provided in URL, select that chat
          if (routeChatId) {
            const targetChat = data.find((c) => c._id === routeChatId);
            if (targetChat) {
              setActiveChat(targetChat);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching chats:", err);
      } finally {
        setIsLoadingChats(false);
      }
    };

    fetchChats();
  }, [routeChatId]);

  // Fetch messages when activeChat changes
  useEffect(() => {
    if (!activeChat?._id) return;

    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const res = await fetch(`/api/chats/${activeChat._id}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);

          // Mark chat as read
          await fetch(`/api/chats/${activeChat._id}/read`, { method: "PUT" });

          // Join socket room
          socketRef.current?.emit("join_chat", activeChat._id);

          // Reset unread count locally
          setChats((prev) =>
            prev.map((c) =>
              c._id === activeChat._id ? { ...c, unreadCount: 0 } : c
            )
          );
        }
      } catch (err) {
        console.error("Error fetching messages:", err);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();

    return () => {
      if (activeChat?._id) {
        socketRef.current?.emit("leave_chat", activeChat._id);
      }
    };
  }, [activeChat?._id]);

  // User search logic for new conversation
  useEffect(() => {
    if (!searchQuery.trim()) {
      setUserSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          const filtered = (Array.isArray(data) ? data : data.users || []).filter(
            (u) => u._id !== currentUserId
          );
          setUserSearchResults(filtered);
        }
      } catch (err) {
        console.error("Error searching users:", err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUserId]);

  const handleStartChatWithUser = async (recipientId) => {
    try {
      const res = await fetch("/api/chats/find-or-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId })
      });
      if (res.ok) {
        const newChat = await res.json();
        setChats((prev) => {
          const exists = prev.some((c) => c._id === newChat._id);
          if (exists) return prev;
          return [newChat, ...prev];
        });
        setActiveChat(newChat);
        setSearchQuery("");
        setUserSearchResults([]);
      }
    } catch (err) {
      console.error("Failed to start chat:", err);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (!activeChat) return;

    if (!isTyping) {
      setIsTyping(true);
      socketRef.current?.emit("typing", {
        chatId: activeChat._id,
        userId: currentUserId
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketRef.current?.emit("stop_typing", {
        chatId: activeChat._id,
        userId: currentUserId
      });
    }, 1500);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!inputText.trim() && !selectedFile) || !activeChat || isSending) return;

    setIsSending(true);

    try {
      const formData = new FormData();
      if (inputText.trim()) formData.append("text", inputText.trim());
      if (selectedFile) formData.append("media", selectedFile);

      const res = await fetch(`/api/chats/${activeChat._id}/messages`, {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });

        setInputText("");
        handleClearFile();

        // Stop typing status
        setIsTyping(false);
        socketRef.current?.emit("stop_typing", {
          chatId: activeChat._id,
          userId: currentUserId
        });

        // Update chats list last message snippet
        setChats((prev) =>
          prev.map((c) =>
            c._id === activeChat._id
              ? { ...c, lastMessage: newMsg, updatedAt: newMsg.createdAt }
              : c
          )
        );
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const filteredChats = chats.filter((c) => {
    if (!searchQuery) return true;
    const nameMatch = c.recipient?.name
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());
    const usernameMatch = c.recipient?.username
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());
    return nameMatch || usernameMatch;
  });

  return (
    <section className="flex h-screen w-full bg-gradient-to-br from-[#f7ece7] via-[#f4e3da] to-[#ecd0c4] overflow-hidden">
      <Sidebar />

      {/* Main Workspace Container */}
      <div className="flex-1 flex m-2 md:m-6 bg-[#fffaf7]/60 backdrop-blur-md border border-[#edd6cc] rounded-2xl shadow-lg overflow-hidden">
        
        {/* LEFT PANEL: Chat Record & History */}
        <div
          className={`${
            activeChat ? "hidden md:flex" : "flex"
          } flex-col w-full md:w-80 lg:w-96 border-r border-[#edd6cc] bg-[#fffaf7]/80 flex-shrink-0`}
        >
          {/* Header */}
          <div className="p-4 border-b border-[#edd6cc] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 m-0">
                <MessageSquare className="w-5 h-5 text-[#9e4635]" />
                Messages
              </h1>
            </div>

            {/* Search Input Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search conversations or users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white/80 border border-[#edd6cc] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9e4635]/30 text-gray-800 placeholder-gray-400 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* User Search Results List (if search query entered) */}
          {searchQuery.trim() && (
            <div className="p-3 border-b border-[#edd6cc] bg-[#fcf5f2]/80 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">
                User Search Results
              </p>
              {isSearchingUsers ? (
                <div className="text-center py-4 text-xs text-gray-500">Searching users...</div>
              ) : userSearchResults.length > 0 ? (
                userSearchResults.map((u) => (
                  <button
                    key={u._id}
                    onClick={() => handleStartChatWithUser(u._id)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-[#edd6cc]/50 rounded-xl transition-all cursor-pointer border-none bg-transparent text-left"
                  >
                    <img
                      src={u.profileImage || profileFallback}
                      alt={u.username}
                      className="w-8 h-8 rounded-full object-cover border border-[#edd6cc]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate m-0">{u.name}</p>
                      <p className="text-xs text-gray-500 truncate m-0">@{u.username}</p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">No matching users found</p>
              )}
            </div>
          )}

          {/* Conversations History List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoadingChats ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#9e4635]"></div>
              </div>
            ) : filteredChats.length > 0 ? (
              filteredChats.map((chat) => {
                const isSelected = activeChat?._id === chat._id;
                const recipient = chat.recipient || {};
                const lastMsgText = chat.lastMessage?.text || (chat.lastMessage?.mediaUrl ? "📷 Image attachment" : "No messages yet");

                return (
                  <button
                    key={chat._id}
                    onClick={() => setActiveChat(chat)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border-none cursor-pointer text-left ${
                      isSelected
                        ? "bg-[#edd6cc] text-[#9e4635] shadow-sm font-semibold"
                        : "hover:bg-[#fcf5f2] bg-transparent text-gray-800"
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={recipient.profileImage || profileFallback}
                        alt={recipient.username}
                        className="w-12 h-12 rounded-full object-cover border border-[#edd6cc] shadow-sm"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <h2 className="text-sm font-bold text-gray-900 truncate m-0">
                          {recipient.name || recipient.username || "User"}
                        </h2>
                        {chat.updatedAt && (
                          <span className="text-[11px] text-gray-400 ml-1 flex-shrink-0">
                            {formatTimestamp(chat.updatedAt)}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-500 truncate max-w-[180px] m-0">
                          {lastMsgText}
                        </p>
                        {chat.unreadCount > 0 && (
                          <span className="ml-2 flex h-4 min-w-4 px-1.5 items-center justify-center rounded-full bg-[#9e4635] text-[10px] font-bold text-white shadow-sm">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-16 px-4 text-gray-500">
                <MessageSquare className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium m-0">No conversations yet</p>
                <p className="text-xs text-gray-400 mt-1">Search users above to start chatting!</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Active Chat Window */}
        <div
          className={`${
            activeChat ? "flex" : "hidden md:flex"
          } flex-col flex-1 bg-white/40`}
        >
          {activeChat ? (
            <>
              {/* Chat Window Header */}
              <div className="p-4 border-b border-[#edd6cc] bg-[#fffaf7]/90 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveChat(null)}
                    className="md:hidden text-gray-600 hover:text-gray-900 border-none bg-transparent cursor-pointer p-1"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <img
                    src={activeChat.recipient?.profileImage || profileFallback}
                    alt={activeChat.recipient?.username}
                    className="w-10 h-10 rounded-full object-cover border border-[#edd6cc] shadow-sm"
                  />

                  <div>
                    <Link
                      to={`/UserProfile/${activeChat.recipient?._id}`}
                      className="text-sm font-bold text-gray-900 hover:text-[#9e4635] transition-colors no-underline block m-0"
                    >
                      {activeChat.recipient?.name || activeChat.recipient?.username}
                    </Link>
                    <p className="text-xs text-gray-500 flex items-center gap-1 m-0">
                      <span>@{activeChat.recipient?.username}</span>
                      {activeChat.recipient?.institute && (
                        <>
                          <span>•</span>
                          <GraduationCap className="w-3 h-3 text-gray-400" />
                          <span className="truncate max-w-[140px]">
                            {activeChat.recipient.institute}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <Link
                  to={`/UserProfile/${activeChat.recipient?._id}`}
                  className="px-3 py-1.5 text-xs font-medium text-[#9e4635] bg-[#edd6cc]/50 hover:bg-[#edd6cc] rounded-xl transition-colors no-underline flex items-center gap-1"
                >
                  <User className="w-3.5 h-3.5" /> View Profile
                </Link>
              </div>

              {/* Message Feed Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoadingMessages ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#9e4635]"></div>
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((msg) => {
                    const isMe = (msg.sender?._id || msg.sender) === currentUserId;

                    return (
                      <div
                        key={msg._id || msg.createdAt}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[75%] md:max-w-[65%] rounded-2xl p-3.5 shadow-sm text-sm ${
                            isMe
                              ? "bg-[#9e4635] text-white rounded-br-none"
                              : "bg-[#fffaf7] border border-[#edd6cc] text-gray-800 rounded-bl-none"
                          }`}
                        >
                          {msg.mediaUrl && (
                            <img
                              src={msg.mediaUrl}
                              alt="Attachment"
                              className="rounded-xl max-h-60 w-full object-cover mb-2 border border-black/10"
                            />
                          )}

                          {msg.text && <p className="leading-relaxed whitespace-pre-wrap m-0">{msg.text}</p>}

                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                              isMe ? "text-white/80" : "text-gray-400"
                            }`}
                          >
                            <span>{formatTimestamp(msg.createdAt)}</span>
                            {isMe && (
                              <CheckCheck className="w-3 h-3 text-white/90" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-20 text-gray-400 text-xs">
                    No messages in this chat yet. Say hi! 👋
                  </div>
                )}

                {recipientTyping && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 italic bg-[#fffaf7] border border-[#edd6cc] px-3 py-1.5 rounded-full w-max shadow-sm animate-pulse">
                    <span>{activeChat.recipient?.name || "User"} is typing...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 border-t border-[#edd6cc] bg-[#fffaf7]/90 flex flex-col gap-2 flex-shrink-0">
                {/* File Attachment Preview */}
                {previewUrl && (
                  <div className="relative inline-block w-20 h-20 rounded-xl overflow-hidden border border-[#edd6cc]">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={handleClearFile}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white p-0.5 rounded-full border-none cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 text-gray-500 hover:text-[#9e4635] hover:bg-[#edd6cc]/50 rounded-xl transition-colors border-none bg-transparent cursor-pointer"
                    title="Attach Image"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={inputText}
                    onChange={handleInputChange}
                    className="flex-1 px-4 py-2.5 text-sm bg-white border border-[#edd6cc] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9e4635]/30 text-gray-800 placeholder-gray-400"
                  />

                  <button
                    type="submit"
                    disabled={(!inputText.trim() && !selectedFile) || isSending}
                    className={`p-2.5 rounded-xl text-white transition-all border-none cursor-pointer flex items-center justify-center ${
                      (!inputText.trim() && !selectedFile) || isSending
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-[#9e4635] hover:bg-[#8f3a2c] shadow-sm"
                    }`}
                  >
                    {isSending ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* Empty State when no chat selected */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
              <div className="w-16 h-16 rounded-full bg-[#edd6cc]/40 flex items-center justify-center mb-4 text-[#9e4635]">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 m-0">Your Chat Workspace</h2>
              <p className="text-xs text-gray-500 max-w-sm mt-1">
                Select an existing conversation record from the left panel, or search for a user to start a new real-time message stream!
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
