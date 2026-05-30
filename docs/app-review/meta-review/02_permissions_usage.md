# Meta App Review — Permission Usage Justification

每個 permission 在 App Review → Permissions and Features 介面填寫 "How will your app use this permission?" 與 "How is this data being used by users?"。

直接複製貼上以下對應段落即可。每段都 < 1000 chars 符合 Meta 介面字數限制。

---

## 1. `pages_show_list`

### How will your app use this permission?

PuffinPuff requires `pages_show_list` to retrieve the list of Facebook Pages the user manages so they can choose which Page to publish their short-form video (Reel) to.

After the user signs in via Meta Business Login, PuffinPuff calls `GET /me/accounts?fields=id,name,access_token,picture` to fetch the list of Pages and their Page access tokens. The result is displayed in the in-app Accounts page as a list of cards (one card per Page), and the user selects one Page in the Publish form when scheduling or publishing a new Reel.

Without this permission, the user cannot see which of their Pages are available, and cannot select a destination Page for the Reel upload — making the entire Facebook publishing flow unusable.

The data (Page ID, Page name, Page access token, Page profile picture URL) is stored only on the user's own Windows PC in `%APPDATA%\海鸚泡芙 PuffinPuff\puffinpuff.db`, encrypted with Windows DPAPI. No data is sent to any server other than the official Meta Graph API.

### How is this data being used by users?

Users see their list of managed Facebook Pages in the Accounts section of PuffinPuff. They click on a Page to confirm it is connected, and select one Page per Reel publish via a dropdown in the Publish or Schedule page. The Page profile picture appears in the UI for visual confirmation. Users can disconnect any Page at any time, which immediately deletes the Page's access token from local storage.

---

## 2. `pages_read_engagement`

### How will your app use this permission?

PuffinPuff uses `pages_read_engagement` to verify that the Page access token returned by `/me/accounts` is still valid and to retrieve basic Page metadata (verified status, category) for display in the Accounts page.

Specifically, after retrieving the Page access token, PuffinPuff makes a single call to `GET /{page-id}?fields=name,category,verification_status&access_token={page_token}` to confirm the token has not been revoked and to refresh the Page metadata shown in UI. We do not read Page insights, posts, comments, or any engagement metrics.

Without this permission, PuffinPuff cannot reliably tell the user if their Page token has expired (forcing them to re-link), nor display accurate Page category information.

The data is stored only locally on the user's Windows PC. No server-side caching.

### How is this data being used by users?

Users see a status indicator on each Page card in the Accounts page (e.g., "Connected", "Verified ✓", category badge). If the Page token has expired or been revoked, users see a "Re-link required" warning, prompting them to re-authorize. This permission is purely for confirming the connection is healthy.

---

## 3. `pages_manage_posts`

### How will your app use this permission?

PuffinPuff uses `pages_manage_posts` to publish short-form video Reels to the user's selected Facebook Page on behalf of the authenticated user.

When the user clicks "Publish" on a Reel, PuffinPuff implements the official 3-step Reels API flow:

1. **Start phase**: `POST /{page-id}/video_reels?upload_phase=start&access_token={page_token}` — initiate the upload session
2. **Upload phase**: `POST {upload_url}` with `file_size`, `Content-Length`, `X-Entity-Length`, `Offset` headers and the video binary as the body — uploads the actual file
3. **Finish phase**: `POST /{page-id}/video_reels?upload_phase=finish&video_state=PUBLISHED&description={title+hashtags}` — finalize and publish

All three calls are made directly from the user's Windows PC to Meta's API endpoints (`graph.facebook.com` and `rupload.facebook.com`); PuffinPuff has no intermediate servers.

Without this permission, users cannot publish Reels to their Pages via PuffinPuff — defeating the purpose of the application.

The video file content is read from the user's local disk, streamed directly to Meta's `rupload.facebook.com` endpoint, and never stored on any PuffinPuff server (we have none).

### How is this data being used by users?

