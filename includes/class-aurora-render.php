<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Aurora_Render {

	private static $count      = 0;
	private static $css_added  = false;

	public static function init() {
		add_shortcode( 'aurora_slider', array( __CLASS__, 'shortcode' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'register' ) );
	}

	public static function register() {
		wp_register_style( 'aurora-slider', AURORA_URL . 'public/slider.css', array(), AURORA_VERSION );
		wp_register_script( 'aurora-slider', AURORA_URL . 'public/slider.js', array(), AURORA_VERSION, true );
	}

	public static function shortcode( $atts ) {
		$a = shortcode_atts( array( 'id' => 0 ), $atts, 'aurora_slider' );
		return self::html( (int) $a['id'] );
	}

	private static function assets( $global ) {
		if ( ! wp_style_is( 'aurora-slider', 'registered' ) ) {
			self::register();
		}
		wp_enqueue_style( 'aurora-slider' );
		wp_enqueue_script( 'aurora-slider' );
		if ( ! self::$css_added && ! empty( $global['customCss'] ) ) {
			wp_add_inline_style( 'aurora-slider', $global['customCss'] );
			self::$css_added = true;
		}
	}

	private static function rgba( $hex, $pct ) {
		$h = ltrim( $hex, '#' );
		if ( 3 === strlen( $h ) ) {
			$h = $h[0] . $h[0] . $h[1] . $h[1] . $h[2] . $h[2];
		}
		return 'rgba(' . hexdec( substr( $h, 0, 2 ) ) . ',' . hexdec( substr( $h, 2, 2 ) ) . ',' . hexdec( substr( $h, 4, 2 ) ) . ',' . round( $pct / 100, 3 ) . ')';
	}

	private static function css_url( $url ) {
		return "url('" . str_replace( array( "'", '"', '(', ')', ' ' ), array( '%27', '%22', '%28', '%29', '%20' ), $url ) . "')";
	}

	private static function arrow_svg( $dir ) {
		$d = 'prev' === $dir ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7';
		return '<svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' . $d . '"/></svg>';
	}

	public static function html( $id ) {
		$s = Aurora_DB::get_slider( $id );
		if ( ! $s || empty( $s['slides'] ) ) {
			return '';
		}
		$g = Aurora_DB::get_global();
		self::assets( $g );

		$set = $s['settings'];
		$ar  = $set['arrows'];
		$dt  = $set['dots'];
		$uid = 'aurora-slider-' . (int) $id . '-' . ( ++self::$count );
		$h   = $set['height'];
		$n   = count( $s['slides'] );

		$prev_img = $ar['prevImage'] ? $ar['prevImage'] : $g['arrowPrevImage'];
		$next_img = $ar['nextImage'] ? $ar['nextImage'] : $g['arrowNextImage'];
		$custom   = 'custom' === $ar['style'] && $prev_img && $next_img;

		$vars = '--as-h:' . (int) $h['desktop'] . 'px;'
			. '--as-arrow-size:' . (int) $ar['size'] . 'px;--as-arrow-color:' . $ar['color'] . ';'
			. '--as-arrow-bg:' . self::rgba( $ar['bg'], $ar['bgOpacity'] ) . ';--as-arrow-off:' . (int) $ar['offset'] . 'px;'
			. '--as-dot-size:' . (int) $dt['size'] . 'px;--as-dot-gap:' . (int) $dt['gap'] . 'px;'
			. '--as-dot-color:' . $dt['color'] . ';--as-dot-active:' . $dt['active'] . ';'
			. '--as-dot-op:' . ( $dt['inactiveOpacity'] / 100 ) . ';--as-dot-off:' . (int) $dt['offset'] . 'px;';
		if ( $set['maxWidth'] ) {
			$vars .= 'max-width:' . (int) $set['maxWidth'] . 'px;margin-left:auto;margin-right:auto;';
		}

		$classes = array( 'aurora-slider', 'as-arrows-' . $ar['style'] );
		if ( $ar['hoverOnly'] ) {
			$classes[] = 'as-arrows-hover';
		}
		if ( $ar['hideMobile'] ) {
			$classes[] = 'as-arrows-nomobile';
		}
		if ( $set['kenburns'] ) {
			$classes[] = 'as-kb';
		}

		$cfg = array(
			'transition' => $set['transition'],
			'speed'      => $set['speed'],
			'autoplay'   => $set['autoplay'],
			'delay'      => $set['delay'],
			'pauseHover' => $set['pauseHover'],
			'loop'       => $set['loop'],
			'swipe'      => $set['swipe'],
			'keyboard'   => $set['keyboard'],
		);

		$out  = '<style>@media(max-width:1024px){#' . $uid . '{--as-h:' . (int) $h['tablet'] . 'px}}@media(max-width:640px){#' . $uid . '{--as-h:' . (int) $h['mobile'] . 'px}}</style>';
		$out .= '<div id="' . esc_attr( $uid ) . '" class="' . esc_attr( implode( ' ', $classes ) ) . '" style="' . esc_attr( $vars ) . '" data-config="' . esc_attr( wp_json_encode( $cfg ) ) . '" tabindex="0" role="region" aria-roledescription="carousel" aria-label="' . esc_attr( $s['title'] ) . '">';
		$out .= '<div class="as-track">';

		foreach ( $s['slides'] as $i => $slide ) {
			$bg    = 'background-color:' . $slide['bg']['color'] . ';';
			$bgimg = '';
			if ( $slide['bg']['image'] ) {
				$bgimg = 'background-image:' . self::css_url( $slide['bg']['image'] ) . ';background-size:' . $slide['bg']['size'] . ';background-position:' . $slide['bg']['position'] . ';';
			}
			$out .= '<div class="as-slide' . ( 0 === $i ? ' is-active' : '' ) . '" role="group" aria-roledescription="slide" aria-label="' . esc_attr( ( $i + 1 ) . ' / ' . $n ) . '">';
			$out .= '<div class="as-bg" style="' . esc_attr( $bg . $bgimg ) . '"></div>';
			$out .= '<div class="as-ov" style="background:' . esc_attr( self::rgba( $slide['overlay']['color'], $slide['overlay']['opacity'] ) ) . '"></div>';
			$out .= '<div class="as-layers">';
			foreach ( $slide['layers'] as $l ) {
				$out .= self::layer( $l );
			}
			$out .= '</div></div>';
		}
		$out .= '</div>';

		if ( $n > 1 && $ar['enabled'] ) {
			foreach ( array( 'prev', 'next' ) as $dir ) {
				$img  = 'prev' === $dir ? $prev_img : $next_img;
				$out .= '<button type="button" class="as-arrow as-' . $dir . '" aria-label="' . ( 'prev' === $dir ? 'Previous slide' : 'Next slide' ) . '">';
				$out .= $custom ? '<img src="' . esc_url( $img ) . '" alt="" />' : self::arrow_svg( $dir );
				$out .= '</button>';
			}
		}

		if ( $n > 1 && $dt['enabled'] ) {
			$out .= '<div class="as-dots as-dots-' . esc_attr( $dt['style'] ) . ' as-pos-' . esc_attr( $dt['position'] ) . '">';
			for ( $i = 0; $i < $n; $i++ ) {
				$out .= '<button type="button" data-i="' . $i . '" aria-label="' . esc_attr( 'Go to slide ' . ( $i + 1 ) ) . '"' . ( 0 === $i ? ' class="is-active"' : '' ) . '>' . ( 'numbers' === $dt['style'] ? ( $i + 1 ) : '' ) . '</button>';
			}
			$out .= '</div>';
		}

		if ( $n > 1 && $set['progress'] && $set['autoplay'] ) {
			$out .= '<div class="as-progress"><span></span></div>';
		}

		return $out . '</div>';
	}

	private static function layer( $l ) {
		$tx = array(
			'left'   => '0',
			'center' => '-50%',
			'right'  => '-100%',
		);
		$ty = array(
			'top'    => '0',
			'middle' => '-50%',
			'bottom' => '-100%',
		);

		$pos = 'left:' . $l['x'] . '%;top:' . $l['y'] . '%;';
		if ( 'button' !== $l['type'] ) {
			$pos .= 'width:' . $l['w'] . '%;';
		}
		$pos .= 'transform:translate(' . $tx[ $l['ax'] ] . ',' . $ty[ $l['ay'] ] . ');';

		$a      = $l['anim'];
		$an     = 'none' === $a['in'] ? 'none' : 'as-' . $a['in'];
		$vars   = '--an:' . $an . ';--dur:' . (int) $a['duration'] . 'ms;--delay:' . (int) $a['delay'] . 'ms;';
		$cls    = 'as-layer as-layer-' . $l['type'] . ( 'none' === $a['in'] ? ' as-noanim' : '' );
		$inner  = '';
		$in_cls = 'as-in' . ( ! empty( $l['shadow'] ) ? ' as-shadow' : '' );

		if ( 'text' === $l['type'] ) {
			$inner = wp_kses_post( $l['html'] );
		} elseif ( 'button' === $l['type'] ) {
			$s      = $l['style'];
			$bv     = '--as-bb:' . $s['bg'] . ';--as-bc:' . $s['color'] . ';--as-bhb:' . $s['hoverBg'] . ';--as-bhc:' . $s['hoverColor']
				. ';--as-br:' . (int) $s['radius'] . 'px;--as-bfs:' . (int) $s['fontSize'] . 'px;--as-bfw:' . $s['weight']
				. ';--as-bpx:' . (int) $s['px'] . 'px;--as-bpy:' . (int) $s['py'] . 'px;';
			$target = ! empty( $l['newTab'] ) ? ' target="_blank" rel="noopener noreferrer"' : '';
			$href   = $l['url'] ? $l['url'] : '#';
			$inner  = '<a class="as-btn" href="' . esc_url( $href ) . '"' . $target . ' style="' . esc_attr( $bv ) . '">' . esc_html( $l['label'] ) . '</a>';
		} elseif ( $l['src'] ) {
			$inner = '<img src="' . esc_url( $l['src'] ) . '" alt="' . esc_attr( $l['alt'] ) . '" />';
		}

		return '<div class="' . esc_attr( $cls ) . '" style="' . esc_attr( $pos ) . '"><div class="' . esc_attr( $in_cls ) . '" style="' . esc_attr( $vars ) . '">' . $inner . '</div></div>';
	}
}
