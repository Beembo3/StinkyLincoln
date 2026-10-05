# 🐶 Stinky Lincoln

A cozy pixel-art virtual pet game starring **Lincoln**, a scruffy brown-and-white dog who
is a very good boy and a very bad bather.

> **The twist:** bathing Lincoln is *not* easy. Washing him is the chaotic, funny,
> near-impossible core challenge of the whole game.

See [`LINCOLN_GAME_FLOW.md`](./LINCOLN_GAME_FLOW.md) for the full design.

## Tech stack

- **Vite + TypeScript** for the build/dev server.
- **Phaser** for rendering, input, tweens, and scenes.
- Portrait 480×800 logical resolution, scaled to fit the screen.

## Getting started

```bash
npm install
npm run dev      # start the dev server (opens http://localhost:5173)
npm run build    # typecheck + production build into dist/
npm run preview  # preview the production build
```

## Phase 1 — Core loop skeleton (done)

- 🐕 Lincoln idle animation (placeholder pixel sprite, drawn in code)
- 📊 Five stat bars — Food, Water, Fun, Energy, Cleanliness
- 🍖 Feed · 🎾 Play · 😴 Sleep actions
- ✋ Tap Lincoln to pet him
- ⏳ Stats decay in real time; an in-game clock / day counter ticks along
- 🌫️ Stink cloud that grows as cleanliness drops

## Phase 2 — Bath mini-game (done)

The chaotic centrepiece, launched as an overlay scene over a paused room:

- **Catch stage** — Lincoln sprints and dodges; drag a net (pointer or arrow keys) onto him
  while he hops the furniture and periodically shakes you off.
- **Scrub stage** — mash **SCRUB** (or Space) before his next shake knocks progress back.
- 💦 Every shake splashes mud/water, raising **room mess** and **water level**.
- 📉 Results: best case **cleanliness +10%**, worst case **−5%** and a soaked room. Mess and
  water carry back into the room, where puddles and grime become visible.
- 🔗 Scenes now share a single game state via `src/state/store.ts`.

## Feed him too much and he pops 💥

- Every feed adds **Chonk** (a sixth stat bar). His sprite visibly inflates as it climbs.
- Chonk slowly digests away on its own — stop feeding and he deflates.
- Push it to 100 and Lincoln **pops**: screen shake, fur/kibble burst, and a big **POP!**
  He then deflates to nothing, loses cleanliness, and leaves a huge mess behind.
- His face bubble turns 😵 when he's near bursting.

## Phase 3 — Save/load, day cycle & moods (done)

- 💾 **Save/load** to `localStorage` (`src/state/save.ts`), auto-saved every 5s, on tab
  hide, and before unload. Missing fields in old saves are back-filled.
- 🌙 **Offline progression** — time away is simulated on load, capped so a long break
  doesn't destroy him.
- 🌗 **Day/night cycle** — the room darkens at night; a new day raises a banner.
- 😴 **Sleep** — runs through to 7:00 at night, or a 2-hour power nap during the day,
  with a screen fade.
