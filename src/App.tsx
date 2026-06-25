import React, { useEffect, useState } from "react";
import WebGPUCanvas from "./components/WebGPUCanvas";
import { io, Socket } from "socket.io-client";
import { Obstacle } from "./types";
import categoriesData from "./config/matchCategories.json";

interface Player {
  id: string;
  x: number;
  y: number;
  color: { r: number; g: number; b: number };
  status: "lobby" | "matching" | "in-game";
}

interface MatchCategory {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  color: string;
}

const categories = categoriesData as MatchCategory[];

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<
    "lobby" | "matching" | "countdown" | "playing"
  >("lobby");
  const [countdown, setCountdown] = useState<number>(5);
  const [roomPlayers, setRoomPlayers] = useState<Player[]>([]);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("arena");

  useEffect(() => {
    // Determine the socket server URL based on the environment
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
        setGameState("countdown");
        setRoomPlayers(data.players);
        setObstacles(data.obstacles || []);
      },
    );

    newSocket.on("countdown", (count: number) => {
      setCountdown(count);
    });

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
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8 text-center space-y-8 shadow-2xl">
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-2xl font-bold text-neutral-200">Lobby</h2>
              <div className="flex justify-center mt-2">
                <div
                  className="w-16 h-16 rounded-full shadow-lg border-2 border-neutral-700 animate-pulse"
                  style={{
                    backgroundColor: player
                      ? `rgb(${player.color.r * 255}, ${player.color.g * 255}, ${player.color.b * 255})`
                      : "gray",
                  }}
                />
              </div>
              <p className="text-neutral-400 text-sm">Your synchronized node color</p>
            </div>

            {/* Category Selector */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest text-left pl-1">
                Select Game Arena
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex flex-col text-left p-5 rounded-xl border transition-all duration-200 outline-none relative overflow-hidden ${
                      selectedCategory === cat.id
                        ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                        : "border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex justify-between items-center w-full mb-2">
                      <span className="font-bold text-neutral-200">{cat.name}</span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          cat.difficulty === "Easy"
                            ? "bg-indigo-500/20 text-indigo-300"
                            : cat.difficulty === "Medium"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {cat.difficulty}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 flex-grow leading-relaxed">
                      {cat.description}
                    </p>
                    {selectedCategory === cat.id && (
                      <div className="absolute right-0 bottom-0 w-8 h-8 bg-indigo-600 flex items-center justify-center rounded-tl-xl text-white">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="3.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-md mx-auto pt-4 border-t border-neutral-800/60">
              <button
                onClick={handleFindMatch}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 active:scale-98 w-full"
              >
                Find Match
              </button>
              <button
                onClick={handleStartSoloMatch}
                className="border border-neutral-700 hover:border-neutral-600 bg-neutral-800/40 hover:bg-neutral-800 text-neutral-300 px-8 py-3.5 rounded-xl font-semibold transition-all active:scale-98 w-full flex items-center justify-center gap-2"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Start Solo Match (Dev)
              </button>
            </div>
          </div>
        )}

        {gameState === "matching" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
            <h2 className="text-2xl font-semibold text-neutral-200">
              Looking for Opponent...
            </h2>
            <div className="flex justify-center items-center h-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
            <p className="text-neutral-500 text-sm font-mono">
              Arena category: <span className="text-indigo-400 font-bold uppercase">{selectedCategory}</span>
            </p>
          </div>
        )}

        {gameState === "countdown" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
            <h2 className="text-2xl font-semibold text-neutral-200">
              Match Found!
            </h2>
            <p className="text-neutral-400">Loading arena nodes...</p>
            <div className="text-6xl font-black text-indigo-400 animate-pulse tracking-tight">
              {countdown}
            </div>
            <div className="flex justify-center gap-6 pt-4">
              {roomPlayers.map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-2">
                  <div
                    className="w-12 h-12 rounded-full border-2 border-neutral-700 shadow-md"
                    style={{
                      backgroundColor: `rgb(${p.color.r * 255}, ${p.color.g * 255}, ${p.color.b * 255})`,
                    }}
                  />
                  <span className="text-xs text-neutral-400 font-medium">
                    {p.id === player?.id ? "You" : "Opponent"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {gameState === "playing" && socket && (
          <WebGPUCanvas socket={socket} myId={player?.id} obstacles={obstacles} />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-neutral-200 border-b border-neutral-800 pb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              System Status
            </h2>
            <ul className="space-y-3 font-mono text-sm text-neutral-400">
              <li className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                <span>WebGPU Engine: Active</span>
              </li>
              <li className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${socket ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"}`}
                ></span>
                <span>
                  Multiplayer Server: {socket ? "Online" : "Connecting..."}
                </span>
              </li>
            </ul>
          </div>

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
    </div>
  );
}
