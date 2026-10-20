<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Aurora_REST {

	const NS = 'aurora-slider/v1';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function can() {
		return current_user_can( 'manage_options' );
	}

	public static function routes() {
		$can = array( __CLASS__, 'can' );

		register_rest_route(
			self::NS,
			'/sliders',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'get_all' ),
					'permission_callback' => $can,
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( __CLASS__, 'create' ),
					'permission_callback' => $can,
				),
			)
		);

		register_rest_route(
			self::NS,
			'/sliders/(?P<id>\d+)',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'get_one' ),
					'permission_callback' => $can,
				),
				array(
					'methods'             => 'PUT,PATCH,POST',
					'callback'            => array( __CLASS__, 'update' ),
					'permission_callback' => $can,
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => array( __CLASS__, 'delete' ),
					'permission_callback' => $can,
				),
			)
		);

		register_rest_route(
			self::NS,
			'/sliders/(?P<id>\d+)/duplicate',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'duplicate' ),
				'permission_callback' => $can,
			)
		);

		register_rest_route(
			self::NS,
			'/settings',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'get_settings' ),
					'permission_callback' => $can,
				),
				array(
					'methods'             => 'PUT,PATCH,POST',
					'callback'            => array( __CLASS__, 'update_settings' ),
					'permission_callback' => $can,
				),
			)
		);
	}

	private static function not_found() {
		return new WP_Error( 'aurora_not_found', 'Slider not found.', array( 'status' => 404 ) );
	}

	public static function get_all() {
		return rest_ensure_response( Aurora_DB::get_sliders() );
	}

	public static function create( $req ) {
		$p  = $req->get_json_params();
		$id = Aurora_DB::create_slider( is_array( $p ) && isset( $p['title'] ) ? $p['title'] : '' );
		return rest_ensure_response( Aurora_DB::get_slider( $id ) );
	}

	public static function get_one( $req ) {
		$s = Aurora_DB::get_slider( (int) $req['id'] );
		return $s ? rest_ensure_response( $s ) : self::not_found();
	}

	public static function update( $req ) {
		$id = (int) $req['id'];
		if ( ! Aurora_DB::get_slider( $id ) ) {
			return self::not_found();
		}
		$p = $req->get_json_params();
		$p = is_array( $p ) ? $p : array();
		Aurora_DB::save_slider(
			$id,
			isset( $p['title'] ) ? $p['title'] : '',
			isset( $p['settings'] ) ? $p['settings'] : array(),
			isset( $p['slides'] ) ? $p['slides'] : array()
		);
		return rest_ensure_response( Aurora_DB::get_slider( $id ) );
	}

	public static function delete( $req ) {
		Aurora_DB::delete_slider( (int) $req['id'] );
		return rest_ensure_response( array( 'deleted' => true ) );
	}

	public static function duplicate( $req ) {
		$new = Aurora_DB::duplicate_slider( (int) $req['id'] );
		return $new ? rest_ensure_response( Aurora_DB::get_slider( $new ) ) : self::not_found();
	}

	public static function get_settings() {
		return rest_ensure_response( Aurora_DB::get_global() );
	}

	public static function update_settings( $req ) {
		$p = $req->get_json_params();
		return rest_ensure_response( Aurora_DB::save_global( is_array( $p ) ? $p : array() ) );
	}
}
