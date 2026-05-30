# Appendix — YouTube API Compliance Mapping

備用文件：如果 audit 員質疑特定政策合規性，把這份對照表貼給他/她。

---

## YouTube API Services Developer Policies 對照

來源：https://developers.google.com/youtube/terms/developer-policies

| Policy Section | PuffinPuff 合規狀態 |
|---|---|
| **III. Definitions** | PuffinPuff is an "API Client" (third-party application) — confirmed |
| **IV. Compliance** | App complies with all relevant YouTube ToS — uploads are user-initiated, content is user-supplied, no automated content generation |
| **V. Brand Features** | We do not use "YouTube" or YouTube logo in PuffinPuff branding except in feature descriptions ("Publish to YouTube Shorts") — acceptable nominative use |
| **VI. API Limits & Restrictions** | We respect daily quota (1,600 points per upload); display clear error to user if exceeded |
| **VII. Privacy & Security** | OAuth tokens encrypted with Windows DPAPI; no server-side storage; no third-party sharing |
| **VIII. Data Use** | All data (channel info, upload history) used only for the explicit user-facing functionality stated in our app and Privacy Policy |
| **IX. Account Linking** | Users connect their own Google account via standard OAuth 2.0; we provide clear disconnect UI |
| **X. Content** | We do not generate, modify, or alter user content; user-supplied content is uploaded as-is |
| **XI. Embedded Player** | Not applicable — we do not embed the YouTube player |
| **XII. Reporting** | We respond to user reports via bisharing001@gmail.com within 7 business days |

---

## YouTube API Services Terms of Service 對照

來源：https://developers.google.com/youtube/terms/api-services-terms-of-service

| Section | Compliance |
|---|---|
| **3.A YouTube data restrictions** | We do not store more YouTube data than needed for our specific feature (channel ID/name/picture). Refresh after re-link. |
| **3.B Authentication** | We use OAuth 2.0 Loopback IP Address flow + PKCE (the Google-recommended method for desktop apps) |
| **3.C API caching** | We cache only static metadata (channel name/picture) for 24h; refresh on next account re-link |
| **3.D Quota** | We use a single `videos.insert` per user-publish action; no parallel uploads of the same video |
| **5 Rate limiting** | We implement exponential backoff (1s → 2s → 4s → 8s) on 429 and 5xx errors |

---

## 個人版（V1）的特殊聲明

對於可能被質疑的「個人版 vs. 商業版」狀態：

> PuffinPuff v0.2.x is offered as a **free** desktop application, primarily intended for individual content creators. It is not a SaaS, not a paid service, and not a business-to-business platform. The author (VVLEE) develops and maintains it primarily as an open-source / community tool aligned with creator workflows.
>
> Despite being "personal" in scale, the app fully complies with YouTube API Services Developer Policies and Terms of Service — there are no relaxed rules due to scale. All security, privacy, and behavioral controls described above apply uniformly.

---

## Common Audit Concerns — Pre-emptive Responses

### "Your scope `youtube.upload` includes 'edit and delete videos' — why do you need that?"

The scope description Google shows users is the **full** capability of the OAuth token, but our app **only** uses the upload portion. We never call `videos.update` or `videos.delete`. This is documented in:
1. Our Privacy Policy (Section 1.1)
2. Our scope justification in OAuth Consent Screen
3. Our YouTube API Audit answers (Section 3.1)

Google's API design unfortunately bundles read/write/delete into one scope; we have no way to request only "upload-only" — `youtube.upload` is the minimum scope that grants upload capability.

### "Why is your app a desktop app instead of a web app?"

Desktop app advantages for this use case:
1. **Direct file system access** — no need to upload files to a server first
2. **Privacy** — no user data ever leaves the user's PC (except to platform APIs)
3. **Offline-capable for non-publish features** — scheduling, drafts, history all work without internet
4. **No platform-side hosting costs** — single-developer (VVLEE) cannot afford SaaS infrastructure

Web app version would require us to:
- Host user video files on our servers (privacy concern + bandwidth cost)
- Implement user accounts on our side (additional attack surface)
- Manage SSL, scaling, uptime (infrastructure cost)

The desktop architecture is **safer for users** and **sustainable for the developer**.

### "Are you a YouTube partner or have a commercial agreement?"

No. PuffinPuff is an independent third-party tool. We are not a YouTube partner, MCN, or advertiser. We have no commercial relationship with YouTube beyond being an API consumer subject to the standard Developer Policies.

---

## Pre-flight Checklist Before Submitting to YouTube Audit

- [ ] Brand verification on Google Cloud Console: **completed** (1-2 weeks earlier)
- [ ] Privacy Policy updated to v2026-05-21 (or current)
- [ ] Privacy Policy explicitly mentions: `youtube.upload`, channel ID, channel name, upload metadata
- [ ] Privacy Policy explicitly states data retention period and deletion path
- [ ] ToS published
- [ ] Data Deletion Instructions published
- [ ] Domain `mememaker-tw.com` verified in Search Console
- [ ] OAuth Consent Screen Production status confirmed
- [ ] Test user accounts added (yourself + at least 1 reviewer placeholder)
- [ ] Demo video uploaded to YouTube as Unlisted, 1080p, 3-5 minutes
- [ ] Demo video script (`03_demo_video_script.md`) followed
- [ ] This document (`04_appendix_compliance.md`) ready as backup reference if audit team requests

When ready, submit via Google Console → OAuth Consent Screen → "PREPARE FOR VERIFICATION" → fill in all forms → "Submit for Verification".

Expect 3-6 weeks for full YouTube Audit response.
