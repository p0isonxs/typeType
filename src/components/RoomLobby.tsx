// ✅ CONTEXT FIX - File: src/components/RoomLobby.tsx
import { useNavigate, useParams } from "react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  useReactModelRoot,
  useSession,
  useDetachCallback,
  usePublish,
  useSubscribe,
  useViewId,
  useLeaveSession,
} from "@multisynq/react";
import { TypingModel } from "../multisynq/TypingModel";
import { useUserData } from "../contexts/UserContext"; // ✅ Import UserContext

const DEFAULT_AVATAR = "/avatars/avatar1.png";

export default function RoomLobby() {
  const model = useReactModelRoot<TypingModel>();
  const session = useSession();
  const { code } = useParams();
  const navigate = useNavigate();
  const viewId = useViewId();
  const leaveSession = useLeaveSession();

  // ✅ FIXED: Use UserContext instead of localStorage
  const { userData } = useUserData();

  // Refs to prevent excessive re-renders
  const lastPlayersRef = useRef<string>("");
  const initsSentRef = useRef(false);
  const settingsInitializedRef = useRef(false);

  useDetachCallback(() => {
    leaveSession();
  });

  const sendStart = usePublish(() => ["game", "start"]);
  const sendInitials = usePublish<string>((initials) => [
    viewId!,
    "set-initials",
    initials,
  ]);
  const sendAvatar = usePublish<string>((url) => [viewId!, "set-avatar", url]);
  const initializeRoomSettings = usePublish<any>((settings) => [
    "room",
    "initialize-settings", 
    settings
  ]);

  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState(
    Array.from(model?.players.entries() || [])
  );

  // Optimized update function to prevent excessive re-renders
  const updatePlayers = useCallback(() => {
    if (!model) return;
    
    const entries = Array.from(model.players.entries());
    const playersKey = entries.map(([id, p]) => `${id}:${p.initials}`).join("|");
    
    // Only update if players actually changed
    if (playersKey !== lastPlayersRef.current) {
      lastPlayersRef.current = playersKey;
      setPlayers(entries);

      // Host determination
      if (viewId && entries.length > 0) {
        const firstViewId = entries[0][0];
        setIsHost(viewId === firstViewId);
      }
    }
  }, [model, viewId]);

  useSubscribe("view", "update", updatePlayers);

  // ✅ FIXED: Send user info only once with UserContext values
  useEffect(() => {
    if (model && viewId && !initsSentRef.current) {
      // Send user info immediately with context values
      sendInitials(userData.initials);
      sendAvatar(userData.avatarUrl);
      initsSentRef.current = true;
    }
  }, [model, viewId, sendInitials, sendAvatar, userData.initials, userData.avatarUrl]);

  // ✅ FIXED: Initialize room settings only once with UserContext
  useEffect(() => {
    if (model && viewId && !settingsInitializedRef.current && model.players.size <= 1) {
      if (userData.roomSettings && Object.keys(userData.roomSettings).length > 0) {
        initializeRoomSettings(userData.roomSettings);
        settingsInitializedRef.current = true;
      }
    }
  }, [model, viewId, initializeRoomSettings, userData.roomSettings]);

  // Initial player update
  useEffect(() => {
    updatePlayers();
  }, [updatePlayers]);

  // Navigate to game when started
  useEffect(() => {
    if (model?.started && code) {
      navigate(`/room/${code}`);
    }
  }, [model?.started, code, navigate]);

  // ✅ FIXED: Helper functions use UserContext values
  const getPlayerAvatar = useCallback((playerId: string, player: any) => {
    if (playerId === viewId) {
      return userData.avatarUrl; // ✅ From UserContext
    }
    return player.avatarUrl || DEFAULT_AVATAR;
  }, [viewId, userData.avatarUrl]);

  const getPlayerName = useCallback((playerId: string, player: any) => {
    if (playerId === viewId) {
      return userData.initials || "You"; // ✅ From UserContext
    }
    return player.initials || `Guest_${playerId.substring(0, 6)}`;
  }, [viewId, userData.initials]);

  if (!model || !viewId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Loading lobby...</p>
        </div>
      </div>
    );
  }

  const handleStart = () => {
    if (!isHost) return;
    sendStart();
  };

  const handleExit = () => {
    leaveSession();
    navigate("/multiplayer");
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex justify-between items-center p-3 sm:p-4">
        <button
          onClick={handleExit}
          className="px-3 py-2 sm:px-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg border border-gray-600 transition-all duration-200 text-sm sm:text-base"
        >
          ← Exit Lobby
        </button>
        <div className="text-gray-400 text-sm sm:text-base">
          Mode <span className="text-white font-mono">multiplayer</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <div className="w-full max-w-4xl">
          {/* Room Code Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Room Lobby
            </h1>
            <div className="mb-4">
              <p className="text-gray-400 text-lg mb-2">Room Code:</p>
              <div className="inline-block bg-gray-900 px-6 py-3 rounded-xl border border-gray-700">
                <span className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-widest">
                  {code}
                </span>
              </div>
            </div>
            <p className="text-gray-400">
              Share this code with your friends to join!
            </p>
          </div>

          {/* Room Settings Display */}
          <div className="bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-700 mb-6">
            <h2 className="text-xl font-bold text-white mb-4 text-center">
              Game Settings
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-600">
                <div className="text-xs text-gray-400 mb-1">Theme</div>
                <div className="text-white font-semibold capitalize">
                  {model.theme}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-600">
                <div className="text-xs text-gray-400 mb-1">Words</div>
                <div className="text-white font-semibold">
                  {model.sentenceLength}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-600">
                <div className="text-xs text-gray-400 mb-1">Time</div>
                <div className="text-white font-semibold">
                  {model.timeLimit}s
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-600">
                <div className="text-xs text-gray-400 mb-1">Max Players</div>
                <div className="text-white font-semibold">
                  {model.maxPlayers}
                </div>
              </div>
            </div>
          </div>

          {/* Players Section */}
          <div className="bg-gray-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-700 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 text-center">
              Players ({players.length}/{model.maxPlayers})
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map(([id, player]) => (
                <div 
                  key={id} 
                  className="bg-gray-800 rounded-xl p-4 border border-gray-600 animate-fadeIn"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={getPlayerAvatar(id, player)}
                      alt={getPlayerName(id, player)}
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-600"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-white">
                          {getPlayerName(id, player)}
                        </span>
                        {id === viewId && (
                          <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                            You
                          </span>
                        )}
                        {players[0] && players[0][0] === id && (
                          <span className="bg-yellow-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                            Host
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: model.maxPlayers - players.length }).map((_, index) => (
                <div 
                  key={`empty-${index}`}
                  className="bg-gray-800 rounded-xl p-4 border-2 border-dashed border-gray-600 opacity-50"
                >
                  <div className="flex items-center justify-center h-12">
                    <span className="text-gray-500 text-sm">Waiting for player...</span>
                  </div>
                </div>
              ))}
            </div>

            {players.length <= 1 && (
              <div className="text-center mt-6 p-4 bg-gray-800 rounded-xl border border-gray-600">
                <div className="animate-pulse">
                  <div className="w-8 h-8 bg-gray-600 rounded-full mx-auto mb-3"></div>
                  <p className="text-gray-400">
                    Waiting for more players to join...
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Section */}
          <div className="text-center">
            {isHost ? (
              <button
                onClick={handleStart}
                disabled={players.length <= 1}
                className="px-8 py-4 bg-white hover:bg-gray-200 text-black font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:bg-gray-600 disabled:text-gray-400 text-lg"
              >
                {players.length <= 1 ? "Need More Players" : "Start Game"}
              </button>
            ) : (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <p className="text-gray-400 text-lg">
                    Waiting for host to start the game...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}