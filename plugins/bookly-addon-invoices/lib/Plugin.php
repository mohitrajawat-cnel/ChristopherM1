<?php
namespace BooklyInvoices\Lib;

use Bookly\Lib;
use BooklyInvoices\Backend;
use BooklyInvoices\Frontend;

/**
 * Class Plugin
 * @package BooklyInvoices\Lib
 */
abstract class Plugin extends Lib\Base\Plugin
{
    protected static $prefix;
    protected static $title;
    protected static $version;
    protected static $slug;
    protected static $directory;
    protected static $main_file;
    protected static $basename;
    protected static $text_domain;
    protected static $root_namespace;
    protected static $embedded;

    /**
     * @inheritDoc
     */
    protected static function init()
    {
        // Init ajax.
        Backend\Modules\Invoice\Ajax::init();
        Backend\Components\Invoice\Ajax::init();
        Frontend\Modules\Booking\Ajax::init();
        Frontend\Modules\Invoice\Ajax::init();

        // Init proxy.
        Backend\Modules\Appearance\ProxyProviders\Local::init();
        Backend\Modules\Appearance\ProxyProviders\Shared::init();
        Backend\Modules\Notifications\ProxyProviders\Local::init();
        Backend\Modules\Notifications\ProxyProviders\Shared::init();
        Backend\Modules\Payments\ProxyProviders\Local::init();
        Backend\Modules\Settings\ProxyProviders\Shared::init();
        Frontend\Modules\Booking\ProxyProviders\Local::init();
        Notifications\Assets\Item\ProxyProviders\Shared::init();
        Notifications\Assets\Test\ProxyProviders\Shared::init();
        ProxyProviders\Local::init();
    }

    /**
     * @inheritDoc
     */
    public static function activate( $network_wide )
    {
        // Set client address mandatory on the front-end
        update_option( 'bookly_cst_required_address', '1' );
        update_option( 'bookly_app_show_address', '1' );
        $address_show_fields = (array) get_option( 'bookly_cst_address_show_fields' );
        $exists_selected     = false;
        foreach ( $address_show_fields as $column => $attr ) {
            if ( $attr['show'] ) {
                $exists_selected = true;
                break;
            }
        }
        if ( ! $exists_selected ) {
            foreach ( $address_show_fields as &$field ) {
                $field['show'] = true;
            }
            update_option( 'bookly_cst_address_show_fields', $address_show_fields );
        }

        parent::activate( $network_wide );
    }
}