import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import createSocket from "@/config/socket";
import Button from "@/components/ui/button";
import image from "@/assets/image.png";
import skill from "@/assets/skill.jpg";
import PostCard from "@/components/ui/PostCard";
import { useAuth } from "@/context/AuthContext";
import profile from "@/assets/profile.jpg";
import Sidebar from "@/components/Sidebar";

const socket = createSocket();

export default function Home() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const currentUserId = localStorage.getItem("userId");
  const [user, setUser] = useState(null);
  const [feedPosts, setFeedPosts] = useState([]); // Combined feed posts
  const [file, setFile] = useState(null);
  const [postText, setPostText] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch user and feed sequentially
        const [userResponse, feedResponse] = await Promise.all([
          fetch(`/api/Profile/${id}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json"
            }
          }),
          fetch("/api/following", {
            method: "GET",
            headers: {
              "Content-Type": "application/json"
            }
          })
        ]);

        if (userResponse.status === 401 || feedResponse.status === 401) {
          navigate("/LoginXP");
          return;
        }

        if (!userResponse.ok || !feedResponse.ok) {
          const userError = await userResponse.json().catch(() => null);
          const feedError = await feedResponse.json().catch(() => null);
          throw new Error(userError?.message || feedError?.message || "Failed to fetch data");
        }

        const [userData, feedData] = await Promise.all([
          userResponse.json(),
          feedResponse.json()
        ]);

        setUser(userData);
        setFeedPosts(feedData.posts || []);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Socket.io for real-time updates
    const handleNewPost = (newPost) => {
      setFeedPosts(prevPosts => {
        // Avoid duplicates
        if (!prevPosts.some(post => post._id === newPost._id)) {
          return [newPost, ...prevPosts];
        }
        return prevPosts;
      });
    };

    socket.on("newPost", handleNewPost);

    return () => {
      socket.off("newPost", handleNewPost);
    };
  }, [id]);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handlePost = async () => {
    if (!file && !postText.trim()) {
      alert("Please enter text or select an image.");
      return;
    }

    const formData = new FormData();
    if (postText.trim()) formData.append("text", postText);
    if (file) formData.append("media", file);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create post");
      }

      const newPost = await response.json();
      
      // Add to feed posts
      setFeedPosts(prev => [newPost, ...prev]);
      
      // Reset form fields
      setPostText("");
      setFile(null);
      setPreview(null);
      
      // Emit socket event to notify followers
      socket.emit("newPost", newPost);
    } catch (error) {
      console.error("Error creating post:", error);
      alert(error.message);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gradient-to-br from-[#f7ece7] via-[#f4e3da] to-[#ecd0c4]">
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 hide-scrollbar">
        <Card className="p-4 shadow-md rounded-2xl bg-[#fffaf7] w-full">
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <img 
                src={user?.profileImage || profile}  
                alt="Profile" 
                className="w-10 h-10 rounded-full object-cover" 
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = profile;
                }}
              />
              <textarea
                className="w-full p-3 rounded-lg bg-gray-100 text-black resize-none focus:outline-none"
                placeholder="What's on your mind?"
                rows="3"
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
              ></textarea>
            </div>
            {preview && (
              <div className="relative">
                <img src={preview} alt="Preview" className="w-full max-h-80 rounded-lg object-contain" />
                <button
                  className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"
                  onClick={() => {
                    URL.revokeObjectURL(preview);
                    setFile(null);
                    setPreview(null);
                  }}
                >
                  &times;
                </button>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              onChange={handleFileChange}
              accept="image/*,video/*" 
            />
            <div className="flex flex-wrap justify-between items-center border-t border-gray-200 pt-3 mt-2">
              <div className="flex gap-4">
                <Button 
                  variant="ghost" 
                  className="flex items-center gap-2 text-gray-600" 
                  onClick={() => fileInputRef.current.click()}
                >
                  <img src={image} alt="Upload" className="w-5 h-5" />
                  Photo/Video
                </Button>
              </div>
              <Button 
                onClick={handlePost} 
                className="bg-[#9e4635] text-white px-4 py-2 rounded-lg hover:bg-[#8f3a2c] border-none"
                disabled={!postText.trim() && !file}
              >
                Share
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Posts Feed */}
        <div className="mt-10 space-y-6">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <p className="text-gray-600">Loading posts...</p>
            </div>
          ) : error ? (
            <div className="text-red-500 p-4 text-center">{error}</div>
          ) : feedPosts.length > 0 ? (
            feedPosts.map((post) => (
              <PostCard 
                key={post._id} 
                post={post}
                currentUserId={id}
              />
            ))
          ) : (
            <div className="text-center p-8 text-gray-600">
              <p>No posts yet.</p>
              <p>Create your first post or follow users to see their posts!</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="hidden md:flex flex-col w-64 h-screen p-4 overflow-y-auto">
        {user ? (
          <div className="bg-[#fffaf7] border border-[#edd6cc] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mt-5">
            {/* Accent Banner */}
            <div className="h-12 bg-gradient-to-r from-[#9e4635] to-[#d0735e]" />
            
            <div className="p-4 flex flex-col items-center">
              {/* Avatar overlapping banner */}
              <div className="-mt-10 mb-3 relative">
                <img 
                  src={user?.profileImage || profile} 
                  alt="Profile" 
                  className="w-16 h-16 rounded-full object-cover border-4 border-[#fffaf7] shadow-sm"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = profile;
                  }}
                />
              </div>
              
              {/* User details */}
              <div className="text-center w-full px-2">
                <p className="text-black font-semibold text-base truncate">{user.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">@{user.username}</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 w-full mt-4 py-3 border-t border-b border-[#f5e6df] text-center">
                <div>
                  <p className="text-sm font-bold text-gray-900">{user.posts?.length || 0}</p>
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Posts</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{user.followers?.length || 0}</p>
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Followers</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{user.following?.length || 0}</p>
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Following</p>
                </div>
              </div>

              {/* Action Button */}
              <Link 
                to={`/profile/${id}`} 
                className="w-full text-center py-2 px-4 mt-4 bg-transparent border border-[#9e4635] text-[#9e4635] hover:bg-[#9e4635] hover:text-white rounded-xl font-medium text-xs transition-all duration-300 flex items-center justify-center gap-1 cursor-pointer"
              >
                View Profile
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-gray-600 mt-5">Loading user...</p>
        )}
      </div>
    </div>

  );
}