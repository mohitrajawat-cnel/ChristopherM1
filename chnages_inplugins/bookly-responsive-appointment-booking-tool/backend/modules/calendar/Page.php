<?php
namespace Bookly\Backend\Modules\Calendar;

use Bookly\Lib;
use Bookly\Lib\Config;
use Bookly\Lib\Entities\CustomerAppointment;
use Bookly\Lib\Entities\Staff;
use Bookly\Lib\Utils\Common;
use Bookly\Lib\Utils\DateTime;
use Bookly\Lib\Utils\Price;

/**
 * Class Page
 *
 * @package Bookly\Backend\Modules\Calendar
 */
class Page extends Lib\Base\Ajax
{
    /**
     * Render page.
     */
    public static function render()
    {
        self::enqueueStyles( array(
            'module' => array( 'css/event-calendar.min.css' => array( 'bookly-backend-globals' ) ),
        ) );

        $id = Lib\Entities\Appointment::query( 'a' )
            ->select( 'MAX(id) as max_id' )
            ->fetchRow();
        update_option( 'bookly_cal_last_seen_appointment', $id['max_id'] );

        if ( Config::proActive() ) {
            if ( Common::isCurrentUserSupervisor() ) {
                $staff_members = Staff::query()
                    ->whereNot( 'visibility', 'archive' )
                    ->sortBy( 'position' )
                    ->find();
                $staff_dropdown_data = Lib\Proxy\Pro::getStaffDataForDropDown();
            } else {
                $staff_members = Staff::query()
                    ->where( 'wp_user_id', get_current_user_id() )
                    ->whereNot( 'visibility', 'archive' )
                    ->find();
                $staff_dropdown_data = array(
                    0 => array(
                        'name' => '',
                        'items' => empty ( $staff_members ) ? array() : array( $staff_members[0]->getFields() ),
                    ),
                );
            }
        } else {
            $staff = Staff::query()->findOne();
            $staff_members = $staff ? array( $staff ) : array();
            $staff_dropdown_data = array(
                0 => array(
                    'name' => '',
                    'items' => empty ( $staff_members ) ? array() : array( $staff_members[0]->getFields() ),
                ),
            );
        }

        self::enqueueScripts(
            $staff_members ?
                array(
                    'module' => array(
                        'js/event-calendar.min.js' => array( 'bookly-backend-globals' ),
                        'js/calendar-common.js' => array( 'bookly-event-calendar.min.js' ),
                        'js/calendar.js' => array( 'bookly-calendar-common.js', 'bookly-dropdown.js' ),
                    ),
                    'backend' => array(
                        'js/nav-scrollable.js' => array( 'bookly-backend-globals' ),
                    ),
                ) :
                array(
                    'alias' => array( 'bookly-backend-globals', ),
                ) );

        self::enqueueStyles( array(
            'alias' => array( 'bookly-backend-globals', ),
        ) );

        wp_localize_script( 'bookly-calendar.js', 'BooklyL10n', array_merge(
            Lib\Utils\Common::getCalendarSettings(),
            array(
                'delete' => __( 'Delete', 'bookly' ),
                'are_you_sure' => __( 'Are you sure?', 'bookly' ),
                'filterResourcesWithEvents' => Config::showOnlyStaffWithAppointmentsInCalendarDayView(),
                'recurring_appointments' => array(
                    'active' => (int) Config::recurringAppointmentsActive(),
                    'title' => __( 'Recurring appointments', 'bookly' ),
                ),
                'waiting_list' => array(
                    'active' => (int) Config::waitingListActive(),
                    'title' => __( 'On waiting list', 'bookly' ),
                ),
                'packages' => array(
                    'active' => (int) Config::packagesActive(),
                    'title' => __( 'Package', 'bookly' ),
                ),
            ) ) );

        $refresh_rate = get_user_meta( get_current_user_id(), 'bookly_calendar_refresh_rate', true );
        $services_dropdown_data = Common::getServiceDataForDropDown( 's.type = "simple"' );

        self::renderTemplate( 'calendar', compact( 'staff_members', 'staff_dropdown_data', 'services_dropdown_data', 'refresh_rate' ) );
    }

