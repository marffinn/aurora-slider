<?php
/**
 * Plugin Name: Aurora Slider
 * Description: Modern responsive slider with a visual drag-and-drop layer editor, WYSIWYG animated text, freely movable buttons, multiple transitions and custom arrow graphics. All sliders, slides and settings are stored in dedicated database tables.
 * Version: 1.0.3
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * Author: Aurora
 * License: GPL-2.0-or-later
 * Text Domain: aurora-slider
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'AURORA_VERSION', '1.0.2' );
define( 'AURORA_DIR', plugin_dir_path( __FILE__ ) );
define( 'AURORA_URL', plugin_dir_url( __FILE__ ) );

require_once AURORA_DIR . 'includes/class-aurora-db.php';
require_once AURORA_DIR . 'includes/class-aurora-rest.php';
require_once AURORA_DIR . 'includes/class-aurora-admin.php';
require_once AURORA_DIR . 'includes/class-aurora-render.php';

register_activation_hook( __FILE__, array( 'Aurora_DB', 'install' ) );

add_action(
	'plugins_loaded',
	function () {
		Aurora_REST::init();
		Aurora_Admin::init();
		Aurora_Render::init();
	}
);

/**
 * Template tag: <?php aurora_slider( 1 ); ?>
 */
function aurora_slider( $id, $echo = true ) {
	$html = Aurora_Render::html( (int) $id );
	if ( $echo ) {
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput -- escaped while building.
		return '';
	}
	return $html;
}
