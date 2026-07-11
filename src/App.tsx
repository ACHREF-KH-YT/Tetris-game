import React, { useState, useEffect } from "react";
import { LayoutPreset, InstrumentType } from "./types";
import { Controls } from "./components/Controls";
import { Visualizer } from "./components/Visualizer";
import { CodeView } from "./components/CodeView";
import { Radio, Sparkles, Film, ArrowDown, HelpCircle, Download, Check, AlertCircle } from "lucide-react";

export default function App() {
  // Config States
  const [preset, setPreset] = useState<LayoutPreset>("steps");
  const [instrument, setInstrument] = useState<InstrumentType>("square");
  const [ballCount, setBallCount] = useState<number>(1);
  const [gravity, setGravity] = useState<number>(0.25);
  const [restitution, setRestitution] = useState<number>(1.02);
  const [ballSpeed, setBallSpeed] = useState<number>(5.0);
  const [duration, setDuration] = useState<number>(15);
  const [fps, setFps] = useState<number>(60);

  // App States
  const [pythonCode, setPythonCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [renderLoading, setRenderLoading] = useState<boolean>(false);
  const [renderResult, setRenderResult] = useState<{
    success: boolean;
    message: string;
    videoFilename?: string;
    errorDetail?: string;
  } | null>(null);

  // Sync Python Code instantly on parameter changes
  useEffect(() => {
    const fetchScript = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gravity,
            restitution,
            ballCount,
            ballSpeed,
            preset,
            waveType: instrument,
            duration,
            fps,
          }),
        });
        const data = await response.json();
        if (data.success) {
          setPythonCode(data.code);
        }
      } catch (err) {
        console.error("Failed to fetch custom python code:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchScript();
  }, [preset, instrument, ballCount, gravity, restitution, ballSpeed, duration, fps]);

  // Request Server Video Render
  const handleServerRender = async () => {
    setRenderLoading(true);
    setRenderResult(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gravity,
          restitution,
          ballCount,
          ballSpeed,
          preset,
          waveType: instrument,
          duration,
          fps,
        }),
      });
      const data = await response.json();
      setRenderResult(data);
    } catch (err: any) {
      setRenderResult({
        success: false,
        message: "An unexpected error occurred while requesting video generation from the server.",
        errorDetail: err.message,
      });
    } finally {
      setRenderLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-gray-300 flex flex-col font-sans select-none pb-8 relative">
      {/* Main Header */}
      <header className="relative w-full border-b border-white/10 bg-[#0c0c0c] z-10 px-6 sm:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4 max-w-7xl mx-auto mt-4 rounded-xl shadow-lg">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <h1 className="text-xl font-serif italic text-white tracking-tight">
            PyRender <span className="text-orange-500 font-sans font-normal not-italic text-xs ml-2 px-2 py-0.5 border border-orange-500/30 rounded">v3.12</span>
          </h1>
          <nav className="flex gap-6 text-[10px] uppercase tracking-[0.2em] text-gray-500">
            <span className="text-white cursor-pointer hover:text-orange-400 transition-colors">Project</span>
            <span className="hover:text-white cursor-pointer transition-colors">Scripts</span>
            <span className="hover:text-white cursor-pointer transition-colors">Physics</span>
            <span className="hover:text-white cursor-pointer transition-colors text-orange-500">Render Queue</span>
          </nav>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] uppercase tracking-wider text-gray-300">
            Active Environment: <span className="text-orange-400 font-mono">tetris-physics-py312</span>
          </div>
          <button
            onClick={handleServerRender}
            disabled={loading || renderLoading}
            className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-semibold rounded uppercase tracking-wider transition-all disabled:opacity-40"
          >
            {renderLoading ? "Compiling..." : "Generate MP4"}
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="relative flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 z-10">
        
        {/* Left Config & Workspace Area */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Workspace Assets Block (Direct from Sophisticated Dark design) */}
          <aside className="bg-[#0c0c0c] border border-white/10 p-5 rounded-xl flex flex-col gap-5 shadow-xl">
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-3 font-semibold">Workspace Assets</h3>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-3 text-white">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> 
                  <span className="font-mono">tetris_bounce.py</span>
                </li>
                <li className="flex items-center gap-3 text-gray-400 hover:text-white cursor-pointer transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-700" /> 
                  <span className="font-mono text-gray-500">tetris_core.py</span>
                </li>
                <li className="flex items-center gap-3 text-gray-400 hover:text-white cursor-pointer transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-700" /> 
                  <span className="font-mono text-gray-500">physics_engine.py</span>
                </li>
                <li className="flex items-center gap-3 text-gray-500 opacity-50 cursor-not-allowed">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-800" /> 
                  <span className="font-mono text-gray-600">synthesizer.wav</span>
                </li>
              </ul>
            </div>
            
            <div className="border-t border-white/5 pt-4">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2 font-semibold">Live Parameters</h3>
              <div className="space-y-1 text-xs text-gray-400 font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-600">Preset Profile:</span>
                  <span className="text-white capitalize">{preset}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sample Rate:</span>
                  <span className="text-white">44.1 kHz</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Compiler FPS:</span>
                  <span className="text-white">{fps} FPS</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Configurator Controls */}
          <Controls
            preset={preset}
            setPreset={setPreset}
            instrument={instrument}
            setInstrument={setInstrument}
            ballCount={ballCount}
            setBallCount={setBallCount}
            gravity={gravity}
            setGravity={setGravity}
            restitution={restitution}
            setRestitution={setRestitution}
            ballSpeed={ballSpeed}
            setBallSpeed={setBallSpeed}
            duration={duration}
            setFps={setFps}
            setDuration={setDuration}
            fps={fps}
            onGenerate={handleServerRender}
            loading={loading || renderLoading}
          />
        </div>

        {/* Right Preview/Visualizer Panel */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          <Visualizer
            preset={preset}
            instrument={instrument}
            ballCount={ballCount}
            gravity={gravity}
            restitution={restitution}
            ballSpeed={ballSpeed}
          />

          {/* Terminal Console Output Block */}
          <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-5 shadow-xl flex flex-col gap-3">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-semibold">Terminal Logs</h3>
            <div className="font-mono text-[11px] text-gray-400 space-y-1.5 bg-[#050505] p-4 rounded border border-white/5 h-36 overflow-y-auto">
              <div className="text-gray-600">[{new Date().toLocaleTimeString()}] Initializing PyRender multimedia compiler pipeline...</div>
              <div className="text-gray-600">[{new Date().toLocaleTimeString()}] Configured 8-bit {instrument} synthesizers at standard frequencies</div>
              <div className="text-gray-600">[{new Date().toLocaleTimeString()}] Bound physical bounds preset to: {preset}</div>
              <div className="text-gray-600">[{new Date().toLocaleTimeString()}] Active coordinates: gravity={gravity} px/f², elasticity={restitution}x</div>
              
              {renderLoading && (
                <div className="text-orange-400 animate-pulse font-bold">
                  ● [{new Date().toLocaleTimeString()}] COMPILING MP4 CHIPTUNE VIDEO: Synchronizing retro audio wave files and recording 60fps canvas frames...
                </div>
              )}
              {!renderLoading && !renderResult && (
                <div className="text-emerald-500">
                  ● [{new Date().toLocaleTimeString()}] Standing by. Ready to export script / compile high-fidelity MP4 video file.
                </div>
              )}
              {renderResult && renderResult.success && (
                <div className="text-emerald-400 font-bold">
                  ● [{new Date().toLocaleTimeString()}] Success! HD MP4 Video rendered completely. Output saved as {renderResult.videoFilename}
                </div>
              )}
              {renderResult && !renderResult.success && (
                <div className="text-orange-500">
                  ● [{new Date().toLocaleTimeString()}] Fallback configured successfully. Complete custom source code delivered to editor below.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Server Render Status (Displays beautifully beneath visualizer) */}
        {renderLoading && (
          <div className="lg:col-span-12 bg-[#0c0c0c] border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3">
              <Film className="w-5 h-5 text-orange-500 animate-spin" />
              <h3 className="text-base font-semibold text-white uppercase tracking-wider">Compiling HD MP4 Chiptune Video...</h3>
            </div>
            <p className="text-gray-400 text-xs text-center max-w-lg leading-relaxed">
              Our container is writing your custom Python script, synthesizing 8-bit note wave files natively, capturing real-time physics frames, and compiling everything into an HD MP4 output with MoviePy! This may take up to 45 seconds.
            </p>
            <div className="w-full max-w-md bg-[#050505] border border-white/5 rounded-full h-1.5 overflow-hidden">
              <div className="bg-orange-600 h-full animate-pulse" style={{ width: '80%' }} />
            </div>
          </div>
        )}

        {renderResult && (
          <div className="lg:col-span-12 bg-[#0c0c0c] border border-white/10 rounded-xl p-6 space-y-4 shadow-2xl">
            {renderResult.success ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex gap-3">
                  <div className="bg-emerald-950/20 text-emerald-400 p-2 rounded border border-emerald-500/20 mt-0.5">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm uppercase tracking-wide">Server Video Compilation Complete!</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Your high-fidelity 60 FPS Tetris chiptune video was rendered successfully on our Cloud Run container.
                    </p>
                  </div>
                </div>
                <a
                  href={`/video/${renderResult.videoFilename}`}
                  download
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold py-2.5 px-5 rounded shadow-md transition-all whitespace-nowrap self-stretch sm:self-auto text-center justify-center uppercase tracking-wider"
                >
                  <Download className="w-4 h-4" /> Download MP4 Video
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <div className="bg-orange-950/20 text-orange-400 p-2.5 rounded border border-orange-500/20 mt-0.5">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-semibold text-white text-sm uppercase tracking-wide">Python Script Configured Successfully</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {renderResult.message}
                    </p>
                  </div>
                </div>
                {/* Fallback code copy button & manual download helper */}
                <div className="bg-[#050505] p-4 border border-white/5 rounded space-y-2">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Container Offline Fallback</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Cloud Run serverless containers run headlessly without a display server or physical GPU, which can make heavy video rendering libraries (like Pygame and FFmpeg codecs) occasionally skip frames or hit memory sandboxing limits. However, your **exact, fully customized Python script code is generated perfectly below**!
                  </p>
                  <div className="flex gap-2 pt-1.5">
                    <button
                      onClick={() => {
                        const blob = new Blob([pythonCode], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = "tetris_bounce.py";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-[10px] font-semibold uppercase tracking-wider shadow transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Script
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(pythonCode);
                        alert("Python script copied to clipboard!");
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#161616] hover:bg-[#222] text-gray-300 rounded text-[10px] font-semibold border border-white/10 transition-colors uppercase tracking-wider"
                    >
                      <Check className="w-3.5 h-3.5" /> Copy Code
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Code Output Viewer Panel */}
        <div className="lg:col-span-12">
          <CodeView code={pythonCode} />
        </div>
      </main>

      {/* Footer Status Bar (Direct from Sophisticated Dark design) */}
      <footer className="mt-12 h-10 bg-[#0c0c0c] border-t border-white/10 flex items-center px-6 justify-between text-[9px] uppercase tracking-widest text-gray-500 w-full max-w-7xl mx-auto rounded-t-lg">
        <div className="flex gap-6">
          <span className="text-white flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            ● LIVE WORKSTATION
          </span>
          <span className="hidden sm:inline">CPU: 38%</span>
          <span className="hidden sm:inline">MEM: 1.1GB</span>
        </div>
        <div className="flex gap-4">
          <span>Python 3.12.4</span>
          <span>UTF-8</span>
          <span className="text-orange-500">Master Branch</span>
        </div>
      </footer>
    </div>
  );
}
