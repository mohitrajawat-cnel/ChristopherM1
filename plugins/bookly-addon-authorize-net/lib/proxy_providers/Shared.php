<?php
namespace BooklyAuthorizeNet\Lib\ProxyProviders;

use Bookly\Lib as BooklyLib;

/**
 * Class Shared
 * @package BooklyAuthorizeNet\Lib\ProxyProviders
 */
class Shared extends BooklyLib\Proxy\Shared
{
    /**
     * @inheritDoc
     */
    public static function showPaymentSpecificPrices( $show )
    {
        if ( ! $show && get_option( 'bookly_authorize_net_enabled' ) ) {
            return (float) get_option( 'bookly_authorize_net_increase' ) != 0 || (float) get_option( 'bookly_authorize_net_addition' ) != 0;
        }

        return $show;
    }

    /**
     * @inheritDoc
     */
    public static function applyGateway( BooklyLib\CartInfo $cart_info, $gateway )
    {
        if ( $gateway === BooklyLib\Entities\Payment::TYPE_AUTHORIZENET && get_option( 'bookly_authorize_net_enabled' ) ) {
            $cart_info->setGateway( $gateway );
        }

        return $cart_info;
    }
}