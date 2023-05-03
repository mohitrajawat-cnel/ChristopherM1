<?php defined( 'ABSPATH' ) || exit; // Exit if accessed directly
/*
Plugin Name: Bookly
Plugin URI: https://www.booking-wp-plugin.com/?utm_source=bookly_admin&utm_medium=plugins_page&utm_campaign=plugins_page
Description: Bookly Plugin – is a great easy-to-use and easy-to-manage booking tool for service providers who think about their customers. The plugin supports a wide range of services provided by business and individuals who offer reservations through websites. Set up any reservation quickly, pleasantly and easily with Bookly!
Version: 21.6
Author: Bookly
Author URI: https://www.booking-wp-plugin.com/?utm_source=bookly_admin&utm_medium=plugins_page&utm_campaign=plugins_page
Text Domain: bookly
Domain Path: /languages
License: GPLv3
License URI: http://www.gnu.org/licenses/gpl-3.0.html
*/

if ( version_compare( PHP_VERSION, '5.3.7', '<' ) ) {
    function bookly_php_outdated()
    {
        echo '<div class="updated"><h3>Bookly</h3><p>To install the plugin - <strong>PHP 5.3.7</strong> or higher is required.</p></div>';
    }

    add_action( is_network_admin() ? 'network_admin_notices' : 'admin_notices', 'bookly_php_outdated' );
} else {
    include_once __DIR__ . '/autoload.php';

    call_user_func( array( 'Bookly\Lib\Boot', 'up' ) );
}
//mohit
add_action('wp_ajax_show_booking_to_interputer', 'custom_action');
add_action('wp_ajax_nopriv_show_booking_to_interputer', 'custom_action');
function custom_action() {
		$appointment_id =$_POST['staff_id'];
		$current_user_id=$_POST['current_login_id'];
        $email=$_POST['email'];
			
			global $wpdb;
			
			$update_staff_id ="UPDATE ".$wpdb->prefix."bookly_appointments SET staff_id='".$current_user_id."' where id='".$appointment_id."'";
			
			$wpdb->query($update_staff_id);
			
			$update_staff_status ="UPDATE ".$wpdb->prefix."bookly_customer_appointments SET status='approved' where appointment_id='".$appointment_id."'";
			
			$wpdb->query($update_staff_status);
	
}
add_action('wp_ajax_cancel_approved_booking_to_interputer', 'cancel_approved');
add_action('wp_ajax_nopriv_cancel_approved_booking_to_interputer', 'cancel_approved');
function cancel_approved() {
        
		 $appointment_id =$_POST['staff_id'];
		 $current_user_id=$_POST['current_login_id'];
        
		
		
			global $wpdb;
			
			$cancel_staff_id ="UPDATE ".$wpdb->prefix."bookly_appointments SET staff_id='0' where id='".$appointment_id."'";
			
			$wpdb->query($cancel_staff_id);

            $cancel_staff_status ="UPDATE ".$wpdb->prefix."bookly_customer_appointments SET status='pending' where appointment_id='".$appointment_id."'";
			
			$wpdb->query($cancel_staff_status);


                            
							$tablebookly=$wpdb->prefix."bookly_customer_appointments";
							$selectappointments="select * from $tablebookly where appointment_id='".$appointment_id."'";
							$resultsappointments=$wpdb->get_results($selectappointments,ARRAY_A);
							foreach($resultsappointments as $results_appointments)
							{
                                    
                                     $custom_fiels_hwe1 =json_decode($appointment['custom_fields'],true);

									foreach($custom_fiels_hwe1 as $get_gender_hwe_hwe)
									{
									   $appointment_gender =$get_gender_hwe_hwe['value'];
									}
/*
									$tablebookly1=$wpdb->prefix."bookly_customers";
									$selectappointments1="select * from $tablebookly1 where email='".$email."'";
									$resultsappointments1=$wpdb->get_results($selectappointments1,ARRAY_A);
									foreach($resultsappointments1 as $results_appointments1)
									{
print_r($results_appointments1);*/
											$getFullName =$_POST['client_name'];
											$getPhone =$_POST['client_phone'];
											$getEmail =$_POST['email'];
									        $date_hwe =date("F d,Y");
											$time_hwe =date("h:i a");  
                            
			                        

					
							$tablebookly=$wpdb->prefix."interputer_booking_lat_long";
							$select="select * from $tablebookly where staff_id='".$appointment_id."'";
							$results=$wpdb->get_results($select,ARRAY_A);
							foreach($results as $results_hwe)
							{
								
			                     $latitude =$results_hwe['latitude'];
								 $longitude =$results_hwe['longitude'];
			
							
							
                        $query = "SELECT *, (((acos(sin((".$latitude."*pi()/180)) * sin((`latitude`*pi()/180)) + cos((".$latitude."*pi()/180)) * cos((`latitude`*pi()/180)) * cos(((".$longitude."- `longitude`)*pi()/180)))) * 180/pi()) * 60 * 1.1515) as distance FROM `wp_interputer_lat_long`";
                      $distance =$wpdb->get_results($query,ARRAY_A);

                       $dis_staff_id='';
                        foreach($distance as $distance_hwe)
						{

						    if($distance_hwe['distance'] <= 30 || $distance_hwe['distance']== '')
							{
							    $dis_staff_id =$distance_hwe['staff_id'];

                                 $select_staff =$wpdb->get_results("SELECT * from ".$wpdb->prefix."bookly_staff where id='".$dis_staff_id."'",ARRAY_A);

								 foreach($select_staff as $select_staff_data)
								 {
                                        $staff_id_hwe3 =$select_staff_data['id'];
                                        if($current_user_id == $staff_id_hwe3)
										{
										   continue;
										}
                                        $gender =$select_staff_data['gender'];
                                        if($gender == 'male')
										{
										   $gender_staff ='Male';
										} 
										else if($gender == 'female')
										{
										   $gender_staff ='Female';
										}
										$all_email =$select_staff_data['email'];

 									if($appointment_gender == 'Male' || $appointment_gender == 'Female')
										{
											if($appointment_gender != $gender_staff)
											{

												break;
	
											
											}
										}
                                        
                                        
										
										$to = $all_email;
										$subject = 'New booking information.';
									
										$message = '<p>Hello.</p>
													<p>You have a new booking.</p>
													<p>Date: '.$date_hwe.'</p>
													<p>Time: '.$time_hwe.'</p>
													<p>Client name: '.$getFullName.'</p>
													<p>Client phone: '.$getPhone.'</p>
													<p>Client email: '.$getEmail.'</p>';
									
										$headers = array("MIME-Version: 1.0\r\n");
										$headers = array('Content-Type: text/html; charset=UTF-8');
										$headers[] = 'From: iTerp Development Server <iterp@chrisorah.com>';
										
										wp_mail( $to, $subject, $message,$headers );


                                 }
		       
							//}


                            
						}
					}

    			}

         

      }

}