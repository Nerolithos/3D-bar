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

The current model lives at `public/models/cozy_bar_v005-411bbe69.glb`. Cloudflare serves it with a one-year immutable cache through `public/_headers`. The suffix is derived from the GLB SHA-256 digest. Never replace bytes at an existing model URL: after changing the model, update the digest suffix plus the paths in `index.html`, `src/main.js`, and `scripts/validate-site.mjs`.

The lighting rig is implemented in `src/main.js` because glTF does not preserve Blender area lights, world lighting, or Eevee color management. Keep the named `webLightRig` values intact when changing unrelated controls.
