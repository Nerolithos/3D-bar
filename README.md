# 3D-bar

First-person WebGL presentation of Lithos' Bar. The site is a standalone Vite project for Cloudflare Pages.

## Local development

Requirements: Node.js 20.20 or newer.

```bash
npm install
npm run dev
```

Production check:

```bash
npm test
npm run build
npm run preview
```

## Publish to GitHub

The repository is already initialized on branch `main`. Create an empty GitHub repository, then run:

```bash
git add .
git commit -m "Publish Lithos Bar 3D"
git remote add origin https://github.com/YOUR_ACCOUNT/3D-bar.git
git push -u origin main
```

Replace `YOUR_ACCOUNT` with your GitHub account name. No commit or remote is created automatically.

## Cloudflare Pages

In Cloudflare Dashboard, open **Workers & Pages**, choose **Create application**, then **Pages** and **Connect to Git**. Select the GitHub repository and enter:

| Field | Value |
| --- | --- |
| Project name | `3d-bar` |
| Production branch | `main` |
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Leave blank |
| Environment variables | None |

Select **Save and Deploy**. Every later push to `main` creates a production deployment; other branches receive preview URLs.

## Static assets

The bar, horror room, pool portal room, elevator, reusable library shelf, ceiling fixture, fantasy-book door, key, and eye model live under `public/models/` with content-hashed filenames. The optimized elevator is `elevator-b6e14779.glb` (about 80 KB), `bookshelf-1651bc85.glb` retains its original book geometry below 100 KB, and `ceiling-ab0e0502.glb` stays below 30 KB. The door-derived cover is `wood_door-68fb2c4e.glb` at 9,684 bytes, `key-b07613f7.glb` is 4,336 bytes, and the 2.1 MB source eye is packaged as `eye-7bc5b3e3.glb` at about 27 KB with 256 px WebP textures and Meshopt geometry. Untouched source GLBs remain in the parent Blender workspace. Cloudflare serves packaged assets with a one-year immutable cache through `public/_headers`. Never replace bytes at an existing model URL: after changing a model, update the digest suffix plus the paths in the relevant source module and `scripts/validate-site.mjs`.

Open `/hr2` (for example, `http://localhost:4173/hr2`) to load directly into the horror room without running or downloading the bar sequence first.
Open `/hr3` to load directly into the horror room with the pool chapter completed and the Yog-Sothoth television unlocked.
Open `/yog` to load directly inside the closed elevator after surviving the library blackout, with the reward book ready outside and the key still inserted in the elevator panel.

Regenerate and validate these scenes with Blender 5.2:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python ../scripts/create_cozy_bar.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python ../scripts/validate_room_materials.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python ../scripts/create_horror_room.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python ../scripts/validate_horror_room.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python ../scripts/create_pool_room.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python ../scripts/validate_pool_room.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python ../scripts/optimize_oxidized_faucet.py
```

Inserting the revealed `CIDER` card starts the horror-room preload. The abstract keypad decodes to `42425142`; crossing the opened doorway disposes the bar scene. Returning to the bar then requires a hard browser refresh.

Entering the horror room unlocks and preloads the leftmost pool television (`pool-01`), whose screen shows a toy duck and the red title `Dagon`. Clicking it after loading plays the portal pull animation and places the player at the validated pool spawn. The horror room remains hidden and reusable, while the cached pool scene retains puzzle progress across returns. The pool room uses a shared three-wave Gerstner shader, window-localized animated floor caustics, a clear lightly filtered ceiling mirror, literal openings assembled into the back wall, soft radial Tyndall haze, and linked instances of the optimized oxidized faucet. The right-wall faucets form a vertical map of all seven floating props. Each of the three ducks rotates independently in 45° steps; matching all three beaks to their mapped faucet directions raises a straight brushed-metal ladder to half-room height.

The submerged television behind the pool spawn reuses the optimized CRT model. Its power control starts a five-second red countdown followed by three seconds of visible electrical discharge and smoke. Standing in the water or on the ladder causes a blackout and returns the player to the horror room without erasing pool progress. The blue inflatable mattress is an interactive insulated refuge; surviving there while the duck puzzle is solved extends the ladder to the ceiling. Climbing the full ladder crosses the mirror, returns to the preserved horror room, and unlocks `CRTScreen_07` as the `Yog-Sothoth` portal. Its door preview leads to a flickering elevator embedded in a collision-backed opening in the fourth library wall. The room uses dark aged wax-yellow wallpaper, the restored dark floor, and optimized ceiling fixtures controlled by the white switch outside the elevator. A single imported brass key begins on the elevator floor, moves visibly into the player's right hand when collected, and can occupy only one place at a time: the native panel keyhole enables the two central door leaves, the exterior switch keyhole enables the library lights, and the final book keyhole releases its cover. Clicking the full panel or switch inserts a held key, while aiming at an inserted key removes it. Turning the lights off fully extinguishes ambient, elevator, and ceiling lights while playing six glowing eyes in left-right-center-right-left-center order; the sequence can be replayed before success. After the lights return, the same pull/return sequence on three shelf-aligned books makes the lights flash, then the three ceiling rows fade from the far wall toward the elevator over 11.4 seconds. The player must walk back inside and fully close the doors; dark zones add a fine, tapered red vascular vignette and blur, while failure triggers an eye jumpscare and resets the library from the preserved horror room. After three safe seconds the elevator lamp becomes steady, its controls unlock, and the library fixtures return to their original warm-white color. A thick fantasy book then appears on the center table. Its cover reads as a miniature carved wooden door with raised frame, recessed panels, hinges, and a projecting brass lever handle. The raised book lock and inserted key are children of the hinged cover, so both rotate with it. Opening the book reveals a dense three-dimensional mound built from the compressed `eye.glb`; the same shared geometry and material then infect the table and every shelf bank in stages. All 123 eyes continuously face the player. The 52 book eyes span a much wider size range, while infected eyes grow with their distance from the book so far shelves remain readable. One dynamic instanced draw call and a single 256 px texture set keep memory bounded. The blink transition waits eleven seconds so the spread remains visible before the deferred surgery-room transition.

The library keeps its three interactive shelf units independent, while its twelve decorative shelf units use two shared instanced draw batches. Programmatically generated walls, furniture, doors, books, and diffusers reuse box geometries by dimensions, and the eye sprites share one material. Entering this portal also releases the hidden horror room's GPU buffers while retaining its object state and downloaded data for a no-network return. This preserves the scene appearance while reducing Object3D count, geometry buffers, draw calls, per-frame allocations, and peak GPU memory.

The interactive glass and ice derivatives live under `public/models/interactive/`. Regenerate them from the untouched root-level source GLBs with Blender 5.2:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python ../scripts/optimize_patch2_props.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python ../scripts/validate_patch2_props.py
```

The optimizer removes source placeholders, simplifies the ice, creates content-hashed filenames, and keeps each derivative below 500 KB. Update the immutable URLs in `src/glass-prop.js` and `scripts/validate-site.mjs` whenever regenerated bytes change.

The lighting rig is implemented in `src/main.js` because glTF does not preserve Blender area lights, world lighting, or Eevee color management. Keep the named `webLightRig` values intact when changing unrelated controls.
