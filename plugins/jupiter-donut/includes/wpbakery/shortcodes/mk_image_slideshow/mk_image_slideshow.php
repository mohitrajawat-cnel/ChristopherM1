<?php

$phpinfo =  pathinfo( __FILE__ );
$path = $phpinfo['dirname'];
include( $path . '/config.php' );

$id = Mk_Static_Files::shortcode_id();

if ( $images == '' ) return null;

$images = explode( ',', $images );

if ( ! empty( $visibility ) ) {
	echo '<div class="jupiter-donut-' . $visibility . '">';
}
mk_get_view('global', 'shortcode-heading', false, ['title' => $title]);

$lazyload_class = '';
$global_lazyload = jupiter_donut_get_option( 'global_lazyload' );
if ( ($global_lazyload == 'true' && $disable_lazyload == 'false') || ($global_lazyload == 'false' && $lazyload == 'true') ) {
     $lazyload_class = 'mk-swipe-slideshow-lazyload';
}
?>

<div class="mk-slideshow mk-flexslider mk-slider js-el <?php echo $el_class .' '. $lazyload_class; ?>"
	style="max-width:<?php echo $image_width; ?>px; margin-top:<?php echo $margin_top; ?>px; margin-bottom:<?php echo $margin_bottom; ?>px;"
	data-mk-component='SwipeSlideshow'
	data-swipeSlideshow-config='{
		"effect" : "<?php echo $effect ?>",
		"displayTime" : "<?php echo $slideshow_speed ?>",
		"transitionTime" : "<?php echo $animation_speed ?>",
		"nav" : "#flex-direction-nav-<?php echo $id ?>",
		"hasNav" : "<?php echo $direction_nav; ?>",
		"pauseOnHover" : <?php echo $pause_on_hover; ?>,
		"fluidHeight" :  <?php echo $smooth_height; ?>}' >

	<div class="mk-swiper-wrapper mk-slider-holder">

		<?php
		foreach ( $images as $attach_id ) {
			// $featured_image_src = Mk_Image_Resize::resize_by_id_adaptive( $attach_id, 'crop', $image_width, $image_height, $crop = true, $dummy = true);
			$url = wp_get_attachment_url($attach_id);
			$featured_image_src = Mk_Image_Resize::resize_by_url_adaptive($url, $image_width, $image_height, $crop = true, $dummy = true);
			// print_r($featured_image_src);
		?>
			<div class="mk-slider-slide">
				<img class="swiper-slide-image" src="<?php echo $featured_image_src['dummy']; ?>"
				<?php echo $featured_image_src['data-set']; ?>
				alt="<?php echo trim(strip_tags( get_post_meta($attach_id, '_wp_attachment_image_alt', true) )); ?>" />
			</div>

		<?php } ?>

		<!-- empty PNG to stretch slider and make it responsive outside of js as the slider adjusts height and width to container sizes  -->
		<img src="<?php echo Mk_Image_Resize::generate_dummy_image($image_width, $image_height, true); ?>" style="visibility: hidden;" />

	</div>

	<?php if( $direction_nav == 'true' ) { ?>
	<ul id="flex-direction-nav-<?php echo $id; ?>" class="flex-direction-nav">
		<li><a class="flex-prev" href="#"  data-direction="prev"><?php Mk_SVG_Icons::get_svg_icon_by_class_name(true, 'mk-jupiter-icon-arrow-left'); ?></a></li>
		<li><a class="flex-next" href="#"  data-direction="next"><?php Mk_SVG_Icons::get_svg_icon_by_class_name(true, 'mk-jupiter-icon-arrow-right'); ?></a></li>
	</ul>
	<?php } ?>
</div>

<?php
if ( ! empty( $visibility ) ) {
	echo '</div>';
}
