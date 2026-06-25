import React, { useEffect, useState } from "react";
import WebGPUCanvas from "./components/WebGPUCanvas";
import { io, Socket } from "socket.io-client";

interface Player {
  id: string;
  x: number;
  y: number;
  color: { r: number; g: number; b: number };
  status: "lobby" | "matching" | "in-game";
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<
    "lobby" | "matching" | "countdown" | "playing"
  >("lobby");
  const [countdown, setCountdown] = useState<number>(5);
  const [roomPlayers, setRoomPlayers] = useState<Player[]>([]);

  useEffect(() => {
    // Determine the socket server URL based on the environment
    // In production/preview, use the current host. In dev, Vite is proxied by Express.
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
      (data: { roomId: string; players: Player[] }) => {
        setGameState("countdown");
        setRoomPlayers(data.players);
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
      socket.emit("find_match");
      setGameState("matching");
    }
  };

  const handleStartSoloMatch = () => {
    if (socket) {
      socket.emit("start_solo_match");
      setGameState("matching");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex flex-col items-center justify-center p-4 font-sans selection:bg-indigo-500/30">
      <div className="max-w-4xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
            Milestone 2
          </h1>
          <p className="text-lg text-neutral-400 font-medium">
            Multiplayer Matchmaking & Server
          </p>
        </div>

        {gameState === "lobby" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center space-y-6 shadow-xl">
            <h2 className="text-2xl font-semibold text-neutral-200">Lobby</h2>
            <div className="flex justify-center">
              <div
                className="w-16 h-16 rounded-full shadow-lg border-2 border-neutral-700"
                style={{
                  backgroundColor: player
                    ? `rgb(${player.color.r * 255}, ${player.color.g * 255}, ${player.color.b * 255})`
                    : "gray",
                }}
              />
            </div>
            <p className="text-neutral-400">Your color</p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-md mx-auto">
              <button
                onClick={handleFindMatch}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20 w-full"
              >
                Find Match
              </button>
              <button
                onClick={handleStartSoloMatch}
                className="border border-neutral-700 hover:border-neutral-600 bg-neutral-800/50 hover:bg-neutral-800 text-neutral-300 px-8 py-3 rounded-lg font-medium transition-colors w-full flex items-center justify-center gap-2"
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                Start Solo Match (Dev)
              </button>
            </div>
          </div>
        )}

        {gameState === "matching" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center space-y-6 shadow-xl">
            <h2 className="text-2xl font-semibold text-neutral-200">
              Looking for Opponent...
            </h2>
            <div className="flex justify-center items-center h-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          </div>
        )}

        {gameState === "countdown" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center space-y-6 shadow-xl">
            <h2 className="text-2xl font-semibold text-neutral-200">
              Match Found!
            </h2>
            <p className="text-neutral-400">Starting in...</p>
            <div className="text-6xl font-bold text-indigo-400 animate-pulse">
              {countdown}
            </div>
            <div className="flex justify-center gap-4">
              {roomPlayers.map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-2">
                  <div
                    className="w-10 h-10 rounded-full border-2 border-neutral-700"
                    style={{
                      backgroundColor: `rgb(${p.color.r * 255}, ${p.color.g * 255}, ${p.color.b * 255})`,
                    }}
                  />
                  <span className="text-xs text-neutral-500">
                    {p.id === player?.id ? "You" : "Opponent"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {gameState === "playing" && socket && (
          <WebGPUCanvas socket={socket} myId={player?.id} />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-left space-y-4 shadow-xl">
            <h2 className="text-lg font-semibold text-neutral-200 border-b border-neutral-800 pb-2">
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

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-left space-y-4 shadow-xl">
            <h2 className="text-lg font-semibold text-neutral-200 border-b border-neutral-800 pb-2">
              Milestone 2 Objectives
            </h2>
            <ul className="space-y-3 font-mono text-sm text-neutral-400">
              <li className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>Lobby & Matchmaking</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>Match Countdown</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>Multiplayer Real-time Sync</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
