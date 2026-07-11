import React, { useEffect, useRef, useState } from "react";
import { InstrumentType, GameStatus } from "../types";
import { NOTE_FREQS, TETRIS_MELODY } from "../data";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Radio, Trophy, Zap, Award, Video, Music, Palette, Info, Sliders, Upload, Check } from "lucide-react";

// Board rendering coordinates & grid spacing
const BOARD_W = 380;
const BOARD_H = 560; // 560px height makes each block exactly 28px tall (nice even grid ratio!)
const BX = 50;        // Centered horizontally on a 480px canvas
const BY = 130;       // Positioned lower to make space for a stunning neon arcade stats header
const CW = BOARD_W / 10; // 38px width
const CH = BOARD_H / 20; // 28px height

interface VisualizerProps {
  preset: string;
  instrument: InstrumentType;
  ballCount: number; // Reused as Autopilot Game Speed (1x to 5x)
  gravity: number;    // Reused as Visual Drop Fall Rate
  restitution: number; // Reused as Synth Note decay/length
  ballSpeed: number;  // Reused as AI Placement Heuristics level (2 to 10)
}

const PIECE_COLORS = {
  I: "#00f0f0", // Cyan
  O: "#f0f000", // Yellow
  T: "#a000f0", // Purple
  S: "#00f000", // Green
  Z: "#f00000", // Red
  J: "#0000f0", // Blue
  L: "#f0a000", // Orange
};

const SHAPES: Record<string, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ]
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  maxLife: number;
  life: number;
}

