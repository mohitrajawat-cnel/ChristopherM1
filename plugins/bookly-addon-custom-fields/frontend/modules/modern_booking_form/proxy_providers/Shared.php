<?php
namespace BooklyCustomFields\Frontend\Modules\ModernBookingForm\ProxyProviders;

use BooklyCustomFields\Lib;
use BooklyPro\Frontend\Modules\ModernBookingForm\Lib\Request;


/**
 * Class Shared
 *
 * @package BooklyCustomFields\Frontend\Modules\ModernBookingForm\ProxyProviders
 */
class Shared extends \Bookly\Frontend\Modules\ModernBookingForm\Proxy\Shared
{
    /**
     * @inheritDoc
     */
    public static function prepareFormOptions( $bookly_options )
    {
        $bookly_options['custom_fields'] = array(
            'data' => array_values( Lib\ProxyProviders\Local::getTranslated() ),
            'conditions' => get_option( 'bookly_custom_fields_conditions', array() ),
            'merge' => get_option( 'bookly_custom_fields_merge_repeating' ),
            'bind_services' => get_option( 'bookly_custom_fields_per_service' ),
            'time_slot_length' => (int) get_option( 'bookly_gen_time_slot_length' ),
        );

        return $bookly_options;
    }

    /**
     * @inheritDoc
     */
    public static function renderForm( $form_id )
    {
        if ( in_array( 'captcha', array_map( function( $field ) { return $field->type; }, Lib\ProxyProviders\Local::getAll() ) ) ) {
            Lib\Captcha\Captcha::init( $form_id );
        }
    }

    /**
     * @inheritDoc
     */
    public static function validate( $request )
    {
        /** @var Request $request */
        $errors = Lib\ProxyProviders\Local::validate( array(), json_encode( $request->getCustomFields() ), $request->getFormId(), 0 );
        if ( $errors ) {
            $request->addNotice( array( 'custom_fields' => $errors['custom_fields'][0] ) );
        }
    }
}