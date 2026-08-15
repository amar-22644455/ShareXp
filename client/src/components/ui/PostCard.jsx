import { Card, CardContent } from "@/components/ui/card";
import Button from "@/components/ui/button";
import {
  ThumbsUp,
  MessageCircle,
  Share2,
  Send,
  ChevronDown,
  ChevronUp,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Mail,
  Trash2
} from "lucide-react";

import { useState, useEffect } from "react";

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
};

export default function PostCard({ post, onDelete }) {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(post?.comments || []);
  const [isLiked, setIsLiked] = useState(post?.isLiked || false);
  const [likeCount, setLikeCount] = useState(post?.likeCount || 0);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [postOwner, setPostOwner] = useState(
    typeof post?.userId === "object" ? post.userId : null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const currentUserId = localStorage.getItem("userId");

  useEffect(() => {
    if (post) {
      setComments(post.comments || []);
      setLikeCount(post.likeCount || 0);
      setIsLiked(post.isLiked || false);
      if (typeof post.userId === "object") {
        setPostOwner(post.userId);
      }
    }
  }, [post]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!post?._id || !currentUserId) return;

      try {
        // Fetch like status only if it is not already pre-calculated
        if (post.isLiked === undefined) {
          const likeRes = await fetch(`/api/${post._id}/like-status?userId=${currentUserId}`);
          if (likeRes.ok) {
            const likeData = await likeRes.json();
            setIsLiked(likeData.isLiked);
            if (likeData.likeCount !== undefined) {
              setLikeCount(likeData.likeCount);
            }
          }
        }

        // Fetch owner details if they are not already populated as an object
        if (!postOwner && post?.userId) {
          const ownerId = typeof post.userId === "object" ? post.userId._id : post.userId;
          const ownerRes = await fetch(`/api/users/${ownerId}`);
          if (ownerRes.ok) {
             const ownerData = await ownerRes.json();
             setPostOwner(ownerData);
          }
        }
      } catch (error) {
        console.error("Error fetching post data:", error);
      }
    };

    fetchInitialData();
  }, [post?._id, post?.userId, postOwner]);

  const handlePostAction = async (actionType, data = {}) => {
    try {
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId: post._id,
          actionType,
          ...data
        })
      });

      if (!response.ok) throw new Error("Action failed");
      return await response.json();
    } catch (err) {
      console.error("Post action error:", err);
      return null;
    }
  };

  const handleLike = async () => {
    if (!currentUserId) return;
    const prevLiked = isLiked;
    const prevCount = likeCount;

    const newLiked = !prevLiked;
    setIsLiked(newLiked);
    setLikeCount(newLiked ? likeCount + 1 : likeCount - 1);

    const action = newLiked ? "like" : "unlike";
    const recipientId = typeof post.userId === "object" ? post.userId._id : post.userId;

    const result = await handlePostAction(action, { recipientId });
    if (!result) {
      setIsLiked(prevLiked);
      setLikeCount(prevCount);
    } else {
      if (result.likes !== undefined) {
        setLikeCount(result.likes.length);
        setIsLiked(result.likes.includes(currentUserId));
      }
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    const recipientId = typeof post.userId === "object" ? post.userId._id : post.userId;
    const result = await handlePostAction("comment", {
      commentText: comment,
      recipientId
    });

    if (result?.comment) {
      setComments(prev => [...prev, result.comment]);
      setComment("");
      setShowCommentInput(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/delete/${post._id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete post");
      }

      if (typeof onDelete === "function") {
        onDelete(post._id);
      } else {
        window.location.href = `/home/${currentUserId}`;
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      alert(error.message || "Failed to delete post");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = (platform) => {
    setShowShareMenu(false);
    const postUrl = `${window.location.origin}/post/${post._id}`;
    const text = `Check out this post: ${post.text}`;

    const urlEncoded = encodeURIComponent(postUrl);
    const textEncoded = encodeURIComponent(text);

    const shareLinks = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`,
      twitter: `https://twitter.com/intent/tweet?text=${textEncoded}&url=${urlEncoded}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${urlEncoded}`,
      whatsapp: `https://wa.me/?text=${textEncoded}%20${urlEncoded}`,
      email: `mailto:?subject=Check out this post&body=${textEncoded}%0A%0A${urlEncoded}`
    };

    if (platform === "instagram") {
      alert("Instagram sharing is not supported via web.");
    } else if (shareLinks[platform]) {
      window.open(shareLinks[platform], "_blank");
    } else if (navigator.share) {
      navigator.share({
        title: "Check out this post",
        text,
        url: postUrl
      }).catch(err => console.error("Share failed:", err));
    } else {
      navigator.clipboard.writeText(postUrl).then(() => alert("Link copied to clipboard!"));
    }
  };

  if (!post) return null;

  return (
    <Card className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden w-full">
      <CardContent className="p-6">
        {/* User Info & Delete Action */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img
              src={postOwner?.profileImage || "https://picsum.photos/100"}
              alt="Profile"
              className="h-12 w-12 rounded-full object-cover border-2 border-[#edd6cc]"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://picsum.photos/100";
              }}
            />
            <div className="text-left">
              <h4 className="text-black font-semibold text-lg">{post?.username || "User"}</h4>
              <span className="text-gray-600 text-sm">
                {formatDate(post.createdAt)}
              </span>
            </div>
          </div>

          {/* Delete Button for Owner */}
          {currentUserId &&
            (currentUserId === postOwner?._id ||
              currentUserId === postOwner?.id ||
              currentUserId === (typeof post.userId === "object" ? post.userId._id : post.userId)) && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="Delete Post"
              >
                <Trash2 className={`w-5 h-5 ${isDeleting ? "animate-pulse" : ""}`} />
              </button>
            )}
        </div>

        {/* Post Content */}
        <p className="text-black text-base leading-relaxed mb-4 text-left whitespace-pre-wrap">{post?.text}</p>

        {/* Media */}
        {post?.media && post.media.url && (
          post.media.fileType === "image" ? (
            <img
              src={post.media.url}
              alt="Post Media"
              className="w-full max-h-[450px] rounded-lg object-cover mb-4"
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = "none";
              }}
            />
          ) : post.media.fileType === "video" ? (
            <video controls className="w-full rounded-lg max-h-80 object-cover mb-4">
              <source src={post.media.url} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : (
            <a
              href={post.media.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#9e4635] underline mb-4 block text-left"
            >
              View Document
            </a>
          )
        )}

        {/* Interaction Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-150">
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 cursor-pointer border-none bg-transparent ${
              isLiked 
                ? 'text-red-500 bg-red-50 font-semibold' 
                : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
            }`}
            onClick={handleLike}
          >
            <ThumbsUp className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            <span className="text-sm font-medium">{likeCount}</span>
          </button>

          <button
            className="flex items-center gap-2 px-4 py-2 rounded-full text-gray-500 hover:text-[#9e4635] hover:bg-[#fcf5f2] transition-all duration-200 cursor-pointer border-none bg-transparent"
            onClick={() => {
              setShowCommentInput(!showCommentInput);
              setShowComments(true);
            }}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{comments.length}</span>
          </button>

          <div className="relative">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-full text-gray-500 hover:text-[#9e4635] hover:bg-[#fcf5f2] transition-all duration-200 cursor-pointer border-none bg-transparent"
              onClick={() => setShowShareMenu(!showShareMenu)}
            >
              <Share2 className="w-5 h-5" />
              <span className="text-sm font-medium">Share</span>
            </button>

            {showShareMenu && (
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-2xl p-3 z-10 flex gap-3 shadow-xl">
                <Facebook onClick={() => handleShare("facebook")} className="text-blue-600 cursor-pointer hover:scale-110 transition-transform" />
                <Twitter onClick={() => handleShare("twitter")} className="text-blue-400 cursor-pointer hover:scale-110 transition-transform" />
                <Instagram onClick={() => handleShare("instagram")} className="text-pink-500 cursor-pointer hover:scale-110 transition-transform" />
                <Linkedin onClick={() => handleShare("linkedin")} className="text-blue-700 cursor-pointer hover:scale-110 transition-transform" />
                <Mail onClick={() => handleShare("email")} className="text-gray-400 cursor-pointer hover:scale-110 transition-transform" />
              </div>
            )}
          </div>
        </div>

        {/* Comment Input */}
        {showCommentInput && (
          <form onSubmit={handleCommentSubmit} className="mt-4 flex gap-3">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9e4635] transition-all text-left"
            />
            <button
              type="submit"
              className="bg-[#9e4635] hover:bg-[#8f3a2c] text-white px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        )}

        {/* Comments */}
        {comments.length > 0 && (
          <div className="mt-4">
            <button
              className="text-gray-500 text-sm flex items-center gap-1 hover:text-[#9e4635] hover:bg-[#fcf5f2] px-3 py-1.5 rounded-full transition-all duration-200 mb-3 border-none bg-transparent cursor-pointer"
              onClick={() => setShowComments(!showComments)}
            >
              {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
            </button>

            {showComments && (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment._id} className="flex gap-3 items-start">
                    <img
                      src={comment.userId?.profileImage || comment.profileImage || "https://picsum.photos/100"}
                      alt="Profile"
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://picsum.photos/100";
                      }}
                    />
                    <div className="flex-1 bg-gray-50 rounded-lg p-3 text-left">
                      <div className="flex justify-between items-center mb-1 text-left">
                        <h4 className="text-sm font-semibold text-black text-left">{comment.username}</h4>
                        <span className="text-xs text-gray-600 whitespace-nowrap ml-2">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 text-left whitespace-pre-wrap">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
