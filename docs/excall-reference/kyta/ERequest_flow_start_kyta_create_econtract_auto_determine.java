// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/ERequest_flow_start_kyta_create_econtract_auto_determine.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.oauth2.common.OAuth2AccessToken;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.domain.BASE64DecodedMultipartFile;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;
import com.fis.excall.service.envelope.dto.EnvelopeErqDTO;
import com.fis.excall.service.envelope.dto.FieldDTO;
import com.fis.excall.service.envelope.dto.HdrFieldDTO;
import com.fis.excall.service.envelope.dto.PartyDTO;
import com.fis.excall.service.envelope.dto.RecipientDTO;
import com.fis.excall.service.envelope.dto.RequesterDTO;

@Service
public class ERequest_flow_start_kyta_create_econtract_auto_determine {
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
	
	private static final String urlErequest = "https://10.14.121.10/app";
//	private static final String urlErequest = "https://demo.econtract.fpt.com/app";
	
	private static final String urlAuth = "http://10.14.121.18:31018/";
    // private static final String urlAuth = "https://demo.econtract.fpt.com/app/services/uaa/";
	
	public String creatingEnvelope(String payload) throws Exception {
		try {
 			Map<String, Object> body = mapperClass.swap(HashMap.class, payload);
 			Object _isDossier = body.get("isDossier");
 			Boolean isDossier = false;
 			if (_isDossier != null) {
 				isDossier = Boolean.valueOf(String.valueOf(_isDossier));
 			}
 			
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
			
			String docTypeCode = (String)body.get("docTypeCode");
			Object header = body.get("headerFields");
			
			List<HdrFieldDTO> fields = mapperClass.mapper().readValue(mapperClass.mapper().writeValueAsString(header),
					new TypeReference<List<HdrFieldDTO>>() {
					});
			
			// create draft
			EnvelopeDTO envelope = null;
			try {
				envelope = this.createEnvelopeDraft(headersEcon, fields, refId, docTypeCode);
			} catch (Exception e) {
				return this.handleReturn("error", "3", e.getMessage());
			}
			
			// upload document
			List<FileInfo> files = mapperClass.mapper().readValue(
					mapperClass.mapper().writeValueAsString(body.get("files")), new TypeReference<List<FileInfo>>() {
					});
			
			if (files == null || files.size() == 0) {
				return this.handleReturn("error", "4", "error.noDocumentToCreateEnvelope");
			}
			
			// mapping document - recipient
			Map<String, List<String>> mapDocAndRecipient = new HashMap<String, List<String>>();
			
			for (FileInfo fileInfo : files) {
				byte[] file = null;
				try {
					file = this.getContent(headersEcon, fileInfo.getId());
				} catch (Exception e) {
					// get file from collaboration error
					return this.handleReturn("error", "4", e.getMessage());
				}
				
				try {
					envelope = this.uploadEcontractDocument(headersEcon, fileInfo.getId(), file, fileInfo.getName(), envelope, fileInfo.getOrder(), mapDocAndRecipient, isDossier);
				} catch (Exception e) {
					// upload to econtract error
					return this.handleReturn("error", "5", e.getMessage());
				}
			}
			
			// update envelope erequest info
			EnvelopeErqDTO erq = new EnvelopeErqDTO();
			erq.setResourceId(envelope.getId());
			erq.setTicketId(ticketId);
			erq.setUserTaskId(userTaskId);
			erq.setUserTaskVersion(userTaskVersion);
			erq.setRecipientDetailsId(recipientDetailsId);
			erq.setResourceType("erequest");
			envelope.setErq(erq);
			
			try {
				envelope = this.updateEnvelope(headersEcon, envelope);
			} catch (Exception e) {
				return this.handleReturn("error", "9", e.getMessage());
			}
			
			return this.handleReturn("success", "0", mapperClass.mapper().writeValueAsString(envelope));
		} catch (Exception ex) {
			return this.handleReturn("error", "-1", ex.getMessage());
		}
	}
	
