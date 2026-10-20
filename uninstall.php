<?php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

global $wpdb;
$options = $wpdb->prefix . 'aurora_options';

$wpdb->suppress_errors( true );
$raw = $wpdb->get_var( "SELECT option_value FROM $options WHERE option_key = 'global'" ); // phpcs:ignore
$wpdb->suppress_errors( false );

$g = $raw ? json_decode( $raw, true ) : array();

// Data is only removed when the "delete on uninstall" option is enabled in Global settings.
if ( ! empty( $g['deleteOnUninstall'] ) ) {
	foreach ( array( 'slides', 'sliders', 'options' ) as $name ) {
		$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}aurora_{$name}" ); // phpcs:ignore
	}
}
