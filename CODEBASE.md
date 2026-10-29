# Aurora Slider — Codebase Index

## Overview

A WordPress plugin that stores slider definitions in custom database tables, exposes them through a REST API, provides a JavaScript drag-and-drop admin editor, and renders sliders through a shortcode.

## Entry points

- `aurora-slider.php` — plugin metadata, constants, includes, lifecycle hooks, and the `aurora_slider()` template helper.
- `[aurora_slider id="123"]` — shortcode for embedding a slider.
- `aurora_slider( 123 )` — PHP template helper.

## Directory map

### `admin/`
- `admin.js` — dashboard application and editor state. Loads slider/settings data from the REST API; renders the slider list, slide canvas, slide strip, inspector tabs, TinyMCE editor, global settings, and help view. Handles canvas dragging/resizing, media picker actions, layer operations, slide operations, and saving.
- `admin.css` — admin shell, sidebar, dashboard cards, canvas, slide strip, inspector fields, editor, responsive layout, and image transform handles.

### `includes/`
- `class-aurora-admin.php` — registers the WordPress admin menu, enqueues editor/media assets, and passes REST nonce/configuration to the dashboard.
- `class-aurora-db.php` — database installation/upgrades, defaults, settings sanitization, slider/slide/layer normalization, and persistence. Layer properties must be whitelisted here to survive saves.
- `class-aurora-rest.php` — REST endpoints used by the admin dashboard for slider CRUD, duplication, and settings.
- `class-aurora-render.php` — shortcode/frontend HTML renderer. Layer properties affecting visible output (such as image flips) must be reflected here as well as in the admin preview.

### `public/`
- `slider.css` — frontend slider layout, animations, navigation, and layer styling. Also loaded in admin to share canvas presentation rules.
- `slider.js` — frontend playback, transitions, autoplay, keyboard/swipe interactions, and navigation.

### Root support files
- `readme.txt` — plugin usage and installation information.
- `uninstall.php` — cleanup behavior when uninstalling.

## Important data flow

1. Admin page loads through `Aurora_Admin::page()`.
2. `admin/admin.js` calls `Aurora_REST` endpoints using the localized REST URL and nonce.
3. `Aurora_DB` sanitizes incoming settings and slide/layer JSON before persistence.
4. The editor preview is assembled by `admin.js`; published output is separately assembled by `Aurora_Render::html()` and `Aurora_Render::layer()`.
5. Any new persisted layer option should be implemented in all three places: admin defaults/editor, `Aurora_DB::sanitize_layer()`, and frontend renderer.

## Key editing locations

- Default layer and slide data: `admin/admin.js` — `defLayer()`, `defSlide()`.
- Admin canvas rendering and sizing: `admin/admin.js` — `layerStyle()`, `layerInner()`, `layerEl()`, `renderStage()`, `fitStage()`.
- Slide and layer inspector: `admin/admin.js` — `pSlide()`, `pLayer()`, `pGeneral()`.
- WYSIWYG editor: `admin/admin.js` — `renderTextBox()`, `initEditor()`.
- Save-safe layer schema: `includes/class-aurora-db.php` — `sanitize_layer()`.
- Published layer output: `includes/class-aurora-render.php` — `layer()`.
- Admin visuals and responsive rules: `admin/admin.css`.

## Recent editor improvements

- Added desktop/tablet/mobile canvas preview profiles using the matching configured height and a representative design width.
- Added image flip state (`flipX`, `flipY`) to the image layer schema, admin preview, and published frontend output.
- Added eight visible transform points for selected non-button layers; the points adjust the layer width.
- Changed TinyMCE's default content canvas to white with dark text.
- Refined responsive admin layout and canvas transform controls.
