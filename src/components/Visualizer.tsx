import React, { useEffect, useRef, useState } from "react";
import { InstrumentType, GameStatus } from "../types";
import { NOTE_FREQS, TETRIS_MELODY } from "../data";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Radio, Trophy, Zap, Award, Video } from "lucide-react";

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

  // Sound Engine
  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const triggerAudioNote = (noteName: string, lengthMultiplier = 1.0) => {
    if (!soundEnabled) return;
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
      if (audioDestRef.current) {
        gain.connect(audioDestRef.current);
      }

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.error("Audio error", e);
    }
  };

  const startRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // Initialize AudioContext if not active
      const ctx = getAudioContext();
      if (!audioDestRef.current) {
        audioDestRef.current = ctx.createMediaStreamDestination();
      }

      const chunks: Blob[] = [];
      const canvasStream = canvas.captureStream(30); // Capture 30fps game screen
      const combinedStream = new MediaStream();

      // Bundle game screen visuals
      canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));

      // Bundle retro audio synth notes
      const audioStream = audioDestRef.current.stream;
      audioStream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));

      let options = { mimeType: "video/webm;codecs=vp9" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "video/webm;codecs=vp8" };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "video/webm" };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "" };
      }

      const recorder = new MediaRecorder(combinedStream, options);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `autonomous-tetris-gameplay-score-${score}.webm`;
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
      ctx.fillText("AUTONOMOUS RETRO TETRIS", canvas.width / 2, 28);

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

      // Flashing "● REC" Indicator
      if (isRecording) {
        const isDotVisible = Math.floor(Date.now() / 500) % 2 === 0;
        if (isDotVisible) {
          ctx.beginPath();
          ctx.arc(38, 28, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = "#ff3333";
          ctx.fill();
        }
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#ff3333";
        ctx.textAlign = "left";
        ctx.fillText("REC", 48, 28);
      }

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
  }, [isPlaying, gameStatus, ballCount, ballSpeed, instrument, gravity, restitution, preset, score, lines, blocksPlaced, isRecording, recordingTime]);

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
    </div>
  );
};
