# Asteroid Shooter

A small browser arcade with two games sharing one canvas: a classic Asteroids-style shooter and a space-themed chess match.

## Run

Open `index.html` in a browser, or serve the folder with any static server:

```sh
python3 -m http.server
```

Then visit http://localhost:8000.

## Games

- **Asteroid Shooter** — Arrows / WASD to move, Space to fire. Large asteroids split into smaller ones; pink alien saucers show up to make things interesting. Difficulty ramps over time.
- **Space Chess** — Standard chess rules with alien-themed pieces. Pawns auto-promote to Queens. Two players share the keyboard.

## Files

- `index.html` — markup and screens
- `game.js` — Asteroids game loop
- `chess.js` — chess logic
- `style.css` — styling
