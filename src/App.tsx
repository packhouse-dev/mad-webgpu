import React, { useEffect, useState } from "react";
import WebGPUCanvas from "./components/WebGPUCanvas";
import { io, Socket } from "socket.io-client";
import { Obstacle, Player, MatchCategory } from "./types";
import categoriesData from "./config/matchCategories.json";
import { Lobby } from "./components/Lobby";
import { MatchingView, SystemStatus } from "./components/GameStateViews";

const categories = categoriesData as MatchCategory[];

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<
    "lobby" | "matching" | "playing"
  >("lobby");
  const [roomPlayers, setRoomPlayers] = useState<Player[]>([]);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    return localStorage.getItem("selectedCategory") || "arena";
  });
  const [isDevMode, setIsDevMode] = useState<boolean>(() => {
    return localStorage.getItem("isDevMode") === "true";
  });

  useEffect(() => {
    localStorage.setItem("selectedCategory", selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    localStorage.setItem("isDevMode", isDevMode.toString());
  }, [isDevMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "~" || e.key === "`") {
        setIsDevMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const socketUrl = window.location.origin;
    const newSocket = io(socketUrl);
    setSocket(newSocket);

    newSocket.on("player_init", (data: Player) => {
      setPlayer(data);
      setGameState("lobby");
    });

    newSocket.on("waiting_for_match", () => {
      setGameState("matching");
    });

    newSocket.on(
      "match_found",
      (data: { roomId: string; players: Player[]; obstacles?: Obstacle[] }) => {
        setRoomPlayers(data.players);
        setObstacles(data.obstacles || []);
      },
    );

    newSocket.on("game_start", () => {
      setGameState("playing");
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleFindMatch = () => {
    if (socket) {
      socket.emit("find_match", { categoryId: selectedCategory });
      setGameState("matching");
    }
  };

  const handleStartSoloMatch = () => {
    if (socket) {
      socket.emit("start_solo_match", { categoryId: selectedCategory });
      setGameState("matching");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex flex-col items-center justify-center p-4 md:p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-4xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
            Milestone 3
          </h1>
          <p className="text-lg text-neutral-400 font-medium max-w-xl mx-auto">
            Procedural Map Generation & Server-side Sliding Collisions
          </p>
        </div>

        {gameState === "lobby" && (
          <Lobby
            player={player}
            categories={categories}
            selectedCategory={selectedCategory}
            isDevMode={isDevMode}
            onSelectCategory={setSelectedCategory}
            onFindMatch={handleFindMatch}
            onStartSoloMatch={handleStartSoloMatch}
          />
        )}

        {gameState === "matching" && (
          <MatchingView selectedCategory={selectedCategory} />
        )}

        {gameState === "playing" && socket && (
          <WebGPUCanvas socket={socket} myId={player?.id} obstacles={obstacles} />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <SystemStatus isConnected={!!socket} />

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-neutral-200 border-b border-neutral-800 pb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
              Milestone 3 Objectives
            </h2>
            <ul className="space-y-2.5 font-mono text-xs text-neutral-400">
              <li className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]"></span>
                <span>Category Rulesets (JSON)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]"></span>
                <span>Procedural Server Map Gen</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]"></span>
                <span>Authoritative sliding AABB</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]"></span>
                <span>Instanced WebGPU Wall Render</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {isDevMode && (
        <div className="fixed top-4 right-4 w-80 bg-black/80 backdrop-blur-md border border-amber-500/50 rounded-xl p-4 text-xs font-mono text-amber-400 z-50 shadow-2xl pointer-events-none">
          <div className="flex items-center justify-between mb-3 border-b border-amber-500/30 pb-2">
            <span className="font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              DEV MODE ACTIVE
            </span>
            <span className="opacity-50">Press ~ to toggle</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="opacity-70">State:</span>
              <span className="text-white">{gameState}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Category:</span>
              <span className="text-white">{selectedCategory}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Socket ID:</span>
              <span className="text-white truncate max-w-[120px]">{socket?.id || 'null'}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Players in Room:</span>
              <span className="text-white">{roomPlayers.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Obstacles:</span>
              <span className="text-white">{obstacles.length}</span>
            </div>
            {player && (
              <div className="mt-2 pt-2 border-t border-amber-500/20">
                <div className="opacity-70 mb-1">Local Player Info:</div>
                <div className="grid grid-cols-2 gap-1 text-[10px] pl-2">
                  <div>X: {player.x.toFixed(3)}</div>
                  <div>Y: {player.y.toFixed(3)}</div>
                  <div className="col-span-2 text-white truncate text-[9px] opacity-60">ID: {player.id}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
