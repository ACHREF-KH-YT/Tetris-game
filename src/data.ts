import { TetrisBlock } from "./types";

export const PIECE_COLORS = {
  I: "#00f0f0", // Cyan
  O: "#f0f000", // Yellow
  T: "#a000f0", // Purple
  S: "#00f000", // Green
  Z: "#f00000", // Red
  J: "#0000f0", // Blue
  L: "#f0a000", // Orange
};

export const TETRIS_MELODY: { note: string; length: number }[] = [
  { note: "E5", length: 0.25 }, { note: "B4", length: 0.125 }, { note: "C5", length: 0.125 },
  { note: "D5", length: 0.25 }, { note: "C5", length: 0.125 }, { note: "B4", length: 0.125 },
  { note: "A4", length: 0.25 }, { note: "A4", length: 0.125 }, { note: "C5", length: 0.125 },
  { note: "E5", length: 0.25 }, { note: "D5", length: 0.125 }, { note: "C5", length: 0.125 },
  { note: "B4", length: 0.375 }, { note: "C5", length: 0.125 }, { note: "D5", length: 0.25 },
  { note: "E5", length: 0.25 }, { note: "C5", length: 0.25 }, { note: "A4", length: 0.25 },
  { note: "A4", length: 0.25 }, { note: "D5", length: 0.375 }, { note: "F5", length: 0.125 },
  { note: "A5", length: 0.25 }, { note: "G5", length: 0.125 }, { note: "F5", length: 0.125 },
  { note: "E5", length: 0.375 }, { note: "C5", length: 0.125 }, { note: "E5", length: 0.25 },
  { note: "D5", length: 0.125 }, { note: "C5", length: 0.125 }, { note: "B4", length: 0.25 },
  { note: "B4", length: 0.125 }, { note: "C5", length: 0.125 }, { note: "D5", length: 0.25 },
  { note: "E5", length: 0.25 }, { note: "C5", length: 0.25 }, { note: "A4", length: 0.25 },
  { note: "A4", length: 0.25 }
];

export const NOTE_FREQS: Record<string, number> = {
  A4: 440.00,
  "A#4": 466.16,
  B4: 493.88,
  C5: 523.25,
  "C#5": 554.37,
  D5: 587.33,
  "D#5": 622.25,
  E5: 659.25,
  F5: 698.46,
  "F#5": 739.99,
  G5: 783.99,
  "G#5": 830.61,
  A5: 880.00,
};

export function buildPresetBlocks(
  preset: string,
  bx: number,
  by: number,
  bw: number,
  bh: number
): TetrisBlock[] {
  const cols = 10;
  const rows = 20;
  const cw = bw / cols;
  const ch = bh / rows;
  const blocks: TetrisBlock[] = [];

  function addShape(gridX: number, gridY: number, pType: keyof typeof PIECE_COLORS) {
    const shapes = {
      I: [[0, 0], [1, 0], [2, 0], [3, 0]],
      O: [[0, 0], [1, 0], [0, 1], [1, 1]],
      T: [[1, 0], [0, 1], [1, 1], [2, 1]],
      S: [[1, 0], [2, 0], [0, 1], [1, 1]],
      Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
      J: [[0, 0], [0, 1], [1, 1], [2, 1]],
      L: [[2, 0], [0, 1], [1, 1], [2, 1]],
    };
    const offsets = shapes[pType] || [[0, 0]];
    offsets.forEach(([ox, oy]) => {
      const gx = gridX + ox;
      const gy = gridY + oy;
      if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
        blocks.push({
          id: `${pType}_${gx}_${gy}_${Date.now()}_${Math.random()}`,
          gridX: gx,
          gridY: gy,
          x: bx + gx * cw,
          y: by + gy * ch,
          width: cw,
          height: ch,
          color: PIECE_COLORS[pType],
          pieceType: pType as any,
          flashTimer: 0,
        });
      }
    });
  }

  if (preset === "steps") {
    // Cascading stairs
    addShape(0, 4, "I");
    addShape(2, 7, "O");
    addShape(4, 10, "L");
    addShape(6, 13, "S");
    addShape(8, 16, "T");
    addShape(9, 8, "Z");
    addShape(0, 14, "J");
  } else if (preset === "pyramid") {
    // Center pyramid
    for (let i = 1; i < 9; i += 2) {
      addShape(i, 16, "O");
    }
    for (let i = 2; i < 8; i += 3) {
      addShape(i, 12, "T");
    }
    addShape(4, 7, "I");
  } else if (preset === "zigzag") {
    // Chute slalom
    for (let x = 0; x < 6; x++) {
      addShape(x, 4, "I");
      addShape(x, 12, "I");
    }
    for (let x = 4; x < 10; x++) {
      addShape(x, 8, "J");
      addShape(x, 16, "J");
    }
    addShape(8, 6, "O");
    addShape(1, 14, "S");
  } else if (preset === "stack") {
    // Typical Tetris game stack
    addShape(0, 18, "I");
    addShape(4, 18, "O");
    addShape(6, 18, "J");
    addShape(8, 18, "Z");
    addShape(1, 16, "L");
    addShape(4, 16, "S");
    addShape(7, 16, "T");
    addShape(2, 10, "I");
    addShape(6, 12, "O");
    addShape(3, 7, "T");
  } else if (preset === "spiral") {
    // Inward spiral layout
    for (let x = 1; x < 9; x += 3) {
      addShape(x, 4, "I");
    }
    for (let y = 6; y < 17; y += 4) {
      addShape(8, y, "L");
    }
    for (let x = 2; x < 8; x += 3) {
      addShape(x, 16, "S");
    }
    addShape(4, 10, "O");
  }

  return blocks;
}
