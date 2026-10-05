# 🐶 Lincoln — Pixel Tamagotchi Game

> **Concept:** A cozy pixel-art virtual pet game starring **Lincoln**, a scruffy brown-and-white dog.
> Feed him, play with him, take care of him... but there's a twist.
>
> **The Twist:** Bathing Lincoln is **NOT easy**. Washing him is the chaotic, funny, near-impossible core challenge of the whole game.

---

## 🎮 Core Concept

| Item | Details |
|------|---------|
| **Genre** | Virtual Pet / Tamagotchi / Cozy Chaos |
| **Protagonist** | Lincoln — pixelated brown & white dog |
| **Platform** | Mobile / Web (portrait, one-hand) |
| **Art Style** | Pixel art, warm brown/cream palette |
| **Emotional Hook** | Love the dog, fear the bath |
| **Theme** | "You can love him without cleaning him... but the smell grows." |

---

## 🔑 Core Mechanic Summary

- **Easy:** Feed, play, pet, sleep.
- **Hard:** Bath / wash / clean.
- **Why:** Lincoln hates water. He runs, hides, shakes, and sabotages every attempt.
- **Result:** The cleaner you try to make him, the more chaos you create.

---

## 🔄 Main Game Loop

```
        ┌─────────────────────────────┐
        │        START DAY            │
        └──────────────┬──────────────┘
                       │
                       ▼
        ┌─────────────────────────────┐
        │   Lincoln has needs:        │
        │   🍖 Hunger   🎾 Fun        │
        │   😴 Energy   💧 Thirst     │
        │   🧼 Cleanliness (DANGER)   │
        └──────────────┬──────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
  ┌───────────────┐        ┌────────────────┐
  │ EASY ACTIONS  │        │  HARD ACTION   │
  │ Feed / Play   │        │  ★ BATH TIME ★ │
  │ Pet / Sleep   │        │  (Chaos Zone)  │
  └───────┬───────┘        └────────┬───────┘
          │                         │
          ▼                         ▼
  ┌───────────────┐        ┌────────────────────────┐
  │ Lincoln happy │        │ Lincoln ESCAPES /      │
  │ Stats up      │        │ Messes / Shakes water  │
  └───────┬───────┘        │ → Cleanliness barely ↑ │
          │                │ → Chaos meter ↑        │
          │                └───────────┬────────────┘
          │                            │
          └────────────┬───────────────┘
                       ▼
        ┌─────────────────────────────┐
        │  Time passes / Stats decay   │
        │  Smelliness grows 🌫️         │
        └──────────────┬──────────────┘
                       │
                       ▼
        ┌─────────────────────────────┐
        │   Mood & Score update        │
        │   Bond + Reputation change   │
        └──────────────┬──────────────┘
                       │
                       ▼
                 LOOP AGAIN
```

---

## 🧩 Detailed Sub-Flows

### 1. 🍖 Feed Flow
```
Hunger low → Open food menu → Choose food → Lincoln eats
→ Hunger ↑, Happiness ↑ → Mess/Stink chance ↑ (small)
```

### 2. 🎾 Play Flow
```
Fun low → Pick toy → Mini toss/chase game
→ Fun ↑, Energy ↓ → Dirt ↑ (rolling around)
```

### 3. 😴 Sleep Flow
```
Energy low → Tap lamp → Screen dims → Time skips
→ Energy ↑, Hunger ↓, Cleanliness ↓
```

### 4. 🧼 BATH FLOW (The Twist) ★
```
Cleanliness critical
        │
        ▼
  Player taps "Bath"
        │
        ▼
  Lincoln SPRINTS away
        │
        ▼
  Mini-game: Catch Lincoln
   ├── Run left/right
   ├── Dodge furniture
   ├── Lincoln shakes → mud splashes
   └── Water spills → floor mess
        │
        ▼
  CATCH him → place in tub
        │
        ▼
  Scrub mini-game (button mash)
        │
        ▼
  Lincoln shakes EVERYTHING off
        │
        ▼
  RESULT:
   - Best case: Clean +10% (slightly cleaner)
   - Worst case: Clean -5% AND room is soaked
```

### 5. 🌫️ Smell / Consequence Flow
```
Cleanliness low + time passes
        │
        ▼
  Stink Cloud appears around Lincoln
        │
        ▼
  Effects:
   - Happiness ↓
   - Room dirtiness ↑
   - "Smell score" on HUD ↑
   - Guests / other pets avoid him
```

---

## 📊 Game State Model

```
LINCOLN STATE
├── Hunger        (0–100)
├── Fun           (0–100)
├── Energy        (0–100)
├── Thirst        (0–100)
├── Cleanliness   (0–100)  ← the hard one
├── Mood          (Happy / Neutral / Grumpy / Furious)
└── Bond          (0–100)  ← grows over time

WORLD STATE
├── Room Mess     (0–100)
├── Water Level   (tub/mess)
└── Stink Meter   (0–100)  ← rises when Cleanliness dips
```

---

## 🖥️ Screen / UI Flow

```
Splash → Home (Room)
            │
            ├── Feed Screen
            ├── Play Screen
            ├── Sleep Screen
            ├── Bath Mini-game
            ├── Stats / HUD
            └── Shop / Upgrades
                   │
                   └── (Shampoo, Towels, Treats,
                        Better Tub, Doggy Dad Jokes)
```

---

## 📈 Progression / Progression Loop

```
Day 1 ──► Learn basic care
Day 3 ──► First enforced bath (fails comically)
Day 5 ──► Unlock shop items
Day 7 ──► Lincoln learns new escapes
Day 10 ─► Master "Calm Down" mechanic
Day 15 ─► Reach "Squeaky Clean" ending
         OR "Legendary Stink" ending
```

**Endings:**
- 🏆 **Squeaky Clean** — mastered the bath struggle.
- 💀 **Legendary Stink** — surrendered to the smell.
- 💛 **True Bond** — loved him dirty or clean.

---

## ✅ MVP Scope (First Build)

- [ ] Lincoln idle animation (pixel sprite)
- [ ] 4 stat bars + cleanliness
- [ ] Feed / Play / Sleep actions
- [ ] Basic Bath mini-game (catch + scrub)
- [ ] Stink cloud visual
- [ ] Day/time cycle
- [ ] Save/Load

---

## 🚀 Stretch Ideas (Later)

- Weather affecting mud/dirt
- Other pets to compare smells
- Multiplayer "whose dog smells worse?"
- Cosmetic collars & hats
- Lincoln's revenge: hiding your shampoo

---

*“He’s a good boy. He’s just... a little stinky.”*
