export type InstrumentType = "square" | "sine" | "triangle" | "sawtooth";
export type GameStatus = "playing" | "gameover" | "celebrating";
export type LayoutPreset = "steps" | "pyramid" | "zigzag" | "stack" | "spiral" | "empty";

export interface TetrisBlock {
  id: string;
  gridX: number;
  gridY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  pieceType: "I" | "O" | "T" | "S" | "Z" | "J" | "L";
  flashTimer: number;
}

export interface ActivePiece {
  shape: number[][];
  color: string;
  pieceType: "I" | "O" | "T" | "S" | "Z" | "J" | "L";
  x: number;
  y: number;
  targetX: number; // For AI movement smoothing
  targetRotation: number;
}

export interface Particle {
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

export interface AudioNote {
  note: string;
  freq: number;
  duration: number;
}
