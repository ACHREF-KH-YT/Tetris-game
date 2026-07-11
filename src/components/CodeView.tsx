import React, { useState } from "react";
import { Terminal, Copy, Check, Download, AlertCircle, Info } from "lucide-react";

interface CodeViewProps {
  code: string;
}

export const CodeView: React.FC<CodeViewProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tetris_bounce.py";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-6 shadow-2xl flex flex-col space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-white/5">
        <div className="flex items-center space-x-3">
          <Terminal className="text-orange-500 w-5 h-5 animate-pulse" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Python 3.12 Code Compiler</h2>
        </div>
        <div className="flex space-x-2">
          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center space-x-2 px-3.5 py-1.5 bg-[#161616] hover:bg-[#222] text-gray-300 rounded text-xs font-medium border border-white/10 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-orange-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="flex items-center space-x-2 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-medium shadow-md shadow-orange-600/15 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Script</span>
          </button>
        </div>
      </div>

      {/* Guide Banner */}
      <div className="bg-[#050505] rounded p-4 border border-white/5 flex items-start gap-3.5">
        <Info className="text-orange-400 w-4 h-4 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-gray-400 space-y-1">
          <h3 className="font-semibold text-white text-xs uppercase tracking-wide">Self-Contained Dynamic Synthesis</h3>
          <p className="leading-relaxed">
            This Python script embeds a complete **8-bit waveform synth engine**! It writes pure digital WAV sound bytes at runtime without external audio dependencies. When executed, it synchronizes high-speed vector physics frames with generated bouncing sounds, encoding everything into a smooth, high-fidelity **MP4 video file**.
          </p>
        </div>
      </div>

      {/* Steps Guide */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">How to run locally</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Step 1 */}
          <div className="bg-[#050505] p-4 border border-white/5 rounded space-y-2">
            <span className="bg-orange-600/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">STEP 1</span>
            <p className="text-gray-300 font-medium">Install Packages</p>
            <p className="text-gray-400 leading-relaxed text-[11px]">
              Open your console and install the standard scientific and multimedia compilation packages:
            </p>
            <code className="block bg-[#080808] p-2 rounded border border-white/5 text-orange-400 text-[10px] select-all font-mono">
              pip install pygame moviepy numpy
            </code>
          </div>

          {/* Step 2 */}
          <div className="bg-[#050505] p-4 border border-white/5 rounded space-y-2">
            <span className="bg-orange-600/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">STEP 2</span>
            <p className="text-gray-300 font-medium">Run Compilation</p>
            <p className="text-gray-400 leading-relaxed text-[11px]">
              Execute your customized script to begin synthesizing the 8-bit audio track and rendering visual frames:
            </p>
            <code className="block bg-[#080808] p-2 rounded border border-white/5 text-orange-400 text-[10px] select-all font-mono">
              python tetris_bounce.py
            </code>
          </div>

          {/* Step 3 */}
          <div className="bg-[#050505] p-4 border border-white/5 rounded space-y-2">
            <span className="bg-orange-600/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">STEP 3</span>
            <p className="text-gray-300 font-medium">Render Finished Video</p>
            <p className="text-gray-400 leading-relaxed text-[11px]">
              The visual compiler will merge the sound bytes and physical simulator state, writing the finished HD video to:
            </p>
            <code className="block bg-[#080808] p-2 rounded border border-white/5 text-orange-400 text-[10px] font-mono">
              tetris_bounce_output.mp4
            </code>
          </div>
        </div>
      </div>

      {/* Code Textarea Block */}
      <div className="bg-[#050505] rounded border border-white/5 p-4 relative overflow-hidden flex flex-col h-[400px]">
        <div className="absolute top-4 right-4 flex space-x-1 z-10">
          <span className="w-2 h-2 bg-neutral-700 rounded-full" />
          <span className="w-2 h-2 bg-neutral-700 rounded-full" />
          <span className="w-2 h-2 bg-neutral-700 rounded-full" />
        </div>
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-mono pb-2 border-b border-white/5 flex justify-between">
          <span>tetris_bounce.py</span>
          <span>Python 3.12 // Pygame // MoviePy</span>
        </div>
        <textarea
          readOnly
          value={code}
          className="w-full flex-grow bg-transparent text-[#d4d4d4] font-mono text-[11px] leading-relaxed resize-none border-none outline-none focus:ring-0 mt-3 overflow-y-auto select-all pr-2"
        />
      </div>
    </div>
  );
};
