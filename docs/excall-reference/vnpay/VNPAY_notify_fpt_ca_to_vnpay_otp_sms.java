// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/VNPAY_notify_fpt_ca_to_vnpay_otp_sms.java
// Secret đã thay bằng "<REDACTED>" (1 chỗ).
package com.fis.excall.service.test;

import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
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

import com.fasterxml.jackson.databind.JsonNode;
import com.fis.excall.config.MapperClass;

@Service
public class VNPAY_notify_fpt_ca_to_vnpay_otp_sms {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	private static final String urlVnpay = "https://smsgateway.vnpay.vn/smsgw/sendSms";

	private static final String urlEcontract = "https://demo.econtract.fpt.com/";

	public String sendOtp(String id, Object oContent) throws Exception {
		Map<String, Object> bodyParams = new HashMap<>();
		Map<String, Object> body = mapperClass.swap(HashMap.class, oContent);
		Map<String, Object> rtnMessage = new HashMap<>();
		String contactId = String.valueOf(body.get("contactId"));
		String envelopeId = String.valueOf(body.get("envelopeId"));
		String refId = String.valueOf(body.get("refId"));
		String otpValue = String.valueOf(body.get("otpValue"));
		String expiredTime = String.valueOf(body.get("expiredTime"));
		String otpNumberPhone = String.valueOf(body.get("otpNumberPhone"));

		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

		bodyParams.put("messageId", id);
		bodyParams.put("destination", otpNumberPhone);
		bodyParams.put("sender", "VNPAY");
		bodyParams.put("keyword", "VNPAYHDDT");
		bodyParams.put("shortMessage", "[FPT-CA] Ma xac thuc (OTP) cua Quy khach la " + otpValue
				+ ". Vui long dien ma so nay de ky Hop dong Dien Tu va khong cung cap OTP cho bat ky ai");
		bodyParams.put("encryptMessage", "");
		bodyParams.put("isEncrypt", 0);
		bodyParams.put("requestTime", expiredTime);
		bodyParams.put("partnerCode", "950406");
		bodyParams.put("secretKey", "<REDACTED>");

		HttpEntity<Object> entity = new HttpEntity<>(bodyParams, headersEcon);
		rtnMessage.put("param", entity);
		ResponseEntity<String> response = null;
		try {
			response = restTemplate.exchange(urlVnpay, HttpMethod.POST, entity, String.class);
			if (response.getStatusCodeValue() == 200) {
				JsonNode rootNode = null;
				try {
					rootNode = mapperClass.mapper().readTree(response.getBody());
				} catch (IOException e) {
					rtnMessage.put("response", "send-sms-vnpay-error");
					throw new RuntimeException(mapperClass.mapper().writeValueAsString(rtnMessage));
				}
				String description = rootNode.path("description").asText();

				if (!("SUCCESS".equals(description) || "DUPLICATE_TRANSACTION".equals(description))) {
					rtnMessage.put("response", response.getBody());
					throw new RuntimeException(mapperClass.mapper().writeValueAsString(rtnMessage));
				}
			} else {
				rtnMessage.put("response", "send-to-sms-error");
				throw new RuntimeException(mapperClass.mapper().writeValueAsString(rtnMessage));
			}
			
			rtnMessage.put("response", response.getBody());
			return mapperClass.mapper().writeValueAsString(rtnMessage);
		} catch (HttpStatusCodeException e) {
			rtnMessage.put("response", e.getMessage());
			throw new RuntimeException(mapperClass.mapper().writeValueAsString(rtnMessage));
		}
	}
}
