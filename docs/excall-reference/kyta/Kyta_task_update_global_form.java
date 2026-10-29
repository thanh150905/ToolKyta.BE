// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/Kyta_task_update_global_form.java
// Secret đã thay bằng "<REDACTED>" (2 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
import java.nio.charset.StandardCharsets;
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
import org.springframework.util.Base64Utils;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;

@Service
public class Kyta_task_update_global_form {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;
	
	@Autowired
	private UaaClient uaaClient;

	private static final String eContractUrl = "https://10.14.121.18:30600/app/";
	
	private static final String urlErequest = "http://10.14.121.10/";
//	private static final String urlErequest = "https://demo.econtract.fpt.com/app/";
	
	private static final String urlAuth = "http://10.14.121.18:31018/";
    // private static final String urlAuth = "https://demo.econtract.fpt.com/app/services/uaa/";
	private static final String clientId = "<REDACTED>";
	private static final String clientSecret = "<REDACTED>";
	
	private static final String fixedId = "sid-B0E9F1AD-8B3E-4276-BB63-B5F769200380";
	
	protected Object updateGlobalForm(Object content) throws Exception {
		Map<String, Object> mapContent = mapperClass.swap(Map.class, content);
		String ticketId = null;
		String userTaskId = null;
		String eventType = null;
		if (mapContent.containsKey("ticketId") && mapContent.get("ticketId") != null) {
			ticketId = String.valueOf(mapContent.get("ticketId"));
		}
		if (mapContent.containsKey("userTaskId") && mapContent.get("userTaskId") != null) {
			userTaskId = String.valueOf(mapContent.get("userTaskId"));
		}
		
		if (ticketId == null || userTaskId == null) {
			throw new RuntimeException("TicketId or UserTaskId is underfind");
		}
		
		String access_token = "Bearer " + this.getAccessToken();
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headers.set("Authorization", access_token);
		
		Map<String, Object> ticket = this.getTicket(headers, ticketId);
//		PartyDTO partyDTO = null;
//		RecipientDTO recipientDTO = null;
		
		if (ticket.containsKey("createdBy")) {
			OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(String.valueOf(ticket.get("createdBy")));
			headers.set("Authorization", "Bearer " + accessToken.getValue());
		}
		
//		FormData formGlobalData = this.getFormData(headers, ticketId, null);
		String moderlerId = this.getModerlerId(headers, ticketId);
		String userTaskIdAfter = this.getAfterTask(headers, moderlerId, userTaskId);
		FormData formInputData = this.getFormData(headers, ticketId, userTaskIdAfter);
		String formInputStr = formInputData.getFormData();
//		List<FormDataField> formDataFields = null;
//		if (formInputStr != null) {
//			formDataFields = mapperClass.mapper().readValue(formInputStr, new TypeReference<List<FormDataField>>() {});
//			if (formDataFields != null) {
//				if (formDataFields != null && formDataFields.size() > 0) {
//					String pers = "PERS.1Y";
//					for (FormDataField formDataField : formDataFields) {
//						String value = formDataField.getValue();
//						if ("year".equals(formDataField.getCode())) {
//							if (!StringUtils.isEmpty(value)) {
//								if ("3 năm".equals(value)) {
//									pers = "PERS.3Y";
//								}
//							}
//						}
//					}
//				}
//				this.updateFormData(headers, formInputData, formDataFields);
//			}
//		}
		
		this.updateFormData(headers, formInputData);
		
//		this.send(headers, eventType, dto.getEmail(), dto.getAgreementUUID(), dto.getPassword());
		return "ok";
	}
	
	private String getModerlerId(HttpHeaders headers, String ticketId) {
		try {
			String url = eContractUrl + "services/erequest/api/tickets/modeler/" + ticketId;
			
			HttpEntity<Object> entity = new HttpEntity<>(headers);
			try {
				ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
				return response.getBody();
			} catch (HttpStatusCodeException e) {
				throw new RuntimeException(e.getResponseBodyAsString());
			}
		} catch (Exception e) {
			throw new RuntimeException("Get moderler id - " + ticketId + " : " + e.getMessage());
		}
	}
	
	private String getAfterTask(HttpHeaders headers, String ticketId, String userTaskId) {
		try {
			String url = eContractUrl + "services/idaas-eflow/api/task-services/service-task/modeler?serviceTaskId=";
			url = url + userTaskId + "&modelerId=" + ticketId;
			
			HttpEntity<Object> entity = new HttpEntity<>(headers);
			try {
				ResponseEntity<AfterTaskResponse> response = restTemplate.exchange(url, HttpMethod.GET, entity, AfterTaskResponse.class);
				if ("200".equals(response.getBody().getStatus())) {
					AfterTaskData data = new AfterTaskData();
					if (data != null) {
						return data.getUserTaskIds();
					} else {
						return fixedId;
					}
				} else {
					return fixedId;
				}
			} catch (HttpStatusCodeException e) {
				throw new RuntimeException(e.getResponseBodyAsString());
			}
		} catch (Exception e) {
			throw new RuntimeException("Get after task - " + userTaskId + " : " + e.getMessage());
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
//			e.printStackTrace();
			throw new RuntimeException(e.getMessage());
		}
	}
	
