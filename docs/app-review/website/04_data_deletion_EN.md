# Data Deletion Instructions｜PuffinPuff 海鸚泡芙

**Last Updated: May 21, 2026**

---

> Meta (Facebook, Instagram) requires all applications using its API to provide **clear, actionable** data deletion instructions. This page is PuffinPuff's response to that requirement.

---

## One-Sentence Summary

**PuffinPuff never uploads any data to the cloud.** All data lives on your local computer. To delete data: **delete the folder on your computer**, and (recommended) **revoke authorization in the platform backend**.

---

## Where Is My Data?

| Location | Contents |
|---|---|
| Your Windows PC at `%APPDATA%\海鸚泡芙 PuffinPuff\` | Account tokens (encrypted), publish history, thumbnails, transcoded cache |
| ~~PuffinPuff cloud server~~ | **Does not exist** — we have no servers |
| Meta / Google platform databases | OAuth authorization records, uploaded video content (under platform jurisdiction) |

---

## Method 1: Delete All PuffinPuff Local Data (Most Thorough)

### Step 1: Close the App

1. Find the puffin logo in your system tray (under the up-arrow in the lower-right corner)
2. Right-click → "**Quit PuffinPuff Completely**"

### Step 2: Delete the Folder

Press `Windows + R` to open "Run", and type:
```
%APPDATA%\海鸚泡芙 PuffinPuff
```
Press Enter.

In the Explorer window that opens, **go up one level**, find the "**海鸚泡芙 PuffinPuff**" folder, and **delete it entirely**.

### Step 3 (Optional): Uninstall the Application

"Settings → Apps → Installed Apps → 海鸚泡芙 PuffinPuff → Uninstall".

Done. No PuffinPuff residual data on your machine.

---

## Method 2: Delete Data for a Single Account (Keep Other Accounts)

If you only want to remove one specific account (e.g., one YouTube channel) and not all:

1. Open PuffinPuff
2. Click "**Accounts**" in the sidebar
3. Find the account card you want to remove
4. Click the "**Disconnect**" button
5. Upon confirmation, that account's tokens and information are **immediately deleted from the local database**

---

## Method 3: Clear Only Publish History (Keep Account Links)

1. Open PuffinPuff → click "**Settings**" in the sidebar
2. In "Data Management" → click "**Clear Publish History**"
3. Confirm in the modal → "Clear"

This only deletes published records (future schedules and account tokens are kept).

---

## Important: Also Revoke Authorization at Meta / Google

Deleting PuffinPuff's local data **does not revoke the OAuth authorizations you granted**. Authorization records live on the platform side and need separate action:

### Facebook / Instagram

1. Go to [Facebook Settings → Business Integrations](https://www.facebook.com/settings?tab=business_tools)
2. Find "PuffinPuff" (may appear as "VVLEE PuffinPuff Publisher")
3. Click "**Remove**"

Or in Facebook (mobile / desktop):
- Settings & Privacy → Settings → Business Integrations → Active Apps and Websites → PuffinPuff → Remove

Instagram authorization is managed via FB Business Manager — the above step also revokes it.

### Google / YouTube

1. Go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
2. Find "PuffinPuff"
3. Click "**Remove Access**"

Done. Google will no longer let PuffinPuff act on behalf of your account.

---

## What About Videos I've Already Published to YouTube / FB / IG?

PuffinPuff **only delivers videos to each platform**. After publishing, the videos are entirely under that platform's jurisdiction. To delete these videos, use **each platform's native interface**:

- **YouTube**: YouTube Studio → Content → select video → Delete
- **Facebook Page**: Page management → Posts → Delete
- **Instagram**: IG App → Profile → find the Reel → ⋯ → Delete

PuffinPuff will not, and cannot, delete content on platforms after upload.

---

## Can I Use PuffinPuff Again After Deleting the Folder?

Yes. Deleting `%APPDATA%\海鸚泡芙 PuffinPuff\` **does not affect the application itself** (which lives in `Program Files`). Next time you open PuffinPuff, the folder will be recreated empty, and you'll be asked to re-link your accounts.

---

## Questions?

**📧 bisharing001@gmail.com**

We respond within 7 business days.
