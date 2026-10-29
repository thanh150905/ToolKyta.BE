// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/GSM_flow_processing_gsm_voided_contract.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import java.util.Collections;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.common.OAuth2AccessToken;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;

@Service
public class GSM_flow_processing_gsm_voided_contract {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;

	@Autowired
	private EnvelopeClient envelopeClients;

//	private static final String urlFPTeContract = "https://10.14.121.18:30600/app";
	private static final String urlFPTeContract = "https://demo.econtract.fpt.com/app";

	private String voidedEnvelope(Object body) throws Exception {
		Map<String, Object> mapBody = mapperClass.swap(Map.class, body);
		String owner = String.valueOf(mapBody.get("owner"));
		String id = String.valueOf(mapBody.get("id"));
		String reason = String.valueOf(mapBody.get("reason"));
		Boolean disable = Boolean.valueOf(String.valueOf(mapBody.get("disable")));
		OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(owner);

		/*
		 * prepare call to econtract
		 */
		String token = "Bearer " + accessToken.getValue();
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", token);

		HttpEntity<Object> entity = new HttpEntity<>(headersEcon);
		String urlVoided = urlFPTeContract + "/services/envelope/api/flowenvelope/" + id + "&reason=" + reason;
		try {
			this.restTemplate.exchange(urlVoided, HttpMethod.PUT, entity, String.class);
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException("voidedError");
		}
		
		if (disable) {
			String urlDisable = urlFPTeContract + "/services/envelope/api/envelope/v2/putWaterMarkIntoFile?id=" + id + "&text=" + reason;
			try {
				this.restTemplate.exchange(urlDisable, HttpMethod.PUT, entity, String.class);
			} catch (HttpStatusCodeException e) {
				throw new RuntimeException("disabledError");
			}
		}
		return id;
	}
}