	private void updateFormData(HttpHeaders headers, FormData formData) throws Exception {
		try {
			String url = eContractUrl + "services/erequest/api/p/update-ticket-form-data";
			
			Map<String, String> body = new HashMap<String, String>();
			body.put("formData", formData.getFormData());
			body.put("ticketId", formData.getTicketId());
//			body.put("userTaskId", formGlobalData.getUserTaskId());
//			body.put("version", formGlobalData.getVersion());
//			body.put("eformId", formGlobalData.getEformId());
			
			HttpEntity<Object> entity = new HttpEntity<>(body, headers);
			try {
				restTemplate.exchange(url, HttpMethod.POST, entity, FormData.class);
			} catch (HttpStatusCodeException e) {
				throw new RuntimeException(e.getResponseBodyAsString());
			}
		} catch (Exception e) {
			throw new RuntimeException("Update global form error - " + formData.getTicketId() + " : " + e.getMessage());
		}
	}
	
	private FormData getFormData(HttpHeaders headers, String ticketId, String userTaskId) {
		try {
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
		} catch (Exception e) {
			throw new RuntimeException("Get form error - " + userTaskId + " : " + e.getMessage());
		}
	}
	
	private Map<String, Object> getTicket(HttpHeaders headers, String ticketId) throws Exception {
		try {
			String url = eContractUrl + "services/erequest/api/ticket-recipients/findByTicketIdInternal/" + ticketId;
			
			HttpEntity<Object> entity = new HttpEntity<>(headers);
			try {
				ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
				return mapperClass.swap(Map.class, response.getBody());
				
			} catch (HttpStatusCodeException e) {
				throw new RuntimeException(e.getResponseBodyAsString());
			}
		} catch (Exception e) {
			throw new RuntimeException("Get ticket info error: " + e.getMessage());
		}
	}
	
	private static class AfterTaskResponse implements Serializable {
		private static final long serialVersionUID = 1L;

		private String status;
		private String message;
		private AfterTaskData data;
		public String getStatus() {
			return status;
		}
		public void setStatus(String status) {
			this.status = status;
		}
		public String getMessage() {
			return message;
		}
		public void setMessage(String message) {
			this.message = message;
		}
		public AfterTaskData getData() {
			return data;
		}
		public void setData(AfterTaskData data) {
			this.data = data;
		}
	}

	private static class AfterTaskData implements Serializable {
		private static final long serialVersionUID = 1L;

		private String id;
		private String service;
		private String selector;
		private String status;
		private String serviceTaskId;
		private String modelerId;
		private String orgIn;
		private String custId;
		private String userTaskIds;
		public String getId() {
			return id;
		}
		public void setId(String id) {
			this.id = id;
		}
		public String getService() {
			return service;
		}
		public void setService(String service) {
			this.service = service;
		}
		public String getSelector() {
			return selector;
		}
		public void setSelector(String selector) {
			this.selector = selector;
		}
		public String getStatus() {
			return status;
		}
		public void setStatus(String status) {
			this.status = status;
		}
		public String getServiceTaskId() {
			return serviceTaskId;
		}
		public void setServiceTaskId(String serviceTaskId) {
			this.serviceTaskId = serviceTaskId;
		}
		public String getModelerId() {
			return modelerId;
		}
		public void setModelerId(String modelerId) {
			this.modelerId = modelerId;
		}
		public String getOrgIn() {
			return orgIn;
		}
		public void setOrgIn(String orgIn) {
			this.orgIn = orgIn;
		}
		public String getCustId() {
			return custId;
		}
		public void setCustId(String custId) {
			this.custId = custId;
		}
		public String getUserTaskIds() {
			return userTaskIds;
		}
		public void setUserTaskIds(String userTaskIds) {
			this.userTaskIds = userTaskIds;
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
	
	private static class PartyDTO implements Serializable {
		private static final long serialVersionUID = 1L;
		private String id;
		private String index;
		private String order;
		private String type;
		private String flowType;
		private List<RecipientDTO> recipients;
		
		public String getId() {
			return id;
		}
		public void setId(String id) {
			this.id = id;
		}
		public String getIndex() {
			return index;
		}
		public void setIndex(String index) {
			this.index = index;
		}
		public String getOrder() {
			return order;
		}
		public void setOrder(String order) {
			this.order = order;
		}
		public String getType() {
			return type;
		}
		public void setType(String type) {
			this.type = type;
		}
		public String getFlowType() {
			return flowType;
		}
		public void setFlowType(String flowType) {
			this.flowType = flowType;
		}
		public List<RecipientDTO> getRecipients() {
			return recipients;
		}
		public void setRecipients(List<RecipientDTO> recipients) {
			this.recipients = recipients;
		}
	}
	
	private static class RecipientDTO implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String id;
		private String notionName;
		private String role;
		private String status;
		private String version;
		private String implementerId;
		private String signDate;
		private String overrideid;
		
		public String getId() {
			return id;
		}
		public void setId(String id) {
			this.id = id;
		}
		public String getNotionName() {
			return notionName;
		}
		public void setNotionName(String notionName) {
			this.notionName = notionName;
		}
		public String getRole() {
			return role;
		}
		public void setRole(String role) {
			this.role = role;
		}
		public String getStatus() {
			return status;
		}
		public void setStatus(String status) {
			this.status = status;
		}
		public String getVersion() {
			return version;
		}
		public void setVersion(String version) {
			this.version = version;
		}
		public String getImplementerId() {
			return implementerId;
		}
		public void setImplementerId(String implementerId) {
			this.implementerId = implementerId;
		}
		public String getSignDate() {
			return signDate;
		}
		public void setSignDate(String signDate) {
			this.signDate = signDate;
		}
		public String getOverrideid() {
			return overrideid;
		}
		public void setOverrideid(String overrideid) {
			this.overrideid = overrideid;
		}
	}
	
