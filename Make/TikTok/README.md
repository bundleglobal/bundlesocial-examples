# TikTok Image Carousel – Make.com Blueprint

This README describes a **Make.com blueprint** that posts an image carousel to TikTok using the [Bundle.social](https://bundle.social) API.

The scenario uses 5 HTTP modules:

1. Get image 1
2. Upload image 1 to Bundle.social
3. Get image 2
4. Upload image 2 to Bundle.social
5. Create the TikTok post with both images

The **first** module in your scenario (module `1`) is intentionally **not** included here.  
You are expected to add your own data source as module 1 (Notion, Airtable, Google Sheets, etc.).

---

## What this blueprint does

Once you add your own data source as module 1, the blueprint will:

1. Read your API credentials and TikTok content data from module 1.
2. Download two images from URLs provided by your source.
3. Upload both images to Bundle.social using the Upload API.
4. Create a TikTok **image post (carousel)** with those uploaded images.

The final TikTok post uses:

- **Title** – internal post title in Bundle.social
- **Caption** – TikTok text
- **Image 1** and **Image 2** – carousel images

---

## Prerequisites

You will need:

- A Bundle.social account
- A team with at least one TikTok account connected
- A Bundle.social API key with access to that team
- A Make.com account

Your data source (Notion, Airtable, Google Sheets, etc.) must contain at minimum:

- `API Key (from Accounts)`
- `teamId (from Accounts)`
- `Title`
- `Caption`
- `Image 1` (direct image URL)
- `Image 2` (direct image URL)

You can either:

- Use these exact field names in your source, **or**
- Adjust the mapping in the HTTP modules after importing the blueprint.

---

## Modules overview

After importing the blueprint, you will see **5 HTTP modules** that should be connected after your own data source module (module `1`).

### 1. Get image 1 – HTTP > Get a file

- **Purpose:** Download the first image.
- **URL:** Uses the `Image 1` URL output from module 1.
- **Input:** `Image 1` (URL) from your data source.
- **Output:** A file object used in module 2.

### 2. Upload image 1 – HTTP > Make a request

- **Method:** `POST`
- **URL:** `https://api.bundle.social/api/v1/upload`
- **Headers:**
  - `x-api-key` – from `API Key (from Accounts)` field (module 1)
- **Body type:** `multipart/form-data`
- **Form data:**
  - `file` – file from **Get image 1**
- **Output:**
  - Upload response with an `id` (first `uploadId` for the post).

### 3. Get image 2 – HTTP > Get a file

- **Purpose:** Download the second image.
- **URL:** Uses the `Image 2` URL output from module 1.
- **Input:** `Image 2` (URL) from your data source.
- **Output:** A file object used in module 4.

### 4. Upload image 2 – HTTP > Make a request

- **Method:** `POST`
- **URL:** `https://api.bundle.social/api/v1/upload`
- **Headers:**
  - `x-api-key` – from `API Key (from Accounts)` field (module 1)
- **Body type:** `multipart/form-data`
- **Form data:**
  - `file` – file from **Get image 2**
- **Output:**
  - Upload response with an `id` (second `uploadId` for the post).

### 5. Create TikTok post – HTTP > Make a request

- **Method:** `POST`
- **URL:** `https://api.bundle.social/api/v1/post/`
- **Headers:**
  - `x-api-key` – from `API Key (from Accounts)`
  - `Content-Type: application/json`
- **Body (example structure):**

```json
{
  "teamId": "<teamId from your data source>",
  "title": "<Title>",
  "postDate": "<now or scheduled time>",
  "status": "SCHEDULED",
  "socialAccountTypes": ["TIKTOK"],
  "data": {
    "TIKTOK": {
      "type": "IMAGE",
      "text": "<Caption>",
      "uploadIds": ["<upload id from image 1>", "<upload id from image 2>"]
    }
  }
}
```

This creates a scheduled TikTok image post (carousel) with both uploads.
