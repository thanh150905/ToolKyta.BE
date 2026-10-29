// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/Astra_kyta_task_astra_create_account.java
// Secret đã thay bằng "<REDACTED>" (2 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
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
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.Base64Utils;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fis.excall.config.MapperClass;

@Service
public class Astra_kyta_task_astra_create_account {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	private static final String eContractUrl = "https://10.14.121.18:30600/app/";
	
	private static final String urlErequest = "https://10.14.121.10/app/";
//	private static final String urlErequest = "https://demo.econtract.fpt.com/app/";
	
	private static final String urlAuth = "http://10.14.121.18:31018/";
    // private static final String urlAuth = "https://demo.econtract.fpt.com/app/services/uaa/";
	private static final String clientId = "<REDACTED>";
	private static final String clientSecret = "<REDACTED>";
	
	protected Object createAstraAccount(Object content) throws Exception {
		String url = eContractUrl + "services/uaa/api/p/register-orders/create";
		Map<String, Object> mapContent = mapperClass.swap(Map.class, content);
		
		String ticketId = null;
		String userTaskId = null;
		if (mapContent.containsKey("ticketId") && mapContent.get("ticketId") != null) {
			ticketId = String.valueOf(mapContent.get("ticketId"));
		}
		if (mapContent.containsKey("userTaskId") && mapContent.get("userTaskId") != null) {
			userTaskId = String.valueOf(mapContent.get("userTaskId"));
		}
		
		String access_token = "Bearer " + this.getAccessToken();
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headers.set("Authorization", access_token);
		
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		
		Map<String, Object> body = new HashMap<String, Object>();
		Map<String, String> attrs = new HashMap<String, String>();
		attrs.put("email", "email");
		attrs.put("phone_number", "phoneNumber");
		
		FormData formData = this.getFormData(headers, ticketId, null);
		String formStr = formData.getFormData();
		List<FormDataField> formDataFields = null;
		if (formStr != null) {
			formDataFields = mapperClass.mapper().readValue(formStr, new TypeReference<List<FormDataField>>() {});
			if (formDataFields != null && formDataFields.size() > 0) {
				for (FormDataField formDataField : formDataFields) {
					if (attrs.get(formDataField.getCode()) != null) {
						body.put(attrs.get(formDataField.getCode()), formDataField.getValue());
					}
				}
			}
		}
		
//		body.put("email", "andkajsd@gmail.com");
//		body.put("phoneNumber", "0123123123");
		body.put("agreementDetails", null);
		body.put("passCode", null);
		body.put("subEventType", "eventType");
		body.put("caption", null);
		body.put("cusType", "o");
		body.put("langKey", "vi");
		
		User user = null;
		HttpEntity<Object> entity = new HttpEntity<>(body, headersEcon);
		try {
			ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
			Map<String, Object> responseBody = mapperClass.swap(Map.class, response.getBody());
			user = mapperClass.swap(User.class, responseBody.get("user"));
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
		
		if (formDataFields != null) {
			if (formDataFields != null && formDataFields.size() > 0) {
				for (FormDataField formDataField : formDataFields) {
					if ("custId".equals(formDataField.getCode())) {
						formDataField.setValue(user.getCustId());
					}
				}
			}
			this.updateFormData(headers, formData, formDataFields);
		}
		return user;
	}
	
	private void getSubEventType(HttpHeaders headers, String ticketId) {
		String url = "erequest/services/erequest/api/work-flows/" + ticketId;
	}
	
	private void updateFormData(HttpHeaders headers, FormData formData, List<FormDataField> formDataFields) throws Exception {
		String url = eContractUrl + "services/erequest/api/p/ticket-form-data";
		
		Map<String, String> body = new HashMap<String, String>();
		body.put("formData", mapperClass.mapper().writeValueAsString(formDataFields));
		body.put("ticketId", formData.getTicketId());
		body.put("userTaskId", formData.getUserTaskId());
		body.put("version", formData.getVersion());
		body.put("eformId", formData.getEformId());
		
		HttpEntity<Object> entity = new HttpEntity<>(body, headers);
		try {
			restTemplate.exchange(url, HttpMethod.POST, entity, FormData.class);
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}
	
	private FormData getFormData(HttpHeaders headers, String ticketId, String userTaskId) {
		String url = eContractUrl + "services/erequest/api/ticket-sub-form-data/get-sub-form-data";
		
		Map<String, String> body = new HashMap<String, String>();
		body.put("ticketId", ticketId);
		body.put("userTaskId", userTaskId);
		body.put("version", null);
		
		HttpEntity<Object> entity = new HttpEntity<>(body, headers);
		try {
			ResponseEntity<FormData> response = restTemplate.exchange(url, HttpMethod.POST, entity, FormData.class);
			return response.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}
	
	private String getAccessToken() {
		String url = urlAuth + "oauth/token";
		String authorization = clientId + ":" + clientSecret;

		HttpHeaders reqHeaders = new HttpHeaders();
		reqHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
		MultiValueMap<String, String> formParams = new LinkedMultiValueMap<>();
		formParams.set("grant_type", "client_credentials");
		reqHeaders.add("Authorization", "Basic " + Base64Utils.encodeToString(authorization.getBytes(StandardCharsets.UTF_8)));
		
		HttpEntity<MultiValueMap<String, String>> entity = new HttpEntity<>(formParams, reqHeaders);
		try {
			ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
			JsonNode rootNode = null;
			rootNode = mapperClass.mapper().readTree(response.getBody());
			return rootNode.path("access_token").asText();
		} catch (Exception e) {
			e.printStackTrace();
			throw new RuntimeException(e.getMessage());
		}
	}
	
	private static class FormData implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String id;
		private String ticketId;
		private String userTaskId;
		private String eformId;
		private String formData;
		private String version;
		private String versionUserTask;
		private String createdDate;
		private String createdBy;
		private String lastModifiedDate;
		private String lastModifiedBy;
		private String custId;
		private String orgIn;
		
		public String getId() {
			return id;
		}
		public void setId(String id) {
			this.id = id;
		}
		public String getTicketId() {
			return ticketId;
		}
		public void setTicketId(String ticketId) {
			this.ticketId = ticketId;
		}
		public String getUserTaskId() {
			return userTaskId;
		}
		public void setUserTaskId(String userTaskId) {
			this.userTaskId = userTaskId;
		}
		public String getEformId() {
			return eformId;
		}
		public void setEformId(String eformId) {
			this.eformId = eformId;
		}
		public String getFormData() {
			return formData;
		}
		public void setFormData(String formData) {
			this.formData = formData;
		}
		public String getVersion() {
			return version;
		}
		public void setVersion(String version) {
			this.version = version;
		}
		public String getVersionUserTask() {
			return versionUserTask;
		}
		public void setVersionUserTask(String versionUserTask) {
			this.versionUserTask = versionUserTask;
		}
		public String getCreatedDate() {
			return createdDate;
		}
		public void setCreatedDate(String createdDate) {
			this.createdDate = createdDate;
		}
		public String getCreatedBy() {
			return createdBy;
		}
		public void setCreatedBy(String createdBy) {
			this.createdBy = createdBy;
		}
		public String getLastModifiedDate() {
			return lastModifiedDate;
		}
		public void setLastModifiedDate(String lastModifiedDate) {
			this.lastModifiedDate = lastModifiedDate;
		}
		public String getLastModifiedBy() {
			return lastModifiedBy;
		}
		public void setLastModifiedBy(String lastModifiedBy) {
			this.lastModifiedBy = lastModifiedBy;
		}
		public String getCustId() {
			return custId;
		}
		public void setCustId(String custId) {
			this.custId = custId;
		}
		public String getOrgIn() {
			return orgIn;
		}
		public void setOrgIn(String orgIn) {
			this.orgIn = orgIn;
		}
	}
	
	private static class FormDataField implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String label;
		private String type;
		private String value;
		private String formId;
		private String hashid;
		private String code;
		private Map<String, Object> validate;
		private String dataType;
		
		public String getLabel() {
			return label;
		}
		public void setLabel(String label) {
			this.label = label;
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
		public String getFormId() {
			return formId;
		}
		public void setFormId(String formId) {
			this.formId = formId;
		}
		public String getHashid() {
			return hashid;
		}
		public void setHashid(String hashid) {
			this.hashid = hashid;
		}
		public String getCode() {
			return code;
		}
		public void setCode(String code) {
			this.code = code;
		}
		public Map<String, Object> getValidate() {
			return validate;
		}
		public void setValidate(Map<String, Object> validate) {
			this.validate = validate;
		}
		public String getDataType() {
			return dataType;
		}
		public void setDataType(String dataType) {
			this.dataType = dataType;
		}
	}
	
	private static class User implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String id;
		private String login;
		private String email;
		private String langKey;
		private String phone;
		private String custId;
		private String orgIn;
		
		public String getId() {
			return id;
		}
		public void setId(String id) {
			this.id = id;
		}
		public String getLogin() {
			return login;
		}
		public void setLogin(String login) {
			this.login = login;
		}
		public String getEmail() {
			return email;
		}
		public void setEmail(String email) {
			this.email = email;
		}
		public String getLangKey() {
			return langKey;
		}
		public void setLangKey(String langKey) {
			this.langKey = langKey;
		}
		public String getPhone() {
			return phone;
		}
		public void setPhone(String phone) {
			this.phone = phone;
		}
		public String getCustId() {
			return custId;
		}
		public void setCustId(String custId) {
			this.custId = custId;
		}
		public String getOrgIn() {
			return orgIn;
		}
		public void setOrgIn(String orgIn) {
			this.orgIn = orgIn;
		}
	}
	
}
