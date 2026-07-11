import React from "react";
import { LayoutPreset, InstrumentType } from "../types";
import { Settings, Play, ShieldAlert, Cpu, Download, Sparkles, RefreshCw, Layers } from "lucide-react";

interface ControlsProps {
  preset: LayoutPreset;
  setPreset: (preset: LayoutPreset) => void;
  instrument: InstrumentType;
  setInstrument: (inst: InstrumentType) => void;
  ballCount: number;
  setBallCount: (count: number) => void;
  gravity: number;
  setGravity: (g: number) => void;
  restitution: number;
  setRestitution: (r: number) => void;
  ballSpeed: number;
  setBallSpeed: (s: number) => void;
  duration: number;
  setDuration: (d: number) => void;
  fps: number;
  setFps: (f: number) => void;
  onGenerate: () => void;
  loading: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  preset,
  setPreset,
  instrument,
  setInstrument,
  ballCount,
  setBallCount,
  gravity,
  setGravity,
  restitution,
  setRestitution,
  ballSpeed,
  setBallSpeed,
  duration,
  setDuration,
  fps,
  setFps,
  onGenerate,
  loading,
}) => {
  return (
    <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-6 shadow-2xl space-y-6 flex flex-col justify-between h-full">
      <div className="space-y-6">
        {/* Panel Header */}
        <div className="flex items-center space-x-3 pb-4 border-b border-white/5">
          <Settings className="text-orange-500 w-5 h-5 animate-pulse" />
          <h2 className="text-base font-semibold text-white uppercase tracking-wider">Configurator</h2>
        </div>

        {/* Preset Selector */}
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-orange-500" /> AI Starting Board Preset
          </label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as LayoutPreset)}
            className="w-full bg-[#050505] border border-white/10 rounded px-4 py-2.5 text-gray-300 text-xs focus:outline-none focus:border-orange-500 transition-colors"
          >
            <option value="steps">Staircase (AI clears cascading steps)</option>
            <option value="pyramid">Pyramid (AI clears middle blocks)</option>
            <option value="zigzag">Zigzag Funnel (AI clears side walls)</option>
            <option value="stack">Half-Full Board (AI clears complex stack)</option>
            <option value="spiral">Spiral Vortex (AI clears circular layout)</option>
            <option value="empty">Empty Board (AI starts standard play)</option>
          </select>
        </div>

        {/* Audio Instrument wave selection */}
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-orange-500" /> Chiptune Instrument
          </label>
          <select
            value={instrument}
            onChange={(e) => setInstrument(e.target.value as InstrumentType)}
            className="w-full bg-[#050505] border border-white/10 rounded px-4 py-2.5 text-gray-300 text-xs focus:outline-none focus:border-orange-500 transition-colors"
          >
            <option value="square">Square Wave (Retro GameBoy Beeps)</option>
            <option value="triangle">Triangle Wave (Classic 8-Bit Bass)</option>
            <option value="sine">Sine Wave (Smooth Chiptune Lead)</option>
            <option value="sawtooth">Sawtooth Wave (Aggressive Arcade Synth)</option>
          </select>
        </div>

        {/* Physics Tuning Parameters */}
        <div className="space-y-4 pt-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 border-b border-white/5 pb-1.5">
            AI Gameplay Settings
          </h3>

          {/* Ball Count (AI Speed) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400">Game Speed (Ticks/Sec)</span>
              <span className="text-orange-400 font-mono font-semibold">{ballCount}x speed</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={ballCount}
              onChange={(e) => setBallCount(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-1 bg-[#1a1a1a] rounded appearance-none"
            />
          </div>

          {/* Gravity Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400">Visual Drop Fall Rate</span>
              <span className="text-orange-400 font-mono font-semibold">{gravity} px/f</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.5"
              step="0.05"
              value={gravity}
              onChange={(e) => setGravity(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-1 bg-[#1a1a1a] rounded appearance-none"
            />
          </div>

          {/* Restitution Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400">Beep Note Decay / Length</span>
              <span className="text-orange-400 font-mono font-semibold">{restitution.toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.80"
              step="0.05"
              value={restitution}
              onChange={(e) => setRestitution(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-1 bg-[#1a1a1a] rounded appearance-none"
            />
          </div>

          {/* Ball Initial Speed Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400">AI Placement Heuristics</span>
              <span className="text-orange-400 font-mono font-semibold">Smart Level {ballSpeed}</span>
            </div>
            <input
              type="range"
              min="2"
              max="10"
              step="1"
              value={ballSpeed}
              onChange={(e) => setBallSpeed(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-1 bg-[#1a1a1a] rounded appearance-none"
            />
          </div>
        </div>

        {/* Video Rendering Sliders */}
        <div className="space-y-4 pt-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 border-b border-white/5 pb-1.5">
            Python Compiler Settings
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Duration */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-400">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-[#050505] border border-white/10 rounded px-2.5 py-2 text-gray-300 text-xs focus:outline-none focus:border-orange-500 transition-colors"
              >
                <option value="10">10 Seconds</option>
                <option value="15">15 Seconds</option>
                <option value="30">30 Seconds</option>
                <option value="45">45 Seconds</option>
              </select>
            </div>

            {/* Frame Rate */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-400">Frame Rate</label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full bg-[#050505] border border-white/10 rounded px-2.5 py-2 text-gray-300 text-xs focus:outline-none focus:border-orange-500 transition-colors"
              >
                <option value="30">30 FPS</option>
                <option value="60">60 FPS (HD)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Compile/Action Button */}
      <div className="pt-4 mt-6 border-t border-white/5">
        <button
          onClick={onGenerate}
          disabled={loading}
          className="relative w-full flex items-center justify-center space-x-2 bg-orange-600 hover:bg-orange-500 text-white font-medium py-3 px-4 rounded text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-orange-600/10"
        >
          {loading ? (
            <>
              <RefreshCw className="animate-spin w-4 h-4 text-white" />
              <span>Compiling Script...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-orange-200 animate-pulse" />
              <span>Generate Python Video</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
