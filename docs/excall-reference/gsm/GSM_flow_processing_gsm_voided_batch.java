// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/GSM_flow_processing_gsm_voided_batch.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
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
import com.fis.excall.domain.UserInFoDetails;
import com.fis.excall.security.SecurityUtils;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;

@Service
public class GSM_flow_processing_gsm_voided_batch {
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

	private String voidedBatchEnvelope(Object body) throws Exception {
		UserInFoDetails userInfo = SecurityUtils.getInfoCurrentUserLogin();
		OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(userInfo.getLogin());

		/*
		 * prepare call to econtract
		 */
		String token = "Bearer " + accessToken.getValue();
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", token);

		List<VoidedResponse> mapRtn = new ArrayList<VoidedResponse>();
		try {
			VoidedInfo mapBody = mapperClass.swap(VoidedInfo.class, body);
			List<String> ids = mapBody.getIds();
			if (ids != null && ids.size() > 0) {
				for (String id : ids) {
					EnvelopeDTO envelopeDTO = envelopeClients.getEnvelopeById(id);
					VoidedResponse res = new VoidedResponse();
					Boolean status = false;
					res.setId(id);
					res.setEnvelopeStatus(envelopeDTO.getStatus());
					if ("processing".equals(envelopeDTO.getStatus())) {
						status = this.voidedContract(headersEcon, id, mapBody.getReason(), userInfo.getLogin(), mapBody.getDisable());
					}
					res.setStatus(status);

					mapRtn.add(res);
				}
			} else {
				throw new RuntimeException("listIdUndefined");
			}
			return mapperClass.mapper().writeValueAsString(mapRtn);
		} catch (Exception ex) {
			throw new RuntimeException(ex.getMessage());
		}
	}

	private Boolean voidedContract(HttpHeaders headersEcon, String id, String reason, String owner, Boolean disable) {

		Map<String, Object> payload = new HashMap<String, Object>();
		payload.put("id", id);
		payload.put("reason", reason);
		payload.put("owner", owner);
		payload.put("disable", disable);

		Map<String, Object> bodyExcall = new HashMap<String, Object>();
		bodyExcall.put("id", "");
		bodyExcall.put("refId", null);
		bodyExcall.put("selector", "flow_processing_gsm_voided_contract");
		bodyExcall.put("lookup", id);
		bodyExcall.put("attrs", new Object());
		bodyExcall.put("payload", null);
		bodyExcall.put("body", payload);

		HttpEntity<Object> entity = new HttpEntity<>(bodyExcall, headersEcon);
		String url = urlFPTeContract + "/services/excall/api/excall";
		try {
			this.restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
			return true;
		} catch (HttpStatusCodeException e) {
			return false;
		}
	}

	private static class VoidedResponse implements Serializable {
		private static final long serialVersionUID = 1L;

		private String id;
		private Boolean status;
		private String envelopeStatus;

		public String getId() {
			return id;
		}

		public void setId(String id) {
			this.id = id;
		}

		public Boolean getStatus() {
			return status;
		}

		public void setStatus(Boolean status) {
			this.status = status;
		}

		public String getEnvelopeStatus() {
			return envelopeStatus;
		}

		public void setEnvelopeStatus(String envelopeStatus) {
			this.envelopeStatus = envelopeStatus;
		}
	}

	private static class VoidedInfo implements Serializable {
		private static final long serialVersionUID = 1L;

		private List<String> ids;
		private String reason;
		private Boolean disable;
		public List<String> getIds() {
			return ids;
		}
		public void setIds(List<String> ids) {
			this.ids = ids;
		}
		public String getReason() {
			return reason;
		}
		public void setReason(String reason) {
			this.reason = reason;
		}
		public Boolean getDisable() {
			return disable;
		}
		public void setDisable(Boolean disable) {
			this.disable = disable;
		}
	}
}
