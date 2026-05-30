# PuffinPuff 海鸚泡芙

## One Splash, Three Platforms

**One video, one click — publish to YouTube Shorts, Facebook Reels, and Instagram Reels simultaneously.**

[Download v0.2.4 (Windows)](#download) 　 [📘 User Guide](#guide) 　 [📧 Contact](mailto:bisharing001@gmail.com)

---

## Why PuffinPuff?

In the short-form video era, "**one piece of content, three platforms**" is the baseline distribution move for creators. In practice you'll run into:

- 🔁 Opening 3 apps for the same video, filling title/description/hashtags 3 times
- 📅 Each platform's scheduling UI is different, with different rules
- ⏰ FB / IG don't allow scheduling > 6 days out; YouTube has its own privacy rules
- 🎬 HEVC / 4K / vertical videos often fail to upload to IG
- 📊 After publishing, you don't know which platforms succeeded or where to check

PuffinPuff solves **all of this**:

> **3-platform simultaneous publish + cross-platform schedule calendar + auto-transcode + one-click retry + full publish history**

---

## Core Features

### 🎯 Publish to 3 Platforms at Once

Link YouTube + Facebook + Instagram → drag in video → fill title once → click "Publish". Each platform can be independently enabled/disabled, and can independently override title and hashtags.

### 📅 Cross-Platform Calendar

All schedules for the next 365 days on one calendar, in **day / week / month** views. Bulk-import a folder to schedule daily (up to 3 posts/day), skip weekends, preview the full timeline.

### 🎬 Auto-Transcode (HEVC → H.264)

iPhone HEVC, Sony 4K, horizontal 16:9 — all auto-converted to H.264 1080×1920 30fps 9:16 that every platform accepts, with letterbox black bars to preserve full content. Hash-cached so the same video never gets transcoded twice.

### 🛡️ Schedule Fault Tolerance

- Schedules are **persisted immediately** to local SQLite — survive unexpected shutdowns
- App restart auto-recovers **interrupted records** and fires **schedules missed within 6 hours**
- Launch-on-startup option + tray persistence → 24/7 timely publishing
- Schedules stale by > 6 hours are auto-marked failed with a system notification (no random late publishes)

### 🔁 Retry Failed Publishes

YouTube succeeded but FB failed? Click "Retry Failed Platforms" — only FB retries, YT is not re-published. Or reschedule to a future time.

### 🔐 Multi-Account Management

Each platform can connect 2+ accounts (multiple YT channels, multiple FB Pages); pick the target from a dropdown when publishing.

### 🧹 Automatic Garbage Collection

On startup, scans cache folders and auto-deletes 30-day-unused transcoded videos and 90-day-unused thumbnails — caches will never eat your disk.

---

## Privacy & Security (Important!)

**PuffinPuff has no servers. No backend. No database hosts.**

| We Don't | We Do |
|---|---|
| ❌ Collect your personal data | ✅ Encrypt OAuth tokens with Windows DPAPI |
| ❌ Upload videos to "our" cloud | ✅ Videos go **directly** from your PC to YouTube/Meta official APIs |
| ❌ Deploy Google Analytics / FB Pixel | ✅ Zero tracking |
| ❌ Sell tokens to third parties | ✅ Tokens stay only in your PC's `%APPDATA%\` |
| ❌ Know what videos you publish | ✅ We don't even know how many videos you've published |

See [Privacy Policy](https://mememaker-tw.com/puffinpuff/privacy/) and [Terms of Service](https://mememaker-tw.com/puffinpuff/terms/).

---

## System Requirements

- **Windows 10 / 11** (64-bit)
- **RAM**: 8 GB recommended (4 GB minimum)
- **Disk**: 500 MB install; caches auto-recycle
- **Network**: 5 Mbps+ upload recommended
- **Required**: YouTube channel, Facebook Page, Instagram Business account (linked to FB Page)

---

## Download

<a id="download"></a>

### v0.2.4 (Latest Stable, 2026-05-21)

[📥 Download 海鸚泡芙 PuffinPuff-0.2.4-Setup.exe (200 MB)](#)

| Changelog |
|---|
| ✅ Auto-GC on launch: 30-day-unused transcoded cache auto-deleted |
| ✅ Schedule "Cancel All" button |
| ✅ Settings page "Run Cleanup Now" button |
| ✅ Complete V1.1 polish (transcoding + multi-account + tray + video preview) |

[Full CHANGELOG](https://github.com/vvlee/puffinpuff/blob/main/CHANGELOG.md)

---

## User Guide

<a id="guide"></a>

**First-time setup in 3 steps:**

1. **Download + Install** the Setup.exe — all data stays on your local PC
2. **Link accounts**: in the Accounts tab, link YouTube (via Google sign-in) + Facebook (via Meta Business Login, which also links IG automatically)
3. **Drag in video** → edit content → "Publish" or "Schedule" → done

Full tutorial video (YouTube): [Coming soon]

---

## Open Source

PuffinPuff is open-sourced on GitHub under the **MIT License**.
Issues / PRs / stars 🌟 welcome.

🔗 [github.com/vvlee/puffinpuff](https://github.com/vvlee/puffinpuff)

---

## About the Author

**VVLEE**: Independent developer focused on tooling for labor-relations consulting media.
- 📧 bisharing001@gmail.com
- 🌐 [mememaker-tw.com](https://mememaker-tw.com/)

---

## Legal

- [Privacy Policy](https://mememaker-tw.com/puffinpuff/privacy/)
- [Terms of Service](https://mememaker-tw.com/puffinpuff/terms/)
- [Data Deletion Instructions](https://mememaker-tw.com/puffinpuff/data-deletion/)
- [Contact](https://mememaker-tw.com/puffinpuff/contact/)

© 2026 VVLEE. PuffinPuff and "海鸚泡芙" are software trademarks of VVLEE.
YouTube, Facebook, and Instagram are trademarks of their respective companies.
