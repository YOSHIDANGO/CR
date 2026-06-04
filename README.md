# RED KNIFE CHASE

A mobile landscape horror side-scrolling runner.
The player runs automatically to the right while a woman in a red dress chases from the left.

## Run

Open `index.html` directly in a browser. No external libraries or image assets are required.

You can also test with a local server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Controls

### PC

- `Space` / `ArrowUp`: Jump
- `ArrowDown`: Slide
- `P`: Pause
- `Enter`: Retry after game over

### Mobile

- Right-side `JUMP` button: Jump
- Left-side `SLIDE` button: Slide
- Tap the right half of the canvas: Jump
- Tap the left half of the canvas: Slide

Landscape orientation is recommended.

## Gameplay

- Dodge obstacles to increase score and combo.
- Hitting an obstacle reduces the distance from the enemy.
- The distance gauge fills as the enemy gets closer.
- Game over occurs when the enemy catches the player.
- Difficulty increases gradually through scroll speed and spawn timing.
- When the enemy is close, the screen shakes and red danger effects flash.

## Files

```text
index.html
style.css
game.js
README.md
```
