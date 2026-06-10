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
- The enemy can attack directly after the early game.
- Distance is tracked separately from score, and the run moves through different zones.
- Keeping a combo gives FLOW rewards that slightly push the enemy back.

## Zones

The same background assets are reused, but the game changes lighting, color, speed pressure, and enemy pressure by distance.

- `WARD`: the opening area.
- `BLACKOUT`: starts around 300m. The screen darkens and lights flicker more.
- `RED ZONE`: starts around 750m. Red warning lighting and enemy pressure increase.
- `PANIC`: starts around 1300m. Speed and enemy attack pressure become stronger.

## Enemy Attacks

- Knife throw: unlocked after 18 seconds. A red warning line appears, then a knife flies from left to right. Jump to avoid it. Running or sliding into it increases the enemy distance gauge.
- Frenzy dash: unlocked after 38 seconds and difficulty level 2. The enemy rushes forward for about 7 seconds. Avoiding obstacles during this phase is more important because misses increase the distance gauge more.
- Grapple: unlocked after 70 seconds and only when the enemy is already close. Press Jump or Slide repeatedly to shake free. Success lowers the distance gauge; failure raises it sharply.

During grapple, PC players can mash `Space`, `ArrowUp`, or `ArrowDown`. Mobile players can mash the `JUMP` or `SLIDE` buttons.

## Files

```text
index.html
style.css
game.js
README.md
```
