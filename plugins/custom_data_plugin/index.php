<?php

/*

Plugin Name: Custom christopher Plugin
Plugin URI: https://www.booking-wp-plugin.com/?utm_source=bookly_admin&utm_medium=plugins_page&utm_campaign=plugins_page
Description: Bookly Plugin – is a great easy-to-use and easy-to-manage booking tool for service providers who think about their customers. The plugin supports a wide range of services provided by business and individuals who offer reservations through websites. Set up any reservation quickly, pleasantly and easily with Bookly!
Version: 20.4
Author: Bookly
Author URI: https://www.booking-wp-plugin.com/?utm_source=bookly_admin&utm_medium=plugins_page&utm_campaign=plugins_page
Text Domain: bookly
Domain Path: /languages
License: GPLv3
License URI: http://www.gnu.org/licenses/gpl-3.0.html

*/
function hook_custom() {

	$current_user_id=get_current_user_id();
	$user_data = get_userdata( (int) $current_user_id);
	$admin_status = $user_data->roles[0];


	if($admin_status == 'administrator')
		{
			?>
			<script>
			   jQuery(document).ready(function(event){

				
				jQuery("#bookly-customers-list").on("click",function(event){

					jQuery("input").removeAttr("disabled");
							jQuery("select").removeAttr("disabled");
							jQuery("textarea").removeAttr("disabled");

							setTimeout(function(){
									jQuery("input").removeAttr("disabled");
							}, 1000);
							setTimeout(function(){
									jQuery("input").removeAttr("disabled");
							}, 2000);

							setTimeout(function(){
									jQuery("input").removeAttr("disabled");
							}, 3000);

							setTimeout(function(){
									jQuery("input").removeAttr("disabled");
							}, 5000);

							setTimeout(function(){
									jQuery("select").removeAttr("disabled");
							}, 1000);

							setTimeout(function(){
									jQuery("select").removeAttr("disabled");
							}, 2000);

							setTimeout(function(){
									jQuery("select").removeAttr("disabled");
							}, 3000);

							setTimeout(function(){
									jQuery("select").removeAttr("disabled");
							}, 5000);

							setTimeout(function(){
									jQuery("textarea").removeAttr("disabled");
							}, 2000);

							setTimeout(function(){
									jQuery("textarea").removeAttr("disabled");
							}, 3000);

							setTimeout(function(){
									jQuery("textarea").removeAttr("disabled");
							}, 5000);

							setTimeout(function(){
									jQuery("textarea").removeAttr("disabled");
							}, 1000);

				});
				
		
						jQuery("#bookly-appointments-list").on("click",function(event){
							jQuery("input").removeAttr("disabled");
							jQuery("select").removeAttr("disabled");
							setTimeout(function(){
									jQuery("input").removeAttr("disabled");
							}, 2000);

							setTimeout(function(){
									jQuery("input").removeAttr("disabled");
							}, 3000);

							setTimeout(function(){
									jQuery("input").removeAttr("disabled");
							}, 5000);

							setTimeout(function(){
									jQuery("select").removeAttr("disabled");
							}, 2000);

							setTimeout(function(){
									jQuery("select").removeAttr("disabled");
							}, 3000);

							setTimeout(function(){
									jQuery("select").removeAttr("disabled");
							}, 5000);

					

							setTimeout(function(){
									jQuery("#bookly-service").removeAttr("disabled");
							}, 2000);

							setTimeout(function(){
									jQuery("#bookly-service").removeAttr("disabled");
							}, 3000);

							////
							
							setTimeout(function(){
									jQuery("#bookly-date").removeAttr("disabled");
							}, 2000);

							setTimeout(function(){
									jQuery("#bookly-date").removeAttr("disabled");
							}, 3000);
							////

							
							setTimeout(function(){
									jQuery("#bookly-period").removeAttr("disabled");
							}, 2000);

							setTimeout(function(){
									jQuery("#bookly-period").removeAttr("disabled");
							}, 3000);


							setTimeout(function(){
									jQuery(".form-control.custom-select").removeAttr("disabled");
							}, 2000);

							setTimeout(function(){
									jQuery(".form-control.custom-select").removeAttr("disabled");
							}, 3000);


							setTimeout(function(){
									jQuery(".custom_trash").attr("style","display:block;");
							}, 2000);

							setTimeout(function(){
								   jQuery(".custom_trash").attr("style","display:block;");
							}, 3000);

							setTimeout(function(){
								   jQuery(".custom_trash").attr("style","display:block;");
							}, 5000);

							setTimeout(function(){
									jQuery(".custom_payemt_show").attr("style","display:block;");
							}, 2000);

							setTimeout(function(){
									jQuery(".custom_payemt_show").attr("style","display:block;");
							}, 3000);

							setTimeout(function(){
									jQuery(".custom_payemt_show").attr("style","display:block;");
							}, 5000);


							setTimeout(function(){
									jQuery(".list-unstyled .ml-auto").attr("style","display:flex;");
							}, 2000);

							setTimeout(function(){
								jQuery(".list-unstyled .ml-auto").attr("style","display:flex;");
							}, 3000);

							setTimeout(function(){
								jQuery(".list-unstyled .ml-auto").attr("style","display:flex;");
							}, 5000);


							
					
							jQuery(".modal-body").on("click",function(event){
								  jQuery("#bookly-customer-status").removeAttr("disabled");
									setTimeout(function(){
											jQuery("#bookly-customer-status").removeAttr("disabled");
									}, 2000);
										setTimeout(function(){
											jQuery("#bookly-customer-status").removeAttr("disabled");
									}, 3000);

									///////////
									jQuery("#bookly-customer-timezone").removeAttr("disabled");
									setTimeout(function(){
										jQuery("#bookly-customer-timezone").removeAttr("disabled");
									}, 2000);
										setTimeout(function(){
											jQuery("#bookly-customer-timezone").removeAttr("disabled");
									}, 3000);

									///////////////

									jQuery("#bookly-customer-notes").removeAttr("disabled");
									setTimeout(function(){
											jQuery("#bookly-customer-notes").removeAttr("disabled");
									}, 2000);
										setTimeout(function(){
											jQuery("#bookly-customer-notes").removeAttr("disabled");
									}, 3000);
									///////////

									jQuery("select").removeAttr("disabled");
									setTimeout(function(){
										jQuery("select").removeAttr("disabled");
									}, 2000);
										setTimeout(function(){
											jQuery("select").removeAttr("disabled");
									}, 3000);

									/////////////////

									jQuery("input").removeAttr("disabled");
									setTimeout(function(){
											jQuery("input").removeAttr("disabled");
									}, 1000);
									setTimeout(function(){
											jQuery("input").removeAttr("disabled");
									}, 2000);
										setTimeout(function(){
											jQuery("input").removeAttr("disabled");
									}, 3000);

									jQuery("textarea").removeAttr("disabled");
									setTimeout(function(){
											jQuery("textarea").removeAttr("disabled");
									}, 1000);
									setTimeout(function(){
											jQuery("textarea").removeAttr("disabled");
									}, 2000);
										setTimeout(function(){
											jQuery("textarea").removeAttr("disabled");
									}, 3000);

									
								
								
							});
						});


						
						
						
			   });
			   </script>
		   <?php
			
		}
	
    ?>
        
    <?php
}
add_action('admin_head', 'hook_custom');