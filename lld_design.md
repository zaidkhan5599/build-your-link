# Low-Level Design (LLD): Build Your Link

This document outlines the low-level component specifications, database schema constraints, REST API payloads, and style token classes for the **Build Your Link** platform.

---

## 1. Database Schema Design (MySQL)

The platform maintains four tables with strict constraint relationships inside the `liinks_db` database:

### Table: `users`
Tracks administrator and creator user credentials.
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `username` VARCHAR(50) UNIQUE NOT NULL (indexed)
- `email` VARCHAR(100) UNIQUE NOT NULL (indexed)
- `password` VARCHAR(255) NOT NULL
- `first_name` VARCHAR(100) DEFAULT ''
- `last_name` VARCHAR(100) DEFAULT ''
- `mobile_number` VARCHAR(50) DEFAULT ''
- `role` VARCHAR(20) DEFAULT 'user' ('user', 'admin')
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Table: `profiles`
Tracks profile branding configurations, styling parameters, and layout modes.
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `user_id` INT (FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE)
- `name` VARCHAR(100) DEFAULT ''
- `bio` TEXT
- `avatar_url` VARCHAR(2083) DEFAULT ''
- `theme_id` VARCHAR(50) DEFAULT 'midnight-premium'
- `social_links` JSON (stores Instagram, Twitter, LinkedIn, etc., as key-value pairs)
- `font_family` VARCHAR(50) DEFAULT 'Outfit'
- `bg_type` VARCHAR(20) DEFAULT 'preset' ('preset', 'color', 'gradient')
- `custom_bg` VARCHAR(255) DEFAULT ''
- `btn_shape` VARCHAR(30) DEFAULT 'rounded' ('rounded', 'pill', 'sharp')
- `btn_style` VARCHAR(30) DEFAULT 'solid' ('solid', 'glass', 'outline')
- `layout_mode` VARCHAR(30) DEFAULT 'mobile-card' ('mobile-card', 'full-page')
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Table: `links`
Tracks active profile content blocks, text subheadings, and media feeds.
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `user_id` INT (FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE)
- `title` VARCHAR(255) NOT NULL
- `url` VARCHAR(2083) DEFAULT ''
- `sort_order` INT DEFAULT 0 (used for array drag/drop sequence weight)
- `clicks` INT DEFAULT 0
- `is_active` TINYINT(1) DEFAULT 1
- `type` VARCHAR(50) DEFAULT 'link' ('link', 'instagram', 'facebook', 'linkedin', 'text', 'youtube')
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Table: `analytics`
Logs profile views and outbound button clicks.
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `profile_user_id` INT (FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE)
- `event_type` VARCHAR(20) NOT NULL ('view', 'click')
- `link_id` INT NULL (FOREIGN KEY REFERENCES links(id) ON DELETE CASCADE)
- `referrer` VARCHAR(255) DEFAULT ''
- `event_date` DATE NOT NULL (default current date)
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

---

## 2. API Endpoints Specification

### Authentication API (auth.js)
- **`POST /api/auth/register`**: Registers a new account.
  - Body: `{ username, email, password, first_name, last_name, mobile_number }`
  - Success: `201 Created`
- **`POST /api/auth/login`**: Authenticates user and assigns cookies.
  - Body: `{ email, password }` (Can also accept username in `loginIdentifier` payload)
  - Success: `200 OK`
- **`POST /api/auth/logout`**: Clears user session.
  - Success: `200 OK`

### Links Block API (api.js)
- **`GET /api/links`**: Retrieves all block elements for the logged-in user.
  - Returns: `200 OK` with JSON array ordered by `sort_order`.
- **`POST /api/links`**: Appends a new block element.
  - Body: `{ title, url, type }` (where `type` is `link`, `text`, `youtube`, `instagram`, etc.)
  - Success: `201 Created`
- **`PUT /api/links/:id`**: Modifies block text, URLs, or active toggle.
  - Body: `{ title, url, is_active }`
- **`DELETE /api/links/:id`**: Removes block.
- **`POST /api/links/reorder`**: Saves re-sorted blocks order.
  - Body: `{ order: [ { id, sort_order }, ... ] }`

### Profile Styling API (api.js)
- **`GET /api/profile`**: Fetches style details for the current user.
- **`POST /api/profile`**: Saves custom style updates.
  - Body: `{ name, bio, avatar_url, social_links, font_family, bg_type, custom_bg, btn_shape, btn_style, layout_mode }`
  - Success: `200 OK`

---

## 3. Client-Side Event Handling

### Silent Save Debouncer (dashboard.js)
Autosaving is controlled by a timeout queue to aggregate layout input updates:
```javascript
let silentSaveTimeout = null;

function saveProfileSilently() {
  clearTimeout(silentSaveTimeout);
  silentSaveTimeout = setTimeout(() => {
    saveProfile(false); // Sends background POST without alert blocking
  }, 800);
}
```

### YouTube Video ID Extraction Helper
Handles standard watch, embedded, or short mobile URLs:
```javascript
function getYouTubeVideoId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}
```

---

## 4. CSS Class Configurations (style.css)

### 1. Typography Fonts Systems
- **Outfit**: `.font-outfit { font-family: 'Outfit', sans-serif; }`
- **Inter**: `.font-inter { font-family: 'Inter', sans-serif; }`
- **Playfair Display**: `.font-playfair { font-family: 'Playfair Display', serif; }`
- **Space Grotesk**: `.font-grotesk { font-family: 'Space Grotesk', sans-serif; }`

### 2. Card Corner Formats
- **Rounded**: `.btn-shape-rounded { border-radius: var(--btn-radius, 12px); }`
- **Capsule Pill**: `.btn-shape-pill { border-radius: 9999px; }`
- **Sharp Corners**: `.btn-shape-sharp { border-radius: 0px; }`

### 3. Card Fills
- **Solid**: `.btn-style-solid` (default theme background fills).
- **Glassmorphic**: `.btn-style-glass` (transparent borders with frosted glass backgrounds).
- **Outline**: `.btn-style-outline` (transparent background with visible solid borders).

### 4. Custom Social Card Branding
- **brand-instagram**: Solid gradient background (`#f09433` -> `#bc1888`), white text, left-aligned logo.
- **brand-facebook**: Solid Facebook blue (`#1877f2`), white text.
- **brand-linkedin**: Professional blue (`#0077b5`), white text.
- Outlines/Glass styles adapt text colors to their respective brand palettes.
