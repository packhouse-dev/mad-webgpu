import React from "react";
import { Player } from "../types";

export function MatchingView({ selectedCategory }: { selectedCategory: string }) {
  return (
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
  );
}

export function SystemStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4 shadow-xl">
      <h2 className="text-lg font-bold text-neutral-200 border-b border-neutral-800 pb-2 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
        System Status
      </h2>
      <ul className="space-y-3 font-mono text-sm text-neutral-400">
        <li className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
          <span>Graphics Engine: Ready</span>
        </li>
        <li className="flex items-center gap-3">
          <span
            className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"}`}
          ></span>
          <span>Multiplayer Server: {isConnected ? "Online" : "Connecting..."}</span>
        </li>
      </ul>
    </div>
  );
}
