import React from "react";
import { Player, MatchCategory } from "../types";

interface LobbyProps {
  player: Player | null;
  categories: MatchCategory[];
  selectedCategory: string;
  isDevMode: boolean;
  onSelectCategory: (id: string) => void;
  onFindMatch: () => void;
  onStartSoloMatch: () => void;
}

export function Lobby({
  player,
  categories,
  selectedCategory,
  isDevMode,
  onSelectCategory,
  onFindMatch,
  onStartSoloMatch,
}: LobbyProps) {
  return (
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

      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest text-left pl-1">
          Select Game Arena
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-md mx-auto pt-4 border-t border-neutral-800/60">
        <button
          onClick={onFindMatch}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 active:scale-98 w-full"
        >
          Find Match
        </button>
        {isDevMode && (
          <button
            onClick={onStartSoloMatch}
            className="border border-neutral-700 hover:border-neutral-600 bg-neutral-800/40 hover:bg-neutral-800 text-neutral-300 px-8 py-3.5 rounded-xl font-semibold transition-all active:scale-98 w-full flex items-center justify-center gap-2"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Start Solo Match (Dev)
          </button>
        )}
      </div>
    </div>
  );
}
