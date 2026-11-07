# Mud Masters: Build & Smash

A dependency-free, touch-friendly HTML5 Canvas mini-game for kids ages 4–9. Build a mud structure, decorate it, smash it with silly tools, then clean the splats.

## Run locally

Open `index.html` in a browser, or serve the folder with any static server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Architecture

- `GameEngine` — responsive canvas loop, phases, pointer interactions, and game state.
- `ParticleSystem` — mud, water, and debris bursts.
- `SoundController` — Web Audio hooks for squish, splash, pop, thud, and cheer.
- `UIManager` — phase controls, prompts, and kid-friendly feedback.

The project has no external runtime dependencies.
A touch-friendly HTML5 Canvas mini-game for building and smashing mud structures.
