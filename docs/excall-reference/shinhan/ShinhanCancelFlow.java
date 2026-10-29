// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/ShinhanCancelFlow.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.common.OAuth2AccessToken;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.domain.UserInFoDetails;
import com.fis.excall.security.SecurityUtils;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;

@Service
public class ShinhanCancelFlow {

	@Autowired
	private EnvelopeClient envelopeClients;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	private static final String urlFPTeContract = "http://10.15.68.187:8080/app/";

	// private static final String urlFPTeContract =
	// "https://demo.econtract.fpt.com.vn/app/";

	public Object cancel(Object payload) throws Exception {

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

		Map<String, List<ResponseBody>> bodyR = new HashMap<String, List<ResponseBody>>();

		List<ResponseBody> responseBodys = new ArrayList<>();

		try {
			Map<String, Object> body = mapperClass.swap(HashMap.class, payload);

			Object acts = body.get("actList");
			List<Act> actList = mapperClass.mapper().readValue(mapperClass.mapper().writeValueAsString(acts),
					new TypeReference<List<Act>>() {
					});

			if (actList != null && actList.size() > 0) {				
				if (actList.size() > 20) {
					throw new RuntimeException("error.tooManyActList");
				}
				
				for (Act act : actList) {
					ResponseBody responseBody = this.processCancelAct(act, headersEcon);
					responseBodys.add(responseBody);
				}
				
			}
		} catch (Exception e) {
		}
		bodyR.put("detail", responseBodys);

		return bodyR;

		/// return mapperClass.mapper().writeValueAsString(bodyR);
	}

	public ResponseBody processCancelAct(Act act, HttpHeaders headersEcon) {
		ResponseBody responseBody = new ResponseBody();

		if (!StringUtils.isNotBlank(act.getEnvelopeId())) {
			if (!StringUtils.isNotBlank(act.getRefId())) {
				responseBody.setStatus("error");
				responseBody.setMess("error.isNotExistsEnvelope");
				return responseBody;
			} else {

				List<EnvelopeDTO> lstEnv = getListEnvelopeByRefId(headersEcon, act.getRefId());

				if (lstEnv == null || lstEnv.size() == 0) {
					responseBody.setStatus("error");
					responseBody.setMess("error.isNotExistsEnvelope");
					return responseBody;
				} else if (lstEnv.size() > 1) {
					responseBody.setStatus("error");
					responseBody.setMess("error.tooManyEnvelope");
					return responseBody;
				} else {
					EnvelopeDTO envelopeDTO = lstEnv.get(0);
					act.setEnvelopeId(envelopeDTO.getId());
				}
			}
		}

		responseBody.setEnvelopeId(act.getEnvelopeId());
		EnvelopeDTO envelope = null;

		try {
			envelope = envelopeClients.getEnvelopeById(act.getEnvelopeId());
		} catch (Exception e) {
			responseBody.setStatus("error");
			responseBody.setMess("error.isNotExistsEnvelope");
			return responseBody;
		}
		return this.cancelContract(envelope, act);

	}

	public ResponseBody cancelContract(EnvelopeDTO envelope, Act act) {
		ResponseBody responseBody = new ResponseBody();
		responseBody.setEnvelopeId(act.getEnvelopeId());
		responseBody.setRefId(act.getRefId());

		try {
			OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(envelope.getOwner());
			String token = "Bearer " + accessToken.getValue();
			HttpHeaders headersEcon = new HttpHeaders();
			headersEcon.setContentType(MediaType.APPLICATION_JSON);
			headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
			headersEcon.set("Authorization", token);

			HttpEntity request = new HttpEntity(headersEcon);

			// make an HTTP GET request with headers

			String urlVoided = "services/envelope/api/flowenvelope/" + envelope.getId() + "?reason=" + act.getReason();

			RestTemplate restTemplate = new RestTemplate();

			if ("processing".equals(envelope.getStatus())) {
				ResponseEntity<String> response = restTemplate.exchange(urlFPTeContract + urlVoided, HttpMethod.PUT,
						request, String.class);
				if (response.getBody().equals("ok")) {

					responseBody.setStatus("ok");
					return responseBody;

				} else {
					responseBody.setStatus("error");
					responseBody.setMess("error.notCancelEnvelope");
					return responseBody;

				}
			} else {
				responseBody.setStatus("error");
				responseBody.setMess("error.wrongStatusCancelEnvelope");
				return responseBody;
			}

		} catch (Exception ex) {
			responseBody.setStatus("error");
			responseBody.setMess("error.notCancelEnvelope");
			return responseBody;
		}

	}

	public List<EnvelopeDTO> getListEnvelopeByRefId(HttpHeaders headersEcon, String ticketId) {
		try {
			String urlRefId = "services/envelope/api/external/v1/envelope/refId";
			Map<String, String> bodyParamsRefId = new HashMap<String, String>();
			bodyParamsRefId.put("refId", ticketId);

			HttpEntity<Object> entityRefId = new HttpEntity<>(bodyParamsRefId, headersEcon);

			ResponseEntity<List<EnvelopeDTO>> requestEcontractRefId = restTemplate.exchange(urlFPTeContract + urlRefId,
					HttpMethod.POST, entityRefId, new ParameterizedTypeReference<List<EnvelopeDTO>>() {
					});
			return requestEcontractRefId.getBody();
		} catch (Exception e) {
			throw new RuntimeException("Lấy danh sách tài liệu theo ticketId không thành công.");
		}
	}

	public class ResponseBody implements Serializable {

		/**
		 * 
		 */
		private static final long serialVersionUID = 3665359594306772862L;

		private String refId;
		private String envelopeId;
		private String status;
		private String mess;

		public ResponseBody() {
			super();
			// TODO Auto-generated constructor stub
		}

		public String getRefId() {
			return refId;
		}

		public void setRefId(String refId) {
			this.refId = refId;
		}

		public String getEnvelopeId() {
			return envelopeId;
		}

		public void setEnvelopeId(String envelopeId) {
			this.envelopeId = envelopeId;
		}

		public String getStatus() {
			return status;
		}

		public void setStatus(String status) {
			this.status = status;
		}

		public String getMess() {
			return mess;
		}

		public void setMess(String mess) {
			this.mess = mess;
		}

	}

	public static class Act implements Serializable {

		/**
		 * 
		 */
		private static final long serialVersionUID = 2195150327276521702L;

		public Act() {
			super();
			// TODO Auto-generated constructor stub
		}

		private String refId;
		private String envelopeId;
		private String reason;

		public String getRefId() {
			return refId;
		}

		public void setRefId(String refId) {
			this.refId = refId;
		}

		public String getEnvelopeId() {
			return envelopeId;
		}

		public void setEnvelopeId(String envelopeId) {
			this.envelopeId = envelopeId;
		}

		public String getReason() {
			return reason;
		}

		public void setReason(String reason) {
			this.reason = reason;
		}

	}

}