    /**
     * Build appointments for Event Calendar.
     *
     * @param Lib\Query $query
     * @param string $display_tz
     * @return mixed
     */
    public static function buildAppointmentsForCalendar( Lib\Query $query, $display_tz )
    {
        $one_participant = Lib\Utils\Codes::tokenize( '<div>' . str_replace( "\n", '</div><div>', get_option( 'bookly_cal_one_participant' ) ) . '</div>' );
        $many_participants = Lib\Utils\Codes::tokenize( '<div>' . str_replace( "\n", '</div><div>', get_option( 'bookly_cal_many_participants' ) ) . '</div>' );
        $tooltip = Lib\Utils\Codes::tokenize( '<i class="fas fa-fw fa-circle mr-1" style="color:{appointment_color}"></i><span>{service_name}</span>{#each participants as participant}<div class="d-flex"><div class="text-muted flex-fill">{participant.client_name}</div><div class="text-nowrap">{participant.nop}<span class="badge badge-{participant.status_color}">{participant.status}</span></div></div>{/each}<span class="d-block text-muted">{appointment_time} - {appointment_end_time}</span>' );
        $tooltip_all_day = Lib\Utils\Codes::tokenize( '<i class="fas fa-fw fa-circle mr-1" style="color:{appointment_color}"></i><span>{service_name}</span>{#each participants as participant}<div class="d-flex"><div class="text-muted flex-fill">{participant.client_name}</div><div class="text-nowrap">{participant.nop}<span class="badge badge-{participant.status_color}">{participant.status}</span></div></div>{/each}<span class="d-block text-muted">{description}</span>' );
        $postfix_any = sprintf( ' (%s)', get_option( 'bookly_l10n_option_employee' ) );
        $coloring_mode = get_option( 'bookly_cal_coloring_mode' );
        $default_codes = array(
            'amount_due' => '',
            'amount_paid' => '',
            'appointment_date' => '',
            'appointment_notes' => '',
            'appointment_time' => '',
            'booking_number' => '',
            'category_name' => '',
            'client_address' => '',
            'client_email' => '',
            'client_name' => '',
            'client_first_name' => '',
            'client_last_name' => '',
            'client_phone' => '',
            'client_birthday' => '',
            'client_note' => '',
            'company_address' => get_option( 'bookly_co_address' ),
            'company_name' => get_option( 'bookly_co_name' ),
            'company_phone' => get_option( 'bookly_co_phone' ),
            'company_website' => get_option( 'bookly_co_website' ),
            'custom_fields' => '',
            'extras' => '',
            'extras_total_price' => 0,
            'internal_note' => '',
            'location_name' => '',
            'location_info' => '',
            'number_of_persons' => '',
            'on_waiting_list' => '',
            'payment_status' => '',
            'payment_type' => '',
            'service_capacity' => '',
            'service_duration' => '',
            'service_info' => '',
            'service_name' => '',
            'service_price' => '',
            'signed_up' => '',
            'staff_email' => '',
            'staff_info' => '',
            'staff_name' => '',
            'staff_phone' => '',
            'status' => '',
            'total_price' => '',
        );
        $query
            ->select(
                'a.id, ca.id as ca_id, ca.series_id, a.staff_any, a.location_id, a.internal_note, a.start_date, DATE_ADD(a.end_date, INTERVAL a.extras_duration SECOND) AS end_date,
                COALESCE(s.title,a.custom_service_name) AS service_name, COALESCE(s.color,"silver") AS service_color, s.info AS service_info,
                COALESCE(ss.price,s.price,a.custom_service_price) AS service_price,
                st.id AS staff_id,
                st.full_name AS staff_name, st.email AS staff_email, st.info AS staff_info, st.phone AS staff_phone, st.color AS staff_color,
                (SELECT SUM(ca.number_of_persons) FROM ' . CustomerAppointment::getTableName() . ' ca WHERE ca.appointment_id = a.id) AS total_number_of_persons,
                s.duration,
                s.start_time_info,
                s.end_time_info,
                ca.number_of_persons,
                ca.units,
                ca.custom_fields,
                ca.status AS status,
                ca.extras,
                ca.extras_multiply_nop,
                ca.package_id,
                ca.notes AS appointment_notes,
                ct.name AS category_name,
                c.full_name AS client_name, c.first_name AS client_first_name, c.last_name AS client_last_name, c.phone AS client_phone, c.email AS client_email, c.id AS customer_id, c.birthday AS client_birthday, c.notes AS client_note,
                p.total, p.type AS payment_gateway, p.status AS payment_status, p.paid,
                (SELECT SUM(ca.number_of_persons) FROM ' . CustomerAppointment::getTableName() . ' ca WHERE ca.appointment_id = a.id AND ca.status = "waitlisted") AS on_waiting_list'
            )
            ->leftJoin( 'CustomerAppointment', 'ca', 'ca.appointment_id = a.id' )
            ->leftJoin( 'Customer', 'c', 'c.id = ca.customer_id' )
            ->leftJoin( 'Payment', 'p', 'p.id = ca.payment_id' )
            ->leftJoin( 'Service', 's', 's.id = a.service_id' )
            ->leftJoin( 'Category', 'ct', 'ct.id = s.category_id' )
            ->leftJoin( 'Staff', 'st', 'st.id = a.staff_id' )
            ->whereNot( 'a.start_date', null )
            // Custom service without customers have not ca.id
            ->groupBy( 'COALESCE(ca.id,CONCAT(\'appointment-\',a.id))' );
        if ( Lib\Proxy\Locations::servicesPerLocationAllowed() ) {
            $query = Proxy\Locations::prepareCalendarQuery( $query );
        } else {
            $query->leftJoin( 'StaffService', 'ss', 'ss.staff_id = a.staff_id AND ss.service_id = a.service_id AND ss.location_id IS NULL' );
        }

        if ( Config::groupBookingActive() ) {
            $query->addSelect( 'COALESCE(ss.capacity_max,s.capacity_max,9999) AS service_capacity' );
        } else {
            $query->addSelect( '1 AS service_capacity' );
        }

        if ( Config::proActive() ) {
            $query->addSelect( 'c.country, c.state, c.postcode, c.city, c.street, c.street_number, c.additional_address, c.info_fields' );
        }

        // Fetch appointments,
        // and shift the dates to appropriate time zone if needed
        $appointments = array();
        $wp_tz = Config::getWPTimeZone();
        $convert_tz = $display_tz !== $wp_tz;

        foreach ( $query->fetchArray() as $appointment ) {
            if ( ! isset ( $appointments[ $appointment['id'] ] ) ) {
                if ( $convert_tz ) {
                    $appointment['start_date'] = DateTime::convertTimeZone( $appointment['start_date'], $wp_tz, $display_tz );
                    $appointment['end_date'] = DateTime::convertTimeZone( $appointment['end_date'], $wp_tz, $display_tz );
                }
                $appointments[ $appointment['id'] ] = $appointment;
            }
            $appointments[ $appointment['id'] ]['customers'][] = array(
                'appointment_id' => $appointment['id'],
                'appointment_notes' => $appointment['appointment_notes'],
                'booking_number' => Config::groupBookingActive() ? $appointment['id'] . '-' . $appointment['ca_id'] : $appointment['id'],
                'client_birthday' => $appointment['client_birthday'],
                'client_email' => $appointment['client_email'],
                'client_first_name' => $appointment['client_first_name'],
                'client_last_name' => $appointment['client_last_name'],
                'client_name' => $appointment['client_name'],
                'client_note' => $appointment['client_note'],
                'client_phone' => $appointment['client_phone'],
                'number_of_persons' => $appointment['number_of_persons'],
                'payment_status' => Lib\Entities\Payment::statusToString( $appointment['payment_status'] ),
                'payment_type' => Lib\Entities\Payment::typeToString( $appointment['payment_gateway'] ),
                'status' => $appointment['status'],
                '_info_fields' => isset( $appointment['info_fields'] ) ? json_decode( $appointment['info_fields'], true ) : array(),
                '_custom_fields' => isset( $appointment['custom_fields'] ) ? json_decode( $appointment['custom_fields'], true ) : array(),
            );
        }

        $status_codes = array(
            CustomerAppointment::STATUS_APPROVED => 'success',
            CustomerAppointment::STATUS_CANCELLED => 'danger',
            CustomerAppointment::STATUS_REJECTED => 'danger',
        );
        $cancelled_statuses = array(
            CustomerAppointment::STATUS_CANCELLED,
            CustomerAppointment::STATUS_REJECTED,
        );
        $pending_statuses = array(
            CustomerAppointment::STATUS_CANCELLED,
            CustomerAppointment::STATUS_REJECTED,
            CustomerAppointment::STATUS_PENDING,
        );
        $colors = array();
        if ( $coloring_mode === 'status' ) {
            $colors = Lib\Proxy\Shared::prepareColorsStatuses( array(
                CustomerAppointment::STATUS_PENDING => get_option( 'bookly_appointment_status_pending_color' ),
                CustomerAppointment::STATUS_APPROVED => get_option( 'bookly_appointment_status_approved_color' ),
                CustomerAppointment::STATUS_CANCELLED => get_option( 'bookly_appointment_status_cancelled_color' ),
                CustomerAppointment::STATUS_REJECTED => get_option( 'bookly_appointment_status_rejected_color' ),
            ) );
            $colors['mixed'] = get_option( 'bookly_appointment_status_mixed_color' );
        }
        //lucky



  global $wpdb;

  //get current login staff  gender 
  //mohit_new
  $login_id =$_POST['staff_ids'];
  $current_login_service_id = $wpdb->get_results("SELECT * FROM ".$wpdb->prefix."bookly_staff_services WHERE staff_id='".$login_id."'",ARRAY_A);
  
  $service_id_hwe=array();
  foreach($current_login_service_id as $current_login_service_id_hwe)
  {
     $service_id_hwe[] = $current_login_service_id_hwe['service_id'];
  }
       
   //$implode_service_id=implode(',',$service_id_hwe);
  
  $current_staff_gender = $wpdb->get_results("SELECT * FROM ".$wpdb->prefix."bookly_staff WHERE id='".$login_id."'",ARRAY_A);
  foreach($current_staff_gender as $current_staff_gender_hwe)
  {
     $get_current_staff_gender = $current_staff_gender_hwe['gender'];
      if($get_current_staff_gender == 'male')
      {
          $fm_gender ='Male';
      }
      else if($get_current_staff_gender == 'female')
      {
          $fm_gender ='Female';
      }
  }
  
  $customer = array();
  $staff_id = $wpdb->get_results("SELECT 
  a.id AS id,
  a.staff_any AS staff_any,
  a.location_id AS location_id,
  a.internal_note AS internal_note,
  a.internal_note AS internal_note,
  a.start_date AS start_date,
  a.end_date AS end_date,
  a.service_id As service_id_hwe,
  b.status AS status ,
  b.custom_fields As custom_fiels_hwe,
  b.number_of_persons AS total_number_of_persons,
  b.number_of_persons AS number_of_persons,
  b.customer_id AS customer_id,
  c.full_name AS client_name,
  c.first_name AS client_first_name,
  c.last_name AS client_last_name,
  c.phone AS client_phone,
  c.email AS client_email,
  c.birthday AS client_birthday,
  c.notes AS client_note,
  c.country AS country,
  c.state AS state,
  c.postcode AS postcode,
  c.city AS city,
  c.street AS street,
  c.street_number AS street_number,
  c.additional_address AS additional_address
  FROM ".$wpdb->prefix."bookly_appointments AS a INNER JOIN ".$wpdb->prefix."bookly_customer_appointments AS b ON a.id =b.appointment_id INNER JOIN ".$wpdb->prefix."bookly_customers AS c ON b.customer_id =c.id WHERE (a.staff_id='0') && (b.custom_fields LIKE BINARY '%".$fm_gender."%' || b.custom_fields LIKE '%No Preference%') ",ARRAY_A);
  
  
  $staffkey=0;
  
  foreach( $staff_id as $staff_id_hwe )
  {
     $staff_auto_id = $staff_id_hwe['customer_id'];
     $staff_status_id = $staff_id_hwe['status'];
     $number_of_persons = $staff_id_hwe['total_number_of_persons'];
  
      $get_gender = stripslashes($staff_id_hwe['custom_fiels_hwe']);
      $decode_ste_gender =json_decode($get_gender,true); 
      
      /*foreach($decode_ste_gender as $decode_ste_gender_hwe)
      {
          $set_gender_value = $decode_ste_gender_hwe['value'];
      }
      if($set_gender_value != 'No Preference')
      {    
          if($set_gender_value != $fm_gender)
          {
                  unset($appointments[$staffkey]);
                  continue;	
           
          }
      }  */ 
  
      $status= $wpdb->get_results("SELECT 
      c.full_name AS client_name,
      c.first_name AS client_first_name,
      c.last_name AS client_last_name,
      c.phone AS client_phone,
      c.email AS client_email,
      c.birthday AS client_birthday,
      c.notes AS appointment_notes
      FROM wp_bookly_customers AS c WHERE id='".$staff_auto_id."'",ARRAY_A);
  
      $status_array=array();
      $keyhwe=0;
      foreach( $status as $status_value)
      {  
             $status[$keyhwe]["number_of_persons"]=$number_of_persons;
             $status[$keyhwe]["status"]=$staff_status_id;
            // $status_array[] =$status_value;
              $keyhwe++;
  
           
              
  
             
      }
      
     // $blank_array =array();
      //foreach($staff_id as $blank)
      //{
          $blank["customers"] = $status;
          //$blank_array[] =$blank;
      //}
          $staff_id[$staffkey]["customers"]=$status;
  
          
    $staffkey++;
    
                        
    
    }
    
    if(isset($_REQUEST['radius']) && $_REQUEST['radius'] !='')
    {
                $latitude='';
                $longitude='';
                if(isset($_REQUEST['zipcode']) && $_REQUEST['zipcode'] !='')
                {    
                            $url = "https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyCZKEvihF8xfkRiJ3Mgbr9fSR2TbLHklzk&components=postal_code:".$_REQUEST['zipcode'];
                            $result_string = file_get_contents($url);
                            $result = json_decode($result_string, true);
                            $value =$result['results'][0]['geometry']['location'];
                
                            
                                $latitude =$value['lat'];
                                $longitude =$value['lng'];
    
    
                        
                }
                else
                {
                        $cuerrent_login_staff_id  =$_POST['staff_ids'];
    
                        $tablebookly2=$wpdb->prefix."interputer_lat_long";
                        $select2="select * from $tablebookly2 where staff_id='".$cuerrent_login_staff_id."'";
                        $results2=$wpdb->get_results($select2,ARRAY_A);
                        foreach($results2 as $results3)
                        {
                                $latitude =$results3['latitude'];
                                $longitude =$results3['longitude'];
    
                            
                        }
                }
                            $query_radius = "SELECT *, (((acos(sin((".$latitude."*pi()/180)) * sin((`latitude`*pi()/180)) + cos((".$latitude."*pi()/180)) * cos((`latitude`*pi()/180)) * cos(((".$longitude."- `longitude`)*pi()/180)))) * 180/pi()) * 60 * 1.1515) as distance FROM `".$wpdb->prefix."interputer_booking_lat_long`";
                            $distance =$wpdb->get_results($query_radius,ARRAY_A);
    
                            $dis_appointment_id=array();
                            foreach($distance as $distance_hwe)
                            {
    
                                if($distance_hwe['distance'] <= $_REQUEST['radius'] || $distance_hwe['distance']== '')
                                {
                                    //appontment id 
                                    $dis_appointment_id[] =$distance_hwe['staff_id'];
            
                                }
                            }
    
                
        }

        $appointments = array_merge($appointments,$staff_id);

       

        foreach ( $appointments as $key => $appointment ) {

            if(empty($appointment['service_id_hwe']))
            {
    
                $appoint_id=$appointment['id'];
    
                $get_approved_ser_id = $wpdb->get_results("SELECT * FROM ".$wpdb->prefix."bookly_appointments WHERE id='".$appoint_id."'",ARRAY_A);
                foreach($get_approved_ser_id as $get_approved_ser_id_hwe)
                {
                  $approved_service_id=$get_approved_ser_id_hwe['service_id'];
                    if(!in_array($approved_service_id,$service_id_hwe))
                    {
                       unset($appointments[$key]);
                       continue;
                    }
                }
                   
    
            }

           
            if(!empty($appointment['service_id_hwe']) && !in_array($appointment['service_id_hwe'],$service_id_hwe))
            {
               unset($appointments[$key]);
               continue;
            }
    
            if(isset($_REQUEST['radius']) && $_REQUEST['radius'] !='' && isset($_REQUEST['zipcode']) && $_REQUEST['zipcode'] !='')
            {
    
                if(!in_array($appointment['id'],$dis_appointment_id))
                {
                    unset($appointments[$key]);
                    continue;
                
                }
    
            }
            else if(!empty($_REQUEST['zipcode']))
            {
                            
    
                        $customerid=$appointment['customer_id'];
                    global $wpdb;
                    $booklycustomer=$wpdb->prefix."bookly_customers";
                    //$select ="select * from $booklycustomer where id='$customerid'";
                    $select ="select * from $booklycustomer where id='$customerid'";
                    $results=$wpdb->get_results($select);
                    if($results[0]->postcode!=$_REQUEST['zipcode'])
                    {
                        unset($appointments[$key]);
                        continue;	
                    }		
            }
            //mohit
            if(isset($_REQUEST['radius']) && $_REQUEST['radius'] !='')
            {
    
                if(!in_array($appointment['id'],$dis_appointment_id))
                {
                    unset($appointments[$key]);
                    continue;
                
                }
    
            }
            
    
    
    
                $show_cancel_button='';
                $styling_pending_button='';
            if($appointment['customers'][0]['status'] == 'approved')
            {
                $change_color_status = 'success';
                $button_name = 'Approved';
                $check_condition = '0';
                $appointment['id'];
                $current_date_hwe =date("Y-m-d H:i:s");
                $start_date_hwe =$appointment['start_date'];
                $end_date_hwe =$appointment['end_date'];
                if($current_date_hwe < $end_date_hwe)
                {
                    $styling_cancel_button ="display:inline !important;"; 
                }
                else
                {
                    $styling_cancel_button ="display:none;"; 
                }
                
                
                
            }
            else if($appointment['customers'][0]['status'] == 'pending')
            {
                $check_condition = '1';
                $change_color_status = 'secondary';
                $button_name = 'Accept Job';
                $set_id_appointment ="change_status_".$appointment['id'];
                $styling_pending_button ='background-color: red; font-size: 11px; padding: 5px;';
                $styling_cancel_button="display:none;";
            }


            $codes = $default_codes;
            $codes['appointment_id'] = $appointment['id'];
            $codes['appointment_date'] = DateTime::formatDate( $appointment['start_date'] );
            $codes['appointment_time'] = $appointment['duration'] >= DAY_IN_SECONDS && $appointment['start_time_info'] ? $appointment['start_time_info'] : Lib\Utils\DateTime::formatTime( $appointment['start_date'] );
            $codes['booking_number'] = $appointment['id'];
            $codes['internal_note'] = esc_html( $appointment['internal_note'] );
            $codes['on_waiting_list'] = $appointment['on_waiting_list'];
            // $codes['service_name'] = $appointment['service_name'] ? esc_html( $appointment['service_name'] ) : __( 'Untitled', 'bookly' );
            $codes['service_price'] = Price::format( $appointment['service_price'] * $appointment['units'] );
            $codes['service_duration'] = DateTime::secondsToInterval( $appointment['duration'] * $appointment['units'] );
          //mohit 
            
			
          $client_name_hwe ="'".$appointment['customers'][0]['client_name']."'";
          $client_phone_hwe ="'".$appointment['customers'][0]['client_phone']."'";
          $client_email_hwe ="'".$appointment['customers'][0]['client_email']."'";
          $appointment_id_hwe =$appointment['id'];
          $current_login_id =$_POST['staff_ids'];
          $confirm_box ="'Are You Sure, You Want to Approved?'";
          $codes['signed_up']        = $appointment['total_number_of_persons'].'<br><div onclick="return hwe_appointment('.$appointment_id_hwe.','.$current_login_id.','.$check_condition.')" style="'.$styling_pending_button.'" style="width:52px;display:block;" class="badge badge-'.$change_color_status.' get_staff_ids" data-staff_id="'.$appointment['id'].'" data-current_user_id="'.$_POST['staff_ids'].'" id="'.$set_id_appointment.'">' .$button_name. '</div>&nbsp;&nbsp;&nbsp;&nbsp;
            <div onclick="return hwe_appointment_cancel('.$appointment_id_hwe.','.$current_login_id.','.$check_condition.','.$client_name_hwe.','.$client_phone_hwe.','.$client_email_hwe.')" style="'.$styling_cancel_button.'" class="badge badge-danger cancel_btn" data-staff_id="'.$appointment['id'].'" data-current_user_id="'.$_POST['staff_ids'].'">Cancel Job</div>
            ';


            foreach ( array( 'staff_name', 'staff_phone', 'staff_info', 'staff_email', 'service_info', 'service_capacity', 'category_name', 'client_note' ) as $field ) {
                $codes[ $field ] = esc_html( $appointment[ $field ] );
            }
            if ( $appointment['staff_any'] ) {
                $codes['staff_name'] .= $postfix_any;
            }

            // Customers for popover.
            $overall_status = isset( $appointment['customers'][0] ) ? $appointment['customers'][0]['status'] : '';

            $codes['participants'] = array();
            $event_status = null;
            foreach ( $appointment['customers'] as $customer ) {
                $status_color = 'secondary';
                if ( isset( $status_codes[ $customer['status'] ] ) ) {
                    $status_color = $status_codes[ $customer['status'] ];
                }
                if ( $coloring_mode === 'status' ) {
                    if ( $event_status === null ) {
                        $event_status = $customer['status'];
                    } elseif ( $event_status !== $customer['status'] ) {
                        $event_status = 'mixed';
                    }
                }
                if ( $customer['status'] !== $overall_status && ( ! in_array( $customer['status'], $cancelled_statuses, true ) || ! in_array( $overall_status, $cancelled_statuses, true ) ) ) {
                    if ( in_array( $customer['status'], $pending_statuses, true ) && in_array( $overall_status, $pending_statuses, true ) ) {
                        $overall_status = CustomerAppointment::STATUS_PENDING;
                    } else {
                        $overall_status = '';
                    }
                }
                if ( $customer['number_of_persons'] > 1 ) {
                    $number_of_persons = '<span class="badge badge-info mr-1"><i class="far fa-fw fa-user"></i>×' . $customer['number_of_persons'] . '</span>';
                } else {
                    $number_of_persons = '';
                }
                // $customer['status_color'] = $status_color;
                // $customer['nop'] = $number_of_persons;
                // $customer['status'] = CustomerAppointment::statusToString( $customer['status'] );
                $popover_customers .= '<div class="d-flex"><div class="text-muted flex-fill">' . $customer['client_name'] . '</div><div class="text-nowrap">' . $number_of_persons . '<span class="badge badge-' . $status_color . '">' . CustomerAppointment::statusToString( $customer['status'] ) . '</span></div></div>';
                $codes['participants'][] = $customer;
            }

            // Display customer information only if there is 1 customer. Don't confuse with number_of_persons.
            if ( $appointment['number_of_persons'] === $appointment['total_number_of_persons'] ) {
                $participants = 'one';
                $template = $one_participant;
                foreach ( array( 'client_name', 'client_first_name', 'client_last_name', 'client_phone', 'client_email', 'client_birthday' ) as $data_entry ) {
                    $codes[ $data_entry ] = esc_html( $appointment['customers'][0][ $data_entry ] );
                }
                $codes['number_of_persons'] = $appointment['number_of_persons'];
                $codes['appointment_notes'] = $appointment['appointment_notes'];
                // Payment.
                if ( $appointment['total'] ) {
                    $codes['total_price'] = Price::format( $appointment['total'] );
                    $codes['amount_paid'] = Price::format( $appointment['paid'] );
                    $codes['amount_due'] = Price::format( $appointment['total'] - $appointment['paid'] );
                    $codes['total_price']    = Price::format( $appointment['total'] );
                    $codes['payment_type'] = Lib\Entities\Payment::typeToString( $appointment['payment_gateway'] );
                    $codes['payment_status'] = Lib\Entities\Payment::statusToString( $appointment['payment_status'] );
                }
                // Status.
                $codes['status'] = CustomerAppointment::statusToString( $appointment['status'] );
            } else {
                $participants = 'many';
                $template = $many_participants;
            }

            $tooltip = '<i class="" style="color:%s"></i><span>{service_name}</span>' . $popover_customers . '<span class="d-block text-muted">{appointment_time} - %s</span>';

            $tooltip = sprintf( $tooltip,
                $appointment['service_color'],
                ( $appointment['duration'] * $appointment['units'] >= DAY_IN_SECONDS && $appointment['start_time_info'] ? $appointment['end_time_info'] : DateTime::formatTime( $appointment['end_date'] ) )
            );
            
            // $codes['appointment_color'] = $appointment['service_color'];
            // $codes['appointment_end_time'] = ( $appointment['duration'] * $appointment['units'] >= DAY_IN_SECONDS && $appointment['start_time_info'] ? $appointment['end_time_info'] : DateTime::formatTime( $appointment['end_date'] ) );

            $codes = Proxy\Shared::prepareAppointmentCodesData( $codes, $appointment, $participants );

            

            switch ( $coloring_mode ) {
                case 'status';
                    $color = $colors[ $event_status ?: 'mixed' ];
                    break;
                case 'staff':
                    $color = $appointment['staff_color'];
                    break;
                case 'service':
                default:
                    $color = $appointment['service_color'];
            }
            $codes['description'] = Lib\Utils\Codes::stringify( $template, $codes, false );

          

            $appointments[ $key ] = array(
                'id' => $appointment['id'],
                'start' => $appointment['start_date'],
                'end' => $appointment['end_date'],
                'title' => ' ',
                'color' => $color,
                'resourceId' => $appointment['staff_id'],
                'allDay' => $appointment['duration'] >= DAY_IN_SECONDS,
                'extendedProps' => array(
                    'tooltip' => Lib\Utils\Codes::stringify( $appointment['duration'] >= DAY_IN_SECONDS ? $tooltip_all_day : $tooltip, $codes, false, array(), true ),
                    'desc' => $codes['description'],
                    'staffId' => $appointment['staff_id'],
                    'series_id' => (int) $appointment['series_id'],
                    'package_id' => (int) $appointment['package_id'],
                    'waitlisted' => (int) $appointment['on_waiting_list'],
                    'staff_any' => (int) $appointment['staff_any'],
                    'overall_status' => $overall_status,
                ),
            );
       
            if ( $appointment['duration'] * $appointment['units'] >= DAY_IN_SECONDS && $appointment['start_time_info'] ) {
                $appointments[ $key ]['extendedProps']['header_text'] = sprintf( '%s - %s', $appointment['start_time_info'], $appointment['end_time_info'] );
            }
        }

        return array_values( $appointments );
    }

    /**
     * @return int
     */
    public static function getAppointmentsCount()
    {
        if ( isset ( $_REQUEST['page'] ) && $_REQUEST['page'] === self::pageSlug() ) {
            return 0;
        }

        return Lib\Entities\Appointment::query()
            ->whereGt( 'id', get_option( 'bookly_cal_last_seen_appointment', 0 ) )
            ->count();
    }

    /**
     * Show 'News' submenu with counter inside Bookly main menu
     */
    public static function addBooklyMenuItem( $calendar_badge )
    {
        $calendar = __( 'Calendar', 'bookly' );
        if ( $calendar_badge ) {
            add_submenu_page( 'bookly-menu', $calendar, sprintf( '%s <span class="update-plugins count-%d"><span class="update-count">%d</span></span>', $calendar, $calendar_badge, $calendar_badge ), 'read',
                self::pageSlug(), function () { Page::render(); } );
        } else {
            add_submenu_page( 'bookly-menu', $calendar, $calendar, 'read',
                self::pageSlug(), function () { Page::render(); } );
        }
    }
}