	private static class EkycResponse implements Serializable {
		private static final long serialVersionUID = 1L;

		private EkycRepository ekycRepository;
		private PersonalIdCardImage front;
		private PersonalIdCardImage back;
		private String frontIdCardUrl;
		private String backIdCardUrl;
		private String idCardPdfUrl;
		private String positionPdfUrl;
		private String fptCaFormUrl;

		public EkycRepository getEkycRepository() {
			return ekycRepository;
		}

		public void setEkycRepository(EkycRepository ekycRepository) {
			this.ekycRepository = ekycRepository;
		}

		public PersonalIdCardImage getFront() {
			return front;
		}

		public void setFront(PersonalIdCardImage front) {
			this.front = front;
		}

		public PersonalIdCardImage getBack() {
			return back;
		}

		public void setBack(PersonalIdCardImage back) {
			this.back = back;
		}

		public String getFrontIdCardUrl() {
			return frontIdCardUrl;
		}

		public void setFrontIdCardUrl(String frontIdCardUrl) {
			this.frontIdCardUrl = frontIdCardUrl;
		}

		public String getBackIdCardUrl() {
			return backIdCardUrl;
		}

		public void setBackIdCardUrl(String backIdCardUrl) {
			this.backIdCardUrl = backIdCardUrl;
		}

		public String getIdCardPdfUrl() {
			return idCardPdfUrl;
		}

		public void setIdCardPdfUrl(String idCardPdfUrl) {
			this.idCardPdfUrl = idCardPdfUrl;
		}

		public String getPositionPdfUrl() {
			return positionPdfUrl;
		}

		public void setPositionPdfUrl(String positionPdfUrl) {
			this.positionPdfUrl = positionPdfUrl;
		}

		public String getFptCaFormUrl() {
			return fptCaFormUrl;
		}

		public void setFptCaFormUrl(String fptCaFormUrl) {
			this.fptCaFormUrl = fptCaFormUrl;
		}
	}
	
	private static class PersonalIdCardImage implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String id;
		private String ekycRepositoryId;
		private String name;
		private String type;
		private String format;
		private String order;
		private String content;
		private String contentContentType;
		
		public String getId() {
			return id;
		}
		public void setId(String id) {
			this.id = id;
		}
		public String getEkycRepositoryId() {
			return ekycRepositoryId;
		}
		public void setEkycRepositoryId(String ekycRepositoryId) {
			this.ekycRepositoryId = ekycRepositoryId;
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
		public String getFormat() {
			return format;
		}
		public void setFormat(String format) {
			this.format = format;
		}
		public String getOrder() {
			return order;
		}
		public void setOrder(String order) {
			this.order = order;
		}
		public String getContent() {
			return content;
		}
		public void setContent(String content) {
			this.content = content;
		}
		public String getContentContentType() {
			return contentContentType;
		}
		public void setContentContentType(String contentContentType) {
			this.contentContentType = contentContentType;
		}
	}

	private static class EkycRepository implements Serializable {
		private static final long serialVersionUID = 1L;

