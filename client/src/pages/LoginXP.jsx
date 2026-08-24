import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function LoginXP() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [isGuestLoading, setIsGuestLoading] = useState(false);
    const { login, guestLogin } = useAuth();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            // Use AuthContext.login() so currentUser is set in context
            // before ProtectedRoute checks it on the destination page.
            const data = await login(email, password);
            if (data?.message) {
                // login() returns the error payload on failure
                throw new Error(data.message);
            }
        } catch (err) {
            setError(err.message || "Login failed");
        } finally {
            setSubmitting(false);
        }
    };

    const handleGuestLogin = async () => {
        setError("");
        setIsGuestLoading(true);
        try {
            const data = await guestLogin();
            if (data?.message) {
                throw new Error(data.message);
            }
        } catch (err) {
            setError(err.message || "Guest login failed");
        } finally {
            setIsGuestLoading(false);
        }
    };

   return (
  <>
    <section className="min-h-screen w-full bg-white flex items-center justify-center px-4">
      <main className="w-full flex justify-center">
        <div className="flex flex-col gap-2 border-2 border-gray-300 p-10 rounded-[4px] max-w-md w-full bg-gradient-to-br from-[#f7ece7] via-[#f4e3da] to-[#ecd0c4]">
          
          <p className="font-serif text-[2.5rem] text-center">ShareXP</p>
          <p className="font-serif text-base mb-5 text-center">
            Login to share your experience
          </p>

          {error && (
            <p className="text-red-500 text-center">
              {error}
            </p>
          )}

          <form className="flex flex-col gap-2" onSubmit={handleLogin}>
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full
                          p-2
                          border
                          text-black
                          bg-white
                          placeholder-gray-400
                          focus:outline-none
                          focus:ring-2
                          focus:ring-blue-500
                          focus:bg-white
                          focus:text-black"
              required
            />

            <input
              name="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full
                        p-2
                        border
                        text-black
                        bg-white
                        placeholder-gray-400
                        focus:outline-none
                        focus:ring-2
                        focus:ring-blue-500
                        focus:bg-white
                        focus:text-black"
              required
            />

            <button
              type="submit"
              disabled={submitting || isGuestLoading}
              className="mt-1 bg-gray-200 text-black p-2 hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="flex flex-col mt-4 gap-2 pt-3 border-t border-gray-300/60">
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={isGuestLoading || submitting}
              className="bg-[#9e4635] text-white p-2.5 rounded-lg hover:bg-[#8f3a2c] font-semibold transition shadow-sm disabled:opacity-50 border-none cursor-pointer flex items-center justify-center gap-2"
            >
              {isGuestLoading ? "Entering as Guest..." : "Explore as Guest 🚀"}
            </button>

            <p className="text-center font-serif text-sm mt-2 mb-0">Haven't started?</p>
            <Link to="/CreateXp">
              <button className="bg-gray-200 w-full text-black p-2 hover:bg-gray-300 transition border-none cursor-pointer">
                Create Account
              </button>
            </Link>
          </div>

        </div>
      </main>
    </section>
  </>
);
}
