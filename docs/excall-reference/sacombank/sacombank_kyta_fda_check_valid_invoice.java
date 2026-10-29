// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/sacombank_kyta_fda_check_valid_invoice.java
// Secret đã thay bằng "<REDACTED>" (5 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.persistence.Lob;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.ByteArrayResource;
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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

@Service
public class sacombank_kyta_fda_check_valid_invoice {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;

	@Autowired
	private EnvelopeClient envelopeClients;

//	@Autowired
	private S3Client s3Client;

	private static final String eContractUrl = "https://10.14.121.18:30600/app/";

	private static final String urlAuth = "http://10.14.121.18:31018/";
	// private static final String urlAuth =
	// "https://demo.econtract.fpt.com/app/services/uaa/";
	private static final String clientId = "<REDACTED>";
	private static final String clientSecret = "<REDACTED>";

	private static final String bucket = "demo-2025-kyta-erequest-filerepository";
	private static final String accessKeyId = "<REDACTED>";
	private static final String secretAccessKey = "<REDACTED>";
	private static final String endpointOverride = "https://s3-hfx03.fptcloud.com:443";
	private static final String regionString = "fpt";

	public Object createLot(Object content) throws Exception {
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
		
		Map<String, Object> responseBody = null;
		String owner = null;
		try {
			responseBody = this.getTicket(headers, ticketId);
			if (responseBody.containsKey("createdBy")) {
				owner = String.valueOf(responseBody.get("createdBy"));
			}
		} catch (Exception e) {
			throw new RuntimeException("Get ticket " + ticketId + " error: " + e.getMessage());
		}
		
		OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(owner);

		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", "Bearer " + accessToken.getValue());
		
		String moderlerId = this.getModerlerId(headers, ticketId);
		String userTaskIdAfter = this.getAfterTask(headers, moderlerId, userTaskId);

		Map<String, Object> body = new HashMap<String, Object>();
		FormData formData = this.getFormData(headers, ticketId, userTaskIdAfter);
		String formStr = formData.getFormData();

		List<FormDataField> formDataFields = null;
		List<EformFileValue> eformFileValues = null;
		if (formStr != null) {
			formDataFields = mapperClass.mapper().readValue(formStr, new TypeReference<List<FormDataField>>() {
			});
			if (formDataFields != null && formDataFields.size() > 0) {
				for (FormDataField formDataField : formDataFields) {
					if ("input_FDA".equals(formDataField.getCode())) {
						eformFileValues = mapperClass.mapper().readValue(mapperClass.mapper().writeValueAsString(formDataField.getValue()),new TypeReference<List<EformFileValue>>() {});
					}
				}
			}
		}

		String _eformFileData = null;
		EformFileData eformFileData = null;
		if (eformFileValues != null && eformFileValues.size() > 0) {
			for (EformFileValue eformFileValue : eformFileValues) {
				if (eformFileValue.getData() != null) {
					_eformFileData = String.valueOf(eformFileValue.getData());
				}
				if (_eformFileData != null) {
					eformFileData = mapperClass.mapper().readValue(_eformFileData, EformFileData.class);
				}
				eformFileValue.setFileByte(this.getFileFromS3(eformFileData.getKeyName(), eformFileData.getBucketName()));
			}
		}
		
		EformFileValue eformFileValue = eformFileValues.get(0);
		
		HttpHeaders headersFda = new HttpHeaders();
		headersFda.setContentType(MediaType.MULTIPART_FORM_DATA);
		headersFda.set("apikey", "<REDACTED>");
		
		final ByteArrayResource xmlFile = new ByteArrayResource(eformFileValue.getFileByte()) {
			@Override
			public String getFilename() {
				return eformFileValue.getName();
			}
		};
		HttpEntity<ByteArrayResource> xmlFileEntity = new HttpEntity<>(xmlFile, headersFda);

		LinkedMultiValueMap<String, Object> requestMap = new LinkedMultiValueMap<>();
		requestMap.add("File", xmlFileEntity);
		
		InvoiceInfo invoiceInfo = null;
		HttpEntity<LinkedMultiValueMap<String, Object>> requestUpload = new HttpEntity<>(requestMap, headersFda);
		String fdaUrl = "https://api-uat.fda.xplat.online/api/v1/kyta/invoice-verify-info";
		try {
			ResponseEntity<InvoiceInfo> response = restTemplate.exchange(fdaUrl, HttpMethod.POST, requestUpload, InvoiceInfo.class);
			invoiceInfo = response.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
		
		this.updateFormData(headers, formData, formDataFields, invoiceInfo.getInvoice_status());
		
		return mapperClass.mapper().writeValueAsString(invoiceInfo);
	}
	
	private void updateFormData(HttpHeaders headers, FormData formData, List<FormDataField> formDataFields, InvoiceStatus invoiceStatus) throws Exception {
		String url = eContractUrl + "services/erequest/api/p/ticket-sub-form-data";
		
		if (formDataFields != null && formDataFields.size() > 0) {
			for (FormDataField formDataField : formDataFields) {
				String code = formDataField.getCode();
				if ("invoice_status.exist".equals(code)) {
					formDataField.setValue(invoiceStatus.getExist());
				} else if ("invoice_status.process".equals(code)) {
					formDataField.setValue(invoiceStatus.getProcess());
				} else if ("invoice_status.overview".equals(code)) {
					formDataField.setValue(invoiceStatus.getOverview());
				} else if ("invoice_status.kind".equals(code)) {
					formDataField.setValue(invoiceStatus.getKind());
				} else if ("invoice_status.capture_image".equals(code)) {
					formDataField.setValue(invoiceStatus.getCapture_image());
				}
			}
		}
		
		Map<String, String> body = new HashMap<String, String>();
		body.put("formData", mapperClass.mapper().writeValueAsString(formDataFields));
		body.put("ticketId", formData.getTicketId());
		body.put("userTaskId", formData.getUserTaskId());
		body.put("version", formData.getVersion());
		body.put("eformId", formData.getEformId());
		body.put("id", formData.getId()); 

		HttpEntity<Object> entity = new HttpEntity<>(body, headers);
		try {
			restTemplate.exchange(url, HttpMethod.POST, entity, FormData.class);
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
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
					AfterTaskData data = response.getBody().getData();
					if (data != null) {
						return data.getUserTaskIds();
					} else {
						throw new RuntimeException("Usertask id undefined");
					}
				} else {
					throw new RuntimeException("Get form error - " + userTaskId + " : " + response.getBody().getMessage());
				}
			} catch (HttpStatusCodeException e) {
				throw new RuntimeException("Get form error - " + e.getResponseBodyAsString());
			}
		} catch (Exception e) {
			throw new RuntimeException("Get form error - " + userTaskId + " : " + e.getMessage());
		}
	}
	
	private Map<String, Object> getTicket(HttpHeaders headers, String ticketId) throws Exception {
		String url = eContractUrl + "services/erequest/api/ticket-recipients/findByTicketIdInternal/" + ticketId;
		
		HttpEntity<Object> entity = new HttpEntity<>(headers);
		try {
			ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
			return mapperClass.swap(Map.class, response.getBody());
			
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	public byte[] getFileFromS3(String keyName, String bucketName) {
		if (bucket.equals(bucketName)) {
			AwsBasicCredentials credentials = AwsBasicCredentials.create(accessKeyId, secretAccessKey);
			StaticCredentialsProvider credentialsProvider = StaticCredentialsProvider.create(credentials);
			S3Client client = S3Client.builder().credentialsProvider(credentialsProvider)
					.endpointOverride(URI.create(String.format(endpointOverride))).region(Region.of(regionString))
					.build();

			GetObjectRequest objectRequest = GetObjectRequest.builder().key(keyName).bucket(bucketName).build();
			ResponseBytes<GetObjectResponse> objectBytes = client.getObjectAsBytes(objectRequest);

			if (objectBytes.response().sdkHttpResponse().statusCode() != 200) {
				throw new RuntimeException("Get file from S3 error");
			}

			byte[] data = objectBytes.asByteArray();
			return data;
		} else {
			GetObjectRequest objectRequest = GetObjectRequest.builder().key(keyName).bucket(bucketName).build();
			ResponseBytes<GetObjectResponse> objectBytes = s3Client.getObjectAsBytes(objectRequest);

			if (objectBytes.response().sdkHttpResponse().statusCode() != 200) {
				throw new RuntimeException("Get file from S3 error");
			}

			byte[] data = objectBytes.asByteArray();
			return data;
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
		reqHeaders.add("Authorization",
				"Basic " + Base64Utils.encodeToString(authorization.getBytes(StandardCharsets.UTF_8)));

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
	
	private static class InvoiceInfo implements Serializable {
		private static final long serialVersionUID = 1L;

		private String status;
		private String request_message;
		private Instant response_time;
		private Object invoice_format;
		private InvoiceStatus invoice_status;
		public String getStatus() {
			return status;
		}
		public void setStatus(String status) {
			this.status = status;
		}
		public String getRequest_message() {
			return request_message;
		}
		public void setRequest_message(String request_message) {
			this.request_message = request_message;
		}
		public Instant getResponse_time() {
			return response_time;
		}
		public void setResponse_time(Instant response_time) {
			this.response_time = response_time;
		}
		public Object getInvoice_format() {
			return invoice_format;
		}
		public void setInvoice_format(Object invoice_format) {
			this.invoice_format = invoice_format;
		}
		public InvoiceStatus getInvoice_status() {
			return invoice_status;
		}
		public void setInvoice_status(InvoiceStatus invoice_status) {
			this.invoice_status = invoice_status;
		}
	}
	
	private static class InvoiceStatus implements Serializable {
		private static final long serialVersionUID = 1L;

		private String exist;
		private String process;
		private String overview;
		private String kind;
		@Lob
		private String capture_image;

		public String getCapture_image() {
			return capture_image;
		}

		public void setCapture_image(String capture_image) {
			this.capture_image = capture_image;
		}

		public String getExist() {
			return exist;
		}

		public void setExist(String exist) {
			this.exist = exist;
		}

		public String getOverview() {
			return overview;
		}

		public void setOverview(String overview) {
			this.overview = overview;
		}

		public String getKind() {
			return kind;
		}

		public void setKind(String kind) {
			this.kind = kind;
		}

		public String getProcess() {
			return process;
		}

		public void setProcess(String process) {
			this.process = process;
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

	private static class EformFileValue implements Serializable {
		private static final long serialVersionUID = 1L;

		private Object data;
		private String name;
		private String size;
		private String downloadding;

		private byte[] fileByte;

		public Object getData() {
			return data;
		}

		public void setData(Object data) {
			this.data = data;
		}

		public String getName() {
			return name;
		}

		public void setName(String name) {
			this.name = name;
		}

		public String getSize() {
			return size;
		}

		public void setSize(String size) {
			this.size = size;
		}

		public String getDownloadding() {
			return downloadding;
		}

		public void setDownloadding(String downloadding) {
			this.downloadding = downloadding;
		}

		public byte[] getFileByte() {
			return fileByte;
		}

		public void setFileByte(byte[] fileByte) {
			this.fileByte = fileByte;
		}
	}

	private static class EformFileData implements Serializable {
		private static final long serialVersionUID = 1L;

		private String bucketName;
		private String keyName;

		public String getBucketName() {
			return bucketName;
		}

		public void setBucketName(String bucketName) {
			this.bucketName = bucketName;
		}

		public String getKeyName() {
			return keyName;
		}

		public void setKeyName(String keyName) {
			this.keyName = keyName;
		}
	}
}
