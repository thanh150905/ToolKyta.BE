// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/GSM_recipient_start_notify_gsm_econtract_sms.java
// Secret đã thay bằng "<REDACTED>" (3 chỗ).
package com.fis.excall.service.test;

import java.util.Arrays;
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
public class GSM_recipient_start_notify_gsm_econtract_sms {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
//	private UaaClient uaaClient;

//	private static final String urlEcontract = "https://10.14.121.18:30600/app";
	private static final String urlEcontract = "https://demo.econtract.fpt.com/app";
	
	private static final String urlSap = "https://api.staging.gsm-api.net/receiver-notification/v1/public/send";
	
	private static final String urlShortLink = "https://econtract-uat.xanhsm.com/api/";

	private String sendOtp(String id, String passWord, String envId, String recipientId, String phoneNumber, String role) throws Exception {
		try {
			String token = "<REDACTED>";
			HttpHeaders headersEcon = new HttpHeaders();
			headersEcon.setContentType(MediaType.APPLICATION_JSON);
			headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
			headersEcon.set("Authorization", token);

			// String mess = "Vui long nhap so dien thoai va ma " + passWord +" de xem noi
			// dung hop dong dien tu " + urlEcontract + "app/fi/" + envId + "/" +
			// recipientId + "/login";
			String url = urlEcontract + "app/fi/" + envId + "/" + recipientId + "/login";

			String shortLinkToken = this.getShortLinkAccessToken();
			String shortUrl = this.shortLink(shortLinkToken, url);

			Map<String, Object> bodySap = new HashMap<String, Object>();
			bodySap.put("language", "en");
			bodySap.put("type", "sms");
			bodySap.put("template_id", "fpt_sms_econtract_notify");

            if (phoneNumber != null && !"".equals(phoneNumber) && phoneNumber.startsWith("0")) {
                phoneNumber = "+84" + phoneNumber.substring(1);
            }

			Map<String, Object> recipients = new HashMap<String, Object>();
			recipients.put("type", "phone_number");
			recipients.put("identity", phoneNumber);

			bodySap.put("recipients", Arrays.asList(recipients));

			Map<String, Object> data = new HashMap<String, Object>();
			data.put("verification_code", passWord);
			data.put("extended_url", shortUrl);

			bodySap.put("data", data);

			Map<String, Object> body = new HashMap<String, Object>();
			body.put("data", Arrays.asList(bodySap));

			HttpEntity<Object> entity = new HttpEntity<>(body, headersEcon);
			ResponseEntity<String> res = restTemplate.exchange(urlSap, HttpMethod.POST, entity, String.class);
			return "send-sms-ok";
		} catch (Exception e) {
			throw new RuntimeException(e.getMessage());
		}
	}

	private String shortLink(String token, String longUrl) throws Exception {
		String accessToken = "Bearer " + token;

		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", accessToken);

		Map<String, Object> body = new HashMap<String, Object>();
		body.put("alias", "");
		body.put("originalLink", longUrl);

		HttpEntity<Object> entity = new HttpEntity<>(body, headersEcon);
		try {
			ResponseEntity<String> response = restTemplate.postForEntity(urlShortLink + "generate", entity,
					String.class);
			JsonNode rootNode = mapperClass.mapper().readTree(response.getBody());
			return rootNode.path("shortLink").asText();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}

	}

	private String getShortLinkAccessToken() throws Exception {
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

		Map<String, Object> body = new HashMap<String, Object>();
		body.put("username", "<REDACTED>");
		body.put("password", "<REDACTED>");
		body.put("rememberMe", false);

		HttpEntity<Object> entity = new HttpEntity<>(body, headersEcon);
		try {
			ResponseEntity<String> response = restTemplate.postForEntity(urlShortLink + "authenticate", entity, String.class);
			JsonNode rootNode = mapperClass.mapper().readTree(response.getBody());
			JsonNode tokenNode = rootNode.path("token");
			return tokenNode.path("access_token").asText();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}
}
