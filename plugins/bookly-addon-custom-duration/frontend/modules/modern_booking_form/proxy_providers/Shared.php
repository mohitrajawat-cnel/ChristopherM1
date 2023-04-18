<?php
namespace BooklyCustomDuration\Frontend\Modules\ModernBookingForm\ProxyProviders;

use Bookly\Lib as BooklyLib;


/**
 * Class Shared
 *
 * @package BooklyCustomDuration\Frontend\Modules\ModernBookingForm\ProxyProviders
 */
class Shared extends \Bookly\Frontend\Modules\ModernBookingForm\Proxy\Shared
{
    /**
     * @inheritDoc
     */
    public static function prepareAppearance( array $bookly_options )
    {
        $bookly_options['l10n']['units'] = __( 'Units', 'bookly' );

        return $bookly_options;
    }
}