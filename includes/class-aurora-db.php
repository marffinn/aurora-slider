<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Everything lives in three custom tables:
 *   aurora_sliders  - one row per slider (title + settings JSON)
 *   aurora_slides   - one row per slide (layers, background, overlay as JSON)
 *   aurora_options  - plugin-wide settings (global defaults, db version)
 */
class Aurora_DB {

	/* ------------------------------------------------------------------ */
	/* Option lists                                                        */
	/* ------------------------------------------------------------------ */

	public static function transitions() {
		return array(
			'fade'     => 'Crossfade',
			'slide'    => 'Horizontal slide',
			'vertical' => 'Vertical slide',
			'zoom'     => 'Zoom',
			'flip'     => '3D flip',
			'blur'     => 'Blur dissolve',
			'curtain'  => 'Curtain wipe',
			'rotate'   => 'Spin & scale',
			'random'   => 'Random',
		);
	}

	public static function anims() {
		return array(
			'none'       => 'None',
			'fade'       => 'Fade',
			'fade-up'    => 'Fade up',
			'fade-down'  => 'Fade down',
			'fade-left'  => 'Fade from left',
			'fade-right' => 'Fade from right',
			'zoom-in'    => 'Zoom in',
			'zoom-out'   => 'Zoom out',
			'rotate-in'  => 'Rotate in',
			'flip-x'     => 'Flip',
			'blur-in'    => 'Blur in',
			'bounce-in'  => 'Bounce in',
			'skew-in'    => 'Skew in',
			'reveal'     => 'Wipe reveal',
		);
	}

	/* ------------------------------------------------------------------ */
	/* Install                                                             */
	/* ------------------------------------------------------------------ */

	public static function t( $name ) {
		global $wpdb;
		return $wpdb->prefix . 'aurora_' . $name;
	}

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$c = $wpdb->get_charset_collate();
		$p = $wpdb->prefix . 'aurora_';