- 😄 **Mood expressions** — a face bubble above Lincoln reflects his mood (and panic when
  he's about to pop).
- ↺ A small **New game** button sits in the HUD (top-right of the panel).

## 🌙 Sleep: "Bedtime Zoomies" mini-game

Tapping **Sleep** now kicks off Lincoln's pre-bed sprint instead of skipping time:

- Pick a difficulty: **Easy** (1 grab, slow), **Normal** (2 grabs), **Hard** (3 grabs, fast).
- Lincoln bolts around the hallway and hops the furniture; you move a **pair of hands**
  and **snap them shut** (tap / click / Space) when he's between them.
- Each grab makes him faster; each miss makes him bolt away. A timer tracks how quickly
  you tuck him in.
- Catching him resolves the night: time skips, energy is restored, and harder difficulties
  award more **bond**.
- Give up any time with **Never mind** (no time passes).

## 👕 The Closet

A wardrobe of **12 outfits** you can swap onto Lincoln any time:

`Natural · Tuxedo · Hoodie · Raincoat · Cowboy · Wizard · Hawaiian · Sweater · Superhero · Pajamas · Santa · Bunny`

- Opened from the **Closet** button; a grid of live previews, tap to wear, gold highlight
  shows the equipped look.
- Outfits are definition-driven pixel overlays (`src/config/outfits.ts`) drawn on top of the
  base sprite — Lincoln wears them everywhere (room, bath chase, and bedtime chase).
- The choice is saved and persists across reloads.

## 🚪 Loading screen, logo & audio

- **Splash / loading page** (`BootScene`): the logo, an animated load bar, and a
  **Tap to start** prompt. The tap also unlocks the browser's audio.
- **Logo**: drawn in code to match the artwork (wooden sign, gold "Stinky Lincoln",
  bone, paw print, flowers and Lincoln peeking over the top). To use the real PNG, drop
  it at `public/logo.png` and set `USE_LOGO_IMAGE = true` in `src/scenes/BootScene.ts`.
- **Audio** (`src/audio/audio.ts`) is fully synthesized with the Web Audio API — no files:
  - a cozy looping chiptune background track,
  - UI/sfx (clicks, snaps, coins, splash, pop, sleep chime, happy arpeggio),
  - an **"arf arf"** bark for Lincoln (petting him barks).
- A **🔊 mute** toggle sits in the HUD (next to the New-game ↺ button).

## 🛒 Shop & upgrades

Coins are earned by caring (feed/play/pet, good baths). The Shop unlocks on **Day 5**
and sells the doc's five upgrades:

| Item | Cost | Effect |
|------|-----:|--------|
| 🧴 Fancy Shampoo | 30 | Baths end +4% cleaner |
| 🧺 Fluffy Towels | 25 | Halve bath mess & water |
| 🦴 Treat Jar | 20 | Feeding fills him more (+bond) |
| 🛁 Deluxe Tub | 40 | Never lose cleanliness in a bath |
| 📖 Doggy Dad Jokes | 15 | Playing is funnier (+fun, +bond) |

## 📈 Progression & endings

Following the design doc's timeline:

- **Day 5** — Shop unlocks.
- **Day 10** — **Calm Down** button appears (soothes him, +fun/bond, 15s cooldown).
- **Day 15** — the finale. Your care decides the ending:
  🏆 **Squeaky Clean** · 💀 **Legendary Stink** · 💛 **True Bond**.
  The ending screen shows your stats and offers a fresh start or to keep playing.

## 🌦️ Phase 6 — Stretch ideas

- **Weather** re-rolls each day (☀️ Sunny / 🌧️ Rainy / 🟤 Muddy) and is shown top-centre.
  Rain/mud make cleanliness decay faster and actions much messier (only Sunny is clean);
  rain streaks fall across the room during bad weather.
- **🐾 The Great Smell-Off** — the Rival button compares Lincoln's stink against Bruno,
  the neighbour's scruffy grey dog, complete with stink clouds and meters. Bragging rights
  and **+5 coins** if Lincoln is the cleaner one (once per day).
- **🦝 Lincoln's revenge** — when he's filthy (cleanliness < 30), trying to bath him can
  set him hiding the shampoo: the Bath is blocked until you **pet Lincoln** to search for it
  (finding it earns a couple of coins).

## ⛈️ Phase 7 — Thunderstorms & the table

- A **wooden table** now sits in the room.
- During **Rainy / Muddy** weather, occasional **thunder** rolls in: screen flash + shake
  plus a synthesized **thunderclap** (deep boom, rumble and crack).
- When it thunders, Lincoln **bolts under the table**, trembles, and wears a 😨 face.
  He can't be petted while hiding and scurries back out once the rumble passes.

## Roadmap

- **Phase 1 — Core loop skeleton** (done)
- **Phase 2 — Bath mini-game** (catch + scrub), mess/water consequences (done)
- **Phase 3 — Save/load, day cycle polish, moods & expression** (done)
- **Phase 4 — Feed/chonk pop, bedtime-zoomies sleep game, Closet outfits** (done)
- **Phase 5 — Loading/logo, audio, Shop & upgrades, progression & endings** (done)
- **Phase 6 — Weather, rival smell-off, shampoo revenge** (done)
- **Phase 7 — Thunderstorms, table & hiding behaviour** (done)

## Project layout

```
src/
  main.ts              # Phaser game config + bootstrap
  config.ts            # constants, palette, stat defs, decay & action tuning
  config/
    outfits.ts         # Closet outfit data (pixel overlay maps)
    shop.ts            # shop items + progression day milestones
    weather.ts         # weather table + effects
  audio/
    audio.ts           # synthesized music, SFX and Lincoln's bark (Web Audio)
  state/
    types.ts           # GameState model
    gameState.ts       # simulation: decay, mood, stink, actions, overfeed pop, sleep, endings
    store.ts           # shared game-state singleton
    save.ts            # localStorage save/load + offline progression
  scenes/
    BootScene.ts       # splash / loading page + logo + audio unlock
    RoomScene.ts       # the main room: art, HUD, buttons, input, day cycle, weather
    BathScene.ts       # the bath mini-game (catch + scrub + results)
    SleepScene.ts      # bedtime-zoomies catch game (difficulty, two-hand snap)
    ClosetScene.ts     # outfit wardrobe
    ShopScene.ts       # coin shop / upgrades
    RivalScene.ts      # Bruno the rival — the great smell-off
    EndingScene.ts     # Day-15 finale
  ui/
    pixelArt.ts        # base pixel sprite + drawPixelMap helper
    lincoln.ts         # drawLincoln (base + outfit) + sprite dimensions
    logo.ts            # procedural Stinky Lincoln logo
    StatBar.ts         # one stat bar
    ActionButton.ts    # one rounded action button
```
