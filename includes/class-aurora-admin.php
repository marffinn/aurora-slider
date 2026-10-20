<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Aurora_Admin {

	const HOOK = 'toplevel_page_aurora-slider';

	public static function init() {
		add_action( 'admin_init', array( 'Aurora_DB', 'maybe_upgrade' ) );
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( AURORA_DIR . 'aurora-slider.php' ), array( __CLASS__, 'links' ) );
	}

	public static function links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=aurora-slider' ) ) . '">Open dashboard</a>' );
		return $links;
	}

	public static function menu() {
		add_menu_page( 'Aurora Slider', 'Aurora Slider', 'manage_options', 'aurora-slider', array( __CLASS__, 'page' ), 'dashicons-images-alt2', 58 );
	}

	public static function page() {
		echo '<div class="aurora-wrap"><div id="aurora-app"><p class="aurora-loading">Loading Aurora Slider…</p></div></div>';
	}

	public static function assets( $hook ) {
		if ( self::HOOK !== $hook ) {
			return;
		}

		wp_enqueue_media();
		wp_enqueue_editor();

		// Frontend stylesheet is reused for the canvas (animation keyframes + button styles).
		wp_enqueue_style( 'aurora-slider', AURORA_URL . 'public/slider.css', array(), AURORA_VERSION );
		wp_enqueue_style( 'aurora-admin', AURORA_URL . 'admin/admin.css', array( 'aurora-slider' ), AURORA_VERSION );
		wp_enqueue_script( 'aurora-admin', AURORA_URL . 'admin/admin.js', array( 'jquery', 'editor', 'media-editor' ), AURORA_VERSION, true );

		$data = array(
			'rest'        => esc_url_raw( rest_url( Aurora_REST::NS . '/' ) ),
			'nonce'       => wp_create_nonce( 'wp_rest' ),
			'version'     => AURORA_VERSION,
			'transitions' => Aurora_DB::transitions(),
			'anims'       => Aurora_DB::anims(),
		);
		wp_add_inline_script( 'aurora-admin', 'window.AuroraAdmin=' . wp_json_encode( $data ) . ';', 'before' );
	}
}
