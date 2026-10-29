// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/kyta_sabeco_flow_start_kyta_sabeco_create_econtract.java
// Secret đã thay bằng "<REDACTED>" (4 chỗ).
package com.fis.excall.service.test;

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
public class kyta_sabeco_flow_start_kyta_sabeco_create_econtract {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;
	
	private static final String username = "<REDACTED>";
	private static final String password = "<REDACTED>";
	private static final String client_id = "<REDACTED>";
	private static final String client_secret = "<REDACTED>";
	
	private static final String selector = "flow_start_kyta_sabeco_create_econtract";

	private static final String eContractUrl = "https://10.14.121.18:30600/app/";
//	private static final String eContractUrl = "https://demo.econtract.fpt.com/app/";

	public String create(Object body) throws Exception {
		try {
			Map<String, Object> _body = mapperClass.swap(HashMap.class, body);
			String ticketId = String.valueOf(_body.get("ticketId"));
			
			String accessToken = this.getAccessToken();

			String token = "Bearer " + accessToken;
			HttpHeaders headersEcon = new HttpHeaders();
			headersEcon.setContentType(MediaType.APPLICATION_JSON);
			headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
			headersEcon.set("Authorization", token);
			
			Map<String, Object> bodyExcall = new HashMap<String, Object>();
			bodyExcall.put("id", null);
			bodyExcall.put("refId", null);
			bodyExcall.put("selector", selector);
			bodyExcall.put("lookup", ticketId);
			bodyExcall.put("attrs", new Object());
			bodyExcall.put("payload", body);
			bodyExcall.put("body", null);

			HttpEntity<Object> entity = new HttpEntity<>(bodyExcall, headersEcon);
			String url = eContractUrl + "services/excall/api/excall";
			try {
				ResponseEntity<String> response = this.restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
				JsonNode rootNode = null;
				rootNode = mapperClass.mapper().readTree(response.getBody());
				String code = rootNode.get("code").asText();
				if ("0".equals(code)) {
					return mapperClass.mapper().writeValueAsString(rootNode.get("response"));
				} else {
					throw new RuntimeException(response.getBody());
				}
			} catch (HttpStatusCodeException e) {
				throw new RuntimeException(e.getResponseBodyAsString());
			}
		} catch (Exception e) {
			throw new RuntimeException(e.getMessage());
		}
	}
	
	public String getAccessToken() throws Exception {
		String urlGetToken = eContractUrl + "v1/client-auth/login";
		Map<String, Object> bodyToken = new HashMap<String, Object>();
		bodyToken.put("username", username);
		bodyToken.put("password", password);
		bodyToken.put("rememberMe", "false");
		bodyToken.put("clientid", client_id);
		bodyToken.put("clientsecret", client_secret);

		HttpEntity<Object> request = new HttpEntity<Object>(bodyToken);
		try {
			ResponseEntity<String> response = restTemplate.postForEntity(urlGetToken, request, String.class);
			JsonNode rootNode = null;
			rootNode = mapperClass.mapper().readTree(response.getBody());
			return rootNode.path("access_token").asText();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}
}
