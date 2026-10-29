// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/ERequest_flow_finish_kyta_econtract_temp_n_determine.java
// Secret đã thay bằng "<REDACTED>" (1 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
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
import org.springframework.security.oauth2.common.OAuth2AccessToken;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;
import com.fis.excall.service.envelope.dto.EnvelopeErqDTO;

@Service
public class ERequest_flow_finish_kyta_econtract_temp_n_determine {
	@Autowired
	private EnvelopeClient envelopeClients;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;

	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;
	
//	private static final String urlFPTeContract = "https://10.14.121.18:30600/app";
	private static final String urlFPTeContract = "https://demo.econtract.fpt.com/app";
	
//	private static final String urlErequest = "https://10.14.121.10/app";
	private static final String urlErequest = "https://demo.econtract.fpt.com/app";
	
//	private static final String urlAuth = "http://10.14.121.18:31018/";
     private static final String urlAuth = "https://demo.econtract.fpt.com/app/services/uaa/";
	
	public String UpdateStatus(String envelopeId, String status) throws Exception {
		try {
//			EnvelopeDTO envelope = envelopeClients.getEnvelopeById(envelopeId);
//			OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken("nepnhi27@gmail.com");
//			EnvelopeErqDTO erq = envelope.getErq();
				
			String ticketId = "00001gbIKomSgp1nx61A";
			String userTaskId = "sid-3E5355CA-3D61-46B0-A02C-756408ACB77B";
			String recipientDetailsId = "00001WBI9xyfaeGJ3pqpsoy";
			String reason = "";
			String risk = "";
			
			String access_token = "<REDACTED>";
			HttpHeaders headers = new HttpHeaders();
			headers.setContentType(MediaType.APPLICATION_JSON);
			headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
			headers.set("Authorization", access_token);
			
			FormData formData = this.getFormData(headers, ticketId, userTaskId);
			String formStr = null;
			List<FormDataField> formDataFields = null;
			if (formData != null) {
				formStr = formData.getFormData();
				if (formStr != null) {
					formDataFields = mapperClass.mapper().readValue(formStr, new TypeReference<List<FormDataField>>() {});
				}
			}
			if ("completed".equals(status)) {
				if (formDataFields != null) {
					this.updateFormData(headers, formData, formDataFields, null, status);
				}

				String url = urlErequest + "/services/erequest/api/tickets/recipient/finish/" + ticketId + "/" + userTaskId + "/" + recipientDetailsId;
				UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(url);
//				builder.buildAndExpand(map);
				
				Map<String, String> body = new HashMap<String, String>();
				body.put("reason", reason);
				body.put("risk", risk);
				
				HttpEntity<Object> entity = new HttpEntity<>(body, headers);
				try {
					ResponseEntity<String> response = restTemplate.exchange(builder.toUriString(), HttpMethod.PUT, entity, String.class);
					return response.getBody();
				} catch (HttpStatusCodeException ex) {
					throw new RuntimeException(ex.getResponseBodyAsString());
				}
			} else {
				if (formDataFields != null) {
					this.updateFormData(headers, formData, formDataFields, null, status);
					String url = urlErequest + "/services/erequest/api/tickets/recipient/finish/" + ticketId + "/" + userTaskId + "/" + recipientDetailsId;
					UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(url);
					
					Map<String, String> body = new HashMap<String, String>();
					body.put("reason", reason);
					body.put("risk", risk);
					
					HttpEntity<Object> entity = new HttpEntity<>(body, headers);
					try {
						ResponseEntity<String> response = restTemplate.exchange(builder.toUriString(), HttpMethod.PUT, entity, String.class);
						return response.getBody();
					} catch (HttpStatusCodeException ex) {
						throw new RuntimeException(ex.getResponseBodyAsString());
					}
				} else {
					String url = urlErequest + "/services/erequest/api/tickets/recipient/reject/" + ticketId + "/" + userTaskId + "/" + recipientDetailsId;
					UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(url);
					
					Map<String, String> body = new HashMap<String, String>();
					body.put("reason", reason);
					body.put("risk", risk);
					
					HttpEntity<Object> entity = new HttpEntity<>(body, headers);
					try {
						ResponseEntity<String> response = restTemplate.exchange(builder.toUriString(), HttpMethod.PUT, entity, String.class);
						return response.getBody();
					} catch (HttpStatusCodeException ex) {
						throw new RuntimeException(ex.getResponseBodyAsString());
					}
				}
			}
		} catch (Exception e) {
			throw new RuntimeException(e.getMessage());
		}
	}
	
	private void updateFormData(HttpHeaders headers, FormData formData, List<FormDataField> formDataFields, EnvelopeDTO envelope, String status) throws Exception {
		String url = urlFPTeContract + "/services/erequest/api/p/ticket-sub-form-data";
		
		if (formDataFields != null && formDataFields.size() > 0) {
			for (FormDataField formDataField : formDataFields) {
				String code = formDataField.getCode();
				if ("name".equals(code)) {
					formDataField.setValue(envelope.getName());
				} else if ("envelopID".equals(code)) {
					formDataField.setValue(envelope.getId());
				} else if ("status".equals(code)) {
					if ("completed".equals(status) || "overdue".equals(status) || "voided".equals(status)) {
						formDataField.setValue(status);
					} else {
						formDataField.setValue("rejected");
					}
				} else if ("retryEcontract".equals(code)) {
					if ("completed".equals(status)) {
						formDataField.setValue("no");
					} else if ("overdue".equals(status) || "voided".equals(status)) {
						formDataField.setValue("yes");
					}
				}
			}
		}
		
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
		String url = urlFPTeContract + "/services/erequest/api/ticket-sub-form-data/get-sub-form-data";
		
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
		private Object value;
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
		public Object getValue() {
			return value;
		}
		public void setValue(Object value) {
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
}
