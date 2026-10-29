// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/kyta_sabeco_sabeco_get_template.java
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
public class kyta_sabeco_sabeco_get_template {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	private static final String username = "<REDACTED>";
	private static final String password = "<REDACTED>";
	private static final String client_id = "<REDACTED>";
	private static final String client_secret = "<REDACTED>";

	private static final String eContractUrl = "https://10.14.121.18:30600/app/";
//	private static final String eContractUrl = "https://demo.econtract.fpt.com/app/";

	public String getTemplate(Object body) throws Exception {
		try {
			String accessToken = this.getAccessToken();
			Map<String, Object> mapbody = mapperClass.swap(Map.class, body);
			String templateId = null;
			if (mapbody.containsKey("templateId")) {
				templateId = String.valueOf(mapbody.get("templateId"));
			}

			String token = "Bearer " + accessToken;
			HttpHeaders headersEcon = new HttpHeaders();
			headersEcon.setContentType(MediaType.APPLICATION_JSON);
			headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
			headersEcon.set("Authorization", token);
            
			String url = eContractUrl + "services/envelope/api/external/v1/template/tempAndStructure?templateid=" + templateId;

			HttpEntity<Object> entity = new HttpEntity<>(headersEcon);
			ResponseEntity<String> res = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
			return res.getBody();
		} catch (HttpStatusCodeException e) {
					throw new RuntimeException(e.getResponseBodyAsString());
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
