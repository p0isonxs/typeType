// ✅ CONTEXT FIX - File: src/components/RoomSettings.tsx
import Lottie from "lottie-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import { v4 as uuidv4 } from "uuid";
import loadingAnimation from "../assets/loading.json";
import { useUserData } from "../contexts/UserContext"; // ✅ Updated import
import toast from "react-hot-toast";
import {
  FormData,
  RoomMode,
  RoomSettingsProps,
  Theme,
} from "../../type/global";
import { AI_CONTEXTS, THEMES } from "../config/roomsetting";
import { VALIDATION_RULES } from "../validation/roomSettingValidation";

interface RoomSettings {
  sentenceLength: number;
  timeLimit: number;
  maxPlayers: number;
  theme: Theme;
  words: string[];
}

export default function RoomSettings({ mode: propMode }: RoomSettingsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // ✅ FIXED: Use UserContext for both sound and data management
  const { playClickSound, updateUserData } = useUserData();

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<RoomMode>("multi");
  const [formData, setFormData] = useState<FormData>({
    sentenceLength: "",
    timeLimit: "",
    maxPlayers: "",
    theme: "",
  });

  // Determine mode from props or query params
  useEffect(() => {
    if (propMode === "create") {
      setMode("multi");
    } else {
      const params = new URLSearchParams(location.search);
      const selectedMode = params.get("mode");
      setMode(selectedMode === "single" ? "single" : "multi");
    }
  }, [propMode, location.search]);

  // Form validation
  const validation = useMemo(() => {
    const { sentenceLength, timeLimit, maxPlayers, theme } = formData;
    const len = parseInt(sentenceLength);
    const time = parseInt(timeLimit);
    const players = parseInt(maxPlayers);

    const errors: string[] = [];

    if (!theme) errors.push("Please select a theme");
    if (
      !len ||
      len < VALIDATION_RULES.SENTENCE_LENGTH.min ||
      len > VALIDATION_RULES.SENTENCE_LENGTH.max
    ) {
      errors.push(
        `Sentence length must be between ${VALIDATION_RULES.SENTENCE_LENGTH.min}–${VALIDATION_RULES.SENTENCE_LENGTH.max} words`
      );
    }
    if (
      !time ||
      time < VALIDATION_RULES.TIME_LIMIT.min ||
      time > VALIDATION_RULES.TIME_LIMIT.max
    ) {
      errors.push(
        `Time limit must be between ${VALIDATION_RULES.TIME_LIMIT.min}–${VALIDATION_RULES.TIME_LIMIT.max} seconds`
      );
    }
    if (
      mode === "multi" &&
      (!players ||
        players < VALIDATION_RULES.MAX_PLAYERS.min ||
        players > VALIDATION_RULES.MAX_PLAYERS.max)
    ) {
      errors.push(
        `Players must be between ${VALIDATION_RULES.MAX_PLAYERS.min}–${VALIDATION_RULES.MAX_PLAYERS.max}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [formData, mode]);

  const updateFormData = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const fetchAIWords = useCallback(
    async (
      theme: Theme,
      sentenceLength: number
    ): Promise<{ sentence: string }> => {
      try {
        const context = AI_CONTEXTS[theme as keyof typeof AI_CONTEXTS] || "";

        const prompt = `
You are a helpful assistant.

${context}

Respond ONLY with this exact JSON format (no commentary):

{
  "sentence": "A typing sentence about ${theme}, containing around ${sentenceLength} words."
}

Requirements:
- The sentence must be clearly related to the theme "${theme}".
- It should be simple, readable, and easy to type (avoid special symbols).
- Use real English words only.
- Avoid very long words or complex punctuation.
`;

        const response = await fetch(import.meta.env.VITE_BACKEND_GEMINI_URL, {
          method: "POST",
          body: JSON.stringify({ prompt }),
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) throw new Error("AI fetch failed");

        const data = await response.json();
        return { sentence: data.sentence || "" };
      } catch (error) {
        console.error("Failed to fetch AI sentence:", error);
        toast.error("Failed to fetch AI sentence. Using fallback.");
        return { sentence: "" };
      }
    },
    []
  );

  const processWords = useCallback((sentence: string): string[] => {
    return sentence
      .split(/\s+/)
      .map((word: string) => word.replace(/[.,!?]/g, ""))
      .filter(Boolean);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!validation.isValid || loading) {
      toast.error(validation.errors[0] || "Please fix form errors");
      return;
    }

    try {
      playClickSound();
      setLoading(true);

      const len = parseInt(formData.sentenceLength);
      const time = parseInt(formData.timeLimit);
      const players = parseInt(formData.maxPlayers);
      const theme = formData.theme as Theme;

      const response = await fetchAIWords(theme, len);
      const words = processWords(response.sentence);

      const settings: RoomSettings = {
        sentenceLength: len,
        timeLimit: time,
        maxPlayers: players,
        theme,
        words,
      };

      // ✅ FIXED: Use UserContext instead of localStorage
      updateUserData({ roomSettings: settings });

      if (mode === "single") {
        navigate("/single", { state: settings });
      } else {
        const roomCode = uuidv4().slice(0, 4).toUpperCase();
        navigate(`/room/${roomCode}/lobby`, { state: settings });
      }
    } catch (error) {
      console.error("Failed to create room:", error);
      toast.error("Failed to create room. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [
    validation,
    loading,
    formData,
    mode,
    playClickSound,
    fetchAIWords,
    processWords,
    updateUserData, // ✅ Updated dependency
    navigate,
  ]);

  const handleBack = useCallback(() => {
    const destination =
      propMode === "create"
        ? "/multiplayer"
        : mode === "single"
        ? "/mode"
        : "/multiplayer";
    navigate(destination);
  }, [propMode, mode, navigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <Lottie
          animationData={loadingAnimation}
          loop
          style={{ width: 200, height: 200 }}
        />
        <p className="mt-4 text-gray-400">Generating content...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <button
            onClick={handleBack}
            className="absolute top-4 left-4 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg border border-gray-600 transition-all duration-200 text-sm"
          >
            ← Back
          </button>
          <h1
            style={{ fontFamily: "Staatliches" }}
            className="text-5xl font-bold text-white mb-2"
          >
            ROOM SETTINGS
          </h1>
          <p
            style={{ fontFamily: "Staatliches" }}
            className="text-gray-400 text-lg"
          >
            Configure your {mode === "single" ? "solo" : "multiplayer"}{" "}
            experience
          </p>
        </div>

        {/* Settings Card */}
        <main className="bg-gray-900 rounded-3xl p-8 shadow-2xl border border-gray-700">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
            className="space-y-6"
          >
            {/* Sentence Length */}
            <div className="space-y-2">
              <label
                htmlFor="sentence-length"
                className="block text-sm font-semibold text-gray-300 uppercase tracking-wide"
              >
                Sentence Length
              </label>
              <input
                id="sentence-length"
                type="number"
                value={formData.sentenceLength}
                onChange={(e) =>
                  updateFormData("sentenceLength", e.target.value)
                }
                placeholder="e.g. 30"
                min={VALIDATION_RULES.SENTENCE_LENGTH.min}
                max={VALIDATION_RULES.SENTENCE_LENGTH.max}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all duration-200"
                required
              />
              <p className="text-xs text-gray-500">
                Sentence length must be between{" "}
                {VALIDATION_RULES.SENTENCE_LENGTH.min}–
                {VALIDATION_RULES.SENTENCE_LENGTH.max} words
              </p>
            </div>

            {/* Time Limit */}
            <div className="space-y-2">
              <label
                htmlFor="time-limit"
                className="block text-sm font-semibold text-gray-300 uppercase tracking-wide"
              >
                Time Limit (seconds)
              </label>
              <input
                id="time-limit"
                type="number"
                value={formData.timeLimit}
                onChange={(e) => updateFormData("timeLimit", e.target.value)}
                placeholder="e.g. 60"
                min={VALIDATION_RULES.TIME_LIMIT.min}
                max={VALIDATION_RULES.TIME_LIMIT.max}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all duration-200"
                required
              />
              <p className="text-xs text-gray-500">
                Time limit must be between {VALIDATION_RULES.TIME_LIMIT.min}–
                {VALIDATION_RULES.TIME_LIMIT.max} seconds
              </p>
            </div>

            {/* Players (only for multi mode) */}
            {mode === "multi" && (
              <div className="space-y-2">
                <label
                  htmlFor="max-players"
                  className="block text-sm font-semibold text-gray-300 uppercase tracking-wide"
                >
                  Number of Players
                </label>
                <input
                  id="max-players"
                  type="number"
                  value={formData.maxPlayers}
                  onChange={(e) => updateFormData("maxPlayers", e.target.value)}
                  placeholder="e.g. 4"
                  min={VALIDATION_RULES.MAX_PLAYERS.min}
                  max={VALIDATION_RULES.MAX_PLAYERS.max}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all duration-200"
                  required
                />
                <p className="text-xs text-gray-500">
                  Between {VALIDATION_RULES.MAX_PLAYERS.min}–
                  {VALIDATION_RULES.MAX_PLAYERS.max} players
                </p>
              </div>
            )}

            {/* Theme Selection */}
            <div className="space-y-2">
              <label
                htmlFor="theme"
                className="block text-sm font-semibold text-gray-300 uppercase tracking-wide"
              >
                Theme
              </label>
              <select
                id="theme"
                value={formData.theme}
                onChange={(e) => updateFormData("theme", e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all duration-200 appearance-none cursor-pointer"
                required
              >
                <option value="" disabled className="bg-gray-900">
                  Select a theme...
                </option>
                {THEMES.map((theme) => (
                  <option key={theme} value={theme} className="bg-gray-900">
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={!validation.isValid || loading}
              className="w-full mt-8 px-6 py-4 bg-white hover:bg-gray-200 text-black font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-gray-600 border-t-black rounded-full animate-spin"></div>
                  <span>Generating...</span>
                </div>
              ) : (
                <span className="font-staatliches">
                  {mode === "single"
                    ? "Start Solo Game"
                    : "Create Room"}
                </span>
              )}
            </button>
          </form>
        </main>

        {/* Mode Indicator */}
        <div className="text-center mt-6">
          <div className="inline-flex items-center px-4 py-2 bg-gray-800 rounded-full border border-gray-700">
            <span
              style={{ fontFamily: "Staatliches" }}
              className="text-sm text-gray-300"
            >
              {mode === "single" ? "🎯 Solo Mode" : "👥 Multiplayer Mode"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}