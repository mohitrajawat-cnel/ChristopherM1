jQuery(function($) {

  'use strict';

  // Get All Related Layers
  var init = function init() {
    var $image = $('.mk-image');
    var $imgs = $image.find('img[data-mk-image-src-set]');

    if ( $image.hasClass('mk-image-lazyload') && $imgs.length ) {

      // Load Images if the user scrolls to them
      $(window).on('scroll.mk_image_lazyload', MK.utils.throttle(500, function(){
        $imgs.each(function(index, elem) {
          if ( MK.utils.isElementInViewport(elem) ) {
            MK.component.ResponsiveImageSetter.init( $(elem) );
            $imgs = $imgs.not( $(elem) );  // Remove element from the list when loaded to reduce the amount of iteration in each()
          }
        });
      }));

      $(window).trigger('scroll.mk_image_lazyload');

      // Handle the resize
      MK.component.ResponsiveImageSetter.onResize($imgs);

    } else {

      MK.component.ResponsiveImageSetter.init($imgs);
      MK.component.ResponsiveImageSetter.onResize($imgs);

    }
  }

  init();
  $(window).on('vc_reload mk-image-loaded', init);

});


