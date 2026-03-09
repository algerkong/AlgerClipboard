# AlgerClipboard Cloud Sync Configuration Guide

## Table of Contents

- [Overview](#overview)
- [Supported Cloud Storage](#supported-cloud-storage)
- [WebDAV Setup](#webdav-setup)
- [Google Drive Setup](#google-drive-setup)
- [OneDrive Setup](#onedrive-setup)
- [Sync Frequency](#sync-frequency)
- [End-to-End Encryption](#end-to-end-encryption)
- [Sync Mechanism](#sync-mechanism)
- [Conflict Resolution](#conflict-resolution)
- [FAQ](#faq)

---

## Overview

AlgerClipboard can sync your clipboard history to the cloud, enabling seamless data sharing across multiple devices. Key features:

- Supports WebDAV, Google Drive, and OneDrive
- Optional end-to-end encryption (AES-256-GCM + Argon2id)
- Incremental sync — only transfers changes
- Automatic conflict detection and resolution
- Flexible sync frequency (real-time / scheduled / manual)

## Supported Cloud Storage

| Storage Type | Authentication | Best For |
|-------------|---------------|----------|
| WebDAV | Username + Password | Self-hosted NAS (Synology, NextCloud, etc.), Nutstore |
| Google Drive | OAuth 2.0 | Google ecosystem users |
| OneDrive | OAuth 2.0 | Microsoft 365 / Windows users |

---

## WebDAV Setup

WebDAV is the simplest sync method, ideal for self-hosted services or third-party cloud storage with WebDAV support.

### Prerequisites

Make sure you have a service that supports the WebDAV protocol. Common options:

- **Nutstore (Jianguoyun)** — Free WebDAV support, fast in China
- **NextCloud** — Open-source self-hosted cloud
- **Synology NAS** — Built-in WebDAV Server package
- **AList** — WebDAV proxy supporting multiple cloud drives

### Configuration Steps

1. Open **Settings** → **Sync** tab
2. Click **Add Cloud Storage**
3. Select **WebDAV** as the storage type
4. Fill in the following fields:

| Field | Description | Example |
|-------|-------------|---------|
| Server URL | Full WebDAV service URL | `https://dav.jianguoyun.com/dav/` |
| Username | Login account | `user@example.com` |
| Password | Login password or app-specific password | `app-password-here` |

5. Click **Test Connection** to verify the configuration
6. Set your **Sync Frequency**
7. Click **Save**

### Nutstore (Jianguoyun) Example

1. Log in to [Nutstore](https://www.jianguoyun.com)
2. Go to **Account Info** → **Security** → **Third-party App Management**
3. Click **Add App**, enter the name `AlgerClipboard`
4. Copy the generated **App Password**
5. Configure in AlgerClipboard:
   - Server URL: `https://dav.jianguoyun.com/dav/`
   - Username: Your Nutstore email
   - Password: The app password from the previous step

### NextCloud Example

- Server URL: `https://your-domain.com/remote.php/dav/files/username/`
- Username: Your NextCloud username
- Password: NextCloud password or app password (recommended: generate one in Settings → Security)

---

## Google Drive Setup

Using Google Drive requires creating OAuth credentials first.

### Prerequisites

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the **Google Drive API**:
   - Go to **APIs & Services** → **Library**
   - Search for `Google Drive API` and enable it
4. Create OAuth credentials:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Desktop app**
   - Note down the **Client ID** and **Client Secret**
5. Configure the OAuth consent screen:
   - Go to **OAuth consent screen**
   - User type: **External**
   - Add your Google email as a test user

### Configuration Steps

1. Open **Settings** → **Sync** tab
2. Click **Add Cloud Storage**
3. Select **Google Drive**
4. Enter the **Client ID** and **Client Secret**
5. Click **Authorize** — your browser will automatically open the Google sign-in page
6. Sign in to your Google account and grant AlgerClipboard access to your Drive
7. After successful authorization, the window will display "Authorization successful!"
8. Return to AlgerClipboard, set your sync frequency, and save

### Data Storage Location

Synced data is stored in an `AlgerClipboard` folder in the root of your Google Drive.

### Permissions

AlgerClipboard only requests the `drive.file` scope, meaning it can only access files created by the app itself — **it cannot read any other files in your Drive**.

---

## OneDrive Setup

Using OneDrive requires creating a Microsoft app registration.

### Prerequisites

1. Visit [Azure App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **New registration**:
   - Name: `AlgerClipboard`
   - Supported account types: **Personal Microsoft accounts**
   - Redirect URI: Select **Web**, enter `http://127.0.0.1/callback` (the port is dynamically assigned)
3. Note down the **Application (client) ID**

### Configuration Steps

1. Open **Settings** → **Sync** tab
2. Click **Add Cloud Storage**
3. Select **OneDrive**
4. Enter the **Client ID** (Application ID)
5. Click **Authorize** — your browser will automatically open the Microsoft sign-in page
6. Sign in and grant permissions
7. Set your sync frequency and save

### Data Storage Location

Synced data is stored in an `AlgerClipboard` folder in the root of your OneDrive.

### Permissions

AlgerClipboard requests `Files.ReadWrite.All` and `offline_access` permissions for reading/writing files and obtaining refresh tokens.

---

## Sync Frequency

When adding cloud storage, you can choose from the following sync frequencies:

| Mode | Description | Best For |
|------|-------------|----------|
| **Real-time** | Syncs immediately after clipboard changes (5-second debounce) | Scenarios requiring instant sync |
| **Scheduled** | Auto-syncs at a set interval (1 – 1440 minutes) | Balancing performance and timeliness |
| **Manual** | Only syncs when you click "Sync Now" | Bandwidth-sensitive or occasional sync |

### Recommendations

- For daily use: **Scheduled every 15 minutes**
- For LAN-connected NAS: **Real-time**
- On mobile networks or limited bandwidth: **Manual**

---

## End-to-End Encryption

AlgerClipboard supports end-to-end encryption for synced data, ensuring that data stored in the cloud cannot be read by any third party — including the cloud storage provider.

### Encryption Scheme

| Component | Algorithm |
|-----------|-----------|
| Key Derivation | Argon2id (derives a 256-bit key from user password) |
| Data Encryption | AES-256-GCM (authenticated encryption) |
| Nonce | 12-byte random nonce generated per encryption |
| Salt | 16-byte random salt generated on first setup |

### Enabling Encryption

1. When adding or editing a cloud storage account, toggle **End-to-End Encryption** on
2. Enter an **encryption password** (recommended: 12+ characters with uppercase, lowercase, and numbers)
3. Save settings

### Important Notes

- **Remember your encryption password** — if lost, cloud data cannot be recovered
- All devices must use the **same encryption password** to sync correctly
- After changing the password, update it on all devices
- Encryption slightly increases sync data size and sync time

### Encryption Scope

When enabled, the following data is encrypted:

- Clipboard entry metadata (JSON)
- Image and file binary data
- Sync manifest

---

## Sync Mechanism

### Data Flow

```
Device A                    Cloud                     Device B
  │                          │                          │
  ├── Push local changes ──→ │                          │
  │                          │ ←── Push local changes ──┤
  │                          │                          │
  ├── Pull remote changes ←─ │                          │
  │                          │ ──→ Pull remote changes ─┤
  │                          │                          │
```

### Sync Process

1. **Initialization**: Creates the directory structure in the cloud
   ```
   AlgerClipboard/
   ├── manifest.json          ← Sync manifest (tracks versions of all entries)
   ├── entries/               ← Entry metadata
   │   ├── {id-1}.json
   │   └── {id-2}.json
   └── blobs/                 ← Binary files (images, etc.)
       ├── {hash-1}.bin
       └── {hash-2}.bin
   ```

2. **Push**: Uploads new or modified local entries to the cloud

3. **Pull**: Downloads new entries or updates from the cloud

4. **Update Manifest**: Updates the remote manifest.json after sync completes

### Incremental Sync

Each clipboard entry maintains a `sync_version` number. During sync, only entries with a version number greater than the last synced version are transferred, avoiding redundant uploads of already-synced data.

### Status Indicators

Sync status is displayed via title bar icons and entry badges:

| Icon | Meaning |
|------|---------|
| Green cloud | Synced |
| Blue up arrow | Waiting to upload |
| Orange warning | Conflict detected |
| Spinning icon | Syncing in progress |
| Red cross | Sync failed |

---

## Conflict Resolution

Sync conflicts occur when the same entry is modified on multiple devices.

### Conflict Detection

A conflict is triggered when both conditions are met:
- The local content hash differs from the remote version
- The local version was modified after the last sync

### Resolution Options

| Option | Description |
|--------|-------------|
| **Keep Local** | Use the local version; overwrites the remote on next sync |
| **Keep Remote** | Use the remote version; pulls and overwrites local on next sync |
| **Keep Both** | Keeps both versions by creating a conflict copy |

Conflicting entries are marked with an orange warning icon in the list. You can choose a resolution method from the right-click context menu.

---

## FAQ

### WebDAV Connection Failed

**Possible causes:**
- Server URL is missing a trailing `/`
- Using your login password instead of an app-specific password (e.g., Nutstore)
- Server SSL certificate issues
- Firewall or proxy blocking the connection

**Troubleshooting:**
1. Verify the server URL format (starts with `https://`, ends with `/`)
2. Try opening the WebDAV URL in a browser to confirm it's accessible
3. Use an app-specific password instead of your account password
4. Check your network connection and firewall settings

### Google Drive / OneDrive Authorization Failed

**Possible causes:**
- Client ID or Client Secret entered incorrectly
- OAuth consent screen not configured
- Your email not added as a test user
- Redirect URI misconfigured

**Troubleshooting:**
1. Check that the Client ID was copied completely (no extra spaces)
2. Confirm the OAuth consent screen is published or your email is added as a test user
3. Try recreating the OAuth credentials

### Data Not Appearing on Other Devices After Sync

**Possible causes:**
- The other device hasn't been configured for sync, or its frequency is set to manual
- Encryption passwords don't match
- Network issues prevented sync from completing

**Troubleshooting:**
1. Verify both devices are using the same cloud storage account
2. Click **Sync Now** on the other device
3. Confirm the encryption passwords match on both devices
4. Check the title bar sync status icon for errors

### Forgot My Encryption Password

Unfortunately, the encryption password cannot be recovered. You will need to:

1. Remove the sync account from all devices
2. Manually delete the `AlgerClipboard` folder from your cloud storage
3. Reconfigure sync with a new password

### How to Migrate to a Different Cloud Storage

1. Click **Sync Now** on the old sync account to ensure all data is fully synced
2. Add the new cloud storage account
3. Click **Sync Now** on the new account
4. After confirming the data sync is complete, delete the old account

### How Much Storage Does Sync Use?

- Each text entry takes approximately 1–5 KB
- Image entries depend on the original image size
- Enabling encryption slightly increases data size (about 10–20%)
- 1,000 text-only entries take roughly 2–5 MB

---

## Technical Specifications

| Item | Specification |
|------|---------------|
| Sync Protocol | HTTPS (WebDAV / REST API) |
| Encryption Algorithm | AES-256-GCM |
| Key Derivation | Argon2id |
| Conflict Detection | Content hash + version number |
| Data Format | JSON (metadata) + Binary (files) |
| Minimum Sync Interval | 1 minute |
| OAuth Callback | Local HTTP server (127.0.0.1, random port) |
