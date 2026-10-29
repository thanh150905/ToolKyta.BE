// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/ERequest_after_flow_start_kyta_create_env_no.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.common.OAuth2AccessToken;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;
import com.fis.excall.service.envelope.dto.EnvelopeHdrDTO;
import com.fis.excall.service.envelope.dto.HdrFieldDTO;

@Service
public class ERequest_after_flow_start_kyta_create_env_no {
	@Autowired
	private EnvelopeClient envelopeClients;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;

	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	private static final String urlFPTeContract = "https://10.14.121.18:30600/app";
//	private static final String urlFPTeContract = "https://demo.econtract.fpt.com/app";

	public String creatingEnvelope(String payload) throws Exception {
		try {
			Map<String, Object> body = mapperClass.swap(HashMap.class, payload);

			String refId = String.valueOf(body.get("refId"));
			String ticketId = String.valueOf(body.get("ticketId"));
			String userTaskId = String.valueOf(body.get("userTaskId"));
			String userTaskVersion = null;
			Object _userTaskVersion = body.get("userTaskVersion");
			if (_userTaskVersion != null) {
				userTaskVersion = String.valueOf(body.get("userTaskVersion"));
				if (StringUtils.isBlank(userTaskVersion)) {
					userTaskVersion = "0";
				}
			} else {
				userTaskVersion = "0";
			}
			String recipientDetailsId = String.valueOf(body.get("recipientDetailsId"));
			String owner = String.valueOf(body.get("owner"));
			OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(owner);

			String token = "Bearer " + accessToken.getValue();
			HttpHeaders headersEcon = new HttpHeaders();
			headersEcon.setContentType(MediaType.APPLICATION_JSON);
			headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
			headersEcon.set("Authorization", token);

			String docTypeCode = String.valueOf(body.get("docTypeCode"));
			Object header = body.get("headerFields");

			// create draft
			EnvelopeDTO envelope = null;
			try {
				envelope = this.createEnvelopeDraft(headersEcon, refId, docTypeCode, ticketId + "_" + userTaskId);
			} catch (Exception e) {
				return this.handleReturn("error", "3", e.getMessage());
			}

			HdrFieldDTO envNo = null;
			try {
				envNo = this.createEnvNo(headersEcon, envelope);
			} catch (Exception e) {
				return this.handleReturn("error", "4", e.getMessage());
			}
			Map<String, Object> rtn = new HashMap<String, Object>();
			rtn.put("envelopeId", envelope.getId());
			rtn.put("envNo", envNo);
			return this.handleReturn("success", "0", mapperClass.mapper().writeValueAsString(rtn));
		} catch (Exception ex) {
			return this.handleReturn("error", "-1", ex.getMessage());
		}
	}

	public HdrFieldDTO createEnvNo(HttpHeaders headersEcon, EnvelopeDTO envelope) {
		Map<String, Object> variables = new HashMap<String, Object>();
		variables.put("envelopeId", envelope.getId());
		variables.put("docTypeId", envelope.getDocTypeCode());

		HdrFieldDTO envNo = new HdrFieldDTO();

		EnvelopeHdrDTO header = envelope.getHeader();
		List<HdrFieldDTO> fields = header.getFields();
		for (HdrFieldDTO field : fields) {
			if ("envNo".equals(field.getId())) {
				envNo = field;
				envNo.setVariables(variables);
			}
		}

		String url = "/services/envelope/api/field/header/formula";
		HttpEntity<Object> entity = new HttpEntity<>(envNo, headersEcon);
		try {
			ResponseEntity<HdrFieldDTO> response = restTemplate.exchange(urlFPTeContract + url, HttpMethod.PUT, entity, HdrFieldDTO.class);
			return response.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	public EnvelopeDTO createEnvelopeDraft(HttpHeaders headersEcon, String refId, String docTypeCode, String envName)
			throws Exception {
		Map<String, Object> body = new HashMap<String, Object>();
		JsonNode rootNode = null;
		if (docTypeCode != null && !docTypeCode.isEmpty()) {
			body.put("docTypeId", docTypeCode);
			String doctypeUrl = "/services/envelope/api/doc-types/" + docTypeCode;
			HttpEntity<Object> entityDoctype = new HttpEntity<>(headersEcon);
			ResponseEntity<String> doctypeResponse = restTemplate.exchange(urlFPTeContract + doctypeUrl, HttpMethod.GET,
					entityDoctype, String.class);
			rootNode = mapperClass.mapper().readTree(doctypeResponse.getBody());
			if (rootNode.path("fields") != null) {
				List<HdrFieldDTO> _fields = new ArrayList<HdrFieldDTO>();
				_fields = mapperClass.mapper().readValue(
						mapperClass.mapper().writeValueAsString(rootNode.path("fields")),
						new TypeReference<List<HdrFieldDTO>>() {
						});
				HdrFieldDTO fieldEnvNo = new HdrFieldDTO();;
				for (HdrFieldDTO field : _fields) {
					if (field.getId().equals("envNo")) {
						fieldEnvNo = field;
					}
				}
				
				HdrFieldDTO fieldName = new HdrFieldDTO("envName", "Tên hợp đồng", "String", envName, null, null);
				HdrFieldDTO fieldEnvDate = new HdrFieldDTO("envDate", "Ngày ký", "Date", null, null, null);
				List<HdrFieldDTO> fields = Arrays.asList(fieldName, fieldEnvNo, fieldEnvDate);
				
				body.put("fields", fields);
			}
		} else {
			body.put("docTypeId", null);
			HdrFieldDTO fieldName = new HdrFieldDTO("envName", "Tên hợp đồng", "String", envName, null, null);
			HdrFieldDTO fieldEnvNo = new HdrFieldDTO("envNo", "Số hợp đồng", "String", null, null, null);
			HdrFieldDTO fieldEnvDate = new HdrFieldDTO("envDate", "Ngày ký", "Date", null, null, null);
			List<HdrFieldDTO> fields = Arrays.asList(fieldName, fieldEnvNo, fieldEnvDate);
			
			body.put("fields", fields);
		}

		body.put("isStep", false);
		body.put("refId", refId);

		EnvelopeDTO envelope;
		try {
			String createEnvelope = "/services/envelope/api/envelope/v2";
			HttpEntity<Object> entity = new HttpEntity<>(mapperClass.mapper().writeValueAsString(body), headersEcon);
			ResponseEntity<EnvelopeDTO> requestEcontract1 = restTemplate.postForEntity(urlFPTeContract + createEnvelope,
					entity, EnvelopeDTO.class);

			envelope = requestEcontract1.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
		return envelope;
	}

	public String handleReturn(String status, String message, String result) throws Exception {
		Map<String, String> rtn = new HashMap<String, String>();
		rtn.put("status", status);
		rtn.put("message", message);
		rtn.put("result", result);
		return mapperClass.mapper().writeValueAsString(rtn);
	}
}
