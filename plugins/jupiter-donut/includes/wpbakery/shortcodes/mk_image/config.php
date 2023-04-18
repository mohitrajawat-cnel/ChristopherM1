<?php
extract( shortcode_atts( array(
			'heading_title'        => '',
			'image_width'          => 800,
			'image_height'         => 350,
			'lightbox'             => 'false',
			'svg'                  => 'false',
			'crop'                 => 'true',
			'image_size'           => 'crop',
			'custom_lightbox'      => '',
			'margin_bottom'        => 10,
			'group'                => '',
			'frame_style'          => 'simple',
			'src'                  => '',
			'link'                 => '',
			'target'               => '_self',
			'animation'            => '',
			'title'                => '',
			'desc'                 => '',
			'align'                => 'left',
			'caption_location'     => 'inside-image',
			'hover_image_overlay'  => 'true',
			'visibility'           => '',
			'el_class'             => '',
			'drop_shadow'          => 'false',
			'drop_shadow_angle'    => '45',
			'drop_shadow_distance' => '8',
			'drop_shadow_blur'     => '20',
			'drop_shadow_color'    => 'rgba(0,0,0,0.5)',
			'pxs'                  => 'false',
			'pxs_x'                => 0,
			'pxs_y'                => -100,
			'pxs_z'                => 0,
			'pxs_smoothness'       => '',
			'lazyload'             => 'false',
			'disable_lazyload'     => 'false',
		), $atts ) );
Mk_Static_Files::addAssets('mk_image');

$image_size = ($crop == 'false') ? 'full' : $image_size;