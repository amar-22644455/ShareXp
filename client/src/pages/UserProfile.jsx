import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import profile from "@/assets/profile.jpg";
import PostThumbnail from "@/components/PostThumbnail";
import Sidebar from "@/components/Sidebar";
import { GraduationCap, Award, MessageSquare } from "lucide-react";
export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  // Get current user ID from localStorage
  const currentUserId = localStorage.getItem("userId");

  useEffect(() => {
    const fetchUserAndPosts = async () => {
      try {
        // Fetch user data
        const userResponse = await fetch(`/api/userprofile/${id}`, {
          method:"GET",
          headers: {
            "Content-Type": "application/json"
          },
        });
  
        if (userResponse.status === 401) {
          navigate("/LoginXP");
          return;
        }
  
        if (!userResponse.ok) throw new Error("Failed to fetch user");
        const { user: userData, isFollowing: followingStatus, posts:userposts } = await userResponse.json();
        
        setUser(userData);
        setIsFollowing(followingStatus);
        setPosts(userposts || []);

      } catch (error) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchUserAndPosts();
  }, [id]);

  const handleFollow = async () => {
    try {
      const newFollowingStatus = !isFollowing;
  
      // Optimistic UI Update (immediately reflect changes)
      setIsFollowing(newFollowingStatus);
      setUser(prev => {
        const updatedFollowers = newFollowingStatus
          ? [...prev.followers, currentUserId]  // Add follower
          : prev.followers.filter(id => id !== currentUserId);  // Remove follower
  
        return {
          ...prev,
          followers: updatedFollowers,
        };
      });
  
      // Send request to backend
      const response = await fetch(`/api/follow/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
      });
  
      if (!response.ok) {
        throw new Error("Failed to update follow status");
      }
  
      // Optional: Fetch latest data to ensure sync (if needed)
      const updatedUserResponse = await fetch(`/api/userprofile/${id}`);
      const { user: updatedUser } = await updatedUserResponse.json();
      setUser(updatedUser);  // Force update with latest data
  
    } catch (error) {
      console.error("Follow/Unfollow error:", error);
      // Revert optimistic update on failure
      setIsFollowing(!newFollowingStatus);
      setUser(prev => ({
        ...prev,
        followers: prev.followers,  // Revert to previous state
      }));
      setError(error.message);
    }
  };

  const handleMessageUser = async () => {
    try {
      const response = await fetch('/api/chats/find-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: id })
      });
      if (response.ok) {
        const chat = await response.json();
        navigate(`/chat/${currentUserId}/${chat._id}`);
      }
    } catch (err) {
      console.error('Failed to initiate chat:', err);
    }
  };

  if (isLoading) return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#9e4635]"></div>
    </div>
  );

  if (error) return <p className="text-red-500 p-4">{error}</p>;
  if (!user) return <p className="text-gray-400 p-4">User not found</p>;

  return (
    <section className="flex h-screen w-full bg-gradient-to-br from-[#f7ece7] via-[#f4e3da] to-[#ecd0c4]">
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Cover Banner */}
        <div className="mx-6 mt-6 h-28 md:h-36 bg-gradient-to-r from-[#9e4635] to-[#d0735e] relative rounded-t-2xl flex-shrink-0 shadow-sm" />

        {/* Profile Header Card */}
        <div className="mx-6 px-6 pb-6 relative -mt-10 flex flex-col md:flex-row items-center md:items-end gap-6 border-l border-r border-b border-[#edd6cc] w-[calc(100%-3rem)] bg-[#fffaf7]/40 backdrop-blur-sm rounded-b-2xl flex-shrink-0 shadow-sm">
          {/* Avatar container */}
          <div className="relative group flex-shrink-0">
            {user ? (
              <img 
                src={user.profileImage || profile} 
                alt="Profile" 
                className="w-28 h-28 rounded-full object-cover border-4 border-[#fffaf7] shadow-md"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-gray-200 border-4 border-[#fffaf7] shadow-md animate-pulse flex items-center justify-center">
                <span className="text-gray-400 text-xs font-semibold">...</span>
              </div>
            )}
          </div>

          {/* User Meta info */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900 m-0">{user.username}</h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                {currentUserId !== id && (
                  <>
                    <button 
                      onClick={handleFollow}
                      className={`px-5 py-1.5 rounded-xl font-medium text-xs border-none cursor-pointer transition-colors shadow-sm ${
                        isFollowing ? "bg-red-500 hover:bg-red-600 text-white" : "bg-[#9e4635] hover:bg-[#8f3a2c] text-white"
                      }`}
                    >
                      {isFollowing ? "Unfollow" : "Follow"}
                    </button>
                    <button
                      onClick={handleMessageUser}
                      className="px-4 py-1.5 bg-[#9e4635] hover:bg-[#8f3a2c] text-white rounded-xl font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm border-none"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Message
                    </button>
                  </>
                )}
                <Link 
                  to={`/achievements/${id}`}
                  className="px-3.5 py-1.5 bg-[#fffaf7] border border-[#edd6cc] text-[#9e4635] hover:bg-[#fcf5f2] rounded-xl font-medium text-xs transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5" /> Achievements
                </Link>
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <p className="text-sm font-semibold text-gray-800 text-left md:text-left m-0">{user.name}</p>
              <p className="text-xs text-gray-500 flex items-center justify-center md:justify-start gap-1 m-0">
                <GraduationCap className="w-3.5 h-3.5 text-gray-400" /> {user.institute}
              </p>
            </div>
          </div>

          {/* Stats Summary Card */}
          <div className="flex gap-6 bg-[#fffaf7]/80 border border-[#edd6cc] rounded-2xl px-5 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex-shrink-0">
            <div className="text-center min-w-12">
              <p className="text-base font-bold text-gray-900 m-0">{posts.length}</p>
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider m-0">posts</p>
            </div>
            <div className="h-8 w-[1px] bg-[#f5e6df] self-center" />
            <div className="text-center min-w-16">
              <p className="text-base font-bold text-gray-900 m-0">{user.followers?.length || 0}</p>
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider m-0">followers</p>
            </div>
            <div className="h-8 w-[1px] bg-[#f5e6df] self-center" />
            <div className="text-center min-w-16">
              <p className="text-base font-bold text-gray-900 m-0">{user.following?.length || 0}</p>
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider m-0">following</p>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="mx-6 mt-6 flex justify-center border-b border-[#edd6cc] bg-[#fffaf7]/20 flex-shrink-0">
          <div className="px-6 py-3 border-b-2 border-[#9e4635] text-sm font-semibold text-[#9e4635]">
            Posts ({posts.length})
          </div>
        </div>

        {/* Posts Grid container */}
        <div className="mx-6 mb-6 p-4 md:p-6 bg-[#fffaf7]/30 border border-[#edd6cc] border-t-0 rounded-b-2xl flex-1">
          {posts.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {posts.map(post => (
                <PostThumbnail 
                  key={post._id}
                  post={post}
                  profileFallback={profile}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-gray-500">
              No posts yet
            </div>
          )}
        </div>
      </div>
    </section>
  );
}