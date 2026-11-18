import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  History,
  User,
  Lock,
  Mail,
  LogOut,
  RefreshCw,
  Sun,
  Moon,
  CheckCircle,
  AlertCircle,
  KeyRound,
  Save,
  Play,
  Square,
  ShieldCheck,
  Eye,
  EyeOff,
  Trash2,
  X,
  AlertTriangle,
  FileText,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000";

export default function App() {
  // Theme state (Dark by default)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : true;
  });

  const [activeTab, setActiveTab] = useState("studio");
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  // Auth states
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [authStatus, setAuthStatus] = useState({ type: "", text: "" });
  const [authLoading, setAuthLoading] = useState(false);

  // Password visibility toggle state
  const [showPassword, setShowPassword] = useState(false);

  // User profile info state
  const [userInfo, setUserInfo] = useState(null);

  // Studio & Camera states
  const [translatedText, setTranslatedText] = useState(
    "Waiting for gesture stream...",
  );
  const [confidence, setConfidence] = useState(0.0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [studioStatus, setStudioStatus] = useState({ type: "", text: "" });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const wsRef = useRef(null);
  const animationFrameRef = useRef(null);

  // History states
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal States
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null); // holds translation object for deletion modal

  // Sync theme to document body and localStorage
  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
    document.body.style.backgroundColor = darkMode ? "#0f172a" : "#f8fafc";
    document.body.style.margin = "0";
    document.body.style.transition = "background-color 0.25s ease";
  }, [darkMode]);

  // --- CAMERA STREAM LIFECYCLE ---
  useEffect(() => {
    if (isStreaming && activeTab === "studio" && token) {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 320, height: 240 } })
        .then((stream) => {
          mediaStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.error("Camera access error:", err);
          setStudioStatus({
            type: "error",
            text: "Could not access webcam. Please check permissions.",
          });
          setIsStreaming(false);
        });
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isStreaming, activeTab, token]);

  // --- REAL-TIME AUTHENTICATED WEBSOCKET & FRAME CAPTURE LOOP ---
  useEffect(() => {
    if (isStreaming && activeTab === "studio" && token) {
      const wsUrl = `ws://127.0.0.1:8000/ws/sign-translate?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setStudioStatus({ type: "", text: "" });

        let lastSendTime = 0;
        const sendVideoFrame = (timestamp) => {
          if (!isStreaming || ws.readyState !== WebSocket.OPEN) return;

          if (timestamp - lastSendTime > 5000) {
            lastSendTime = timestamp;
            if (videoRef.current && canvasRef.current) {
              const video = videoRef.current;
              const canvas = canvasRef.current;
              const context = canvas.getContext("2d");

              if (video.videoWidth > 0 && video.videoHeight > 0) {
                canvas.width = 160;
                canvas.height = 120;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                const frameData = canvas.toDataURL("image/jpeg", 0.6);

                ws.send(
                  JSON.stringify({
                    image_frame: frameData,
                  }),
                );
              }
            }
          }
          animationFrameRef.current = requestAnimationFrame(sendVideoFrame);
        };

        animationFrameRef.current = requestAnimationFrame(sendVideoFrame);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === "success") {
            setTranslatedText(data.translated_text);
            setConfidence(data.confidence);
          }
        } catch (err) {
          console.error("Invalid WebSocket message:", err);
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
        setStudioStatus({
          type: "error",
          text: "WebSocket connection error or token expired.",
        });
      };

      ws.onclose = () => {
        setWsConnected(false);
      };

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (ws) ws.close();
      };
    } else {
      setWsConnected(false);
    }
  }, [isStreaming, activeTab, token]);

  // --- FETCH USER INFO FOR ACCOUNT TAB ---
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!token) {
        setUserInfo(null);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUserInfo(data);
        } else {
          setUserInfo({ email: email || "Authenticated User" });
        }
      } catch (err) {
        setUserInfo({ email: email || "Authenticated User" });
      }
    };
    fetchUserInfo();
  }, [token, email]);

  // --- AUTH & HISTORY HANDLERS ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthStatus({ type: "", text: "" });
    setAuthLoading(true);

    try {
      if (authMode === "login" || authMode === "register") {
        const endpoint =
          authMode === "login" ? "/auth/login" : "/auth/register";
        const res = await fetch(`${API_URL}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Authentication failed");

        if (authMode === "login") {
          setToken(data.access_token);
          localStorage.setItem("token", data.access_token);
          setAuthStatus({ type: "success", text: "Signed in successfully!" });
        } else {
          setAuthStatus({
            type: "success",
            text: "Account created! Please sign in.",
          });
          setAuthMode("login");
        }
      } else if (authMode === "forgot") {
        const res = await fetch(`${API_URL}/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();

        // This ensures if res.not.ok (like the 404 error from FastAPI), it throws the backend's exact message!
        if (!res.ok) throw new Error(data.detail || "Request failed");

        setAuthStatus({
          type: "success",
          text: data.message || "Reset token generated and sent to email.",
        });
        setAuthMode("reset");
      } else if (authMode === "reset") {
        const res = await fetch(`${API_URL}/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            token: resetToken,
            new_password: password,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Password reset failed");

        setAuthStatus({
          type: "success",
          text: "Password updated! You can now sign in.",
        });
        setAuthMode("login");
        setPassword("");
      }
    } catch (err) {
      // This catches the thrown error and outputs "User with this email does not exist." in red text on your UI!
      setAuthStatus({ type: "error", text: err.message });
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    setIsStreaming(false);
    setToken("");
    localStorage.removeItem("token");
    setAuthStatus({ type: "", text: "" });
  };

  const fetchHistory = async () => {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_URL}/translations/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to load history");
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history" && token) {
      fetchHistory();
    }
  }, [activeTab, token]);

  // Triggered when user clicks "Save to History" button -> opens modal first
  const handleSaveClick = () => {
    if (
      !translatedText ||
      translatedText === "Waiting for gesture stream..." ||
      translatedText === "No gesture detected" || // 👈 Blocks saving inactive text
      translatedText.trim() === ""
    ) {
      setStudioStatus({
        type: "error",
        text: "Please wait for an active sign translation before saving!",
      });
      return;
    }
    setStudioStatus({ type: "", text: "" });
    setShowSaveModal(true);
  };

  // Confirmed save action from modal
  const confirmSaveTranslation = async () => {
    setShowSaveModal(false);
    try {
      const res = await fetch(`${API_URL}/translations/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: 1,
          translated_text: translatedText,
          confidence: confidence,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save translation");

      setStudioStatus({
        type: "success",
        text: "Translation saved to history!",
      });

      // Clear out studio box to allow capturing fresh signs immediately
      setTranslatedText("Waiting for gesture stream...");
      setConfidence(0.0);

      fetchHistory();
    } catch (err) {
      setStudioStatus({ type: "error", text: err.message });
    }
  };

  // Confirmed delete action from modal
  const confirmDeleteTranslation = async () => {
    if (!itemToDelete) return;
    const targetId = itemToDelete.id;
    setItemToDelete(null);

    try {
      await fetch(`${API_URL}/translations/${targetId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setHistory((prev) => prev.filter((item) => item.id !== targetId));
    } catch (err) {
      console.error("Delete error, removing from local state:", err);
      setHistory((prev) => prev.filter((item) => item.id !== targetId));
    }
  };

  const theme = getTheme(darkMode);

  return (
    <div style={theme.page}>
      <div style={theme.container}>
        {/* HEADER */}
        <header style={theme.header}>
          <div
            style={{ ...theme.brand, cursor: "pointer" }}
            onClick={() => setActiveTab("studio")}
            title="Go to Studio"
          >
            <span style={theme.logoIcon}>🤟</span>
            <div>
              <h1 style={theme.title}>SignBridge</h1>
              <span style={theme.tagline}>Secure Two-Way Sign Studio</span>
            </div>
          </div>

          <div style={theme.headerRight}>
            <nav style={theme.nav}>
              <button
                style={
                  activeTab === "studio" ? theme.activeNavBtn : theme.navBtn
                }
                onClick={() => setActiveTab("studio")}
              >
                <Camera size={16} />
                <span>Studio</span>
              </button>
              <button
                style={
                  activeTab === "history" ? theme.activeNavBtn : theme.navBtn
                }
                onClick={() => setActiveTab("history")}
              >
                <History size={16} />
                <span>History</span>
              </button>
              <button
                style={
                  activeTab === "account" ? theme.activeNavBtn : theme.navBtn
                }
                onClick={() => setActiveTab("account")}
              >
                <User size={16} />
                <span>{token ? "Account" : "Sign In"}</span>
              </button>
            </nav>

            <button
              onClick={() => setDarkMode(!darkMode)}
              style={theme.themeToggle}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Theme"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main style={theme.main}>
          {!token && activeTab !== "account" ? (
            <div style={theme.card}>
              <div style={theme.authWrapper}>
                <div style={{ textAlign: "center", marginBottom: "20px" }}>
                  <ShieldCheck
                    size={48}
                    color="#6366f1"
                    style={{ margin: "0 auto 12px" }}
                  />
                  <h2 style={theme.cardTitle}>Authentication Required</h2>
                  <p style={theme.subtitle}>
                    Please sign in or register to access the real-time sign
                    language studio and translation history.
                  </p>
                </div>
                <button
                  style={theme.submitBtn}
                  onClick={() => setActiveTab("account")}
                >
                  Go to Sign In / Register
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* STUDIO TAB */}
              {activeTab === "studio" && (
                <div style={theme.card}>
                  <div style={theme.cardHeader}>
                    <div>
                      <h2 style={theme.cardTitle}>
                        Real-Time Gemini Vision Stream
                      </h2>
                      <p style={theme.subtitle}>
                        Secure WebSocket streaming connected with JWT
                        authorization.
                      </p>
                    </div>
                    <span
                      style={{
                        ...theme.statusBadge,
                        backgroundColor: wsConnected
                          ? "rgba(16, 185, 129, 0.15)"
                          : darkMode
                            ? "rgba(148, 163, 184, 0.15)"
                            : "#f1f5f9",
                        color: wsConnected
                          ? "#10b981"
                          : darkMode
                            ? "#94a3b8"
                            : "#64748b",
                      }}
                    >
                      ● {wsConnected ? "Secure Stream Active" : "WS Idle"}
                    </span>
                  </div>

                  <div style={theme.videoGrid}>
                    <div style={theme.cameraBox}>
                      {isStreaming ? (
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          style={theme.videoElement}
                        />
                      ) : (
                        <div style={theme.cameraPlaceholder}>
                          <Camera size={42} color="#64748b" />
                          <p style={theme.cameraLabel}>Stream Paused</p>
                          <span style={theme.cameraHint}>
                            Click "Start Live Stream" to begin AI translation.
                          </span>
                        </div>
                      )}
                      <canvas ref={canvasRef} style={{ display: "none" }} />
                    </div>

                    <div style={theme.outputPanel}>
                      <div>
                        <span style={theme.outputLabel}>
                          GEMINI TRANSLATION OUTPUT
                        </span>
                        <div style={theme.outputBox}>
                          <p style={theme.translatedText}>{translatedText}</p>
                        </div>

                        <div style={theme.confidenceWrapper}>
                          <div style={theme.flexBetween}>
                            <span style={theme.confidenceText}>Confidence</span>
                            <span style={theme.confidenceValue}>
                              {(confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div style={theme.progressTrack}>
                            <div
                              style={{
                                ...theme.progressFill,
                                width: `${Math.min(
                                  Math.max(confidence * 100, 0),
                                  100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={theme.actionStack}>
                        <button
                          style={isStreaming ? theme.stopBtn : theme.startBtn}
                          onClick={() => setIsStreaming(!isStreaming)}
                        >
                          {isStreaming ? (
                            <>
                              <Square size={16} /> Stop Stream
                            </>
                          ) : (
                            <>
                              <Play size={16} /> Start Live Stream
                            </>
                          )}
                        </button>

                        <button
                          style={{
                            ...theme.saveBtn,
                            opacity:
                              !isStreaming ||
                              translatedText === "Waiting for gesture stream..."
                                ? 0.5
                                : 1,
                            cursor:
                              !isStreaming ||
                              translatedText === "Waiting for gesture stream..."
                                ? "not-allowed"
                                : "pointer",
                          }}
                          disabled={
                            !isStreaming ||
                            translatedText === "Waiting for gesture stream..."
                          }
                          onClick={handleSaveClick}
                        >
                          <Save size={16} /> Save to History
                        </button>
                      </div>
                    </div>
                  </div>

                  {studioStatus.text && (
                    <div
                      style={
                        studioStatus.type === "error"
                          ? theme.errorBanner
                          : theme.successBanner
                      }
                    >
                      {studioStatus.type === "error" ? (
                        <AlertCircle size={16} />
                      ) : (
                        <CheckCircle size={16} />
                      )}
                      <span>{studioStatus.text}</span>
                    </div>
                  )}
                </div>
              )}

              {/* HISTORY TAB */}
              {activeTab === "history" && (
                <div style={theme.card}>
                  <div style={theme.cardHeader}>
                    <div>
                      <h2 style={theme.cardTitle}>Translation History</h2>
                      <p style={theme.subtitle}>
                        Secured database records for your authenticated session
                      </p>
                    </div>
                    <button
                      style={theme.iconBtn}
                      onClick={fetchHistory}
                      title="Refresh History"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>

                  {loadingHistory ? (
                    <p style={theme.emptyState}>Loading history...</p>
                  ) : history.length === 0 ? (
                    <p style={theme.emptyState}>
                      No saved translations yet. Use the Studio tab and save
                      your signs!
                    </p>
                  ) : (
                    <ul style={theme.list}>
                      {history.map((item) => (
                        <li key={item.id} style={theme.listItem}>
                          <div style={theme.listItemMain}>
                            <FileText
                              size={18}
                              color={theme.colors.accentText}
                            />
                            <div>
                              <strong style={theme.itemText}>
                                {item.translated_text}
                              </strong>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  alignItems: "center",
                                  marginTop: "2px",
                                }}
                              >
                                <span style={theme.confBadge}>
                                  {(item.confidence * 100).toFixed(0)}% conf
                                </span>
                                <small style={theme.timestamp}>
                                  {new Date(
                                    item.created_at || Date.now(),
                                  ).toLocaleString()}
                                </small>
                              </div>
                            </div>
                          </div>
                          <button
                            style={theme.deleteIconBtn}
                            onClick={() => setItemToDelete(item)}
                            title="Delete this record"
                          >
                            <Trash2 size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}

          {/* ACCOUNT TAB */}
          {activeTab === "account" && (
            <div style={theme.card}>
              {token ? (
                <div style={theme.accountBox}>
                  <div style={theme.accountBadge}>
                    <CheckCircle size={32} color="#10b981" />
                    <div>
                      <h2 style={theme.cardTitle}>Active Secure Session</h2>
                      <p style={theme.subtitle}>
                        Your JWT authorization token is verified and active.
                      </p>
                    </div>
                  </div>

                  {/* USER INFO DISPLAY CARD */}
                  <div style={theme.userInfoCard}>
                    <h3
                      style={{
                        margin: "0 0 12px 0",
                        fontSize: "15px",
                        fontWeight: "600",
                      }}
                    >
                      Profile Information
                    </h3>
                    <div style={theme.infoRow}>
                      <span style={theme.infoLabel}>Email Address:</span>
                      <strong style={theme.infoVal}>
                        {userInfo?.email || email || "N/A"}
                      </strong>
                    </div>
                    <div style={theme.infoRow}>
                      <span style={theme.infoLabel}>User ID:</span>
                      <strong style={theme.infoVal}>{userInfo?.id || 1}</strong>
                    </div>
                    <div style={theme.infoRow}>
                      <span style={theme.infoLabel}>Saved Records:</span>
                      <strong style={theme.infoVal}>
                        {history.length} items in history
                      </strong>
                    </div>
                    <div style={theme.infoRow}>
                      <span style={theme.infoLabel}>Auth Standard:</span>
                      <strong style={theme.infoVal}>JWT Bearer Token</strong>
                    </div>
                  </div>

                  <button style={theme.logoutBtn} onClick={logout}>
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              ) : (
                <div style={theme.authWrapper}>
                  <h2 style={theme.cardTitle}>
                    {authMode === "login" && "Sign In to Your Account"}
                    {authMode === "register" && "Create an Account"}
                    {authMode === "forgot" && "Recover Password"}
                    {authMode === "reset" && "Reset Your Password"}
                  </h2>
                  <p style={theme.subtitle}>
                    {authMode === "login" &&
                      "Authenticate with FastAPI to unlock translation tools."}
                    {authMode === "register" &&
                      "Register a new credential with SQLite backend."}
                    {authMode === "forgot" &&
                      "Generate a backend token to reset your password."}
                    {authMode === "reset" &&
                      "Provide your token and choose a new password."}
                  </p>

                  <form onSubmit={handleAuth} style={theme.form}>
                    <div style={theme.inputGroup}>
                      <Mail size={18} color="#64748b" />
                      <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={theme.input}
                      />
                    </div>

                    {authMode === "reset" && (
                      <div style={theme.inputGroup}>
                        <KeyRound size={18} color="#64748b" />
                        <input
                          type="text"
                          placeholder="Reset token"
                          value={resetToken}
                          onChange={(e) => setResetToken(e.target.value)}
                          required
                          style={theme.input}
                        />
                      </div>
                    )}

                    {authMode !== "forgot" && (
                      <div style={theme.inputGroup}>
                        <Lock size={18} color="#64748b" />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder={
                            authMode === "reset" ? "New password" : "Password"
                          }
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          style={theme.input}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={theme.eyeBtn}
                          title={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff size={18} color="#64748b" />
                          ) : (
                            <Eye size={18} color="#64748b" />
                          )}
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      style={theme.submitBtn}
                    >
                      {authLoading
                        ? "Processing..."
                        : authMode === "login"
                          ? "Sign In"
                          : authMode === "register"
                            ? "Register"
                            : authMode === "forgot"
                              ? "Send Reset Token"
                              : "Update Password"}
                    </button>
                  </form>

                  <div style={theme.authLinks}>
                    {authMode === "login" && (
                      <>
                        <span
                          style={theme.link}
                          onClick={() => {
                            setAuthMode("register");
                            setAuthStatus({ type: "", text: "" });
                          }}
                        >
                          Don't have an account? Register
                        </span>
                        <span
                          style={theme.linkMuted}
                          onClick={() => {
                            setAuthMode("forgot");
                            setAuthStatus({ type: "", text: "" });
                          }}
                        >
                          Forgot password?
                        </span>
                      </>
                    )}
                    {authMode !== "login" && (
                      <span
                        style={theme.link}
                        onClick={() => {
                          setAuthMode("login");
                          setAuthStatus({ type: "", text: "" });
                        }}
                      >
                        Back to Sign In
                      </span>
                    )}
                  </div>

                  {authStatus.text && (
                    <div
                      style={
                        authStatus.type === "error"
                          ? theme.errorBanner
                          : theme.successBanner
                      }
                    >
                      {authStatus.type === "error" ? (
                        <AlertCircle size={16} />
                      ) : (
                        <CheckCircle size={16} />
                      )}
                      <span>{authStatus.text}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* --- SAVE CONFIRMATION MODAL --- */}
      {showSaveModal && (
        <div style={theme.modalOverlay}>
          <div style={theme.modalCard}>
            <div style={theme.modalHeader}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <Save size={20} color={theme.colors.accent} />
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                  Confirm Save Translation
                </h3>
              </div>
              <button
                style={theme.modalCloseBtn}
                onClick={() => setShowSaveModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p style={theme.subtitle}>
              Are you sure you want to save this translation record to your
              secure history?
            </p>

            <div style={theme.modalPreviewBox}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  color: theme.colors.textMuted,
                }}
              >
                TRANSLATION TEXT:
              </span>
              <p
                style={{
                  margin: "6px 0 10px 0",
                  fontSize: "16px",
                  fontWeight: "600",
                  color: theme.colors.accentText,
                }}
              >
                "{translatedText}"
              </p>
              <span style={{ fontSize: "12px", color: theme.colors.textMuted }}>
                Confidence rating:{" "}
                <strong>{(confidence * 100).toFixed(1)}%</strong>
              </span>
            </div>

            <div style={theme.modalActions}>
              <button
                style={theme.modalCancelBtn}
                onClick={() => setShowSaveModal(false)}
              >
                Cancel
              </button>
              <button
                style={theme.modalConfirmBtn}
                onClick={confirmSaveTranslation}
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {itemToDelete && (
        <div style={theme.modalOverlay}>
          <div style={theme.modalCard}>
            <div style={theme.modalHeader}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <AlertTriangle size={20} color="#ef4444" />
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                  Confirm Deletion
                </h3>
              </div>
              <button
                style={theme.modalCloseBtn}
                onClick={() => setItemToDelete(null)}
              >
                <X size={18} />
              </button>
            </div>
            <p style={theme.subtitle}>
              Are you sure you want to remove this translation item from your
              history?
            </p>

            <div style={theme.modalPreviewBox}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600" }}>
                "{itemToDelete.translated_text}"
              </p>
            </div>

            <div style={theme.modalActions}>
              <button
                style={theme.modalCancelBtn}
                onClick={() => setItemToDelete(null)}
              >
                Cancel
              </button>
              <button
                style={theme.modalDeleteConfirmBtn}
                onClick={confirmDeleteTranslation}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Dynamic Dark / Light Responsive Theme Generator
function getTheme(dark) {
  const colors = dark
    ? {
        bg: "#0f172a",
        card: "#1e293b",
        cardSubtle: "#0f172a",
        border: "#334155",
        text: "#f8fafc",
        textMuted: "#94a3b8",
        accent: "#6366f1",
        accentSoft: "rgba(99, 102, 241, 0.18)",
        accentText: "#a5b4fc",
        navBg: "#1e293b",
        inputBg: "#0f172a",
        modalBg: "#1e293b",
      }
    : {
        bg: "#f8fafc",
        card: "#ffffff",
        cardSubtle: "#f1f5f9",
        border: "#e2e8f0",
        text: "#0f172a",
        textMuted: "#64748b",
        accent: "#4f46e5",
        accentSoft: "#e0e7ff",
        accentText: "#3730a3",
        navBg: "#f1f5f9",
        inputBg: "#f8fafc",
        modalBg: "#ffffff",
      };

  return {
    colors,
    page: {
      minHeight: "100vh",
      backgroundColor: colors.bg,
      color: colors.text,
      fontFamily:
        "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      transition: "all 0.25s ease",
      boxSizing: "border-box",
    },
    container: {
      maxWidth: "920px",
      margin: "0 auto",
      padding: "clamp(14px, 3vw, 28px)",
      boxSizing: "border-box",
    },
    header: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "16px",
      borderBottom: `1px solid ${colors.border}`,
      paddingBottom: "18px",
      marginBottom: "24px",
    },
    brand: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    logoIcon: {
      fontSize: "28px",
      backgroundColor: colors.accentSoft,
      padding: "8px",
      borderRadius: "12px",
      lineHeight: 1,
    },
    title: {
      margin: 0,
      fontSize: "clamp(1.25rem, 2.5vw, 1.5rem)",
      fontWeight: "700",
      letterSpacing: "-0.02em",
    },
    tagline: {
      fontSize: "12px",
      color: colors.textMuted,
    },
    headerRight: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "10px",
    },
    nav: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      backgroundColor: colors.navBg,
      padding: "4px",
      borderRadius: "10px",
      border: `1px solid ${colors.border}`,
    },
    navBtn: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "8px 12px",
      background: "transparent",
      color: colors.textMuted,
      border: "none",
      borderRadius: "7px",
      cursor: "pointer",
      fontWeight: "500",
      fontSize: "14px",
      transition: "all 0.15s ease",
    },
    activeNavBtn: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "8px 12px",
      background: colors.accent,
      color: "#ffffff",
      border: "none",
      borderRadius: "7px",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "14px",
      boxShadow: "0 2px 6px rgba(99, 102, 241, 0.35)",
    },
    themeToggle: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "38px",
      height: "38px",
      borderRadius: "10px",
      border: `1px solid ${colors.border}`,
      backgroundColor: colors.card,
      color: colors.text,
      cursor: "pointer",
    },
    main: {
      display: "flex",
      flexDirection: "column",
      gap: "20px",
    },
    card: {
      backgroundColor: colors.card,
      padding: "clamp(18px, 3vw, 28px)",
      borderRadius: "16px",
      border: `1px solid ${colors.border}`,
      boxShadow: dark
        ? "0 10px 25px -5px rgba(0, 0, 0, 0.4)"
        : "0 4px 12px rgba(15, 23, 42, 0.06)",
    },
    cardHeader: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: "12px",
      marginBottom: "20px",
    },
    cardTitle: {
      margin: "0 0 4px 0",
      fontSize: "1.2rem",
      fontWeight: "600",
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: "14px",
      margin: 0,
    },
    statusBadge: {
      padding: "5px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: "600",
    },
    videoGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
      gap: "20px",
    },
    cameraBox: {
      backgroundColor: colors.cardSubtle,
      border: `1px solid ${colors.border}`,
      borderRadius: "12px",
      height: "260px",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    videoElement: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      backgroundColor: "#000",
      transform: "scaleX(-1)",
    },
    cameraPlaceholder: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "20px",
      gap: "8px",
      width: "100%",
      height: "100%",
      backgroundColor: colors.cardSubtle,
    },
    cameraLabel: {
      margin: 0,
      fontWeight: "600",
      fontSize: "15px",
    },
    cameraHint: {
      fontSize: "12px",
      color: colors.textMuted,
    },
    outputPanel: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      gap: "16px",
    },
    outputLabel: {
      fontSize: "11px",
      fontWeight: "700",
      letterSpacing: "0.06em",
      color: colors.textMuted,
    },
    outputBox: {
      backgroundColor: colors.cardSubtle,
      border: `1px solid ${colors.border}`,
      borderRadius: "10px",
      padding: "14px",
      marginTop: "6px",
      marginBottom: "14px",
    },
    translatedText: {
      fontSize: "1.25rem",
      fontWeight: "700",
      color: colors.accentText,
      margin: 0,
      lineHeight: 1.4,
    },
    confidenceWrapper: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    },
    flexBetween: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    confidenceText: {
      fontSize: "13px",
      color: colors.textMuted,
    },
    confidenceValue: {
      fontSize: "13px",
      fontWeight: "600",
    },
    progressTrack: {
      width: "100%",
      height: "8px",
      backgroundColor: colors.cardSubtle,
      borderRadius: "999px",
      overflow: "hidden",
      border: `1px solid ${colors.border}`,
    },
    progressFill: {
      height: "100%",
      backgroundColor: "#10b981",
      transition: "width 0.3s ease",
    },
    actionStack: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
    startBtn: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      backgroundColor: "#10b981",
      color: "#ffffff",
      border: "none",
      padding: "11px",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "14px",
    },
    stopBtn: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      backgroundColor: "#ef4444",
      color: "#ffffff",
      border: "none",
      padding: "11px",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "14px",
    },
    saveBtn: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      backgroundColor: colors.accent,
      color: "#ffffff",
      border: "none",
      padding: "10px",
      borderRadius: "8px",
      fontWeight: "500",
      fontSize: "14px",
    },
    iconBtn: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cardSubtle,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      padding: "8px",
      borderRadius: "8px",
      cursor: "pointer",
    },
    deleteIconBtn: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      color: "#ef4444",
      border: "1px solid rgba(239, 68, 68, 0.2)",
      padding: "8px",
      borderRadius: "8px",
      cursor: "pointer",
      transition: "background 0.2s",
    },
    list: {
      listStyle: "none",
      padding: 0,
      margin: 0,
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
    listItem: {
      padding: "14px",
      borderRadius: "10px",
      backgroundColor: colors.cardSubtle,
      border: `1px solid ${colors.border}`,
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "10px",
    },
    listItemMain: {
      display: "flex",
      alignItems: "flex-start",
      gap: "12px",
    },
    itemText: {
      fontSize: "15px",
      display: "block",
    },
    confBadge: {
      backgroundColor: colors.accentSoft,
      color: colors.accentText,
      padding: "2px 6px",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: "600",
    },
    timestamp: {
      color: colors.textMuted,
      fontSize: "11px",
    },
    emptyState: {
      color: colors.textMuted,
      textAlign: "center",
      padding: "24px 0",
      fontSize: "14px",
    },
    authWrapper: {
      maxWidth: "420px",
      margin: "0 auto",
    },
    form: {
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      marginTop: "18px",
    },
    inputGroup: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      border: `1px solid ${colors.border}`,
      padding: "11px 14px",
      borderRadius: "8px",
      backgroundColor: colors.inputBg,
    },
    input: {
      border: "none",
      outline: "none",
      backgroundColor: "transparent",
      color: colors.text,
      width: "100%",
      fontSize: "14px",
    },
    eyeBtn: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      padding: 0,
    },
    submitBtn: {
      backgroundColor: colors.accent,
      color: "#ffffff",
      border: "none",
      padding: "12px 24px",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "14px",
      marginTop: "8px",
      display: "block",
      width: "100%",
    },
    authLinks: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: "10px",
      marginTop: "16px",
    },
    link: {
      color: colors.accentText,
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "500",
    },
    linkMuted: {
      color: colors.textMuted,
      cursor: "pointer",
      fontSize: "13px",
    },
    errorBanner: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginTop: "16px",
      padding: "10px 14px",
      borderRadius: "8px",
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      color: "#f87171",
      fontSize: "13px",
      fontWeight: "500",
    },
    successBanner: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginTop: "16px",
      padding: "10px 14px",
      borderRadius: "8px",
      backgroundColor: "rgba(16, 185, 129, 0.15)",
      color: "#34d399",
      fontSize: "13px",
      fontWeight: "500",
    },
    accountBox: {
      display: "flex",
      flexDirection: "column",
      gap: "18px",
      maxWidth: "460px",
      margin: "0 auto",
    },
    accountBadge: {
      display: "flex",
      alignItems: "center",
      gap: "14px",
      textAlign: "left",
    },
    userInfoCard: {
      backgroundColor: colors.cardSubtle,
      border: `1px solid ${colors.border}`,
      borderRadius: "12px",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
    infoRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: "14px",
      borderBottom: `1px solid ${colors.border}`,
      paddingBottom: "8px",
    },
    infoLabel: {
      color: colors.textMuted,
    },
    infoVal: {
      color: colors.text,
    },
    logoutBtn: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      width: "100%",
      backgroundColor: "#ef4444",
      color: "#ffffff",
      border: "none",
      padding: "11px 16px",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "14px",
    },
    // Modal Styles
    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "16px",
    },
    modalCard: {
      backgroundColor: colors.modalBg,
      border: `1px solid ${colors.border}`,
      borderRadius: "16px",
      padding: "24px",
      width: "100%",
      maxWidth: "400px",
      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
    },
    modalHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "10px",
    },
    modalCloseBtn: {
      background: "transparent",
      border: "none",
      color: colors.textMuted,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
    },
    modalPreviewBox: {
      backgroundColor: colors.cardSubtle,
      border: `1px solid ${colors.border}`,
      borderRadius: "10px",
      padding: "12px",
      margin: "16px 0",
    },
    modalActions: {
      display: "flex",
      gap: "10px",
      marginTop: "20px",
    },
    modalCancelBtn: {
      flex: 1,
      backgroundColor: colors.cardSubtle,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      padding: "10px",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "500",
      fontSize: "14px",
    },
    modalConfirmBtn: {
      flex: 1,
      backgroundColor: colors.accent,
      color: "#ffffff",
      border: "none",
      padding: "10px",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "14px",
    },
    modalDeleteConfirmBtn: {
      flex: 1,
      backgroundColor: "#ef4444",
      color: "#ffffff",
      border: "none",
      padding: "10px",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "14px",
    },
  };
}
