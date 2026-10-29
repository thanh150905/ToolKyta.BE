// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/kyta_sabeco_sabeco_get_empAndStructure_by_templateid.java
// Secret đã thay bằng "<REDACTED>" (4 chỗ).
package com.fis.excall.service.test;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang.StringUtils;
import org.apache.http.client.utils.URIBuilder;
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
public class kyta_sabeco_sabeco_get_empAndStructure_by_templateid {
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
			String status = null;
			String page = null;
			String size = null;
			String sort = null;
			// if (mapbody.containsKey("status")) {
			// 	status = String.valueOf(mapbody.get("status"));
			// }
			if (mapbody.containsKey("page")) {
				page = String.valueOf(mapbody.get("page"));
			}
			if (mapbody.containsKey("size")) {
				size = String.valueOf(mapbody.get("size"));
			}
			// if (mapbody.containsKey("sort")) {
			// 	sort = String.valueOf(mapbody.get("sort"));
			// }

			String token = "Bearer " + accessToken;
			HttpHeaders headersEcon = new HttpHeaders();
			headersEcon.setContentType(MediaType.APPLICATION_JSON);
			headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
			headersEcon.set("Authorization", token);

			// String mess = "Vui long nhap so dien thoai va ma " + passWord +" de xem noi
			// dung hop dong dien tu " + urlEcontract + "app/fi/" + envId + "/" +
			// recipientId + "/login";
			String url = eContractUrl + "services/envelope/api/template/findbyowner";
			if (!StringUtils.isEmpty(status)) {
				url += ("/" + status);
			}
			
			URIBuilder uriBuilder = new URIBuilder(url);
			if (!StringUtils.isEmpty(page)) {
				uriBuilder.addParameter("page", page);
			}
			if (!StringUtils.isEmpty(size)) {
				uriBuilder.addParameter("size", size);
			}
			if (!StringUtils.isEmpty(sort)) {
				uriBuilder.addParameter("sort", sort);
			}

			HttpEntity<Object> entity = new HttpEntity<>(headersEcon);
			ResponseEntity<Object> res = restTemplate.exchange(uriBuilder.build().toString(), HttpMethod.GET, entity, Object.class);
			String total = null;
			List<String> totals = res.getHeaders().get("x-total-count");
			if (totals != null && totals.size() > 0) {
				total = totals.get(0);
			}
			Map<String, Object> rtn = new HashMap<String, Object>();
			rtn.put("total", total);
			rtn.put("data", res.getBody());
			return mapperClass.mapper().writeValueAsString(rtn);
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
