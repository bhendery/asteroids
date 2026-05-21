# Asteroids

A small browser arcade with two games sharing one canvas:

- **Asteroid Shooter** — fly a ship, blast asteroids and alien saucers, dodge debris.
- **Space Chess** — standard chess where the pieces are aliens. Two players, shared keyboard.

## Run

No build step. Open `index.html` in a browser, or serve the directory:

```sh
python3 -m http.server
```

Then visit http://localhost:8000.

## Controls

**Asteroid Shooter** — Arrows or WASD to move, Space to fire.

**Space Chess** — Click a piece to select, click a highlighted square to move. Pawns auto-promote to queens.

## Files

- `index.html` — markup and screens
- `game.js` — Asteroid Shooter
- `chess.js` — Space Chess
- `style.css` — styles
