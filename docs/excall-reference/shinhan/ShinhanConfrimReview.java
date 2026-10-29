// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/ShinhanConfrimReview.java
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
import com.fis.excall.service.envelope.dto.EnvelopeHdrDTO;
import com.fis.excall.service.envelope.dto.FieldDTO;
import com.fis.excall.service.envelope.dto.FinishPayload;
import com.fis.excall.service.envelope.dto.HdrFieldDTO;
import com.fis.excall.service.envelope.dto.RecipientDTO;

@Service
public class ShinhanConfrimReview {

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
	
	//private static final String urlFPTeContract = "https://demo.econtract.fpt.com.vn/app/";


	public Object finish(Object payload) throws Exception {

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

				for (Act act : actList) {
					ResponseBody responseBody = this.processAct(act,headersEcon);
					responseBodys.add(responseBody);
				}
			}
		} catch (Exception e) {
			// TODO: handle exception
		}
		bodyR.put("detail", responseBodys);
		return bodyR;

		/// return mapperClass.mapper().writeValueAsString(bodyR);
	}

	public ResponseBody processAct(Act act, HttpHeaders headersEcon) {
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
				}else {
					EnvelopeDTO envelopeDTO = lstEnv.get(0);
					act.setEnvelopeId( envelopeDTO.getId());
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

		EnvelopeHdrDTO envelopeHdr = envelope.getHeader();
		this.updateValue(envelopeHdr, act.getHeaderField());
		envelope = envelopeClients.updateEnvelopeHdr(act.getEnvelopeId(), envelopeHdr);

		String recipientId = act.getRecipientId();
		
		RecipientDTO recipient = EnvelopeDTO.recipientById(envelope, recipientId);
		
		if (recipient == null) {
			responseBody.setStatus("error");
			responseBody.setMess("error.isNotExistsRecipientInfo");
			return responseBody;
		}

		if (!"reviewer".equals(recipient.getRole())) {
			responseBody.setStatus("error");
			responseBody.setMess("error.wrongRoleRecipientInfo");
			return responseBody;
		}

		this.updateValueRecipient(recipient, act.getFields());

		FinishPayload finishPayload = new FinishPayload();
		finishPayload.setAuth(EnvelopeDTO.recipientToAuth(envelope, recipient));
		finishPayload.setRecipient(recipient);

		Object responeFinish = null;
		try {
			responeFinish = envelopeClients.finishInternal(act.getEnvelopeId(), recipientId, envelope.getVersion(),
					act.getDecision(), "Sign-IMG", null, finishPayload);

		} catch (Exception e) {
			e.printStackTrace();
			responseBody.setStatus("error");
			responseBody.setMess("error.notFinishTask");
			return responseBody;
		}

		EnvelopeDTO envelopeResp = null;
		try {
			envelopeResp = this.mapperClass.swap(EnvelopeDTO.class, responeFinish);
		} catch (Exception e) {
			responseBody.setStatus("error");
			responseBody.setMess("error.notFinishTask");
			return responseBody;
		}
		if (envelopeResp != null && StringUtils.isNotBlank(envelopeResp.getId())) {
			responseBody.setStatus("ok");
			return responseBody;
		} else {
			responseBody.setStatus("error");
			responseBody.setMess("error.notFinishTask");
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

	public void updateValueRecipient(RecipientDTO recipient, List<RecipientField> fields) {
		Map<String, String> mapFields = new HashMap<String, String>();
		if (fields != null && fields.size() > 0) {
			for (RecipientField field : fields) {
				mapFields.put(field.getName(), field.getValue());
			}
		}
		List<FieldDTO> rcpFields = recipient.getFields();
		if (rcpFields != null && rcpFields.size() > 0) {
			for (FieldDTO rcpField : rcpFields) {
				if (mapFields.containsKey(rcpField.getName())) {
					if (FieldDTO.Type.TEXT.toString().equals(rcpField.getType())) {
						rcpField.setValue(mapFields.get(rcpField.getName()));
					}
				}
			}
		}

	}

	public void updateValue(EnvelopeHdrDTO envelopeHdr, List<EnvelopeHeaderField> hdrFields) {
		Map<String, String> mapHdr = new HashMap<String, String>();
		if (hdrFields != null && hdrFields.size() > 0) {
			for (EnvelopeHeaderField hdrField : hdrFields) {
				mapHdr.put(hdrField.getId(), hdrField.getValue());
			}
		}
		List<HdrFieldDTO> fields = envelopeHdr.getFields();
		if (fields != null && fields.size() > 0) {
			for (HdrFieldDTO field : fields) {
				if (mapHdr.containsKey(field.getId())) {
					field.setValue(mapHdr.get(field.getId()));
				}
			}
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
		private String recipientId;
		private String decision;

		public String getRefId() {
			return refId;
		}

		public void setRefId(String refId) {
			this.refId = refId;
		}

		private List<RecipientField> fields;

		private List<EnvelopeHeaderField> headerField;

		public String getEnvelopeId() {
			return envelopeId;
		}

		public void setEnvelopeId(String envelopeId) {
			this.envelopeId = envelopeId;
		}

		public String getRecipientId() {
			return recipientId;
		}

		public void setRecipientId(String recipientId) {
			this.recipientId = recipientId;
		}

		public String getDecision() {
			return decision;
		}

		public void setDecision(String decision) {
			this.decision = decision;
		}

		public List<RecipientField> getFields() {
			return fields;
		}

		public void setFields(List<RecipientField> fields) {
			this.fields = fields;
		}

		public List<EnvelopeHeaderField> getHeaderField() {
			return headerField;
		}

		public void setHeaderField(List<EnvelopeHeaderField> headerField) {
			this.headerField = headerField;
		}

	}

	public static class EnvelopeHeaderField implements Serializable {

		/**
		 * 
		 */
		private static final long serialVersionUID = -2289366345675071862L;

		public EnvelopeHeaderField() {
			super();
			// TODO Auto-generated constructor stub
		}

		private String id;
		private String name;
		private String type;
		private String value;

		public String getId() {
			return id;
		}

		public void setId(String id) {
			this.id = id;
		}

		public String getName() {
			return name;
		}

		public void setName(String name) {
			this.name = name;
		}

		public String getType() {
			return type;
		}

		public void setType(String type) {
			this.type = type;
		}

		public String getValue() {
			return value;
		}

		public void setValue(String value) {
			this.value = value;
		}

	}

	public static class RecipientField implements Serializable {

		/**
		 * 
		 */
		private static final long serialVersionUID = -8174496651498476274L;

		public RecipientField() {
			super();
			// TODO Auto-generated constructor stub
		}

		private String id;
		private String name;
		private String value;

		public String getId() {
			return id;
		}

		public void setId(String id) {
			this.id = id;
		}

		public String getName() {
			return name;
		}

		public void setName(String name) {
			this.name = name;
		}

		public String getValue() {
			return value;
		}

		public void setValue(String value) {
			this.value = value;
		}

	}

}