		dbDelta(
			array(
				"CREATE TABLE {$p}sliders (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  title varchar(200) NOT NULL DEFAULT '',
  settings longtext NOT NULL,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id)
) $c;",
				"CREATE TABLE {$p}slides (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  slider_id bigint(20) unsigned NOT NULL,
  position int(11) NOT NULL DEFAULT 0,
  data longtext NOT NULL,
  PRIMARY KEY  (id),
  KEY slider_id (slider_id)
) $c;",
				"CREATE TABLE {$p}options (
  option_key varchar(100) NOT NULL,
  option_value longtext,
  PRIMARY KEY  (option_key)
) $c;",
			)
		);

		if ( null === self::get_option( 'global' ) ) {
			self::set_option( 'global', self::default_global() );
		}
		self::set_option( 'db_version', AURORA_VERSION );
	}

	public static function maybe_upgrade() {
		global $wpdb;
		$wpdb->suppress_errors( true );
		$v = self::get_option( 'db_version' );
		$wpdb->suppress_errors( false );
		if ( AURORA_VERSION !== $v ) {
			self::install();
		}
	}

	/* ------------------------------------------------------------------ */
	/* Options table                                                       */
	/* ------------------------------------------------------------------ */

	public static function get_option( $key, $default = null ) {
		global $wpdb;
		$t = self::t( 'options' );
		$r = $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM $t WHERE option_key = %s", $key ) ); // phpcs:ignore
		if ( null === $r ) {
			return $default;
		}
		$j = json_decode( $r, true );
		return null === $j ? $default : $j;
	}

	public static function set_option( $key, $value ) {
		global $wpdb;
		$wpdb->replace(
			self::t( 'options' ),
			array(
				'option_key'   => $key,
				'option_value' => wp_json_encode( $value ),
			)
		);
	}

	/* ------------------------------------------------------------------ */
	/* Defaults                                                            */
	/* ------------------------------------------------------------------ */

	public static function default_global() {
		return array(
			'transition'        => 'slide',
			'speed'             => 800,
			'autoplay'          => true,
			'delay'             => 5000,
			'arrowPrevImage'    => '',
			'arrowNextImage'    => '',
			'customCss'         => '',
			'deleteOnUninstall' => false,
		);
	}

	public static function default_settings() {
		return array(
			'transition' => 'slide',
			'speed'      => 800,
			'autoplay'   => true,
			'delay'      => 5000,
			'pauseHover' => true,
			'loop'       => true,
			'swipe'      => true,
			'keyboard'   => true,
			'progress'   => false,
			'kenburns'   => false,
			'maxWidth'   => 0,
			'height'     => array(
				'desktop' => 560,
				'tablet'  => 440,
				'mobile'  => 340,
			),
			'arrows'     => array(
				'enabled'    => true,
				'style'      => 'circle',
				'size'       => 48,
				'color'      => '#ffffff',
				'bg'         => '#000000',
				'bgOpacity'  => 35,
				'offset'     => 20,
				'hoverOnly'  => false,
				'hideMobile' => false,
				'prevImage'  => '',
				'nextImage'  => '',
			),
			'dots'       => array(
				'enabled'         => true,
				'style'           => 'dots',
				'position'        => 'bottom-center',
				'size'            => 12,
				'gap'             => 8,
				'color'           => '#ffffff',
				'active'          => '#7c5cff',
				'inactiveOpacity' => 55,
				'offset'          => 22,
			),
		);
	}

	/** Defaults for a brand-new slider: base defaults + global overrides. */
	public static function new_slider_settings() {
		$g = self::get_global();
		$s = self::default_settings();
		foreach ( array( 'transition', 'speed', 'autoplay', 'delay' ) as $k ) {
			$s[ $k ] = $g[ $k ];
		}
		return $s;
	}

	public static function starter_slide() {
		return self::sanitize_slide(
			array(
				'bg'      => array( 'color' => '#1b1740' ),
				'overlay' => array( 'opacity' => 25 ),
				'layers'  => array(
					array(
						'type' => 'text',
						'name' => 'Headline',
						'x'    => 8,
						'y'    => 26,
						'w'    => 55,
						'html' => '<h2 style="font-size:64px;font-weight:800;color:#ffffff;">Make it unforgettable</h2><p style="font-size:22px;color:#dcd8ff;">Drag me around and edit me with the WYSIWYG editor.</p>',
						'anim' => array(
							'in'       => 'fade-up',
							'delay'    => 300,
							'duration' => 900,
						),
					),
					array(
						'type'  => 'button',
						'name'  => 'Button',
						'x'     => 8,
						'y'     => 66,
						'label' => 'Learn more',
						'url'   => '#',
						'anim'  => array(
							'in'       => 'zoom-in',
							'delay'    => 800,
							'duration' => 700,
						),
					),
				),
			)
		);
	}

	/* ------------------------------------------------------------------ */
	/* Sanitizing helpers                                                  */
	/* ------------------------------------------------------------------ */

	private static function b( $arr, $key, $def ) {
		return isset( $arr[ $key ] ) ? (bool) filter_var( $arr[ $key ], FILTER_VALIDATE_BOOLEAN ) : $def;
	}

	private static function n( $v, $def, $min, $max ) {
		return is_numeric( $v ) ? max( $min, min( $max, $v + 0 ) ) : $def;
	}

	private static function e( $v, $def, $allowed ) {
		return in_array( $v, $allowed, true ) ? $v : $def;
	}

	private static function c( $v, $def ) {
		$x = is_string( $v ) ? sanitize_hex_color( $v ) : null;
		return $x ? $x : $def;
	}

	private static function u( $v ) {
		return is_string( $v ) ? esc_url_raw( $v ) : '';
	}

	private static function id( $v ) {
		$v = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $v );
		return $v ? $v : 'l' . wp_generate_password( 7, false, false );
	}

	public static function sanitize_global( $in ) {
		$d  = self::default_global();
		$in = is_array( $in ) ? $in : array();
		return array(
			'transition'        => self::e( $in['transition'] ?? '', $d['transition'], array_keys( self::transitions() ) ),
			'speed'             => self::n( $in['speed'] ?? null, $d['speed'], 100, 5000 ),
			'autoplay'          => self::b( $in, 'autoplay', $d['autoplay'] ),
			'delay'             => self::n( $in['delay'] ?? null, $d['delay'], 1000, 60000 ),
			'arrowPrevImage'    => self::u( $in['arrowPrevImage'] ?? '' ),
			'arrowNextImage'    => self::u( $in['arrowNextImage'] ?? '' ),
			'customCss'         => wp_strip_all_tags( (string) ( $in['customCss'] ?? '' ) ),
			'deleteOnUninstall' => self::b( $in, 'deleteOnUninstall', false ),
		);
	}

	public static function sanitize_settings( $in ) {
		$d  = self::default_settings();
		$in = is_array( $in ) ? $in : array();
		$h  = isset( $in['height'] ) && is_array( $in['height'] ) ? $in['height'] : array();
		$a  = isset( $in['arrows'] ) && is_array( $in['arrows'] ) ? $in['arrows'] : array();
		$t  = isset( $in['dots'] ) && is_array( $in['dots'] ) ? $in['dots'] : array();

		return array(
			'transition' => self::e( $in['transition'] ?? '', $d['transition'], array_keys( self::transitions() ) ),
			'speed'      => self::n( $in['speed'] ?? null, $d['speed'], 100, 5000 ),
			'autoplay'   => self::b( $in, 'autoplay', $d['autoplay'] ),
			'delay'      => self::n( $in['delay'] ?? null, $d['delay'], 1000, 60000 ),
			'pauseHover' => self::b( $in, 'pauseHover', $d['pauseHover'] ),
			'loop'       => self::b( $in, 'loop', $d['loop'] ),
			'swipe'      => self::b( $in, 'swipe', $d['swipe'] ),
			'keyboard'   => self::b( $in, 'keyboard', $d['keyboard'] ),
			'progress'   => self::b( $in, 'progress', $d['progress'] ),
			'kenburns'   => self::b( $in, 'kenburns', $d['kenburns'] ),
			'maxWidth'   => self::n( $in['maxWidth'] ?? null, 0, 0, 3000 ),
			'height'     => array(
				'desktop' => self::n( $h['desktop'] ?? null, $d['height']['desktop'], 120, 1400 ),
				'tablet'  => self::n( $h['tablet'] ?? null, $d['height']['tablet'], 120, 1400 ),
				'mobile'  => self::n( $h['mobile'] ?? null, $d['height']['mobile'], 120, 1400 ),
			),
			'arrows'     => array(
				'enabled'    => self::b( $a, 'enabled', $d['arrows']['enabled'] ),
				'style'      => self::e( $a['style'] ?? '', $d['arrows']['style'], array( 'circle', 'square', 'minimal', 'custom' ) ),
				'size'       => self::n( $a['size'] ?? null, $d['arrows']['size'], 16, 140 ),
				'color'      => self::c( $a['color'] ?? '', $d['arrows']['color'] ),
				'bg'         => self::c( $a['bg'] ?? '', $d['arrows']['bg'] ),
				'bgOpacity'  => self::n( $a['bgOpacity'] ?? null, $d['arrows']['bgOpacity'], 0, 100 ),
				'offset'     => self::n( $a['offset'] ?? null, $d['arrows']['offset'], -40, 200 ),
				'hoverOnly'  => self::b( $a, 'hoverOnly', false ),
				'hideMobile' => self::b( $a, 'hideMobile', false ),
				'prevImage'  => self::u( $a['prevImage'] ?? '' ),
				'nextImage'  => self::u( $a['nextImage'] ?? '' ),
			),
			'dots'       => array(
				'enabled'         => self::b( $t, 'enabled', $d['dots']['enabled'] ),
				'style'           => self::e( $t['style'] ?? '', $d['dots']['style'], array( 'dots', 'lines', 'numbers' ) ),
				'position'        => self::e( $t['position'] ?? '', $d['dots']['position'], array( 'bottom-center', 'bottom-left', 'bottom-right', 'top-center', 'right-center' ) ),
				'size'            => self::n( $t['size'] ?? null, $d['dots']['size'], 6, 40 ),
				'gap'             => self::n( $t['gap'] ?? null, $d['dots']['gap'], 0, 40 ),
				'color'           => self::c( $t['color'] ?? '', $d['dots']['color'] ),
				'active'          => self::c( $t['active'] ?? '', $d['dots']['active'] ),
				'inactiveOpacity' => self::n( $t['inactiveOpacity'] ?? null, $d['dots']['inactiveOpacity'], 10, 100 ),
				'offset'          => self::n( $t['offset'] ?? null, $d['dots']['offset'], 0, 200 ),
			),
		);
	}

	public static function sanitize_slide( $in ) {
		$in = is_array( $in ) ? $in : array();
		$bg = isset( $in['bg'] ) && is_array( $in['bg'] ) ? $in['bg'] : array();
		$ov = isset( $in['overlay'] ) && is_array( $in['overlay'] ) ? $in['overlay'] : array();

		$out = array(
			'id'      => self::id( $in['id'] ?? '' ),
			'name'    => sanitize_text_field( $in['name'] ?? '' ),
			'bg'      => array(
				'image'    => self::u( $bg['image'] ?? '' ),
				'color'    => self::c( $bg['color'] ?? '', '#1b1740' ),
				'size'     => self::e( $bg['size'] ?? '', 'cover', array( 'cover', 'contain' ) ),
				'position' => self::e( $bg['position'] ?? '', 'center center', array( 'center center', 'top center', 'bottom center', 'left center', 'right center' ) ),
			),
			'overlay' => array(
				'color'   => self::c( $ov['color'] ?? '', '#000000' ),
				'opacity' => self::n( $ov['opacity'] ?? null, 30, 0, 100 ),
			),
			'layers'  => array(),
		);

		$layers = isset( $in['layers'] ) && is_array( $in['layers'] ) ? $in['layers'] : array();
		foreach ( array_slice( $layers, 0, 60 ) as $l ) {
			$out['layers'][] = self::sanitize_layer( $l );
		}
		return $out;
	}

	public static function sanitize_layer( $l ) {
		$l    = is_array( $l ) ? $l : array();
		$type = self::e( $l['type'] ?? '', 'text', array( 'text', 'button', 'image' ) );
		$a    = isset( $l['anim'] ) && is_array( $l['anim'] ) ? $l['anim'] : array();
		$s    = isset( $l['style'] ) && is_array( $l['style'] ) ? $l['style'] : array();

		$o = array(
			'id'   => self::id( $l['id'] ?? '' ),
			'type' => $type,
			'name' => sanitize_text_field( $l['name'] ?? '' ),
			'x'    => self::n( $l['x'] ?? null, 10, 0, 100 ),
			'y'    => self::n( $l['y'] ?? null, 30, 0, 100 ),
			'w'    => self::n( $l['w'] ?? null, 45, 2, 100 ),
			'ax'   => self::e( $l['ax'] ?? '', 'left', array( 'left', 'center', 'right' ) ),
			'ay'   => self::e( $l['ay'] ?? '', 'top', array( 'top', 'middle', 'bottom' ) ),
			'anim' => array(
				'in'       => self::e( $a['in'] ?? '', 'fade-up', array_keys( self::anims() ) ),
				'delay'    => self::n( $a['delay'] ?? null, 300, 0, 10000 ),
				'duration' => self::n( $a['duration'] ?? null, 800, 50, 5000 ),
			),
		);

		if ( 'text' === $type ) {
			$o['html']   = wp_kses_post( (string) ( $l['html'] ?? '' ) );
			$o['shadow'] = self::b( $l, 'shadow', false );
		} elseif ( 'button' === $type ) {
			$o['label']  = sanitize_text_field( $l['label'] ?? 'Button' );
			$o['url']    = self::u( $l['url'] ?? '' );
			$o['newTab'] = self::b( $l, 'newTab', false );
			$o['style']  = array(
				'bg'         => self::c( $s['bg'] ?? '', '#7c5cff' ),
				'color'      => self::c( $s['color'] ?? '', '#ffffff' ),
				'hoverBg'    => self::c( $s['hoverBg'] ?? '', '#ffffff' ),
				'hoverColor' => self::c( $s['hoverColor'] ?? '', '#1b1740' ),
				'radius'     => self::n( $s['radius'] ?? null, 40, 0, 60 ),
				'fontSize'   => self::n( $s['fontSize'] ?? null, 18, 10, 60 ),
				'weight'     => self::e( (string) ( $s['weight'] ?? '' ), '700', array( '400', '500', '600', '700', '800' ) ),
				'px'         => self::n( $s['px'] ?? null, 34, 0, 100 ),
				'py'         => self::n( $s['py'] ?? null, 16, 0, 60 ),
			);
		} else {
			$o['src'] = self::u( $l['src'] ?? '' );
			$o['alt'] = sanitize_text_field( $l['alt'] ?? '' );
		}
		return $o;
	}

	/* ------------------------------------------------------------------ */
	/* Global settings                                                     */
	/* ------------------------------------------------------------------ */

	public static function get_global() {
		return self::sanitize_global( self::get_option( 'global', array() ) );
	}

	public static function save_global( $in ) {
		$clean = self::sanitize_global( $in );
		self::set_option( 'global', $clean );
		return $clean;
	}

	/* ------------------------------------------------------------------ */
	/* Sliders CRUD                                                        */
	/* ------------------------------------------------------------------ */

	public static function get_sliders() {
		global $wpdb;
		$s    = self::t( 'sliders' );
		$sl   = self::t( 'slides' );
		$rows = $wpdb->get_results( "SELECT s.id, s.title, s.updated_at, (SELECT COUNT(*) FROM $sl x WHERE x.slider_id = s.id) AS slides FROM $s s ORDER BY s.id DESC", ARRAY_A ); // phpcs:ignore
		$rows = (array) $rows;
		foreach ( $rows as &$r ) {
			$r['id']       = (int) $r['id'];
			$r['slides']   = (int) $r['slides'];
			$r['thumb']    = '';
			$r['color']    = '#1b1740';
			$r['headline'] = '';
			$first         = $wpdb->get_var( $wpdb->prepare( "SELECT data FROM $sl WHERE slider_id = %d ORDER BY position ASC, id ASC LIMIT 1", $r['id'] ) ); // phpcs:ignore
			if ( $first ) {
				$sd         = self::sanitize_slide( json_decode( $first, true ) );
				$r['thumb'] = $sd['bg']['image'];
				$r['color'] = $sd['bg']['color'];
				foreach ( $sd['layers'] as $ly ) {
					if ( 'text' === $ly['type'] ) {
						$r['headline'] = mb_substr( trim( wp_strip_all_tags( $ly['html'] ) ), 0, 70 );
						break;
					}
				}
			}
		}
		unset( $r );
		return $rows;
	}

	public static function get_slider( $id ) {
		global $wpdb;
		$id  = (int) $id;
		$s   = self::t( 'sliders' );
		$sl  = self::t( 'slides' );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $s WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore
		if ( ! $row ) {
			return null;
		}
		$rows   = $wpdb->get_results( $wpdb->prepare( "SELECT data FROM $sl WHERE slider_id = %d ORDER BY position ASC, id ASC", $id ), ARRAY_A ); // phpcs:ignore
		$slides = array();
		foreach ( (array) $rows as $r ) {
			$slides[] = self::sanitize_slide( json_decode( $r['data'], true ) );
		}
		return array(
			'id'         => (int) $row['id'],
			'title'      => $row['title'],
			'settings'   => self::sanitize_settings( json_decode( $row['settings'], true ) ),
			'slides'     => $slides,
			'updated_at' => $row['updated_at'],
		);
	}

	public static function create_slider( $title = '', $settings = null, $slides = null ) {
		global $wpdb;
		$now = current_time( 'mysql' );
		$wpdb->insert(
			self::t( 'sliders' ),
			array(
				'title'      => $title ? sanitize_text_field( $title ) : 'Untitled slider',
				'settings'   => wp_json_encode( self::sanitize_settings( null === $settings ? self::new_slider_settings() : $settings ) ),
				'created_at' => $now,
				'updated_at' => $now,
			)
		);
		$id = (int) $wpdb->insert_id;
		self::write_slides( $id, null === $slides ? array( self::starter_slide() ) : $slides );
		return $id;
	}

	private static function write_slides( $id, $slides ) {
		global $wpdb;
		$wpdb->delete( self::t( 'slides' ), array( 'slider_id' => $id ) );
		foreach ( array_slice( array_values( (array) $slides ), 0, 50 ) as $i => $sd ) {
			$wpdb->insert(
				self::t( 'slides' ),
				array(
					'slider_id' => $id,
					'position'  => $i,
					'data'      => wp_json_encode( self::sanitize_slide( $sd ) ),
				)
			);
		}
	}

	public static function save_slider( $id, $title, $settings, $slides ) {
		global $wpdb;
		$id = (int) $id;
		$wpdb->update(
			self::t( 'sliders' ),
			array(
				'title'      => sanitize_text_field( $title ),
				'settings'   => wp_json_encode( self::sanitize_settings( $settings ) ),
				'updated_at' => current_time( 'mysql' ),
			),
			array( 'id' => $id )
		);
		self::write_slides( $id, $slides );
	}

	public static function delete_slider( $id ) {
		global $wpdb;
		$wpdb->delete( self::t( 'slides' ), array( 'slider_id' => (int) $id ) );
		$wpdb->delete( self::t( 'sliders' ), array( 'id' => (int) $id ) );
	}

	public static function duplicate_slider( $id ) {
		$s = self::get_slider( $id );
		if ( ! $s ) {
			return 0;
		}
		foreach ( $s['slides'] as $si => $sl ) {
			$s['slides'][ $si ]['id'] = '';
			foreach ( $sl['layers'] as $li => $ly ) {
				$s['slides'][ $si ]['layers'][ $li ]['id'] = '';
			}
		}
		return self::create_slider( $s['title'] . ' (copy)', $s['settings'], $s['slides'] );
	}
}
