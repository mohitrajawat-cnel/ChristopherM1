<?php

defined( 'ABSPATH' ) || die();

/**
 * This class will use Artbees Themes Captcha plugin to generate captcha interface.
 *
 * @author      Bob Ulusoy
 * @copyright   Artbees LTD (c)
 * @link        http://artbees.net
 * @since       Version 5.1
 * @since       5.9.3 Add static keyword and AJAX check to `create_captcha_image` function.
 * @package     artbees
 */


class Mk_Theme_Captcha {

	function __construct() {
		add_action('wp_ajax_nopriv_mk_create_captcha_image', array(
			&$this,
			'create_captcha_image',
		));
		add_action('wp_ajax_mk_create_captcha_image', array(
			&$this,
			'create_captcha_image',
		));

		add_action('wp_ajax_nopriv_mk_validate_captcha_input', array(
			&$this,
			'validate_captcha_input',
		));
		add_action('wp_ajax_mk_validate_captcha_input', array(
			&$this,
			'validate_captcha_input',
		));

		add_action( 'wp_ajax_nopriv_jupiter_donut_validate_captcha', [ $this, 'validate_captcha' ] );
		add_action( 'wp_ajax_jupiter_donut_validate_captcha', [ $this, 'validate_captcha' ] );
	}

	/**
	 * Check if captcha plugin is active
	 *
	 */
	static public function is_plugin_active() {
		if ( class_exists( 'Mk_Artbees_Captcha' ) ) {
			return true;
		}
		return false;

	}

	/**
	 * Generate the captcha image
	 *
	 */
	public static function create_captcha_image() {
		if ( self::is_plugin_active() ) {
			echo plugins_url( 'artbees-captcha/generate-captcha.php' );
		}

		if ( wp_doing_ajax() ) {
			wp_die();
		}

		return;
	}

	/**
	 * Validates the captcha sent to the contact form.
	 *
	 */
	public function validate_captcha_input() {
		//Continue the session
		session_start();

		/** Validate captcha */
		if ( ! empty( $_REQUEST['captcha'] ) ) {
			if ( empty( $_SESSION['captcha'] ) || trim( strtolower( $_REQUEST['captcha'] ) ) != $_SESSION['captcha'] ) {
				$captcha_message = 'Invalid captcha';
			} else {
				$captcha_message = 'ok';
			}
			echo $captcha_message;
			wp_die();
		}
	}

	/**
	 * Validate captcha.
	 *
	 * @since 1.2.0
	 */
	public function validate_captcha() {
		if (
			empty( $_GET['nonce'] )
			|| ! wp_verify_nonce( $_GET['nonce'], 'jupiter-donut' )
		) {
			wp_send_json_error( esc_html__( 'Nonce is invalid.', 'jupiter-donut' ) );
		}

		if ( PHP_SESSION_NONE === session_status() ) {
			session_start();
		}

		if ( empty( $_REQUEST['captcha'] ) ) {
			wp_send_json_error( esc_html__( 'Captcha field is missing.', 'jupiter-donut' ) );
		}

		if (
			empty( $_SESSION['captcha'] )
			|| trim( strtolower( $_REQUEST['captcha'] ) ) != $_SESSION['captcha']
		) {
			wp_send_json_error( esc_html__( 'Captcha is invalid. Try again.', 'jupiter-donut' ) );
		}

		wp_send_json_success( esc_html__( 'Captcha is correct.', 'jupiter-donut' ) );
	}

}

new Mk_Theme_Captcha();
