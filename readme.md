=== Aurora Slider ===
Requires at least: 5.8
Requires PHP: 7.4
Stable tag: 1.0.1
License: GPLv2 or later

Responsive slider with a visual layer editor, WYSIWYG animated text, movable buttons, 8 transitions, custom arrow graphics and a styled dashboard.

== Usage ==
1. Activate the plugin and open "Aurora Slider" in the admin menu.
2. Create a slider, edit it, press "Save changes".
3. Add [aurora_slider id="1"] to any page, or <?php aurora_slider( 1 ); ?> to a template.

== Data ==
Sliders, slides and settings are stored in the tables {prefix}aurora_sliders, {prefix}aurora_slides and {prefix}aurora_options.

== Changes in 1.0.1 ==
The admin editor now uses a preview-first vertical layout. The complete editing tools panel appears underneath the live slider preview, followed by the slide strip and WYSIWYG text editor. Existing REST API, media-library, drag-and-drop, resize, and save functionality is unchanged.
