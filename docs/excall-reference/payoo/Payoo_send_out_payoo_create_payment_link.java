// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/Payoo_send_out_payoo_create_payment_link.java
// Secret đã thay bằng "<REDACTED>" (2 chỗ).
package com.fis.excall.service.test;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.SimpleDateFormat;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fis.excall.config.MapperClass;

@Service
public class Payoo_send_out_payoo_create_payment_link {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	private static final String urlFPTeContract = "https://10.14.121.18:30600/app";
	private static final String urlPayBill = "https://demo.epaybill.kyta.fpt.com";
	private static final String urlPayoo = "https://newsandbox.payoo.com.vn/v2/checkout";
	
	private static final String username = "<REDACTED>";
	private static final String shop_id = "12170";
	private static final String shop_title = "FPTIS";
	private static final String shop_domain = "https://demo.econtract.fpt.com";
	private static final String checksumKey = "<REDACTED>";

	public String createPayment(Object body) throws Exception {
		Map<String, Object> _body = mapperClass.swap(Map.class, body);
		Map<String, Object> bodyParams = new HashMap<>();
		try {
			HttpHeaders headersEcon = new HttpHeaders();
			headersEcon.setContentType(MediaType.APPLICATION_JSON);
			
			String currency = String.valueOf(_body.get("currency"));
			String totalPriceVND = String.valueOf(_body.get("originalTotalPrice"));
			
			// đăng ký account
			Map<String, Object> bodyRegisterOrder = mapperClass.swap(Map.class, _body.get("registerOrder"));
			String urlRegisterOrder = urlFPTeContract + "/services/uaa/api/p/register-orders";
			HttpEntity<Object> entityRegisterOrder = new HttpEntity<>(bodyRegisterOrder, headersEcon);
			ResponseEntity<String> responseRegisterOrder = restTemplate.exchange(urlRegisterOrder, HttpMethod.POST, entityRegisterOrder, String.class);
			Map<String, Object> registerOrder = mapperClass.swap(Map.class, responseRegisterOrder.getBody());
			
			String refId = String.valueOf(registerOrder.get("id"));
			
			Map<String, Object> bodyCreatePayment = mapperClass.swap(Map.class, _body.get("payment"));
			bodyCreatePayment.put("refId", refId);
			bodyCreatePayment.put("paymentType", "econtract_register");
			bodyCreatePayment.put("totalPrice", totalPriceVND);
			bodyCreatePayment.put("currency", currency);
			bodyCreatePayment.put("currencyRate", _body.get("currencyRate"));
			String urlCreatePayment = urlFPTeContract + "/services/pay-bill/api/p/payments/create";
			HttpEntity<Object> entityCreatePayment = new HttpEntity<>(bodyCreatePayment, headersEcon);
			ResponseEntity<String> responseCreatePayment = restTemplate.exchange(urlCreatePayment, HttpMethod.POST, entityCreatePayment, String.class);
			Map<String, Object> payment = mapperClass.swap(Map.class, responseCreatePayment.getBody());
			
			String paymentId = String.valueOf(payment.get("id"));
			String name = String.valueOf(payment.get("name"));
			String email = String.valueOf(payment.get("email"));
			String phone = String.valueOf(payment.get("phoneNumber"));
			String paymentType = String.valueOf(payment.get("paymentType"));
			String custId = String.valueOf(payment.get("custId"));
			String orderCashAmount = String.valueOf(payment.get("totalPrice"));
			
			
			Map<String, Object> bodyInvoice = mapperClass.swap(Map.class, _body.get("invoice"));
			
			Map<String, String> mapData = new LinkedHashMap<String, String>();
			Map<String, String> mapShops = new LinkedHashMap<String, String>();
			Map<String, String> mapShop = new LinkedHashMap<String, String>();
			mapShop.put("username", username);
			mapShop.put("shop_id", shop_id);
			mapShop.put("shop_title", shop_title);
			mapShop.put("shop_domain", shop_domain);
			mapShop.put("order_no", paymentId);
			mapShop.put("order_cash_amount", totalPriceVND);
			mapShop.put("order_ship_date", "");
			mapShop.put("order_ship_days", "0");
			mapShop.put("order_description", "Register Kyta.Signature");
			mapShop.put("shop_back_url", "");
			mapShop.put("notify_url", urlPayBill + "/services/pay-bill/api/p/payments/paymentResult/" + paymentId);
			
			if (currency != null && currency != "" && currency.equals("usd")) {
				mapShop.put("amount_usd", orderCashAmount);
				if (_body.get("currencyRate") != null && _body.get("currencyRate") != "") {
					String currencyRate = String.valueOf(_body.get("currencyRate"));
					mapShop.put("exchange_rate", currencyRate);
				}
			}
			
			ZonedDateTime now = ZonedDateTime.now().plus(30, ChronoUnit.MINUTES);
			Date dateNow = Date.from(now.toInstant());
			SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
			String strDate = buildValidityDate(formatter.format(dateNow));
			mapShop.put("validity_time", strDate);
			
			Map<String, String> mapCustomer = new LinkedHashMap<String, String>();
			mapCustomer.put("name", name);
			mapCustomer.put("phone", phone);
			mapCustomer.put("address", "");
			mapCustomer.put("email", email);
			
			mapShop.put("customer", convertMapToXML(mapCustomer));
			mapShop.put("jsonresponse", "TRUE");
			
			mapShops.put("shop", convertMapToXML(mapShop));
;			mapData.put("shops", convertMapToXML(mapShops));
			String data = convertMapToXML(mapData);
			
			bodyParams.put("data", data);
			bodyParams.put("checksum", this.buildChecksum(checksumKey + data));
			bodyParams.put("refer", shop_domain);
			
			String payooPaymentType = "qrcode";
			if (_body.containsKey("paymentType") && _body.get("paymentType") != null) {
				payooPaymentType = String.valueOf(_body.get("paymentType"));
			}
			
			if ("qrcode".equals(payooPaymentType)) {
				bodyParams.put("create_ref_qrbank_id", 1);
				bodyParams.put("payment_group", "qrcode");
				bodyParams.put("qr_standard", 0);
			} else {
				bodyParams.put("payment_group", payooPaymentType);
			}
			
			HttpEntity<Object> entity = new HttpEntity<>(bodyParams, headersEcon);

			ResponseEntity<String> response = restTemplate.exchange(urlPayoo, HttpMethod.POST, entity, String.class);
			return response.getBody();
		} catch (HttpStatusCodeException e) {
			Map<String, Object> bodyxxx = new HashMap<>();
			bodyxxx.put("callback", bodyParams);
			bodyxxx.put("response", e.getResponseBodyAsString());
			throw new RuntimeException(mapperClass.mapper().writeValueAsString(bodyxxx));
		}
	}
	
