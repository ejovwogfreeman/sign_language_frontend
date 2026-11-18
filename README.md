# SignBridge Frontend

A secure, responsive React frontend for **SignBridge**, enabling real-time sign language translation via Gemini Vision WebSockets, secure JWT authentication, session management, and translation history tracking.

---

## 🚀 Features

- **Real-Time Studio Stream:** Secure WebSocket connection streaming webcam frames to the backend for real-time sign language translation and confidence scoring.
- **JWT Authentication:** Complete sign-in, registration, and password recovery flow with strict error handling.
- **Translation History Dashboard:** View, filter, and delete saved translation records.
- **Responsive Dark/Light Mode:** Seamless theme toggling persisted via `localStorage` and custom styling hooks.
- **Interactive Modals:** Secure confirmation prompts for saving and deleting translation history items.

---

## 🛠️ Tech Stack

- **React** (Hooks, Component Architecture)
- **Lucide React** (Modern UI Icons)
- **Native Web APIs** (`navigator.mediaDevices.getUserMedia`, `WebSocket`, `HTMLCanvasElement`)
- **CSS-in-JS / Responsive Theme System**

---

## 📦 Project Setup & Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/ejovwogfreeman/sign_language_frontend.git
   cd sign_language_frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure API Endpoint:**
   Ensure `API_URL` in your configuration points to your running FastAPI backend (default: `http://127.0.0.1:8000`).

4. **Run the development server:**

   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```
