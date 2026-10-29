// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/Bridgestone_flow_start_bridgestone_create_lot.java
// Secret đã thay bằng "<REDACTED>" (4 chỗ).
package com.fis.excall.service.test;

import java.io.ByteArrayInputStream;
import java.io.Serializable;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.apache.http.client.utils.URIBuilder;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.NumberToTextConverter;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.service.dto.TemplateDTO;
import com.fis.excall.service.envelope.dto.DataDTO;
import com.fis.excall.service.envelope.dto.FieldDTO;
import com.fis.excall.service.envelope.dto.HdrFieldDTO;
import com.fis.excall.service.envelope.dto.LotDataDTO;
import com.fis.excall.service.envelope.dto.PartyDTO;
import com.fis.excall.service.envelope.dto.RecipientDTO;
import com.fis.excall.service.envelope.dto.ValidatorDTO;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

@Service
public class Bridgestone_flow_start_bridgestone_create_lot {
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

	private static final String urlEwriter = "https://10.14.121.10/ewriter/services/ewriter";

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

	private static final String NAME_ENVELOPE = "ne", NO_ENVELOPE = "no", SIGN_DATE = "sd", PARTY = "p",
			RECIPIENT = "r", MAIL = "m", PHONE = "phone", FIELD = "f", FREE_FIELD = "ff",
			HEADER_FIELD = "header_fields", FPT_CA_FOWARD_CODE = "fowardCode", FPT_CA_ADDRESS = "address",
			FPT_CA_STATE = "stateOrProvince", FPT_CA_LOCATION = "location", FPT_CA_COMMUNE = "commune",
			FPT_CA_COUNTRY = "country", FPT_CA_MESSAGE_TYPE = "messageType",
			FPT_CA_DOCUMENT_TYPE = "personalDocumentType", FPT_CA_PERSONALID = "personalID",
			FPT_CA_PROVIDE_DATE = "provideDate", FPT_CA_PROVIDE_ADDRESS = "provideAddress",
			FPT_CA_PHOTO_FRONT = "photoFrontSideIDCard", FPT_CA_PHOTO_BACKSIDE = "photoBackSideIDCard";

