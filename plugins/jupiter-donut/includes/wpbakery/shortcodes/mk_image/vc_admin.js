(function($) {
    'use strict';

    $(document).on('ajaxComplete.mk_image_lazyload_option', function(e) {
        if ( typeof theme_backend_localized_data !== 'undefined' && theme_backend_localized_data.mk_image_lazyload == 'true' ) {
            var $lazyload = $('.vc_shortcode-param').filter(function(index) {
                return $(this).attr('data-vc-shortcode-param-name') === 'lazyload';
            });
            $lazyload.hide();
        } else {
            var $disable_lazyload = $('.vc_shortcode-param').filter(function(index) {
                return $(this).attr('data-vc-shortcode-param-name') === 'disable_lazyload';
            });
            $disable_lazyload.hide();
        }
    });

})(jQuery);
