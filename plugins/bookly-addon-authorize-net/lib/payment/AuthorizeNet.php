<?php
namespace BooklyAuthorizeNet\Lib\Payment;

use BooklyAuthorizeNet\Lib;

/**
 * Class AuthorizeNet
 * @package BooklyAuthorizeNet\Lib\Payment
 */
class AuthorizeNet
{
    const LIVE_URL = 'https://secure2.authorize.net/gateway/transact.dll';
    const SANDBOX_URL = 'https://test.authorize.net/gateway/transact.dll';

    protected $sandbox = null;
    protected $_x_post_fields = array(
        'version'        => '3.1',
        'delim_char'     => ',',
        'delim_data'     => 'TRUE',
        'relay_response' => 'FALSE',
        'encap_char'     => '|',
    );

    private $_all_aim_fields = array(
        'address', 'allow_partial_auth','amount','auth_code','authentication_indicator',
        'bank_aba_code','bank_acct_name','bank_acct_num','bank_acct_type','bank_check_number',
        'bank_name','card_code','card_num','cardholder_authentication_value','city','company',
        'country','cust_id','customer_ip','delim_char','delim_data','description','duplicate_window',
        'duty','echeck_type','email','email_customer','encap_char','exp_date','fax','first_name',
        'footer_email_receipt','freight','header_email_receipt','invoice_num','last_name','line_item',
        'login','method','phone','po_num','recurring_billing','relay_response','ship_to_address',
        'ship_to_city','ship_to_company','ship_to_country','ship_to_first_name','ship_to_last_name',
        'ship_to_state','ship_to_zip','split_tender_id','state','tax','tax_exempt','test_request',
        'tran_key','trans_id','type','version','zip'
    );

    public function __construct( $api_login_id, $transaction_key, $sandbox )
    {
        $this->setField( 'login', $api_login_id )
            ->setField( 'tran_key', $transaction_key );
        $this->sandbox = $sandbox;
    }

    /**
     * Do an AUTH_CAPTURE transaction.
     *
     * @return AuthorizeNet\AuthorizeNetAIM_Response
     */
    public function authorizeAndCapture()
    {
        $this->setField( 'type', 'AUTH_CAPTURE' );

        return $this->_sendAIM_Request();
    }

    /**
     * Posts the request to AuthorizeNet & returns response.
     *
     * @return AuthorizeNet\AuthorizeNetAIM_Response
     */
    protected function _sendAIM_Request()
    {
        $url  = $this->sandbox ? self::SANDBOX_URL : self::LIVE_URL;
        $data = array();
        foreach ( $this->_x_post_fields as $key => $value ) {
            $data[ 'x_' . $key ] = $value;
        }
        $args = array(
            'timeout' => 30,
            'sslverify' => false,
            'body' => $data,
        );
        $response = wp_remote_post( $url, $args );

        return new Lib\Payment\AuthorizeNet\AuthorizeNetAIM_Response( $response['body'], $this->_x_post_fields['delim_char'], $this->_x_post_fields['encap_char'] );
    }

    /**
     * @param string $name
     * @param string $value
     * @return $this
     */
    public function setField( $name, $value )
    {
        if ( in_array( $name, $this->_all_aim_fields ) ) {
            $this->_x_post_fields[ $name ] = $value;
        }

        return $this;
    }

}