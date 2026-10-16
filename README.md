# CRT TV Frame

A browser extension that frames YouTube videos, and most other videos on the web, in an old television set instead of plain black bars.

- **4:3 videos** (old shows, music videos) get a full 70s-style set: wood cabinet, chrome trim, and a side panel with a channel dial, volume knob, power light and speaker grille.
- **Widescreen videos** get a slimmer bezel with the knobs and badge in the "chin" below the screen.
- The tube has rounded "pillow" corners, light scanlines and curved-glass glare (both adjustable).
- If the TV doesn't fill the player, the space around it is a dim wall instead of black bars. Rabbit-ear antennas show up when there's room above.
- The power light is on while the video plays.

![A 4:3 video in the 70s walnut set](screenshots/4x3-video-walnut.png)

![A widescreen video in the 60s red set](screenshots/16x9-video-red.png)

## Install (Chrome, Edge, Brave, Opera, Arc)

1. Download or clone this repository somewhere you'll keep it.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and pick the folder (the one that contains `manifest.json`).
5. Open a YouTube video. Pin the extension icon to get to its settings.

## Install on iPhone or iPad (Safari)

Phone browsers can't load this extension, so on iOS the frame runs as a userscript in Safari: [`crt-tv-frame.user.js`](crt-tv-frame.user.js), built from the same code.

1. Install the free [Userscripts](https://apps.apple.com/app/id1463298887) app from the App Store and open it once.
2. Turn it on: **Settings → Apps → Safari → Extensions → Userscripts** (on iOS 17 and earlier: **Settings → Safari → Extensions**). Switch it on and set **All Websites** to **Allow**.
3. In Safari, open
   `https://raw.githubusercontent.com/MmedaraJ/old-tv-extension/main/crt-tv-frame.user.js`
4. Tap the extensions button in the address bar (the puzzle piece, or **AA** on older iOS), tap **Userscripts**, then tap **Install**.
5. Go to [m.youtube.com](https://m.youtube.com) in Safari and play a video.

To change the style, open the Userscripts app, edit the settings block at the top of the script (`theme: 'red'`, `scanlines: 0` and so on), and save.

Good to know:
- **It has to be Safari.** Apple only lets Safari run extensions, so Brave, Chrome, Firefox and other browsers on iPhone and iPad can't show the frame. You can keep using Brave for everything else and open YouTube in Safari.
- It doesn't work in the YouTube app. Nothing can change that app.
- **iPhone fullscreen = TV mode.** iPhone's real fullscreen hands the video to Apple's own player, which nothing can draw on. So on iPhone, YouTube's fullscreen button switches to TV mode instead: the player fills Safari's window with the frame on. Turn the phone sideways for the full set. Tap fullscreen again, or **Exit TV**, to go back. To use Apple's player instead, set `tvMode: false` in the script settings.
- **iPad:** Safari loads YouTube's desktop layout, which gets the full knob-panel TV. YouTube fullscreens its whole player on iPad, so the frame should stay in fullscreen too.

## Install on Android

Use Firefox for Android: add [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/) from Firefox's add-ons menu, then open the `crt-tv-frame.user.js` link above and accept the install prompt.

## Settings (click the toolbar icon)

<img src="screenshots/settings-popup.png" alt="Settings popup" width="320">

| Setting | What it does |
| --- | --- |
| Master switch | Turns the frame on or off everywhere |
| On this site | Turns it off for just the current site |
| Cabinet | 70s Walnut, 80s Black, 90s Beige, 60s Red |
| Frame size | Thicker or thinner bezel |
| Scanlines | 0 = off |
| Curved glass & glare | Edge vignette and reflection on the tube |
| Knob panel | Use the side panel with dials when there's room |
| Badge text | The label on the set (default "SOLID STATE") |

Changes apply right away to open tabs.

## How it works

The content script finds every `<video>` and measures where the picture actually sits (it handles `object-fit` and players like YouTube that size the video element themselves). It then draws the TV as an SVG over the player. The SVG is see-through only where the screen is, and lets clicks pass through. If there's no black-bar space to put the frame in, it shrinks the picture slightly with CSS `scale`/`translate` so the frame doesn't cover any of the video. Turning the extension off puts everything back.

The userscript is generated from `frame.js` and `content.js`. After changing those, rebuild it with `node scripts/build-userscript.mjs`. Don't run the extension and the userscript in the same browser, or you'll get two frames.

## Limitations

- If a site puts the bare `<video>` element itself into fullscreen, browsers don't let anything draw on top of it, so you won't see the frame there. YouTube, Vimeo, Twitch and most players fullscreen their whole player, so it works on those.
- Videos smaller than 280×150 (thumbnails, hover previews) and muted looping background videos are skipped.
- A frame needs room, so a 16:9 video in a 16:9 player shrinks a bit. Use **Frame size** to pick how much.

## Firefox

Add this to `manifest.json`, then load it from `about:debugging` → *This Firefox* → *Load Temporary Add-on*:

```json
"browser_specific_settings": { "gecko": { "id": "crt-tv-frame@example.com" } }
```