	public EnvelopeDTO updateEnvelope(HttpHeaders headersEcon, EnvelopeDTO envelope) {
		String docId = envelope.getDocuments().get(0).getId();
		
		List<FieldDTO> rqtFields = new ArrayList<FieldDTO>();
		if (envelope.getParties() != null && envelope.getParties().size() > 0) {
			for (PartyDTO party : envelope.getParties()) {
				for (RecipientDTO recipient : party.getRecipients()) {
					for (FieldDTO field : recipient.getFields()) {
						field.setDocId(docId);
						rqtFields.add(field);
					}
 				}
			}
		}
		
		RequesterDTO requester = envelope.getRequester();
		if (requester != null) {
			requester.setFields(rqtFields);
		}
		envelope.setRequester(requester);
		envelope.setResourceType("erequest");
		String createEnvelope = "/services/envelope/api/envelope/" + envelope.getId();

		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		envelope.setFlowFinish(Arrays.asList("flow_finish_kyta_econtract_temp_n_determine"));
		HttpEntity<Object> entityEnvelope = new HttpEntity<>(envelope, headersEcon);
		try {
			ResponseEntity<EnvelopeDTO> requestEcontract3 = restTemplate.exchange(urlFPTeContract + createEnvelope,
					HttpMethod.PUT, entityEnvelope, EnvelopeDTO.class);

			return requestEcontract3.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}
	
	private byte[] getContent(HttpHeaders headersEcon, String docId) throws Exception {
		try {
			String url = urlFPTeContract + "/services/collabora/api/files/" + docId + "/download";
			HttpEntity<Object> entity = new HttpEntity<>(headersEcon);

			ResponseEntity<byte[]> response = restTemplate.exchange(url, HttpMethod.GET, entity, byte[].class);
			return response.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}
	
	private EnvelopeDTO uploadEcontractDocument(HttpHeaders headersEcon, String refId, byte[] valuePdfContract,
			String fileName, EnvelopeDTO envelope, String order, Map<String, List<String>> mapDocAndRecipient, Boolean isDossier)
			throws Exception {
		List<String> docRecipient = null;
		if (mapDocAndRecipient != null) {
			docRecipient = mapDocAndRecipient.get(refId);
		}
		String uploadUrl = "/services/envelope/api/envelope/v2/" + envelope.getId() + "/doc";
		String url2 = urlFPTeContract + uploadUrl;

		BASE64DecodedMultipartFile file = new BASE64DecodedMultipartFile(valuePdfContract, fileName);

		ObjectMapper mapper = new ObjectMapper();
		mapper.configure(SerializationFeature.FAIL_ON_EMPTY_BEANS, false);
		MappingJackson2HttpMessageConverter converter = new MappingJackson2HttpMessageConverter(mapper);
		converter.setSupportedMediaTypes(Arrays.asList(MediaType.APPLICATION_OCTET_STREAM));
		restTemplate.getMessageConverters().add(converter);
		MultiValueMap<String, String> fileMap = new LinkedMultiValueMap<>();
		ContentDisposition contentDisposition = ContentDisposition.builder("form-data").name("files")
				.filename(file.getFileName()).build();
		fileMap.add(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString());
		HttpEntity<byte[]> fileEntity = new HttpEntity<>(file.getBytes(), fileMap);

		Map<String, Object> fileInfos = new HashMap<String, Object>();
		if (isDossier) {
			fileInfos.put("type", "DOSSIER");
		} else {
			fileInfos.put("type", "DEFAULT");
		}
		fileInfos.put("order", order);
		fileInfos.put("docRefId", refId);
		if (docRecipient != null) {
			fileInfos.put("recipientList", docRecipient);
		}

		MultiValueMap<String, Object> map = new LinkedMultiValueMap<>();
		map.add("files", fileEntity);
//		String fileInfos = "[{\"type\":\"DOSSIER\",\"order\":" + order + ",\"docRefId\":" + refId + "}]";
		map.add("fileInfos", mapperClass.mapper().writeValueAsString(Arrays.asList(fileInfos)));
		map.add("id", envelope.getId());

		headersEcon.setContentType(MediaType.MULTIPART_FORM_DATA);
		try {
			HttpEntity<MultiValueMap<String, Object>> requestUpload = new HttpEntity<>(map, headersEcon);

			ResponseEntity<EnvelopeDTO> requestEcontract2 = restTemplate.postForEntity(url2, requestUpload,
					EnvelopeDTO.class);
			envelope = requestEcontract2.getBody();
		} catch (HttpStatusCodeException e) {
			// TODO: handle exception
			throw new RuntimeException(e.getResponseBodyAsString());
		}
		return envelope;
	}
	
	public EnvelopeDTO createEnvelopeDraft(HttpHeaders headersEcon, List<HdrFieldDTO> fields, String refId, String docTypeCode) throws Exception {
		Map<String, Object> body = new HashMap<String, Object>();
		body.put("fields", fields);
		body.put("isStep", false);
		body.put("refId", refId);
		
		if (docTypeCode != null && !docTypeCode.isEmpty()) {
			body.put("docTypeId", docTypeCode);
		} else {
			body.put("docTypeId", null);
		}

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
	
	public static class FileInfo implements Serializable {
		private static final long serialVersionUID = 1L;

		private String name;
		private String id;
		private String order;
		
		public String getName() {
			return name;
		}
		public void setName(String name) {
			this.name = name;
		}
		public String getId() {
			return id;
		}
		public void setId(String id) {
			this.id = id;
		}
		public String getOrder() {
			return order;
		}
		public void setOrder(String order) {
			this.order = order;
		}
	}
}
