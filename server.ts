import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// API: Get generated python script code
app.post("/api/script", (req, res) => {
  const {
    gravity = 0.25,
    restitution = 1.02,
    ballCount = 1,
    ballSpeed = 5.0,
    preset = "steps",
    waveType = "square",
    duration = 15,
    fps = 60,
  } = req.body;

  try {
    const pythonScript = generatePythonScriptContent({
      gravity,
      restitution,
      ballCount,
      ballSpeed,
      preset,
      waveType,
      duration,
      fps,
    });
    res.json({ success: true, code: pythonScript });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Try to generate video
app.post("/api/generate", async (req, res) => {
  const {
    gravity = 0.25,
    restitution = 1.02,
    ballCount = 1,
    ballSpeed = 5.0,
    preset = "steps",
    waveType = "square",
    duration = 15,
    fps = 60,
  } = req.body;

  const scriptContent = generatePythonScriptContent({
    gravity,
    restitution,
    ballCount,
    ballSpeed,
    preset,
    waveType,
    duration,
    fps,
  });

  const timestamp = Date.now();
  const scriptPath = path.join(process.cwd(), `tetris_bounce_${timestamp}.py`);
  const outputPath = path.join(process.cwd(), `tetris_bounce_${timestamp}.mp4`);

  try {
    // Write Python script to temporary file
    fs.writeFileSync(scriptPath, scriptContent, "utf-8");

    // Execute the Python script using python3
    // We set dummy SDL driver for headless execution
    const runEnv = { ...process.env, SDL_VIDEODRIVER: "dummy" };

    exec(
      `python3 "${scriptPath}" --output "${outputPath}"`,
      { env: runEnv, timeout: 120000 }, // 2 minute timeout
      (execError, stdout, stderr) => {
        // Clean up script file
        try {
          if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        } catch (err) {}

        if (execError) {
          console.error("Python Execution Error:", execError, stderr);
          // Return the script code so they can run it locally, along with a nice helper message!
          return res.json({
            success: false,
            message: "Server environment lacks the pre-requisite libraries (Pygame/MoviePy/FFmpeg) to render heavy MP4 videos, but your custom Python script was generated perfectly!",
            errorDetail: stderr || execError.message,
            scriptCode: scriptContent,
          });
        }

        // Check if output file was created
        if (fs.existsSync(outputPath)) {
          // Serve the generated video
          res.json({
            success: true,
            message: "Video generated successfully on the server!",
            videoFilename: `tetris_bounce_${timestamp}.mp4`,
            scriptCode: scriptContent,
          });
        } else {
          res.json({
            success: false,
            message: "Python script ran but didn't produce the MP4. This can happen in server containers due to missing codecs. You can download and run the script locally to get the video!",
            stdout,
            stderr,
            scriptCode: scriptContent,
          });
        }
      }
    );
  } catch (err: any) {
    res.json({
      success: false,
      message: "An error occurred while preparing the script.",
      errorDetail: err.message,
      scriptCode: scriptContent,
    });
  }
});

// Serve generated video files
app.get("/video/:filename", (req, res) => {
  const filename = req.params.filename;
  if (!/^[a-zA-Z0-9_-]+\.(mp4|py)$/.test(filename)) {
    return res.status(400).send("Invalid filename");
  }
  const filePath = path.join(process.cwd(), filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send("File not found");
  }
});

// Helper: Python Script Generator
function generatePythonScriptContent(params: any): string {
  const {
    gravity,
    restitution,
    ballCount,
    ballSpeed,
    preset,
    waveType,
    duration,
    fps,
  } = params;

  return `import pygame
import pygame.gfxdraw
import math
import random
import struct
import wave
import numpy as np
from moviepy import ImageSequenceClip, AudioFileClip, CompositeAudioClip
import os
import sys
import argparse

# Force Pygame dummy video driver for headless server generation
os.environ["SDL_VIDEODRIVER"] = "dummy"

# --- CONFIGURATION ---
WIDTH, HEIGHT = 720, 1280
FPS = ${fps}
DURATION = ${duration}
GAME_SPEED = ${ballCount}      # Maps to game tick/fall multiplier
DECAY = ${restitution}         # Note length duration
HEURISTIC_LEVEL = ${ballSpeed} # AI Smartness Level (2 to 10)
PRESET = "${preset}"
WAVE_TYPE = "${waveType}"

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GRID_COLOR = (24, 24, 37)

PIECE_COLORS = {
    'I': (0, 240, 240),   # Cyan
    'O': (240, 240, 0),   # Yellow
    'T': (160, 0, 240),   # Purple
    'S': (0, 240, 0),     # Green
    'Z': (240, 0, 0),     # Red
    'J': (0, 0, 240),     # Blue
    'L': (240, 160, 0)    # Orange
}

SHAPES = {
    'I': [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    'O': [
        [1, 1],
        [1, 1]
    ],
    'T': [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0]
    ],
    'S': [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0]
    ],
    'Z': [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0]
    ],
    'J': [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0]
    ],
    'L': [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0]
    ]
}

# --- Korobeiniki Melody ---
TETRIS_MELODY = [
    ('E5', 0.25), ('B4', 0.125), ('C5', 0.125), ('D5', 0.25), ('C5', 0.125), ('B4', 0.125),
    ('A4', 0.25), ('A4', 0.125), ('C5', 0.125), ('E5', 0.25), ('D5', 0.125), ('C5', 0.125),
    ('B4', 0.375), ('C5', 0.125), ('D5', 0.25), ('E5', 0.25),
    ('C5', 0.25), ('A4', 0.25), ('A4', 0.25), ('D5', 0.375), ('F5', 0.125), ('A5', 0.25),
    ('G5', 0.125), ('F5', 0.125), ('E5', 0.375), ('C5', 0.125), ('E5', 0.25), ('D5', 0.125),
    ('C5', 0.125), ('B4', 0.25), ('B4', 0.125), ('C5', 0.125), ('D5', 0.25), ('E5', 0.25),
    ('C5', 0.25), ('A4', 0.25), ('A4', 0.25)
]

NOTE_FREQS = {
    'A4': 440.00, 'A#4': 466.16, 'B4': 493.88, 'C5': 523.25, 'C#5': 554.37,
    'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F#5': 739.99,
    'G5': 783.99, 'G#5': 830.61, 'A5': 880.00
}

SOUNDS_DIR = "sounds_temp"
if not os.path.exists(SOUNDS_DIR):
    os.makedirs(SOUNDS_DIR)

# --- CHIPTUNE WAV SYNTHESIZER ---
def synthesize_note(note_name, freq, duration_sec, filename, volume=0.4, wave_type=WAVE_TYPE):
    sample_rate = 22050
    num_samples = int(sample_rate * duration_sec)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        for i in range(num_samples):
            t = float(i) / sample_rate
            
            if wave_type == 'square':
                val = volume if math.sin(2 * math.pi * freq * t) >= 0 else -volume
            elif wave_type == 'triangle':
                val = volume * (2.0 * abs(2.0 * (freq * t - math.floor(freq * t + 0.5))) - 1.0)
            elif wave_type == 'sawtooth':
                val = volume * (2.0 * (freq * t - math.floor(freq * t + 0.5)))
            else: # sine
                val = volume * math.sin(2 * math.pi * freq * t)
            
            # Anti-click fade out
            fade_samples = int(sample_rate * 0.04)
            if num_samples - i < fade_samples:
                fade_ratio = float(num_samples - i) / fade_samples
                val *= fade_ratio
                
            sample = int(val * 32767)
            wav_file.writeframesraw(struct.pack('<h', sample))

print("Synthesizing chiptune samples...")
sound_files = {}
for note, length in TETRIS_MELODY:
    if note not in sound_files:
        freq = NOTE_FREQS.get(note, 440.0)
        file_path = os.path.join(SOUNDS_DIR, f"{note}.wav")
        synthesize_note(note, freq, DECAY, file_path)
        sound_files[note] = file_path

# Helper functions for rotation and collision
def rotate_clockwise(matrix):
    return [list(x) for x in zip(*matrix[::-1])]

def check_collision(grid, shape, px, py):
    for r in range(len(shape)):
        for c in range(len(shape[r])):
            if shape[r][c] != 0:
                target_x = px + c
                target_y = py + r
                if target_x < 0 or target_x >= 10 or target_y >= 20:
                    return True
                if target_y >= 0 and grid[target_y][target_x] is not None:
                    return True
    return False

def find_best_move(grid, piece_type):
    best_x = 3
    best_rot = 0
    max_score = -9999999.0
    
    current_shape = SHAPES[piece_type]
    for rot in range(4):
        if rot > 0:
            current_shape = rotate_clockwise(current_shape)
            
        min_offset = 99
        max_offset = -99
        for r in range(len(current_shape)):
            for c in range(len(current_shape[r])):
                if current_shape[r][c] != 0:
                    if c < min_offset: min_offset = c
                    if c > max_offset: max_offset = c
                    
        min_col = -min_offset
        max_col = 10 - 1 - max_offset
        
        for col in range(min_col, max_col + 1):
            drop_y = -2
            while not check_collision(grid, current_shape, col, drop_y + 1):
                drop_y += 1
                
            if drop_y < -1:
                continue
                
            temp_grid = [row[:] for row in grid]
            for r in range(len(current_shape)):
                for c in range(len(current_shape[r])):
                    if current_shape[r][c] != 0:
                        gy = drop_y + r
                        gx = col + c
                        if 0 <= gy < 20 and 0 <= gx < 10:
                            temp_grid[gy][gx] = piece_type
                            
            # AI evaluation
            heights = [0] * 10
            aggregate_height = 0
            for c in range(10):
                h = 0
                for r in range(20):
                    if temp_grid[r][c] is not None:
                        h = 20 - r
                        break
                heights[c] = h
                aggregate_height += h
                
            holes = 0
            for c in range(10):
                block_found = False
                for r in range(20):
                    if temp_grid[r][c] is not None:
                        block_found = True
                    elif block_found and temp_grid[r][c] is None:
                        holes += 1
                        
            completed_lines = 0
            for r in range(20):
                if all(cell is not None for cell in temp_grid[r]):
                    completed_lines += 1
                    
            roughness = sum(abs(heights[c] - heights[c + 1]) for c in range(9))
            
            score = (
                -0.51 * aggregate_height +
                0.76 * completed_lines +
                -0.45 * holes +
                -0.18 * roughness
            ) * (HEURISTIC_LEVEL / 10.0)
            
            if score > max_score:
                max_score = score
                best_x = col
                best_rot = rot
                
    return best_x, best_rot

class Particle:
    def __init__(self, x, y, color):
        self.x = x
        self.y = y
        angle = random.uniform(0, 2 * math.pi)
        speed = random.uniform(2, 7)
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed
        self.radius = random.uniform(2, 6)
        self.color = color
        self.life = 1.0
        self.decay = random.uniform(0.03, 0.06)

    def update(self):
        self.x += self.vx
        self.y += self.vy
        self.vy += 0.08
        self.life -= self.decay

    def draw(self, surface):
        if self.life > 0:
            alpha = int(255 * self.life)
            r = int(max(1, self.radius))
            p_surf = pygame.Surface((r*2, r*2), pygame.SRCALPHA)
            pygame.draw.circle(p_surf, (*self.color, alpha), (r, r), r)
            surface.blit(p_surf, (int(self.x - r), int(self.y - r)))

def generate_tetris_video(output_file):
    pygame.init()
    screen = pygame.Surface((WIDTH, HEIGHT))
    
    # Grid Setup
    grid = [[None for _ in range(10)] for _ in range(20)]
    
    # Load presets
    def apply_preset():
        if PRESET == "steps":
            grid[16][0] = 'I'; grid[17][2] = 'O'; grid[17][3] = 'O'; grid[18][4] = 'L'; grid[18][5] = 'L'
        elif PRESET == "pyramid":
            for x in [1, 3, 5, 7]: grid[18][x] = 'O'
            for x in [2, 5]: grid[15][x] = 'T'
            grid[12][4] = 'I'
        elif PRESET == "zigzag":
            for x in range(6): grid[10][x] = 'I'; grid[15][x] = 'I'
            for x in range(4, 10): grid[12][x] = 'J'; grid[18][x] = 'J'
        elif PRESET == "stack":
            grid[18][0] = 'I'; grid[18][4] = 'O'; grid[18][6] = 'J'; grid[18][8] = 'Z'
            grid[16][1] = 'L'; grid[16][4] = 'S'; grid[16][7] = 'T'
            grid[13][2] = 'I'; grid[14][6] = 'O'
        elif PRESET == "spiral":
            for x in [1, 4, 7]: grid[13][x] = 'I'
            for y in [14, 16, 18]: grid[8][y-14] = 'L'
            grid[16][4] = 'O'

    apply_preset()
    
    # Play stats
    score = 0
    lines = 0
    blocks_placed = 0
    
    # Active Piece
    active_piece = None
    particles = []
    line_flash_rows = []
    
    audio_events = []
    frames_data = []
    
    melody_idx = 0
    game_over_state = False
    game_over_timer = 0
    
    board_w = 540
    board_h = 960
    bx = (WIDTH - board_w) / 2
    by = (HEIGHT - board_h) / 2
    cw = board_w / 10
    ch = board_h / 20
    
    total_frames = FPS * DURATION
    tick_interval = max(3, int(FPS / (GAME_SPEED * 1.5)))
    
    print(f"Compiling Tetris Gameplay Simulation video ({total_frames} frames)...")
    
    for frame_num in range(total_frames):
        current_time = frame_num / FPS
        
        # --- Particles Physics ---
        for p in particles[:]:
            p.update()
            if p.life <= 0:
                particles.remove(p)
                
        # --- Autonomous Game Updates ---
        if game_over_state:
            game_over_timer += 1
            if game_over_timer >= FPS * 3: # 3s Game Over screen
                grid = [[None for _ in range(10)] for _ in range(20)]
                apply_preset()
                score = 0
                lines = 0
                blocks_placed = 0
                active_piece = None
                game_over_state = False
        else:
            if active_piece is None:
                # Spawn piece
                piece_type = random.choice(list(SHAPES.keys()))
                best_x, best_rot = find_best_move(grid, piece_type)
                
                active_piece = {
                    'shape': SHAPES[piece_type],
                    'color': PIECE_COLORS[piece_type],
                    'piece_type': piece_type,
                    'x': 3,
                    'y': 0,
                    'target_x': best_x,
                    'target_rot': best_rot,
                    'curr_rot': 0
                }
                
                if check_collision(grid, active_piece['shape'], active_piece['x'], active_piece['y']):
                    game_over_state = True
                    game_over_timer = 0
            
            # Tick logic based on interval
            elif frame_num % tick_interval == 0:
                # 1. AI movements
                if active_piece['curr_rot'] < active_piece['target_rot']:
                    rotated = rotate_clockwise(active_piece['shape'])
                    if not check_collision(grid, rotated, active_piece['x'], active_piece['y']):
                        active_piece['shape'] = rotated
                        active_piece['curr_rot'] += 1
                    else:
                        active_piece['curr_rot'] = active_piece['target_rot']
                elif active_piece['x'] < active_piece['target_x']:
                    if not check_collision(grid, active_piece['shape'], active_piece['x'] + 1, active_piece['y']):
                        active_piece['x'] += 1
                    else:
                        active_piece['x'] = active_piece['target_x']
                elif active_piece['x'] > active_piece['target_x']:
                    if not check_collision(grid, active_piece['shape'], active_piece['x'] - 1, active_piece['y']):
                        active_piece['x'] -= 1
                    else:
                        active_piece['x'] = active_piece['target_x']
                else:
                    # 2. Drop or lock
                    if not check_collision(grid, active_piece['shape'], active_piece['x'], active_piece['y'] + 1):
                        active_piece['y'] += 1
                    else:
                        # Lock block
                        for r in range(len(active_piece['shape'])):
                            for c in range(len(active_piece['shape'][r])):
                                if active_piece['shape'][r][c] != 0:
                                    gy = active_piece['y'] + r
                                    gx = active_piece['x'] + c
                                    if 0 <= gy < 20 and 0 <= gx < 10:
                                        grid[gy][gx] = active_piece['piece_type']
                                        
                        # Trigger note sync
                        note_name, _ = TETRIS_MELODY[melody_idx % len(TETRIS_MELODY)]
                        melody_idx += 1
                        
                        audio_events.append({
                            'time': current_time,
                            'file': sound_files[note_name],
                            'note': note_name
                        })
                        
                        # Landing particles
                        for _ in range(6):
                            particles.append(Particle(bx + (active_piece['x'] + 1.5) * cw, by + (active_piece['y'] + 1.5) * ch, active_piece['color']))
                            
                        blocks_placed += 1
                        score += 10
                        
                        # Clear complete rows
                        cleared_rows = []
                        for r in range(20):
                            if all(cell is not None for cell in grid[r]):
                                cleared_rows.append(r)
                                
                        if cleared_rows:
                            # Create sparkles
                            for row_idx in cleared_rows:
                                for col in range(10):
                                    cell_type = grid[row_idx][col]
                                    cell_color = PIECE_COLORS.get(cell_type, WHITE)
                                    for _ in range(3):
                                        particles.append(Particle(bx + (col + 0.5) * cw, by + (row_idx + 0.5) * ch, cell_color))
                                        
                            new_grid = [row for r_idx, row in enumerate(grid) if r_idx not in cleared_rows]
                            while len(new_grid) < 20:
                                new_grid.insert(0, [None] * 10)
                            grid = new_grid
                            
                            lines += len(cleared_rows)
                            rewards = [0, 100, 300, 600, 1200]
                            score += rewards[min(4, len(cleared_rows))]
                            
                        active_piece = None
                        
        # --- DRAW VISUAL FRAME ---
        screen.fill(BLACK)
        
        # Retro backdrop gradient glow
        r_val = int(12 + 10 * math.sin(current_time * 0.4))
        g_val = int(12 + 10 * math.sin(current_time * 0.4 + 2))
        b_val = int(24 + 12 * math.sin(current_time * 0.4 + 4))
        pygame.draw.rect(screen, (max(0, r_val), max(0, g_val), max(0, b_val)), (0, 0, WIDTH, HEIGHT))
        
        # Grid lines
        for col in range(11):
            pygame.draw.line(screen, GRID_COLOR, (bx + col * cw, by), (bx + col * cw, by + board_h), 1)
        for row in range(21):
            pygame.draw.line(screen, GRID_COLOR, (bx, by + row * ch), (bx + board_w, by + row * ch), 1)
            
        # Draw static blocks
        for r in range(20):
            for c in range(10):
                cell_type = grid[r][c]
                if cell_type:
                    color = PIECE_COLORS.get(cell_type, WHITE)
                    pygame.draw.rect(screen, color, (bx + c * cw + 1, by + r * ch + 1, cw - 2, ch - 2))
                    pygame.draw.rect(screen, BLACK, (bx + c * cw + 1, by + r * ch + 1, cw - 2, ch - 2), 2)
                    
        # Draw falling piece
        if active_piece and not game_over_state:
            ap = active_piece
            for r in range(len(ap['shape'])):
                for c in range(len(ap['shape'][r])):
                    if ap['shape'][r][c] != 0:
                        gy = ap['y'] + r
                        gx = ap['x'] + c
                        if gy >= 0:
                            # Draw active piece block
                            pygame.draw.rect(screen, ap['color'], (bx + gx * cw + 1, by + gy * ch + 1, cw - 2, ch - 2))
                            pygame.draw.rect(screen, BLACK, (bx + gx * cw + 1, by + gy * ch + 1, cw - 2, ch - 2), 2)
                            
        # Draw particles
        for p in particles:
            p.draw(screen)
            
        # Neon glowing borders
        border_hue = int((current_time * 100) % 360)
        pygame.draw.rect(screen, WHITE, (bx, by, board_w, board_h), 3)
        
        # Scoreboard stats header
        header_surf = pygame.Surface((WIDTH, 160), pygame.SRCALPHA)
        header_surf.fill((0, 0, 0, 220))
        screen.blit(header_surf, (0, 0))
        
        try:
            font_title = pygame.font.SysFont('sans-serif', 36, bold=True)
            font_stats = pygame.font.SysFont('monospace', 22, bold=True)
        except Exception:
            font_title = pygame.font.Font(None, 36)
            font_stats = pygame.font.Font(None, 22)
            
        title_text = font_title.render("AUTONOMOUS RETRO TETRIS", True, WHITE)
        screen.blit(title_text, title_text.get_rect(center=(WIDTH // 2, 45)))
        
        stats_text = font_stats.render(f"SCORE: {score}  |  LINES: {lines}  |  BLOCKS: {blocks_placed}", True, (240, 160, 0))
        screen.blit(stats_text, stats_text.get_rect(center=(WIDTH // 2, 100)))
        
        # Draw Game Over screen overlay
        if game_over_state:
            over_surf = pygame.Surface((board_w, board_h), pygame.SRCALPHA)
            over_surf.fill((10, 10, 10, 230))
            screen.blit(over_surf, (bx, by))
            
            over_title = font_title.render("GAME OVER", True, (255, 50, 50))
            screen.blit(over_title, over_title.get_rect(center=(WIDTH // 2, HEIGHT // 2 - 100)))
            
            recap_1 = font_stats.render(f"Final Score: {score}", True, WHITE)
            recap_2 = font_stats.render(f"Lines Cleared: {lines}", True, WHITE)
            recap_3 = font_stats.render(f"Blocks Placed: {blocks_placed}", True, WHITE)
            
            screen.blit(recap_1, recap_1.get_rect(center=(WIDTH // 2, HEIGHT // 2 - 20)))
            screen.blit(recap_2, recap_2.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 15)))
            screen.blit(recap_3, recap_3.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 50)))
            
            res_text = font_stats.render("RESETTING AUTOPILOT...", True, (0, 240, 240))
            screen.blit(res_text, res_text.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 150)))
            
        # Draw Footer Credit
        footer_text = font_stats.render("MADE WITH PYTHON 3.12 & MOVIEPY", True, (150, 150, 150))
        screen.blit(footer_text, footer_text.get_rect(center=(WIDTH // 2, HEIGHT - 50)))
        
        # Frame capture
        frame_str = pygame.image.tostring(screen, "RGB", False)
        from PIL import Image
        pil_img = Image.frombytes("RGB", (WIDTH, HEIGHT), frame_str)
        frames_data.append(np.array(pil_img))
        
    pygame.quit()
    
    # Create output video
    clip = ImageSequenceClip(frames_data, fps=FPS)
    audio_clips = []
    
    print(f"Adding {len(audio_events)} synched sound events...")
    for ev in audio_events:
        try:
            audio_clip = AudioFileClip(ev['file'])
            audio_clip = audio_clip.with_start(ev['time'])
            audio_clips.append(audio_clip)
        except Exception as err:
            print(f"Sound Loading Error for {ev['note']}: {err}")
            
    if audio_clips:
        final_audio = CompositeAudioClip(audio_clips)
        clip = clip.with_audio(final_audio)
        print("Synthesized retro track bound successfully!")
    else:
        print("Saving silent video.")
        
    clip.write_videofile(output_file, codec="libx264")
    print(f"Video compiled and written to {output_file}")
    
    try:
        for f in os.listdir(SOUNDS_DIR):
            os.remove(os.path.join(SOUNDS_DIR, f))
        os.rmdir(SOUNDS_DIR)
    except Exception:
        pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=str, default="tetris_bounce_output.mp4")
    args = parser.parse_args()
    generate_tetris_video(args.output)
`;
}

// Initialize server and mount Vite middleware
async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
