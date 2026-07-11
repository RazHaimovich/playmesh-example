# Asset prompts - GPT image generator (gpt-image-1 / DALL·E)

Shared style - paste this prefix before every prompt so all assets match:

> **STYLE:** Cute flat 2D game art for young children, soft rounded shapes, thick subtle outlines, pastel palette, kawaii style, clean vector look, no text, no watermark.

Only 5 images are needed. Avatar colors are done in-game by tinting the single white avatar, so do NOT generate per-color avatars.

---

## 1. `avatar.png` - base avatar (tintable)

- Size: 1024×1024, **transparent background**

> STYLE + A single cute round blob creature mascot, pure white body with light gray soft shading only (it will be color-tinted in the game engine, so no colored areas), big friendly black eyes, tiny smile, small stubby arms, slight rosy-free cheeks, front-facing, centered, full body visible, transparent background.

## 2. `bg_meadow.png` - Sunny Meadow room

- Size: 1536×1024

> STYLE + A wide sunny meadow game background for a children's game: rolling green hills, scattered daisies and tulips, one big friendly tree on the left, fluffy round clouds, bright blue sky, large open flat grassy area in the center-bottom for characters to walk on, no characters, no text.

## 3. `bg_beach.png` - Sandy Beach room

- Size: 1536×1024

> STYLE + A wide sandy beach game background for a children's game: soft yellow sand, gentle turquoise sea with rounded waves at the top third, one palm tree on the right, a starfish and a bucket as small props near the edges, sunny sky with fluffy clouds, large open flat sand area in the center-bottom for characters to walk on, no characters, no text.

## 4. `bg_forest.png` - Starry Forest room

- Size: 1536×1024

> STYLE + A wide magical night forest game background for a children's game: dark teal sky full of twinkling stars and a smiling crescent moon, rounded pine trees on both sides, glowing fireflies, soft glowing mushrooms near the tree trunks, cozy not scary, large open flat mossy area in the center-bottom for characters to walk on, no characters, no text.

## 5. `logo.png` - game logo mark

- Size: 1024×1024, **transparent background**

> STYLE + A cheerful game logo emblem: a round badge with a tiny white blob mascot peeking over a green hill, a sun and two small clouds behind it, rainbow accent arc, no letters, no text, transparent background.

---

Export tips: save avatar + logo as PNG with transparency; backgrounds as PNG or JPG. Drop all files into `game/public/assets/`.