	public String buildChecksum(String context){
	    String generatedPassword = null;
	    try {
	        MessageDigest md = MessageDigest.getInstance("SHA-512");
	        byte[] bytes = md.digest(context.getBytes(StandardCharsets.UTF_8));
	        StringBuilder sb = new StringBuilder();
	        for(int i=0; i< bytes.length ;i++){
	            sb.append(Integer.toString((bytes[i] & 0xff) + 0x100, 16).substring(1));
	        }
	        generatedPassword = sb.toString();
	    } catch (NoSuchAlgorithmException e) {
	        e.printStackTrace();
	    }
	    return generatedPassword;
	}

    public static String convertMapToXML(Map<String, String> map) {
        StringBuilder xmlBuilder = new StringBuilder();
        for (Map.Entry<String, String> entry : map.entrySet()) {
            xmlBuilder.append("<").append(entry.getKey()).append(">")
                      .append(entry.getValue())
                      .append("</").append(entry.getKey()).append(">");
        }
        return xmlBuilder.toString();
    }
    
    public String buildValidityDate(String date) {
    	String[] _date = date.split(" ");
    	String[] __date = _date[0].split("-");
    	String[] time = _date[1].split(":");
    	
    	return __date[0] + __date[1] + __date[2] + time[0] + time[1] + time[2];
    }
}