Users see the Reel they just published appear on their Facebook Page within seconds. In the PuffinPuff app, the publish history shows a row with the platform name (Facebook), the video filename, publish timestamp, status (success / failed), and a direct link to the published post on Facebook so the user can view it. The user can choose to publish to multiple Pages or platforms in a single click.

---

## 4. `business_management`

### How will your app use this permission?

PuffinPuff uses `business_management` because it integrates with Meta Business Login (Business Configuration ID: 1275523534730366) — a flow that is **only available to apps with this permission**.

Meta Business Login is the recommended authentication flow for apps that manage Facebook Pages or Instagram Business accounts on behalf of business users. Without `business_management`, our app cannot use Business Login at all; users would be forced through the legacy Facebook Login flow, which has been deprecated for business use cases by Meta.

The actual data we retrieve is the same as `pages_show_list` and `instagram_basic` — we do not enumerate the user's other businesses, ad accounts, or business assets. We only use the Business Login flow because Meta requires this permission to invoke the Business Configuration on our App.

### How is this data being used by users?

Users see the standard Meta Business Login screen ("Choose how PuffinPuff connects to your Facebook account") and select their Page + Instagram Business Account. They never see any "business management" UI inside PuffinPuff — this permission is invisible to users; it is solely the gating dependency for the Business Login flow.

---

## 5. `instagram_basic`

### How will your app use this permission?

PuffinPuff uses `instagram_basic` to identify the Instagram Business Account linked to the user's selected Facebook Page, and to display the IG username and profile picture in the Accounts UI.

After the user authorizes via Business Login and selects a Page, PuffinPuff calls `GET /{page-id}?fields=instagram_business_account` to retrieve the IG account ID, then `GET /{ig-business-account-id}?fields=id,username,profile_picture_url` to retrieve the IG username and profile picture for display.

We do not read IG media (photos, videos, captions, comments), IG followers, IG hashtags, or any other Instagram content beyond the linked account's basic identity.

Without this permission, users cannot see which Instagram Business account is linked, cannot confirm they're publishing to the correct IG account, and cannot use the IG publishing feature.

### How is this data being used by users?

The Instagram Business account appears as a card in PuffinPuff's Accounts page, showing the IG username (e.g., "@everpro.mita02") and profile picture. This allows the user to visually confirm which IG account will receive any Reels they publish. The IG account ID is stored locally and used in subsequent IG content publishing calls.

---

## 6. `instagram_content_publish`

### How will your app use this permission?

PuffinPuff uses `instagram_content_publish` to upload Reels to the user's linked Instagram Business Account.

We implement the official IG Reels container flow:

1. **Create container**: `POST /{ig-user-id}/media?media_type=REELS&video_url={public_url}&caption={text}` — IG accepts only public HTTPS URLs as the video source.
2. **Poll status**: `GET /{container-id}?fields=status_code` — repeated every 5 seconds until status becomes `FINISHED` (or `ERROR` / `EXPIRED`).
3. **Publish**: `POST /{ig-user-id}/media_publish?creation_id={container-id}` — once finished, publish the container as a Reel.

Because IG's API requires a publicly accessible HTTPS URL (it does not accept binary file uploads), PuffinPuff starts a temporary local HTTP server on the user's PC and uses the official Cloudflare `cloudflared` tool to create a temporary `trycloudflare.com` URL pointing to the video. After the IG container reaches `FINISHED` status, the tunnel and local server are immediately torn down — the URL is invalid within seconds.

The video file content is read into the user's local PC's RAM, served via the temporary tunnel directly to Meta's IG fetcher, and never persisted on any third-party server.

Without this permission, IG Reels publishing is impossible — defeating one of PuffinPuff's three core platform integrations.

### How is this data being used by users?

Users see the published IG Reel appear on their Instagram profile within 30 seconds to a few minutes. In PuffinPuff, the publish history shows the IG row with status (success / failed), filename, timestamp, and a link to the published Reel on instagram.com. Users can click the link to view the published Reel directly on Instagram.