export const Visualizer: React.FC<VisualizerProps> = ({
  preset,
  instrument,
  ballCount,
  gravity,
  restitution,
  ballSpeed,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Custom Customizer Settings
  const [bgTheme, setBgTheme] = useState<"slate" | "neon" | "space" | "sunset" | "matrix" | "custom">("neon");
  const [customBgImage, setCustomBgImage] = useState<HTMLImageElement | null>(null);
  const [customBgName, setCustomBgName] = useState<string>("No image loaded");
  const [chiptuneEnabled, setChiptuneEnabled] = useState(true);
  const [bgMusicSource, setBgMusicSource] = useState<"none" | "procedural" | "uploaded">("procedural");
  const [uploadedMusic, setUploadedMusic] = useState<{
    file: File | null;
    url: string | null;
    name: string;
  }>({
    file: null,
    url: null,
    name: "No track loaded",
  });
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  const [musicCurrentTime, setMusicCurrentTime] = useState(0);
  const [musicDuration, setMusicDuration] = useState(0);

  // Background Theme Rendering Refs
  const starsRef = useRef<{ x: number; y: number; speed: number; size: number }[]>([]);
  const matrixColumnsRef = useRef<number[]>([]);

  // HTML5 Audio Elements for MP3 Background Loop
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Initialize background elements
  if (starsRef.current.length === 0) {
    for (let i = 0; i < 40; i++) {
      starsRef.current.push({
        x: BX + Math.random() * BOARD_W,
        y: BY + Math.random() * BOARD_H,
        speed: Math.random() * 0.4 + 0.1,
        size: Math.random() * 1.5 + 0.5,
      });
    }
  }
  if (matrixColumnsRef.current.length === 0) {
    matrixColumnsRef.current = Array.from({ length: 15 }, () => BY + Math.random() * BOARD_H);
  }
  
  // Game Stats
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [blocksPlaced, setBlocksPlaced] = useState(0);
  const [noteIdx, setNoteIdx] = useState(0);
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [gameOverCountdown, setGameOverCountdown] = useState(3);

  // Recording Engine Stats
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recordingMixerRef = useRef<GainNode | null>(null);

  // References for rendering thread
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gridRef = useRef<( { color: string; pieceType: string } | null )[][]>(
    Array.from({ length: 20 }, () => Array(10).fill(null))
  );
  
  const activePieceRef = useRef<{
    shape: number[][];
    color: string;
    pieceType: string;
    x: number;
    y: number;
    targetX: number;
    targetRot: number;
    currentRotation: number;
  } | null>(null);

  const particlesRef = useRef<Particle[]>([]);
  const lineFlashRowsRef = useRef<number[]>([]);
  const animationIdRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);
  const melodyIndexRef = useRef<number>(0);

  // Recording counter effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      setRecordingTime(0);
      interval = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // --- Background Music Procedural Synthesizer ---
  const playAmbientPad = () => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "triangle";
      
      // Retro synthwave ambient chord progressions: Cmaj7 -> Am7 -> Fmaj7 -> G7
      const chords = [
        [130.81, 164.81, 196.00], // C3, E3, G3
        [110.00, 130.81, 164.81], // A2, C3, E3
        [174.61, 220.00, 261.63], // F3, A3, C4
        [196.00, 246.94, 293.66], // G3, B3, D4
      ];
      
      const currentChord = chords[Math.floor(Date.now() / 6000) % chords.length];
      osc1.frequency.setValueAtTime(currentChord[0], ctx.currentTime);
      osc2.frequency.setValueAtTime(currentChord[1] * 2, ctx.currentTime); // 1 Octave up

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(280, ctx.currentTime); // Nice warm low-pass cut

      // Fade-in & Fade-out envelope
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(musicVolume * 0.15, ctx.currentTime + 1.5);
      gain.gain.setValueAtTime(musicVolume * 0.15, ctx.currentTime + 4.5);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 6.0);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      if (recordingMixerRef.current) {
        gain.connect(recordingMixerRef.current);
      }

      osc1.start();
      osc2.start();
      
      osc1.stop(ctx.currentTime + 6.0);
      osc2.stop(ctx.currentTime + 6.0);
    } catch (e) {
      console.warn("Ambient pad audio error:", e);
    }
  };

  // Trigger procedural ambient soundscapes periodically
  useEffect(() => {
    let padInterval: NodeJS.Timeout | null = null;
    if (isPlaying && soundEnabled && bgMusicSource === "procedural") {
      playAmbientPad();
      padInterval = setInterval(playAmbientPad, 6000);
    }
    return () => {
      if (padInterval) clearInterval(padInterval);
    };
  }, [isPlaying, soundEnabled, bgMusicSource, musicVolume]);

  // Sync volume of HTML5 Audio element
  useEffect(() => {
    if (audioElRef.current) {
      audioElRef.current.volume = musicVolume;
    }
  }, [musicVolume]);

  // Handle playing/pausing of custom MP3/Audio uploads
  useEffect(() => {
    if (audioElRef.current) {
      if (isMusicPlaying && bgMusicSource === "uploaded" && uploadedMusic.url) {
        const ctx = getAudioContext();
        if (ctx.state === "suspended") {
          ctx.resume();
        }
        audioElRef.current.play().catch((err) => console.log("Audio play deferred or blocked by browser policies:", err));
      } else {
        audioElRef.current.pause();
      }
    }
  }, [isMusicPlaying, bgMusicSource, uploadedMusic.url]);

  // Synchronize custom music current play time & total duration
  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setMusicCurrentTime(audio.currentTime);
    };

    const handleDurationChange = () => {
      setMusicDuration(audio.duration || 0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("loadedmetadata", handleDurationChange);

    // Sync initial state
    setMusicCurrentTime(audio.currentTime);
    setMusicDuration(audio.duration || 0);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("loadedmetadata", handleDurationChange);
    };
  }, [uploadedMusic.url]);

  // Connect Audio Element to the Web Audio graph (both speakers and recording mixer)
  useEffect(() => {
    if (audioElRef.current && !audioSourceRef.current) {
      try {
        const ctx = getAudioContext();
        audioSourceRef.current = ctx.createMediaElementSource(audioElRef.current);
        audioSourceRef.current.connect(ctx.destination);
        if (recordingMixerRef.current) {
          audioSourceRef.current.connect(recordingMixerRef.current);
        }
      } catch (err) {
        console.warn("Routing audio element failed:", err);
      }
    }
  }, [uploadedMusic.url]);

  // File Upload Handler
  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (uploadedMusic.url) {
      URL.revokeObjectURL(uploadedMusic.url);
    }

    const url = URL.createObjectURL(file);
    setUploadedMusic({
      file,
      url,
      name: file.name,
    });
    setBgMusicSource("uploaded");
    setIsMusicPlaying(true); // Auto-play when uploaded!

    let audio = audioElRef.current;
    if (audio) {
      audio.pause();
    } else {
      audio = new Audio();
      audio.loop = true;
      audioElRef.current = audio;
    }
    audio.crossOrigin = "anonymous";
    audio.src = url;
    audio.volume = musicVolume;
    
    // We can also trigger play if already running
    audio.play().catch((err) => console.log("Audio autoplay deferred:", err));
  };

  // Background Image Upload Handler
  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setCustomBgImage(img);
      setCustomBgName(file.name);
      setBgTheme("custom");
    };
    img.onerror = () => {
      console.error("Failed to load background image");
    };
    img.src = url;
  };

  // Sound Engine
  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    if (!recordingMixerRef.current && audioCtxRef.current) {
      recordingMixerRef.current = audioCtxRef.current.createGain();
      recordingMixerRef.current.gain.value = 1.0;
    }
    return audioCtxRef.current;
  };

  const triggerAudioNote = (noteName: string, lengthMultiplier = 1.0) => {
    if (!soundEnabled || !chiptuneEnabled) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = NOTE_FREQS[noteName] || 440;
      osc.type = instrument as OscillatorType;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const duration = restitution * lengthMultiplier;

      // 8-bit envelope
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      // If active video recording, feed synth note into MediaRecorder stream
      if (recordingMixerRef.current) {
        gain.connect(recordingMixerRef.current);
      }

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.error("Audio error", e);
    }
  };

  const startRecording = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // Initialize AudioContext if not active
      const ctx = getAudioContext();
      
      // Explicitly await the audio context to be fully resumed before proceeding!
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      // Always create a completely fresh MediaStreamDestination node for this recording session
      audioDestRef.current = ctx.createMediaStreamDestination();
      
      // Connect our persistent recording mixer to this destination node
      if (recordingMixerRef.current) {
        recordingMixerRef.current.connect(audioDestRef.current);
      }

      // Ensure that custom uploaded music is correctly connected to both speakers and recording mixer
      if (audioSourceRef.current && recordingMixerRef.current) {
        try {
          audioSourceRef.current.disconnect(recordingMixerRef.current);
        } catch (e) {}
        audioSourceRef.current.connect(recordingMixerRef.current);
      }
      if (audioSourceRef.current && ctx) {
        try {
          audioSourceRef.current.disconnect(ctx.destination);
        } catch (e) {}
        audioSourceRef.current.connect(ctx.destination);
      }

      // Ensure that the music is playing if it is chosen
      if (bgMusicSource === "uploaded" && audioElRef.current && isMusicPlaying) {
        audioElRef.current.play().catch(e => console.log("Auto-playing uploaded music during recording:", e));
      }

      const chunks: Blob[] = [];
      const canvasStream = canvas.captureStream ? canvas.captureStream(30) : (canvas as any).captureStream ? (canvas as any).captureStream(30) : null;
      if (!canvasStream) throw new Error("Canvas captureStream is not supported in this browser.");

      // Bundle mixed tracks cleanly using direct array constructor for maximum browser compatibility
      const audioStream = audioDestRef.current ? audioDestRef.current.stream : null;
      const tracks = [
        ...canvasStream.getVideoTracks(),
        ...(audioStream ? audioStream.getAudioTracks() : [])
      ];
      const combinedStream = new MediaStream(tracks);

      // Find the best supported container and codecs
      // We prioritize video/webm because it is highly optimized for Canvas encoding in modern browsers
      const candidates = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4;codecs=avc1,mp4a.40.2",
        "video/mp4;codecs=h264,aac",
        "video/mp4",
      ];

      let recorder: MediaRecorder | null = null;
      let options: MediaRecorderOptions = {};

      for (const mime of candidates) {
        if (MediaRecorder.isTypeSupported(mime)) {
          try {
            options = { mimeType: mime };
            recorder = new MediaRecorder(combinedStream, options);
            break;
          } catch (e) {
            console.warn(`Browser reported supporting ${mime} but failed to instantiate MediaRecorder:`, e);
          }
        }
      }

      // Fallback if none of the candidates with specified mimeType worked
      if (!recorder) {
        try {
          recorder = new MediaRecorder(combinedStream);
        } catch (e) {
          console.error("Failed to create MediaRecorder even with default options:", e);
          throw e;
        }
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const actualMime = recorder ? recorder.mimeType : "video/webm";
        const extension = actualMime.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(chunks, { type: actualMime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `autonomous-tetris-gameplay-score-${score}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start MediaRecorder session:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    // Clean up connections to prevent memory leaks and track inactivation bugs
    if (recordingMixerRef.current && audioDestRef.current) {
      try {
        recordingMixerRef.current.disconnect(audioDestRef.current);
      } catch (err) {
        console.warn("Error disconnecting recording mixer:", err);
      }
    }
    audioDestRef.current = null;
    setIsRecording(false);
  };

  const rotateClockwise = (matrix: number[][]): number[][] => {
    const n = matrix.length;
    const result = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        result[c][n - 1 - r] = matrix[r][c];
      }
    }
    return result;
  };

  const checkCollision = (
    grid: ( { color: string; pieceType: string } | null )[][],
    shape: number[][],
    px: number,
    py: number
  ): boolean => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] !== 0) {
          const targetX = px + c;
          const targetY = py + r;
          if (targetX < 0 || targetX >= 10 || targetY >= 20) {
            return true;
          }
          if (targetY >= 0 && grid[targetY][targetX] !== null) {
            return true;
          }
        }
      }
    }
    return false;
  };

  // Heuristic Tetris AI
  const findBestMove = (
    grid: ( { color: string; pieceType: string } | null )[][],
    pieceType: string
  ) => {
    let bestX = 3;
    let bestRot = 0;
    let maxScore = -Infinity;

    let currentShape = SHAPES[pieceType];

    for (let rot = 0; rot < 4; rot++) {
      if (rot > 0) {
        currentShape = rotateClockwise(currentShape);
      }

      // Calculate bounding box width
      let minOffset = 99;
      let maxOffset = -99;
      for (let r = 0; r < currentShape.length; r++) {
        for (let c = 0; c < currentShape[r].length; c++) {
          if (currentShape[r][c] !== 0) {
            if (c < minOffset) minOffset = c;
            if (c > maxOffset) maxOffset = c;
          }
        }
      }

      const minCol = -minOffset;
      const maxCol = 10 - 1 - maxOffset;

      for (let col = minCol; col <= maxCol; col++) {
        let dropY = -2;
        while (!checkCollision(grid, currentShape, col, dropY + 1)) {
          dropY++;
        }

        if (dropY < -1) continue;

        // Place on temporary copy
        const tempGrid = grid.map(row => [...row]);
        for (let r = 0; r < currentShape.length; r++) {
          for (let c = 0; c < currentShape[r].length; c++) {
            if (currentShape[r][c] !== 0) {
              const gy = dropY + r;
              const gx = col + c;
              if (gy >= 0 && gy < 20 && gx >= 0 && gx < 10) {
                tempGrid[gy][gx] = { color: PIECE_COLORS[pieceType as keyof typeof PIECE_COLORS], pieceType };
              }
            }
          }
        }

        // Calculate heights, holes, roughness, completed lines
        let aggregateHeight = 0;
        const heights = Array(10).fill(0);
        for (let c = 0; c < 10; c++) {
          let h = 0;
          for (let r = 0; r < 20; r++) {
            if (tempGrid[r][c] !== null) {
              h = 20 - r;
              break;
            }
          }
          heights[c] = h;
          aggregateHeight += h;
        }

        let holes = 0;
        for (let c = 0; c < 10; c++) {
          let blockFound = false;
          for (let r = 0; r < 20; r++) {
            if (tempGrid[r][c] !== null) {
              blockFound = true;
            } else if (blockFound && tempGrid[r][c] === null) {
              holes++;
            }
          }
        }

        let completedLines = 0;
        for (let r = 0; r < 20; r++) {
          if (tempGrid[r].every(cell => cell !== null)) {
            completedLines++;
          }
        }

        let roughness = 0;
        for (let c = 0; c < 9; c++) {
          roughness += Math.abs(heights[c] - heights[c + 1]);
        }

        // Standard AI Heuristics
        const score = (
          -0.51 * aggregateHeight +
          0.76 * completedLines +
          -0.45 * holes +
          -0.18 * roughness
        ) * (ballSpeed / 10); // scale AI capabilities based on heuristics slider level

        if (score > maxScore) {
          maxScore = score;
          bestX = col;
          bestRot = rot;
        }
      }
    }

    return { x: bestX, rot: bestRot };
  };

  // Seed grid from preset
  const initPresetGrid = () => {
    const grid = Array.from({ length: 20 }, () => Array(10).fill(null));

    const addShapeToGrid = (gx: number, gy: number, type: string) => {
      const offsets = {
        I: [[0, 0], [1, 0], [2, 0], [3, 0]],
        O: [[0, 0], [1, 0], [0, 1], [1, 1]],
        T: [[1, 0], [0, 1], [1, 1], [2, 1]],
        S: [[1, 0], [2, 0], [0, 1], [1, 1]],
        Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
        J: [[0, 0], [0, 1], [1, 1], [2, 1]],
        L: [[2, 0], [0, 1], [1, 1], [2, 1]],
      }[type] || [[0, 0]];

      offsets.forEach(([ox, oy]) => {
        const tx = gx + ox;
        const ty = gy + oy;
        if (tx >= 0 && tx < 10 && ty >= 0 && ty < 20) {
          grid[ty][tx] = { color: PIECE_COLORS[type as keyof typeof PIECE_COLORS], pieceType: type };
        }
      });
    };

    if (preset === "steps") {
      addShapeToGrid(0, 16, "I");
      addShapeToGrid(2, 17, "O");
      addShapeToGrid(4, 18, "L");
      addShapeToGrid(6, 18, "S");
      addShapeToGrid(8, 18, "T");
    } else if (preset === "pyramid") {
      for (let i = 1; i < 9; i += 2) addShapeToGrid(i, 18, "O");
      for (let i = 2; i < 8; i += 3) addShapeToGrid(i, 15, "T");
      addShapeToGrid(4, 12, "I");
    } else if (preset === "zigzag") {
      for (let x = 0; x < 6; x++) {
        addShapeToGrid(x, 10, "I");
        addShapeToGrid(x, 15, "I");
      }
      for (let x = 4; x < 10; x++) {
        addShapeToGrid(x, 12, "J");
        addShapeToGrid(x, 18, "J");
      }
    } else if (preset === "stack") {
      addShapeToGrid(0, 18, "I");
      addShapeToGrid(4, 18, "O");
      addShapeToGrid(6, 18, "J");
      addShapeToGrid(8, 18, "Z");
      addShapeToGrid(1, 16, "L");
      addShapeToGrid(4, 16, "S");
      addShapeToGrid(7, 16, "T");
      addShapeToGrid(2, 13, "I");
      addShapeToGrid(6, 14, "O");
    } else if (preset === "spiral") {
      for (let x = 1; x < 9; x += 3) addShapeToGrid(x, 13, "I");
      for (let y = 14; y < 19; y += 2) addShapeToGrid(8, y, "L");
      addShapeToGrid(4, 16, "O");
    }

    gridRef.current = grid;
    activePieceRef.current = null;
    setScore(0);
    setLines(0);
    setBlocksPlaced(0);
    setGameStatus("playing");
  };

  const spawnPiece = () => {
    const keys = Object.keys(SHAPES);
    const pieceType = keys[Math.floor(Math.random() * keys.length)];
    const bestMove = findBestMove(gridRef.current, pieceType);

    activePieceRef.current = {
      shape: SHAPES[pieceType],
      color: PIECE_COLORS[pieceType as keyof typeof PIECE_COLORS],
      pieceType,
      x: 3,
      y: 0,
      targetX: bestMove.x,
      targetRot: bestMove.rot,
      currentRotation: 0,
    };

    // Check game over
    if (checkCollision(gridRef.current, activePieceRef.current.shape, activePieceRef.current.x, activePieceRef.current.y)) {
      setGameStatus("gameover");
      setGameOverCountdown(3);
    }
  };

  const handleReset = () => {
    initPresetGrid();
  };

  // Initialize and React to params
  useEffect(() => {
    initPresetGrid();
  }, [preset]);

  // Game tick logic loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tickInterval = 1000 / (ballCount * 1.5); // milliseconds

    const updateGame = () => {
      if (gameStatus === "gameover") return;

      if (!activePieceRef.current) {
        spawnPiece();
        return;
      }

      const active = activePieceRef.current;

      // 1. AI Alignments
      if (active.currentRotation < active.targetRot) {
        const rotated = rotateClockwise(active.shape);
        if (!checkCollision(gridRef.current, rotated, active.x, active.y)) {
          active.shape = rotated;
          active.currentRotation++;
          triggerAudioNote("D5", 0.5); // tiny rotate sound
        } else {
          // Force rotation match if stuck to prevent visual loop mismatch
          active.currentRotation = active.targetRot;
        }
      } else if (active.x < active.targetX) {
        if (!checkCollision(gridRef.current, active.shape, active.x + 1, active.y)) {
          active.x++;
          triggerAudioNote("C5", 0.5); // shift sound
        } else {
          active.x = active.targetX;
        }
      } else if (active.x > active.targetX) {
        if (!checkCollision(gridRef.current, active.shape, active.x - 1, active.y)) {
          active.x--;
          triggerAudioNote("C5", 0.5); // shift sound
        } else {
          active.x = active.targetX;
        }
      } else {
        // 2. Drop piece
        if (!checkCollision(gridRef.current, active.shape, active.x, active.y + 1)) {
          active.y++;
        } else {
          // 3. Lock piece
          for (let r = 0; r < active.shape.length; r++) {
            for (let c = 0; c < active.shape[r].length; c++) {
              if (active.shape[r][c] !== 0) {
                const gy = active.y + r;
                const gx = active.x + c;
                if (gy >= 0 && gy < 20 && gx >= 0 && gx < 10) {
                  gridRef.current[gy][gx] = { color: active.color, pieceType: active.pieceType };
                }
              }
            }
          }

          // Play Korobeiniki note on block lock
          const noteData = TETRIS_MELODY[melodyIndexRef.current % TETRIS_MELODY.length];
          melodyIndexRef.current++;
          setNoteIdx(melodyIndexRef.current % TETRIS_MELODY.length);
          triggerAudioNote(noteData.note, 1.2);

          // Add sparkles at landing site using global board constants
          for (let i = 0; i < 8; i++) {
            particlesRef.current.push({
              x: BX + (active.x + 1.5) * CW + (Math.random() - 0.5) * 40,
              y: BY + (active.y + 1.5) * CH,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.5) * 6 - 2,
              radius: Math.random() * 3 + 2,
              color: active.color,
              alpha: 1.0,
              maxLife: 30,
              life: 30,
            });
          }

          setBlocksPlaced(b => b + 1);
          setScore(s => s + 10);

          // Row clearance check
          let rowsClearedThisTurn = 0;
          const clearedRows: number[] = [];

          for (let r = 0; r < 20; r++) {
            if (gridRef.current[r].every(cell => cell !== null)) {
              clearedRows.push(r);
              rowsClearedThisTurn++;
            }
          }

          if (rowsClearedThisTurn > 0) {
            // Flash completed rows
            lineFlashRowsRef.current = clearedRows;
            
            // Add massive row clear particles
            clearedRows.forEach(rowIdx => {
              for (let col = 0; col < 10; col++) {
                const cellColor = gridRef.current[rowIdx][col]?.color || "#ffffff";
                for (let k = 0; k < 4; k++) {
                  particlesRef.current.push({
                    x: BX + (col + 0.5) * CW + (Math.random() - 0.5) * 15,
                    y: BY + (rowIdx + 0.5) * CH + (Math.random() - 0.5) * 15,
                    vx: (Math.random() - 0.5) * 12,
                    vy: (Math.random() - 0.5) * 8 - 4,
                    radius: Math.random() * 4 + 2,
                    color: cellColor,
                    alpha: 1.0,
                    maxLife: 40,
                    life: 40,
                  });
                }
              }
            });

            // Play chord fanfare
            triggerAudioNote("E5", 1.8);
            setTimeout(() => triggerAudioNote("A5", 1.8), 120);

            // Shift grid down
            setTimeout(() => {
              const newGrid = gridRef.current.filter((_, idx) => !clearedRows.includes(idx));
              while (newGrid.length < 20) {
                newGrid.unshift(Array(10).fill(null));
              }
              gridRef.current = newGrid;
              lineFlashRowsRef.current = [];
            }, 100);

            // Scoring formulas
            const rewards = [0, 100, 300, 600, 1200];
            setScore(s => s + (rewards[rowsClearedThisTurn] || 100));
            setLines(l => l + rowsClearedThisTurn);
          }

          activePieceRef.current = null;
        }
      }
    };

    // Draw thread
    const draw = () => {
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // --- Canvas Retro Header HUD ---
      ctx.fillStyle = "#0c0c0c";
      ctx.fillRect(0, 0, canvas.width, BY - 15);

      // Neon orange border separator under HUD
      ctx.strokeStyle = "rgba(240, 100, 0, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, BY - 15);
      ctx.lineTo(canvas.width - 20, BY - 15);
      ctx.stroke();

      // Title Block
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 15px sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("", canvas.width / 2, 28);

      // Stats Columns
      const colWidth = canvas.width / 3;

      // Col 1: SCORE
      ctx.font = "bold 10px sans-serif";
      ctx.fillStyle = "#888888";
      ctx.fillText("SCORE", colWidth * 0.5, 60);
      ctx.font = "bold 20px monospace";
      ctx.fillStyle = "#ffaa00";
      ctx.fillText(score.toString(), colWidth * 0.5, 86);

      // Col 2: LINES
      ctx.font = "bold 10px sans-serif";
      ctx.fillStyle = "#888888";
      ctx.fillText("LINES", colWidth * 1.5, 60);
      ctx.font = "bold 20px monospace";
      ctx.fillStyle = "#ff5500";
      ctx.fillText(lines.toString(), colWidth * 1.5, 86);

      // Col 3: BLOCKS
      ctx.font = "bold 10px sans-serif";
      ctx.fillStyle = "#888888";
      ctx.fillText("BLOCKS", colWidth * 2.5, 60);
      ctx.font = "bold 20px monospace";
      ctx.fillStyle = "#00f0ff";
      ctx.fillText(blocksPlaced.toString(), colWidth * 2.5, 86);



      // --- Background Theme Renderer ---
      ctx.save();
      ctx.beginPath();
      ctx.rect(BX, BY, BOARD_W, BOARD_H);
      ctx.clip();

      if (bgTheme === "slate") {
        ctx.fillStyle = "#09090b";
        ctx.fillRect(BX, BY, BOARD_W, BOARD_H);
      } 
      else if (bgTheme === "neon") {
        ctx.fillStyle = "#050010";
        ctx.fillRect(BX, BY, BOARD_W, BOARD_H);
        
        // draw perspective grid lines from a virtual horizon point at the top center
        const horizonY = BY + 30;
        const horizonX = BX + BOARD_W / 2;
        
        // perspective lines
        ctx.strokeStyle = "rgba(0, 240, 255, 0.25)";
        ctx.lineWidth = 1.5;
        for (let x = -10; x <= 20; x += 3) {
          ctx.beginPath();
          ctx.moveTo(horizonX + x * 10, horizonY);
          ctx.lineTo(BX + (x - 5) * 50, BY + BOARD_H);
          ctx.stroke();
        }

        // horizontal lines scrolling down
        const gridSpeed = (Date.now() * 0.05) % 40;
        ctx.strokeStyle = "rgba(255, 0, 128, 0.3)";
        for (let i = 0; i < 15; i++) {
          const progress = (i * 25 + gridSpeed) / 400; // between 0 and 1
          const y = horizonY + progress * progress * (BOARD_H - 30);
          if (y >= BY && y <= BY + BOARD_H) {
            ctx.beginPath();
            ctx.moveTo(BX, y);
            ctx.lineTo(BX + BOARD_W, y);
            ctx.stroke();
          }
        }
      } 
      else if (bgTheme === "space") {
        const gradient = ctx.createLinearGradient(BX, BY, BX, BY + BOARD_H);
        gradient.addColorStop(0, "#0c0120");
        gradient.addColorStop(0.5, "#04010f");
        gradient.addColorStop(1, "#000000");
        ctx.fillStyle = gradient;
        ctx.fillRect(BX, BY, BOARD_W, BOARD_H);

        // Update & Draw starfield particles inside playfield
        starsRef.current.forEach((star) => {
          star.y += star.speed;
          if (star.y > BY + BOARD_H) {
            star.y = BY;
            star.x = BX + Math.random() * BOARD_W;
          }
          
          const alpha = 0.3 + Math.sin(Date.now() * 0.003 + star.x) * 0.4;
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, alpha)})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          ctx.fill();
        });
      } 
      else if (bgTheme === "sunset") {
        const gradient = ctx.createLinearGradient(BX, BY, BX, BY + BOARD_H);
        gradient.addColorStop(0, "#1f0318");
        gradient.addColorStop(0.6, "#4a053c");
        gradient.addColorStop(1, "#7d0e3a");
        ctx.fillStyle = gradient;
        ctx.fillRect(BX, BY, BOARD_W, BOARD_H);

        const sunX = BX + BOARD_W / 2;
        const sunY = BY + BOARD_H / 2 + 50;
        const sunRadius = 90;

        ctx.save();
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        ctx.clip();

        const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, sunRadius);
        sunGlow.addColorStop(0, "#ffe600");
        sunGlow.addColorStop(0.4, "#ff5500");
        sunGlow.addColorStop(1, "#ff0077");
        ctx.fillStyle = sunGlow;
        ctx.fillRect(sunX - sunRadius, sunY - sunRadius, sunRadius * 2, sunRadius * 2);

        ctx.fillStyle = "rgba(74, 5, 60, 0.95)";
        for (let sy = sunY - sunRadius; sy < sunY + sunRadius; sy += 12) {
          const relativeY = (sy - (sunY - sunRadius)) / (sunRadius * 2);
          const barHeight = relativeY * 6;
          ctx.fillRect(sunX - sunRadius, sy, sunRadius * 2, barHeight);
        }
        ctx.restore();
      } 
      else if (bgTheme === "matrix") {
        ctx.fillStyle = "#010802";
        ctx.fillRect(BX, BY, BOARD_W, BOARD_H);

        ctx.font = "9px monospace";
        matrixColumnsRef.current.forEach((y, colIdx) => {
          const colX = BX + colIdx * (BOARD_W / matrixColumnsRef.current.length);
          const characters = "0101XYZTETRISあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもやゆよらりるれろわをん";
          
          for (let i = 0; i < 8; i++) {
            const charY = y - i * 14;
            if (charY >= BY && charY <= BY + BOARD_H) {
              const char = characters[Math.floor((charY + colIdx * 20) % characters.length)];
              const alpha = 1.0 - i * 0.12;
              ctx.fillStyle = i === 0 ? `rgba(180, 255, 180, ${alpha})` : `rgba(0, 240, 50, ${alpha})`;
              ctx.fillText(char, colX + 4, charY);
            }
          }

          matrixColumnsRef.current[colIdx] += 1.8 + Math.sin(colIdx + Date.now() * 0.001) * 0.8;
          if (matrixColumnsRef.current[colIdx] > BY + BOARD_H + 100) {
            matrixColumnsRef.current[colIdx] = BY - Math.random() * 80;
          }
        });
      }
      else if (bgTheme === "custom") {
        if (customBgImage) {
          const imgRatio = customBgImage.width / customBgImage.height;
          const boardRatio = BOARD_W / BOARD_H;
          let drawW = BOARD_W;
          let drawH = BOARD_H;
          let drawX = BX;
          let drawY = BY;

          if (imgRatio > boardRatio) {
            drawW = BOARD_H * imgRatio;
            drawX = BX - (drawW - BOARD_W) / 2;
          } else {
            drawH = BOARD_W / imgRatio;
            drawY = BY - (drawH - BOARD_H) / 2;
          }

          ctx.drawImage(customBgImage, drawX, drawY, drawW, drawH);
          
          // Subtle dark overlay to ensure piece contrast
          ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
          ctx.fillRect(BX, BY, BOARD_W, BOARD_H);
        } else {
          ctx.fillStyle = "#0c0c0e";
          ctx.fillRect(BX, BY, BOARD_W, BOARD_H);
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("PLEASE UPLOAD IMAGE BELOW", BX + BOARD_W / 2, BY + BOARD_H / 2);
        }
      }

      ctx.restore();

      // 1. Grid Background lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      for (let c = 0; c <= 10; c++) {
        ctx.beginPath();
        ctx.moveTo(BX + c * CW, BY);
        ctx.lineTo(BX + c * CW, BY + BOARD_H);
        ctx.stroke();
      }
      for (let r = 0; r <= 20; r++) {
        ctx.beginPath();
        ctx.moveTo(BX, BY + r * CH);
        ctx.lineTo(BX + BOARD_W, BY + r * CH);
        ctx.stroke();
      }

      // 2. Draw static blocks
      for (let r = 0; r < 20; r++) {
        const isFlashing = lineFlashRowsRef.current.includes(r);
        for (let c = 0; c < 10; c++) {
          const block = gridRef.current[r][c];
          if (block) {
            ctx.fillStyle = isFlashing ? "#ffffff" : block.color;
            ctx.fillRect(BX + c * CW + 1, BY + r * CH + 1, CW - 2, CH - 2);

            // Shading gloss borders
            ctx.strokeStyle = "rgba(0,0,0,0.4)";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(BX + c * CW + 1, BY + r * CH + 1, CW - 2, CH - 2);

            // Top highlight
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
            ctx.fillRect(BX + c * CW + 2, BY + r * CH + 2, CW - 4, 3);
          }
        }
      }

      // 3. Draw active falling piece
      const active = activePieceRef.current;
      if (active && gameStatus === "playing") {
        for (let r = 0; r < active.shape.length; r++) {
          for (let c = 0; c < active.shape[r].length; c++) {
            if (active.shape[r][c] !== 0) {
              const gy = active.y + r;
              const gx = active.x + c;
              if (gy >= 0) {
                // Ghost shadow showing target placement
                let shadowY = active.y;
                while (!checkCollision(gridRef.current, active.shape, active.x, shadowY + 1)) {
                  shadowY++;
                }
                ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
                ctx.fillRect(BX + gx * CW + 2, BY + (shadowY + r) * CH + 2, CW - 4, CH - 4);
                ctx.strokeStyle = "rgba(255,255,255,0.25)";
                ctx.lineWidth = 1;
                ctx.strokeRect(BX + gx * CW + 2, BY + (shadowY + r) * CH + 2, CW - 4, CH - 4);

                // Active piece block
                ctx.fillStyle = active.color;
                ctx.fillRect(BX + gx * CW + 1, BY + gy * CH + 1, CW - 2, CH - 2);
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 1.5;
                ctx.strokeRect(BX + gx * CW + 1, BY + gy * CH + 1, CW - 2, CH - 2);
                
                // Active piece shine
                ctx.fillStyle = "rgba(255,255,255,0.25)";
                ctx.fillRect(BX + gx * CW + 2, BY + gy * CH + 2, CW - 4, 3);
              }
            }
          }
        }
      }

      // 4. Draw Particles
      particlesRef.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // 5. Board neon outline frame
      const borderHue = (Date.now() / 80) % 360;
      const neonBorder = `hsla(${borderHue}, 90%, 55%, 0.8)`;
      ctx.shadowBlur = 12;
      ctx.shadowColor = neonBorder;
      ctx.strokeStyle = neonBorder;
      ctx.lineWidth = 3;
      ctx.strokeRect(BX, BY, BOARD_W, BOARD_H);
      ctx.shadowBlur = 0;

      // 6. Game Over Ending Screen Overlay
      if (gameStatus === "gameover") {
        ctx.fillStyle = "rgba(5, 5, 5, 0.85)";
        ctx.fillRect(BX, BY, BOARD_W, BOARD_H);

        ctx.textAlign = "center";
        
        // Game Over Title
        ctx.fillStyle = "#ff5555";
        ctx.font = "bold 26px sans-serif";
        ctx.fillText("GAME OVER", BX + BOARD_W / 2, BY + 130);

        // Stats Box
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.fillRect(BX + 30, BY + 180, BOARD_W - 60, 180);
        ctx.strokeRect(BX + 30, BY + 180, BOARD_W - 60, 180);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("AI AUTOPILOT STATS RECAP", BX + BOARD_W / 2, BY + 210);

        ctx.fillStyle = "#aaaaaa";
        ctx.font = "12px monospace";
        ctx.textAlign = "left";
        ctx.fillText("Score:", BX + 55, BY + 250);
        ctx.fillText("Lines Cleared:", BX + 55, BY + 280);
        ctx.fillText("Blocks Placed:", BX + 55, BY + 310);

        ctx.fillStyle = "#f0a000";
        ctx.textAlign = "right";
        ctx.fillText(score.toString(), BX + BOARD_W - 55, BY + 250);
        ctx.fillText(lines.toString(), BX + BOARD_W - 55, BY + 280);
        ctx.fillText(blocksPlaced.toString(), BX + BOARD_W - 55, BY + 310);

        // Reset Countdown text
        ctx.textAlign = "center";
        ctx.fillStyle = "#00f0f0";
        ctx.font = "12px sans-serif";
        ctx.fillText(`Auto-Resetting Playboard in ${gameOverCountdown}s...`, BX + BOARD_W / 2, BY + 410);
      }
    };

    const renderLoop = (time: number) => {
      // Delta Time checks for speed control
      if (isPlaying) {
        // Particles physics
        particlesRef.current.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.08;
          p.life--;
          p.alpha = p.life / p.maxLife;
        });
        particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

        if (gameStatus === "playing") {
          const delta = time - lastTickTimeRef.current;
          if (delta >= tickInterval) {
            updateGame();
            lastTickTimeRef.current = time;
          }
        } else if (gameStatus === "gameover") {
          const delta = time - lastTickTimeRef.current;
          if (delta >= 1000) {
            setGameOverCountdown((c) => {
              if (c <= 1) {
                initPresetGrid();
                return 3;
              }
              return c - 1;
            });
            lastTickTimeRef.current = time;
          }
        }
      }

      draw();
      animationIdRef.current = requestAnimationFrame(renderLoop);
    };

    animationIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
    };
  }, [isPlaying, gameStatus, ballCount, ballSpeed, instrument, gravity, restitution, preset, score, lines, blocksPlaced, isRecording, recordingTime, bgTheme, customBgImage]);

  return (
    <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-5 flex flex-col items-center justify-between shadow-2xl h-full relative overflow-hidden">
      {/* Background neon ambient light */}
      <div className="absolute top-[-100px] left-[-100px] w-56 h-56 bg-orange-500/5 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] w-56 h-56 bg-orange-900/5 blur-3xl rounded-full pointer-events-none" />

      {/* Dynamic Statistics Bar */}
      <div className="w-full grid grid-cols-3 gap-3 pb-3 border-b border-white/5 z-10 text-xs text-center font-semibold uppercase tracking-wider">
        <div className="bg-[#050505] p-2 border border-white/5 rounded flex flex-col justify-center items-center gap-1">
          <span className="text-gray-500 text-[9px] flex items-center gap-1"><Trophy className="w-3 h-3 text-orange-400" /> Score</span>
          <span className="text-white font-mono text-sm">{score}</span>
        </div>
        <div className="bg-[#050505] p-2 border border-white/5 rounded flex flex-col justify-center items-center gap-1">
          <span className="text-gray-500 text-[9px] flex items-center gap-1"><Zap className="w-3 h-3 text-cyan-400" /> Lines</span>
          <span className="text-orange-500 font-mono text-sm">{lines}</span>
        </div>
        <div className="bg-[#050505] p-2 border border-white/5 rounded flex flex-col justify-center items-center gap-1">
          <span className="text-gray-500 text-[9px] flex items-center gap-1"><Award className="w-3 h-3 text-emerald-400" /> Blocks</span>
          <span className="text-white font-mono text-sm">{blocksPlaced}</span>
        </div>
      </div>

      {/* Responsive Canvas Container */}
      <div className="my-5 flex items-center justify-center bg-[#050505] rounded-lg overflow-hidden border border-white/5 p-2 shadow-inner w-full relative">
        <canvas
          ref={canvasRef}
          width={480}
          height={720}
          className="max-w-full aspect-[480/720] h-auto object-contain"
        />
      </div>

      {/* Buttons / Controller */}
      <div className="w-full flex items-center justify-between px-3 pt-3 border-t border-white/5 z-10">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded font-medium transition-all text-xs uppercase tracking-wider active:scale-95 ${
              isPlaying
                ? "bg-[#161616] hover:bg-[#222] text-gray-300 border border-white/10"
                : "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/20"
            }`}
          >
            {isPlaying ? "Pause AI" : "Start AI"}
          </button>

          <button
            onClick={handleReset}
            className="p-2.5 bg-[#161616] hover:bg-[#222] text-gray-300 border border-white/10 rounded font-medium active:scale-95 transition-all"
            title="Reset Grid"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Record button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded font-semibold text-xs uppercase tracking-wider transition-all active:scale-95 border ${
              isRecording
                ? "bg-red-600 border-red-500 hover:bg-red-500 text-white animate-pulse shadow-lg shadow-red-600/20"
                : "bg-[#161616] border-white/10 hover:bg-[#222] text-red-500 hover:text-red-400"
            }`}
            title={isRecording ? "Stop Recording Video" : "Record Gameplay Video"}
          >
            <Video className="w-3.5 h-3.5" />
            <span>{isRecording ? `Stop (${formatTime(recordingTime)})` : "Record"}</span>
          </button>
        </div>

        <button
          onClick={() => {
            setSoundEnabled(!soundEnabled);
            if (!soundEnabled) getAudioContext();
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded font-medium text-xs uppercase tracking-wider transition-all active:scale-95 border ${
            soundEnabled
              ? "bg-orange-600/10 border-orange-500/30 hover:bg-orange-600/20 text-orange-400"
              : "bg-[#161616] border-white/5 hover:bg-[#222] text-gray-500"
          }`}
        >
          {soundEnabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5" />
              <span>Sound On</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5" />
              <span>Sound Off</span>
            </>
          )}
        </button>
      </div>

      {/* Dynamic Sandbox Laboratory: Background, Music, Chiptune Configuration */}
      <div className="w-full mt-6 pt-5 border-t border-white/5 space-y-6 z-10 text-left">
        <div className="flex items-center space-x-2 text-gray-400 pb-1.5 border-b border-white/5">
          <Sliders className="w-4 h-4 text-orange-500 animate-pulse" />
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">Game Customization Laboratory</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section A: Background Theme */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Palette className="w-3.5 h-3.5 text-cyan-400" />
              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Game Board Background</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "slate", label: "Retro Slate", color: "bg-[#09090b] border-zinc-700" },
                { id: "neon", label: "Cyber Grid", color: "bg-[#050010] border-pink-500/50" },
                { id: "space", label: "Cosmic Stars", color: "bg-[#0c0120] border-indigo-500/50" },
                { id: "sunset", label: "Sunset Glow", color: "bg-[#4a053c] border-orange-500/50" },
                { id: "matrix", label: "Matrix Code", color: "bg-[#010802] border-emerald-500/50" },
                { id: "custom", label: "Custom Image", color: "bg-[#1c1917] border-orange-500" },
              ].map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setBgTheme(theme.id as any)}
                  className={`flex items-center justify-between p-2 rounded text-left border transition-all text-[11px] font-medium active:scale-95 ${
                    bgTheme === theme.id
                      ? "bg-white/10 border-orange-500 text-white shadow shadow-orange-500/20"
                      : "bg-[#161616]/40 border-white/5 text-gray-400 hover:bg-[#222]/40 hover:text-white"
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${theme.color}`} />
                    <span>{theme.label}</span>
                  </span>
                  {bgTheme === theme.id && <Check className="w-3 h-3 text-orange-500" />}
                </button>
              ))}
            </div>

            {bgTheme === "custom" && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-wider text-gray-500">Upload Background Image</span>
                  {customBgImage && <span className="text-[9px] text-emerald-400 font-mono">Loaded ✓</span>}
                </div>
                
                <label className="flex items-center justify-center space-x-2 px-3 py-2.5 bg-[#161616]/60 border border-white/10 hover:border-orange-500/30 rounded cursor-pointer transition-colors group">
                  <Upload className="w-3.5 h-3.5 text-gray-400 group-hover:text-orange-400 transition-colors" />
                  <span className="text-[11px] text-gray-300 group-hover:text-white transition-colors truncate max-w-[200px]">
                    {customBgImage ? customBgName : "Select custom image..."}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBgImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Section B: Audio & Music System */}
          <div className="space-y-4">
            {/* Chiptune Instrument Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded bg-[#161616]/40 border border-white/5">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-1 rounded ${chiptuneEnabled ? "bg-orange-500/10 text-orange-500" : "bg-zinc-800 text-zinc-500"}`}>
                    <Radio className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[11px] font-semibold text-white">Chiptune Synthesizers</span>
                    <span className="text-[9px] text-gray-500">Play 8-bit sound effects on landings</span>
                  </div>
                </div>
                <button
                  onClick={() => setChiptuneEnabled(!chiptuneEnabled)}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors focus:outline-none ${
                    chiptuneEnabled ? "bg-orange-600" : "bg-neutral-800"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      chiptuneEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Background MP3 Music */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Music className="w-3.5 h-3.5 text-orange-500" />
                <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Background Music Soundtrack</label>
              </div>
              
              <div className="space-y-2 bg-[#161616]/40 border border-white/5 rounded p-3">
                {/* Select Music Source */}
                <div className="grid grid-cols-3 gap-1.5 pb-2.5 border-b border-white/5">
                  <button
                    onClick={() => setBgMusicSource("none")}
                    className={`px-1.5 py-1.5 rounded text-[10px] font-medium transition-all ${
                      bgMusicSource === "none"
                        ? "bg-orange-600 text-white"
                        : "bg-[#0c0c0c] text-gray-400 hover:text-white"
                    }`}
                  >
                    Mute Music
                  </button>
                  <button
                    onClick={() => {
                      setBgMusicSource("procedural");
                      getAudioContext();
                    }}
                    className={`px-1.5 py-1.5 rounded text-[10px] font-medium transition-all ${
                      bgMusicSource === "procedural"
                        ? "bg-orange-600 text-white"
                        : "bg-[#0c0c0c] text-gray-400 hover:text-white"
                    }`}
                  >
                    Procedural Synth
                  </button>
                  <button
                    onClick={() => {
                      setBgMusicSource("uploaded");
                      getAudioContext();
                    }}
                    className={`px-1.5 py-1.5 rounded text-[10px] font-medium transition-all ${
                      bgMusicSource === "uploaded"
                        ? "bg-orange-600 text-white"
                        : "bg-[#0c0c0c] text-gray-400 hover:text-white"
                    }`}
                  >
                    Custom MP3
                  </button>
                </div>

                {/* Upload MP3 Panel */}
                {bgMusicSource === "uploaded" && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase tracking-wider text-gray-500">Upload Custom MP3 File</span>
                      {uploadedMusic.file && <span className="text-[9px] text-emerald-400 font-mono">Loaded ✓</span>}
                    </div>
                    
                    <label className="flex items-center justify-center space-x-2 px-3 py-2 bg-[#0c0c0c] border border-white/10 hover:border-orange-500/30 rounded cursor-pointer transition-colors group">
                      <Upload className="w-3.5 h-3.5 text-gray-400 group-hover:text-orange-400 transition-colors" />
                      <span className="text-[11px] text-gray-300 group-hover:text-white transition-colors truncate max-w-[200px]">
                        {uploadedMusic.file ? uploadedMusic.name : "Select MP3 track..."}
                      </span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleMusicUpload}
                        className="hidden"
                      />
                    </label>

                    {/* Dedicated Music Control Panel when file is loaded */}
                    {uploadedMusic.url && (
                      <div className="bg-[#0a0a0a] border border-white/5 rounded p-2.5 mt-2 space-y-2">
                        {/* Title and Controls */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-medium truncate max-w-[150px]">
                            {uploadedMusic.name}
                          </span>
                          <button
                            onClick={() => setIsMusicPlaying(!isMusicPlaying)}
                            className="p-1.5 rounded-full bg-orange-600 hover:bg-orange-500 active:scale-95 text-white transition-all flex items-center justify-center"
                            title={isMusicPlaying ? "Pause Music" : "Play Music"}
                          >
                            {isMusicPlaying ? (
                              <Pause className="w-3 h-3 fill-current" />
                            ) : (
                              <Play className="w-3 h-3 fill-current ml-0.5" />
                            )}
                          </button>
                        </div>

                        {/* Music Time Seek Timeline */}
                        <div className="space-y-1">
                          <input
                            type="range"
                            min="0"
                            max={musicDuration || 100}
                            value={musicCurrentTime}
                            onChange={(e) => {
                              const newTime = Number(e.target.value);
                              if (audioElRef.current) {
                                audioElRef.current.currentTime = newTime;
                                setMusicCurrentTime(newTime);
                              }
                            }}
                            className="w-full accent-orange-500 cursor-pointer h-1 bg-zinc-800 rounded appearance-none"
                          />
                          <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                            <span>{formatTime(Math.floor(musicCurrentTime))}</span>
                            <span>{formatTime(Math.floor(musicDuration))}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Procedural Track Info */}
                {bgMusicSource === "procedural" && (
                  <div className="text-[10px] text-gray-500 italic flex items-start gap-1.5 pt-1">
                    <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span>Generates dynamic synthwave ambient chords in real-time, procedurally synthesized inside your browser!</span>
                  </div>
                )}

                {/* Volume Slider */}
                {bgMusicSource !== "none" && (
                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <div className="flex justify-between text-[9px] uppercase tracking-wider text-gray-500">
                      <span>Soundtrack Volume</span>
                      <span className="font-mono">{Math.round(musicVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={musicVolume}
                      onChange={(e) => setMusicVolume(Number(e.target.value))}
                      className="w-full accent-orange-500 cursor-pointer h-1 bg-[#0c0c0c] rounded appearance-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