	public Object createLot(Object content) throws Exception {
		Map<String, Object> mapContent = mapperClass.swap(Map.class, content);

		String templateAlias = null;
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

		Map<String, Object> body = new HashMap<String, Object>();
		FormData formData = this.getFormData(headers, ticketId, null);
		String formStr = formData.getFormData();
//		String formStr = "[{\"label\":\"Mẫu hợp đồng\",\"type\":\"dropdown\",\"value\":\"MAU_01\",\"formId\":\"000011mzI8btWqe2G4yBFMBN_dropdown-1\",\"hashid\":\"x6NR6jLvl\",\"code\":\"template_alias\",\"display\":true,\"validate\":{\"required\":false,\"mutilChoose\":false},\"metaSearchOnRequest\":false,\"dataType\":\"String\",\"typeForm\":\"dropdown\"},{\"label\":\"Tên nhà cung cấp\",\"type\":\"textField\",\"value\":\"1\",\"formId\":\"000011mzI8btWqe2G4yBFMBN_textField-1\",\"hashid\":\"K8kJ8mg0n\",\"code\":\"name\",\"display\":true,\"validate\":{\"regex\":\"\",\"unique\":false,\"required\":false,\"maxLength\":\"\",\"minLength\":\"\",\"messErrorForRegex\":\"\",\"listSelectedRegex_value\":[]},\"metaSearchOnRequest\":false,\"dataType\":\"String\",\"typeForm\":\"textField\"},{\"label\":\"Mã nhà cung cấp\",\"type\":\"textField\",\"value\":\"2\",\"formId\":\"000011mzI8btWqe2G4yBFMBN_textField-2\",\"hashid\":\"gpVwp6r2l\",\"code\":\"code\",\"display\":true,\"validate\":{\"regex\":\"\",\"unique\":false,\"required\":false,\"maxLength\":\"\",\"minLength\":\"\",\"messErrorForRegex\":\"\",\"listSelectedRegex_value\":[]},\"metaSearchOnRequest\":false,\"dataType\":\"String\",\"typeForm\":\"textField\"},{\"label\":\"Upload file\",\"type\":\"upload_file\",\"value\":[{\"data\":\"{\\n  \\\"bucketName\\\" : \\\"econ-eform-demo\\\",\\n  \\\"keyName\\\" : \\\"5439/20250224/1740389984625_test hdld09.xlsx\\\"\\n}\",\"name\":\"test hdld09.xlsx\",\"size\":\"0.01\",\"downloadding\":false}],\"formId\":\"000011mzI8btWqe2G4yBFMBN_upload_file-3\",\"hashid\":\"x6NR68WB3\",\"code\":\"upload_template\",\"display\":true,\"validate\":{\"required\":false,\"maxSizeFile\":\"\",\"minSizeFile\":\"\",\"mutilChoose\":true},\"metaSearchOnRequest\":false,\"dataType\":\"String\",\"typeForm\":\"upload_file\"}]";

		List<FormDataField> formDataFields = null;
		List<EformFileValue> eformFileValues = null;
		if (formStr != null) {
			formDataFields = mapperClass.mapper().readValue(formStr, new TypeReference<List<FormDataField>>() {
			});
			if (formDataFields != null && formDataFields.size() > 0) {
				for (FormDataField formDataField : formDataFields) {
					if ("template_alias".equals(formDataField.getCode())) {
						templateAlias = String.valueOf(formDataField.getValue());
					} else if ("upload_template".equals(formDataField.getCode())) {
						eformFileValues = mapperClass.mapper().readValue(mapperClass.mapper().writeValueAsString(formDataField.getValue()),new TypeReference<List<EformFileValue>>() {});
					}
				}
			}
		}

		if (StringUtils.isEmpty(templateAlias)) {
			throw new RuntimeException("Template is undefined");
		}

		// get template from ewriter/econtract
		DocumentInfo documentInfo = this.getDocumentInfo(headersEcon, templateAlias);
		TemplateDTO templateDTO = this.getTemplate(headersEcon, documentInfo.getTemplateEcontractId());
		
		// build excell headers
		Map<Integer, ProfileExcell> mapExcell = this.buildExcellStructure(templateDTO, documentInfo.getStructure());

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
		
		List<Map<Integer, String>> listData = new ArrayList<Map<Integer,String>>();

		EformFileValue eformFileValue = eformFileValues.get(0);
		ByteArrayInputStream bis = new ByteArrayInputStream(eformFileValue.getFileByte());
		Workbook workbook = new XSSFWorkbook(bis);
		Sheet sheet = workbook.getSheetAt(0); // Read the first sheet

		for (Row row : sheet) {
			if (row.getRowNum() == 0) {
				continue;
			}
			Map<Integer, String> mapRow = new HashMap<Integer, String>();
			for (Cell cell : row) {
				Integer cellIndex = cell.getColumnIndex();
				if (cell.getCellType() == CellType.STRING) {
					mapRow.put(cellIndex, cell.getStringCellValue());
				} else if (cell.getCellType() == CellType.NUMERIC) {
					if (DateUtil.isCellDateFormatted(cell)) {
                        mapRow.put(cellIndex, cell.getDateCellValue().toString());
                    } else {
                    	mapRow.put(cellIndex, NumberToTextConverter.toText(cell.getNumericCellValue()));
                    }
				} else if (cell.getCellType() == CellType.BOOLEAN) {
					mapRow.put(cellIndex, String.valueOf(cell.getBooleanCellValue()));
				} else if (cell.getCellType() == CellType.FORMULA) {
					mapRow.put(cellIndex, cell.getCellFormula());
				} else if (cell.getCellType() == CellType.BLANK) {
					mapRow.put(cellIndex, "");
				} else {
					mapRow.put(cellIndex, "");
				}
			}
			listData.add(mapRow);
		}
		
		// valid data/required field => update về form
		
		List<LotDataDTO> lotDatas = new ArrayList<LotDataDTO>();
		// create lot
		for (Map<Integer, String> mapRow : listData) {
			LotDataDTO lotData = new LotDataDTO();
			lotData.setTemplateId(documentInfo.getTemplateEcontractId());
			lotData.setAlias("");
			lotData.setSyncType("sync");
			
			List<DataDTO> dataDTOs = new ArrayList<DataDTO>();
			Map<String, String> docVariables = new HashMap<String,String>();
			
			for (Map.Entry<Integer, String> entry : mapRow.entrySet()) {
				Integer cellIndex = entry.getKey();
				String value = entry.getValue();
				ProfileExcell profileExcell = mapExcell.get(cellIndex);
				if (!"docVariable".equals(profileExcell.getType())) {
					DataDTO dataDTO = new DataDTO(profileExcell.getId(), profileExcell.getType(), value);
					dataDTOs.add(dataDTO);
				} else {
					docVariables.put(profileExcell.getId(), value);
				}
			}
			lotData.setDatas(Arrays.asList(dataDTOs));
			
			Map<String, Object> payload = new HashMap<String, Object>();
			payload.put("lotData", lotData);
			payload.put("docVariable", docVariables);
			payload.put("documentInfo", documentInfo);
			payload.put("owner", owner);
			
			String lotId = "";
			
			Map<String, Object> bodyExcall = new HashMap<String, Object>();
			bodyExcall.put("id", "");
			bodyExcall.put("refId", lotId);
			bodyExcall.put("selector", "flow_start_bridgestone_create_econtract");
			bodyExcall.put("lookup", lotId);
			bodyExcall.put("attrs", new Object());
			bodyExcall.put("payload", null);
			bodyExcall.put("body", payload);

			HttpEntity<Object> entity = new HttpEntity<>(bodyExcall, headersEcon);
			String url = eContractUrl + "services/excall/api/excall";
			try {
				this.restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
			} catch (HttpStatusCodeException e) {
				throw new RuntimeException("Khởi tạo không thành công" + e.getResponseBodyAsString());
			}
        }
		return "ok";
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

	public LinkedHashMap<Integer, ProfileExcell> buildExcellStructure(TemplateDTO templateDTO, List<String> structure) {
		Integer index = 0;
		LinkedHashMap<Integer, ProfileExcell> map = new LinkedHashMap<>();
		if (templateDTO != null) {
			// header fields
			if (templateDTO.getHeader() != null && templateDTO.getHeader().getFields() != null && templateDTO.getHeader().getFields().size() > 0) {
				for (HdrFieldDTO field : templateDTO.getHeader().getFields()) {
					if (!"envSubmittedFrom".equals(field.getId()) && StringUtils.isEmpty(field.getFormula())) {
						ProfileExcell profile = new ProfileExcell(field.getName(), null, HEADER_FIELD, field.getId(), field.getType(), false);
						
						map.put(index++, profile);
					}
				}
			}
			// requester fields
			if (templateDTO.getRequester() != null && templateDTO.getRequester().getFields() != null && templateDTO.getRequester().getFields().size() > 0) {
				for (FieldDTO field : templateDTO.getRequester().getFields()) {
					List<String> types = Arrays.asList("text", "Text");
					if (StringUtils.isEmpty(field.getRecipientId()) && !HEADER_FIELD.equals(field.getType()) && !types.contains(field.getType())) {
						ProfileExcell profile = new ProfileExcell(field.getName(), null, FREE_FIELD, field.getId(), "text", false);
						
						if (field.getValidators() != null && field.getValidators().size() > 0) {
							for (ValidatorDTO validator : field.getValidators()) {
								if ("required".equals(validator.getType())) {
									profile.setRequired("true".equals(validator.getExpression()));
								}
							}
						}
						
						map.put(index++, profile);
					} else if ("text".equals(field.getType())) {
						String type = FIELD;
						if (StringUtils.isEmpty(field.getRecipientId())) {
							type = FREE_FIELD;
						}
						ProfileExcell profile = new ProfileExcell(field.getName(), null, type, field.getId(), "Text", false);
						
						if (field.getValidators() != null && field.getValidators().size() > 0) {
							for (ValidatorDTO validator : field.getValidators()) {
								if ("required".equals(validator.getType())) {
									profile.setRequired("true".equals(validator.getExpression()));
								}
							}
						}
						
						map.put(index++, profile);
					}
				}
			}
			
			// parties
			if (templateDTO.getParties() != null && templateDTO.getParties().size() > 0) {
				Boolean isOtpSign = false;
				Integer orgNum = -1;
				Integer indNum = -1;
				
				List<String> orgType = Arrays.asList("organization", "my-organization");
				for (PartyDTO parties : templateDTO.getParties()) {
					if (orgType.contains(parties.getType())) {
						orgNum = 1;
					}
					if ("individual".equals(parties.getType())) {
						indNum = 1;
					}
				}
				for (PartyDTO party : templateDTO.getParties()) {
					if (orgType.contains(party.getType())) {
						String recipientPrefix = "";
						if (orgNum != -1) {
							recipientPrefix += (party.getName() + " " + orgNum) + ". ";
							map.put(index++, new ProfileExcell(party.getName() + " " + orgNum, null, PARTY, party.getId(), "Text", false));
						} else {
							recipientPrefix += (party.getName()) + ". ";
							map.put(index++, new ProfileExcell(party.getName(), null, PARTY, party.getId(), "Text", false));
						}
						
						// recipient
						if (party.getRecipients() != null && party.getRecipients().size() > 0) {
							Integer reviewerNum = -1;
							Integer signerNum = -1;
							Integer stamperNum = -1;
							Integer ccNum = -1;
							Integer coordinatorNum = -1;
							
							index = this.buildRecipient(index, map, party.getRecipients(), "reviewer", recipientPrefix, reviewerNum);
							index = this.buildRecipient(index, map, party.getRecipients(), "signer", recipientPrefix, signerNum);
							index = this.buildRecipient(index, map, party.getRecipients(), "stamper", recipientPrefix, stamperNum);
							index = this.buildRecipient(index, map, party.getRecipients(), "cc", recipientPrefix, ccNum);
							index = this.buildRecipient(index, map, party.getRecipients(), "coordinator", recipientPrefix, coordinatorNum);
						}
					} else {
						// individual
						index = this.buildRecipient(index, map, party.getRecipients(), "individual", "", indNum);
					}
				}
			}
		}
		
		if (structure != null && structure.size() > 0) {
			for (String variable : structure) {
				map.put(index++, new ProfileExcell(variable, null, "docVariable", variable, "Text", false));
			}
		}
		return map;
	}
	
	public Integer buildRecipient(Integer index, LinkedHashMap<Integer, ProfileExcell> map, List<RecipientDTO> recipients, String role, String prefix, Integer num) {
		for (RecipientDTO recipient : recipients) {
			if (role.equals(recipient.getRole()) || "individual".equals(role)) {
				Boolean isOtpSign = false;
				if (recipient.getSignTypes() != null && recipient.getSignTypes().size() > 0) {
					if (recipient.getSignTypes().contains("sign_fca.otp")) {
						isOtpSign = true;
					}
				}
				if (num != -1) {
					map.put(index++, new ProfileExcell(prefix + role + " name " + num, recipient.getContact().getName(), RECIPIENT, recipient.getId(), "Text", false));
					if (!StringUtils.isEmpty(recipient.getContact().getEmail())) {
						map.put(index++, new ProfileExcell(prefix + role + " email " + num, recipient.getContact().getEmail(), MAIL, recipient.getId(), "Mail", false));
					}
					if (!StringUtils.isEmpty(recipient.getContact().getPhone())) {
						map.put(index++, new ProfileExcell(prefix + role + " phone " + num, recipient.getContact().getPhone(), PHONE, recipient.getId(), "Phone", false));
					}
				} else {
					map.put(index++, new ProfileExcell(prefix + role + " name", recipient.getContact().getName(), RECIPIENT, recipient.getId(), "Text", false));
					if (!StringUtils.isEmpty(recipient.getContact().getEmail())) {
						map.put(index++, new ProfileExcell(prefix + role + " email", recipient.getContact().getEmail(), MAIL, recipient.getId(), "Mail", false));
					}
					if (!StringUtils.isEmpty(recipient.getContact().getPhone())) {
						map.put(index++, new ProfileExcell(prefix + role + " phone", recipient.getContact().getPhone(), PHONE, recipient.getId(), "Phone", false));
					}
				}
				
				if (isOtpSign) {
					map.put(index++, new ProfileExcell(prefix + role + " address " + num, null, FPT_CA_ADDRESS, recipient.getId(), "Text", false));
					map.put(index++, new ProfileExcell(prefix + role + " state " + num, null, FPT_CA_STATE, recipient.getId(), "Text", false));
					map.put(index++, new ProfileExcell(prefix + role + " location " + num, null, FPT_CA_LOCATION, recipient.getId(), "Text", false));
					map.put(index++, new ProfileExcell(prefix + role + " commune " + num, null, FPT_CA_COMMUNE, recipient.getId(), "Text", false));
					map.put(index++, new ProfileExcell(prefix + role + " personal id " + num, null, FPT_CA_PERSONALID, recipient.getId(), "Text", false));
					map.put(index++, new ProfileExcell(prefix + role + " provide date " + num, null, FPT_CA_PROVIDE_DATE, recipient.getId(), "Text", false));
					map.put(index++, new ProfileExcell(prefix + role + " provide address " + num, null, FPT_CA_PROVIDE_ADDRESS, recipient.getId(), "Text", false));
					map.put(index++, new ProfileExcell(prefix + role + " country " + num, null, FPT_CA_COUNTRY, recipient.getId(), "Text", false));
					map.put(index++, new ProfileExcell(prefix + role + " message type " + num, null, FPT_CA_MESSAGE_TYPE, recipient.getId(), "Text", false));
					map.put(index++, new ProfileExcell(prefix + role + " personal document type " + num, null, FPT_CA_DOCUMENT_TYPE, recipient.getId(), "Text", false));
					map.put(index++, new ProfileExcell(prefix + role + " photo front " + num, null, FPT_CA_PHOTO_FRONT, recipient.getId(), "Text", false));
					map.put(index++, new ProfileExcell(prefix + role + " photo back " + num, null, FPT_CA_PHOTO_BACKSIDE, recipient.getId(), "Text", false));
					map.put(index++, new ProfileExcell(prefix + role + " address " + num, null, FPT_CA_ADDRESS, recipient.getId(), "Text", false));
				}
				num++;
			}
		}
		return index;
	}

	public TemplateDTO getTemplate(HttpHeaders headersEcon, String id) throws Exception {
		try {
			String url = eContractUrl + "services/envelope/api/template";

			URIBuilder uriBuilder = new URIBuilder(url);
			if (!StringUtils.isEmpty(id)) {
				uriBuilder.addParameter("id", id);
			}

			HttpEntity<Object> request = new HttpEntity<>(headersEcon);
			ResponseEntity<TemplateDTO> response = restTemplate.exchange(uriBuilder.build().toString(), HttpMethod.GET,
					request, TemplateDTO.class);
			return response.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	public DocumentInfo getDocumentInfo(HttpHeaders headersEcon, String alias) throws Exception {
		try {
			String url = "/api/internal/documents/structure/" + alias;
			HttpEntity<Object> request = new HttpEntity<>(headersEcon);
			ResponseEntity<DocumentInfo> response = restTemplate.exchange(urlEwriter + url, HttpMethod.POST, request,
					DocumentInfo.class);
			return response.getBody();
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

	private static class DocumentInfo implements Serializable {
		private static final long serialVersionUID = 1L;

		private String id;
		private String name;
		private String size;
		private String userId;
		private String status;
		private String custId;
		private String orgIn;
		private String type;
		private String templateEcontractId;
		private String alias;
		private String createdBy;
		private String createdDate;
		private List<String> structure;
		private List<DocumentInfo> aliasDTOS;

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

		public String getSize() {
			return size;
		}

		public void setSize(String size) {
			this.size = size;
		}

		public String getUserId() {
			return userId;
		}

		public void setUserId(String userId) {
			this.userId = userId;
		}

		public String getStatus() {
			return status;
		}

		public void setStatus(String status) {
			this.status = status;
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

		public String getType() {
			return type;
		}

		public void setType(String type) {
			this.type = type;
		}

		public String getTemplateEcontractId() {
			return templateEcontractId;
		}

		public void setTemplateEcontractId(String templateEcontractId) {
			this.templateEcontractId = templateEcontractId;
		}

		public String getAlias() {
			return alias;
		}

		public void setAlias(String alias) {
			this.alias = alias;
		}

		public String getCreatedBy() {
			return createdBy;
		}

		public void setCreatedBy(String createdBy) {
			this.createdBy = createdBy;
		}

		public String getCreatedDate() {
			return createdDate;
		}

		public void setCreatedDate(String createdDate) {
			this.createdDate = createdDate;
		}

		public List<String> getStructure() {
			return structure;
		}

		public void setStructure(List<String> structure) {
			this.structure = structure;
		}

		public List<DocumentInfo> getAliasDTOS() {
			return aliasDTOS;
		}

		public void setAliasDTOS(List<DocumentInfo> aliasDTOS) {
			this.aliasDTOS = aliasDTOS;
		}
	}

	private static class ProfileExcell implements Serializable {
		private static final long serialVersionUID = 1L;

		public ProfileExcell() {
		}
		
		public ProfileExcell(String header, String sample, String type, String id, String typeHeaderField,
				Boolean required) {
			super();
			this.header = header;
			this.sample = sample;
			this.type = type;
			this.id = id;
			this.typeHeaderField = typeHeaderField;
			this.required = required;
		}

		private String header;
		private String sample;
		private String type;
		private String id;
		private String typeHeaderField;
		private Boolean required;

		public String getHeader() {
			return header;
		}

		public void setHeader(String header) {
			this.header = header;
		}

		public String getSample() {
			return sample;
		}

		public void setSample(String sample) {
			this.sample = sample;
		}

		public String getType() {
			return type;
		}

		public void setType(String type) {
			this.type = type;
		}

		public String getId() {
			return id;
		}

		public void setId(String id) {
			this.id = id;
		}
		
		public String getTypeHeaderField() {
			return typeHeaderField;
		}

		public void setTypeHeaderField(String typeHeaderField) {
			this.typeHeaderField = typeHeaderField;
		}
		
		public Boolean getRequired() {
			return required;
		}

		public void setRequired(Boolean required) {
			this.required = required;
		}
	}
}