		private String id;
		private String resourceId;
		private String personalId;
		private String resourceType;
		private String resourceName;
		private String username;
		private String billCode;
		private Map<String, Object> ekycContent;
		private EkycRepositoryAttrs attrs;
		private List<String> originalId;
		private String custId;

		public String getCustId() {
			return custId;
		}

		public void setCustId(String custId) {
			this.custId = custId;
		}

		public String getId() {
			return id;
		}

		public void setId(String id) {
			this.id = id;
		}

		public String getResourceId() {
			return resourceId;
		}

		public void setResourceId(String resourceId) {
			this.resourceId = resourceId;
		}

		public String getPersonalId() {
			return personalId;
		}

		public void setPersonalId(String personalId) {
			this.personalId = personalId;
		}

		public String getResourceType() {
			return resourceType;
		}

		public void setResourceType(String resourceType) {
			this.resourceType = resourceType;
		}

		public String getResourceName() {
			return resourceName;
		}

		public void setResourceName(String resourceName) {
			this.resourceName = resourceName;
		}

		public String getUsername() {
			return username;
		}

		public void setUsername(String username) {
			this.username = username;
		}

		public String getBillCode() {
			return billCode;
		}

		public void setBillCode(String billCode) {
			this.billCode = billCode;
		}

		public Map<String, Object> getEkycContent() {
			return ekycContent;
		}

		public void setEkycContent(Map<String, Object> ekycContent) {
			this.ekycContent = ekycContent;
		}

		public EkycRepositoryAttrs getAttrs() {
			return attrs;
		}

		public void setAttrs(EkycRepositoryAttrs attrs) {
			this.attrs = attrs;
		}

		public List<String> getOriginalId() {
			return originalId;
		}

		public void setOriginalId(List<String> originalId) {
			this.originalId = originalId;
		}
	}

	private static class EkycRepositoryAttrs implements Serializable {
		private static final long serialVersionUID = 1L;

		private String provideAddress;
		private String country;
		private String personalID;
		private String address;
		private String telephoneNumber;
		private String commune;
		private String faceSimilar;
		private String personalDocumentType;
		private List<String> signTypes;
		private String messageType;
		private String provideDate;
		private String stateOrProvince;
		private String dob;
		private String location;
		private String personalName;
		private String refId;
		private String email;

		public String getProvideAddress() {
			return provideAddress;
		}

		public void setProvideAddress(String provideAddress) {
			this.provideAddress = provideAddress;
		}

		public String getCountry() {
			return country;
		}

		public void setCountry(String country) {
			this.country = country;
		}

		public String getPersonalID() {
			return personalID;
		}

		public void setPersonalID(String personalID) {
			this.personalID = personalID;
		}

		public String getAddress() {
			return address;
		}

		public void setAddress(String address) {
			this.address = address;
		}

		public String getTelephoneNumber() {
			return telephoneNumber;
		}

		public void setTelephoneNumber(String telephoneNumber) {
			this.telephoneNumber = telephoneNumber;
		}

		public String getCommune() {
			return commune;
		}

		public void setCommune(String commune) {
			this.commune = commune;
		}

		public String getFaceSimilar() {
			return faceSimilar;
		}

		public void setFaceSimilar(String faceSimilar) {
			this.faceSimilar = faceSimilar;
		}

		public String getPersonalDocumentType() {
			return personalDocumentType;
		}

		public void setPersonalDocumentType(String personalDocumentType) {
			this.personalDocumentType = personalDocumentType;
		}

		public List<String> getSignTypes() {
			return signTypes;
		}

		public void setSignTypes(List<String> signTypes) {
			this.signTypes = signTypes;
		}

		public String getMessageType() {
			return messageType;
		}

		public void setMessageType(String messageType) {
			this.messageType = messageType;
		}

		public String getProvideDate() {
			return provideDate;
		}

		public void setProvideDate(String provideDate) {
			this.provideDate = provideDate;
		}

		public String getStateOrProvince() {
			return stateOrProvince;
		}

		public void setStateOrProvince(String stateOrProvince) {
			this.stateOrProvince = stateOrProvince;
		}

		public String getDob() {
			return dob;
		}

		public void setDob(String dob) {
			this.dob = dob;
		}

		public String getLocation() {
			return location;
		}

		public void setLocation(String location) {
			this.location = location;
		}

		public String getPersonalName() {
			return personalName;
		}

		public void setPersonalName(String personalName) {
			this.personalName = personalName;
		}

		public String getRefId() {
			return refId;
		}

		public void setRefId(String refId) {
			this.refId = refId;
		}

		public String getEmail() {
			return email;
		}

		public void setEmail(String email) {
			this.email = email;
		}
	}
}
