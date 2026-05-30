# PuffinPuff 海鸚泡芙

## One Splash, Three Platforms

**One video, one click — publish to YouTube Shorts, Facebook Reels, and Instagram Reels simultaneously.**

[📥 Download v0.2.5 (Windows)](#download) 　
[📘 User Guide](#guide) 　
[📧 Contact](mailto:bisharing001@gmail.com)

---

### 📑 Table of Contents
- [About](#about)
- [Core Features](#features)
- [Download](#download)
- [User Guide](#guide)
- [Privacy Policy](#privacy)
- [Terms of Service](#terms)
- [Data Deletion Instructions](#data-deletion)
- [Contact / Legal](#contact)

---

<h2 id="about">About</h2>

In the short-form video era, "**one piece of content, three platforms**" is the baseline distribution move for creators. In practice you'll run into:

- 🔁 Opening 3 apps for the same video, filling title/description/hashtags 3 times
- 📅 Each platform's scheduling UI is different, with different rules
- ⏰ FB / IG don't allow scheduling > 6 days out; YouTube has its own privacy rules
- 🎬 HEVC / 4K / vertical videos often fail to upload to IG
- 📊 After publishing, you don't know which platforms succeeded or where to check

PuffinPuff solves **all of this**: 3-platform simultaneous publish + cross-platform schedule calendar + auto-transcode + one-click retry + full publish history.

---

<h2 id="features">Core Features</h2>

### 🎯 Publish to 3 Platforms at Once
Link YouTube + Facebook + Instagram → drag in video → fill title once → click "Publish". Each platform can be independently enabled/disabled, and can independently override title and hashtags.

### 📅 Cross-Platform Calendar
All schedules for the next 365 days on one calendar, in **day / week / month** views. Bulk-import a folder to schedule daily (up to 3 posts/day), skip weekends, preview the full timeline.

### 🎬 Auto-Transcode (HEVC → H.264)
iPhone HEVC, Sony 4K, horizontal 16:9 — all auto-converted to H.264 1080×1920 30fps 9:16 that every platform accepts, with letterbox black bars to preserve full content. Hash-cached so the same video never gets transcoded twice.

### 🛡️ Schedule Fault Tolerance
Schedules are persisted immediately to local SQLite — survive unexpected shutdowns. App restart auto-recovers interrupted records and fires schedules missed within 6 hours. Combined with launch-on-startup + tray persistence → 24/7 timely publishing.

### 🔁 Retry Failed Publishes
YouTube succeeded but FB failed? Click "Retry Failed Platforms" — only FB retries, YT is not re-published. Or reschedule to a future time.

### 🔐 Multi-Account Management
Each platform can connect 2+ accounts (multiple YT channels, multiple FB Pages); pick the target from a dropdown when publishing.

### 🧹 Automatic Garbage Collection
On startup, scans cache folders and auto-deletes 30-day-unused transcoded videos and 90-day-unused thumbnails.

### ♾️ Auto Token Renewal (v0.2.5)
Meta 60-day tokens auto-refresh when < 7 days from expiry — effectively never expire.

---

<h2 id="download">Download</h2>

### v0.2.5 (Latest Stable, 2026-05-21)

[📥 Download 海鸚泡芙 PuffinPuff-0.2.5-Setup.exe (200 MB)](https://mememaker-tw.com/puffinpuff/download/PuffinPuff-0.2.5-Setup.exe)

### Recent Versions
- v0.2.5 — Meta long-lived token auto-refresh
- v0.2.4 — Auto-GC on launch + cancel-all schedules
- v0.2.3 — Transcode cache cleanup + error copy as Markdown + video preview
- v0.2.2 — Persistent system tray
- v0.2.1 — Multi-account publishing selection
- v0.2.0 — Draft load-back + Settings page + auto-transcode

[📜 Full CHANGELOG](https://github.com/vvlee/puffinpuff/blob/main/CHANGELOG.md)

---

<h2 id="guide">User Guide</h2>

### First-Time Setup in 3 Steps

1. **Download + Install** the Setup.exe — all data stays on your local PC
2. **Link accounts**: in the Accounts tab, link YouTube (via Google sign-in) + Facebook (via Meta Business Login, which also links IG automatically)
3. **Drag in video** → edit content → "Publish" or "Schedule" → done

### System Requirements
- Windows 10 / 11 (64-bit)
- RAM: 8 GB recommended (4 GB minimum)
- Disk: 500 MB install; caches auto-recycle
- Network: 5 Mbps+ upload recommended
- Required: YouTube channel, Facebook Page, Instagram Business account (linked to FB Page)

---

<h2 id="privacy">Privacy Policy</h2>

**Last Updated: May 21, 2026**

### One-Sentence Summary
**PuffinPuff does not collect, upload, or store any user data on any cloud server. All data lives only on your own computer.**

This application has no backend server, no database host, and no third-party analytics. When you click "Publish," the video is uploaded **directly from your computer to the official YouTube / Facebook / Instagram APIs**.

### What Data We Collect

#### Via Official OAuth Flow

| Data | Purpose |
|---|---|
| OAuth Access Token | Authorize PuffinPuff to upload videos on your behalf |
| OAuth Refresh Token | Renew the Access Token automatically |
| YouTube Channel ID & Name | Display the currently linked channel |
| Facebook Page ID & Name | Display the currently linked Page |
| Instagram Business Account ID & Username | Display the currently linked IG account |
| Account Avatar URL | Display avatar in UI |
| Token Expiry Time | Show "X days remaining" reminder |

#### Content You Drag Into PuffinPuff
Video file paths, video file content, title, description, hashtags, privacy setting, auto-generated video thumbnails.

#### What PuffinPuff Does **NOT** Collect
- ❌ Personal information (name, birthday, address, phone, ID number)
- ❌ Google / Meta passwords (OAuth flow never touches passwords)
- ❌ Data from other apps, browsing history, file contents
- ❌ Usage analytics, behavior tracking, cookies, ad IDs
- ❌ Device hardware info, IP address, geolocation

### Where Data Is Stored

**All data is stored on your own Windows computer**:
```
C:\Users\<your-username>\AppData\Roaming\海鸚泡芙 PuffinPuff\
```

**Token Encryption**: OAuth tokens are encrypted with **Windows DPAPI** (Data Protection API), bound to your Windows user account — they cannot be decrypted without your Windows login password.

### Data Transmission Path
**PuffinPuff has no servers of its own.** All network requests flow only between:
```
Your computer (PuffinPuff)  ←→  Google / Meta official APIs
                                  ↑
                       Direct transmission, no intermediaries
```

### Special Note on Instagram Upload (Cloudflared Tunnel)
The official Instagram upload API requires the video to be a publicly accessible HTTPS URL. When publishing to IG, PuffinPuff:
1. Starts a temporary HTTP server on your local machine (random port)
2. Uses the official Cloudflare `cloudflared` tool to create a temporary `trycloudflare.com` URL
3. Submits this URL to the Instagram API
4. **Immediately after publishing completes**, the temporary server and tunnel are shut down — the URL becomes invalid
5. The video itself exists only in your computer's RAM (no second disk copy)

### Third-Party Services
| Service | Purpose | Privacy Policy |
|---|---|---|
| Google / YouTube API | OAuth and video upload | [policies.google.com/privacy](https://policies.google.com/privacy) |
| Meta (Facebook, Instagram) Graph API | OAuth and video upload | [www.facebook.com/privacy/policy](https://www.facebook.com/privacy/policy) |
| Cloudflare cloudflared | Temporary tunnel for IG upload | [www.cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/) |

### Cookies & Tracking
PuffinPuff is a desktop application. It **uses no cookies**, **deploys no analytics scripts**, and **does not track user behavior**. This website contains no tracking scripts either.

### Children's Privacy
PuffinPuff is not designed for children under 13.

### Changes to This Policy
For material changes, we will update the "Last Updated" date, notify users via in-app system notification, and require re-consent for new data collection.

### Compliance References
- Taiwan Personal Data Protection Act
- EU General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)
- Meta Platform Terms (FB / IG App Review requirements)
- Google API Services User Data Policy (YouTube Audit requirements)

---

<h2 id="terms">Terms of Service</h2>

**Last Updated: May 21, 2026**

### 1. Service Description
PuffinPuff is a Windows desktop tool developed by VVLEE that helps users publish short-form video files simultaneously to YouTube Shorts, Facebook Reels, and Instagram Reels. The Application **runs entirely on the user's local computer**. It has no servers, collects no user data, and stores nothing in the cloud.

### 2. License Grant
VVLEE grants you a **free, non-exclusive, non-transferable** personal or commercial use license. You **may not**:
1. Reverse engineer, decompile, or disassemble the Application
2. Use it for purposes violating YouTube ToS, Meta Platform Policies, or any applicable law
3. Remove or modify copyright notices or brand identifiers
4. Redistribute, resell, or rent in any form
5. Use for spam publishing, mass malicious content, or copyright-infringing uploads

### 3. User Accounts and Authorization
- You must have legitimate, active YouTube / Facebook / Instagram accounts
- **You are solely responsible for the content you publish**

### 4. Video Content and Third-Party Platform Policies
Once uploaded, videos are governed by each platform's policies: [YouTube ToS](https://www.youtube.com/static?template=terms) / [Meta ToS](https://www.facebook.com/legal/terms) / [Instagram ToU](https://help.instagram.com/581066165581870). PuffinPuff **will not** and **cannot** modify or delete your content on these platforms after upload.

### 5. API Quotas and Limitations
| Platform | Default Limit |
|---|---|
| YouTube | Data API quota: 10,000 points/day (each upload ≈ 1,600 points) |
| Facebook | Rate limit: 200 calls / hr / token |
| Instagram | Reels API: 25 containers / 24 hr / account |

### 6. No Warranty
The Application is provided **"AS IS"**. VVLEE makes no warranty regarding flawless operation, third-party API stability, upload success guarantees, or bug-free behavior.

### 7. Limitation of Liability
To the maximum extent permitted by law, VVLEE is not liable for any direct, indirect, incidental, or consequential damages. VVLEE's maximum liability is **TWD 0** (the Application is free software).

### 8. Application Updates
VVLEE may release new versions from time to time; you download and install updates at your own discretion.

### 9. Termination
You may terminate use at any time by:
1. Disconnecting all accounts within the App
2. Uninstalling PuffinPuff from Windows Apps
3. Deleting the `%APPDATA%\海鸚泡芙 PuffinPuff\` folder

### 10. Dispute Resolution and Governing Law
These Terms shall be interpreted and applied under the **laws of the Republic of China (Taiwan)**. Any disputes shall be submitted to the **Taipei District Court of Taiwan** as the court of first instance.

---

<h2 id="data-deletion">Data Deletion Instructions</h2>

**Last Updated: May 21, 2026**

### One-Sentence Summary
**PuffinPuff never uploads any data to the cloud.** All data lives on your local computer. To delete data: delete the folder on your computer, and (recommended) revoke authorization in the platform backend.

### Method 1: Delete All Local Data (Most Thorough)

1. **Close the App**: Right-click the puffin logo in your system tray → "**Quit PuffinPuff Completely**"
2. **Delete the Folder**: Win+R → type `%APPDATA%` → find "海鸚泡芙 PuffinPuff" folder → delete entirely
3. **(Optional) Uninstall**: Settings → Apps → Installed Apps → 海鸚泡芙 PuffinPuff → Uninstall

### Method 2: Delete a Single Account (Keep Others)
Open PuffinPuff → Accounts page → find the account card → click "**Disconnect**" → confirm

### Method 3: Clear Only Publish History
Open PuffinPuff → Settings page → Data Management → click "**Clear Publish History**"

### Don't Forget to Revoke Authorization on the Platform Side

| Platform | Revocation URL |
|---|---|
| Google / YouTube | [myaccount.google.com/permissions](https://myaccount.google.com/permissions) |
| Facebook / Instagram | Facebook → Settings → Business Integrations → Active Apps and Websites → PuffinPuff → Remove |

### What About Videos Already Published?
PuffinPuff only delivers videos to platforms. To delete published content, use each platform's native interface: YouTube Studio / FB Page management / IG App.

---

<h2 id="contact">Contact / Legal</h2>

### Primary Contact

**📧 bisharing001@gmail.com**　
Response time: within 7 business days

### Response Time SLA
| Category | SLA |
|---|---|
| General technical support | 7 business days |
| Privacy / data rights requests | 30 days (statutory maximum) |
| Suspected data breach | 24 hours initial acknowledgment |
| Business inquiries | 14 business days |
| Review bodies (Google / Meta) inquiries | 3 business days |

### Developer
**VVLEE** — Independent software developer focused on tooling for labor-relations consulting media.
- 📧 bisharing001@gmail.com
- 🌐 [mememaker-tw.com](https://mememaker-tw.com/)

### Legal Service of Process
Under Taiwan law, the service-of-process address for legal documents concerning this Application is the author's email: **bisharing001@gmail.com**

---

© 2026 VVLEE. PuffinPuff and "海鸚泡芙" are software trademarks of VVLEE. YouTube, Facebook, and Instagram are trademarks of their respective companies.

[🇹🇼 中文版本](https://mememaker-tw.com/puffinpuff/)
