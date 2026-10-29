// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/GSM_flow_start_gsm_create_auto_determine_integrate.java
// Secret đã thay bằng "<REDACTED>" (4 chỗ).
package com.fis.excall.service.test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.Serializable;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.apache.commons.lang.StringUtils;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
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
import com.fis.envelope.pdfutil.PdfUtilEWriter;
import com.fis.envelope.pdfutil.field.FieldDescriptor;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.domain.BASE64DecodedMultipartFile;
import com.fis.excall.service.InternalExcallService;
import com.fis.excall.service.dto.CustomerAuthenDTO;
import com.fis.excall.service.dto.RedisEnvelopeRefIdDTO;
import com.fis.excall.service.envelope.dto.AgreementDetailFPTCaCloudDTO;
import com.fis.excall.service.envelope.dto.ContactDTO;
import com.fis.excall.service.envelope.dto.DocumentDTO;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;
import com.fis.excall.service.envelope.dto.FieldBoxDTO;
import com.fis.excall.service.envelope.dto.FieldDTO;
import com.fis.excall.service.envelope.dto.FieldDesign;
import com.fis.excall.service.envelope.dto.HdrFieldDTO;
import com.fis.excall.service.envelope.dto.PartyDTO;
import com.fis.excall.service.envelope.dto.RecipientDTO;
import com.fis.excall.service.envelope.dto.ValidatorDTO;

@Service
public class GSM_flow_start_gsm_create_auto_determine_integrate {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;

	@Autowired
	private EnvelopeClient envelopeClients;
	
	@Autowired
	private InternalExcallService internalExcallService;

	private static final String urlFPTeContract = "https://10.14.121.18:30600/app";
	private static final String urlEwriter = "https://10.14.121.10/ewriter/services/ewriter";
	private static final String urlSAP = "https://test-api.xanhsm.com/api/sap/gsm/v1/ws/backend/hrms/employee/information";
	
	private static final String keyHex = "<REDACTED>";
	private static final String client_id = "<REDACTED>";
	private static final String client_secret = "<REDACTED>";
	private static final String api_key = "<REDACTED>";
	private static final String country_code = "VN";

	public String creatingEnvelope(Object body, String lookup) throws Exception {
		Map<String, Object> mapBody = mapperClass.swap(Map.class, body);
		String owner = String.valueOf(mapBody.get("owner"));
		Long custId = Long.valueOf(String.valueOf(mapBody.get("custId")));
		OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(owner);

		/*
		 * prepare call to econtract
		 */
		// String token = "Bearer " + bearer;
		String token = "Bearer " + accessToken.getValue();
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", token);

		// sap_create_history
		EnvelopeDTO envelope = null;
		String lotId = null;
		ContractInfo contractInfo = null;
		String laborId = null;
		String laborName = null;
		String laborEmail = null;
		String laborPhone = null;
		ZonedDateTime checksum = null;

		try {
			if (mapBody.containsKey("checksum") && mapBody.get("checksum") != null) {
				checksum = ZonedDateTime.parse(String.valueOf(mapBody.get("checksum")));
			}
			lotId = String.valueOf(mapBody.get("lotId"));
			String doctypeCode = String.valueOf(mapBody.get("doctypeCode"));
			if (mapBody.get("contractInfo") == null) {
				this.saveHistory(headersEcon, "error", "Thông tin nhân viên không xác định", lotId, lookup, envelope,
						contractInfo, laborId, laborName, laborEmail, laborPhone);
				return this.handleReturn("success", "errorEmployeeUndefined", "Employee info undefined");
			}
			contractInfo = mapperClass.swap(ContractInfo.class, mapBody.get("contractInfo"));
			
			RedisEnvelopeRefIdDTO redisRefId = internalExcallService.findById(contractInfo.getContract_number());
			if (redisRefId != null) {
				if (checksum != null && !checksum.isEqual(redisRefId.getCreatedDate())) {
					this.saveHistory(headersEcon, "error", "Hợp đồng đang được khởi tạo trong 1 lô khác", lotId, lookup, null, contractInfo, null, null, null, null);
					return this.handleReturn("success", "errorDuplicateCreateRequest", "Employee is creating in another lot");
				}
			} else {
				this.saveHistory(headersEcon, "error", "Yêu cầu khởi tạo hợp đồng đã quá hạn", lotId, lookup, null, contractInfo, null, null, null, null);
				return this.handleReturn("success", "errorCreateRequestTimeOut", "Create employee request timeout");
			}
			
			if (mapBody.get("templateAlias") == null) {
				this.saveHistory(headersEcon, "error", "Loại hợp đồng không xác định", lotId, lookup, envelope, contractInfo,
						laborId, laborName, laborEmail, laborPhone);
				return this.handleReturn("success", "errorDocumentTypeUndefined", "Document type undefined");
			}
			String templateAlias = String.valueOf(mapBody.get("templateAlias"));
			if (mapBody.get("parties") == null) {
				this.saveHistory(headersEcon, "error", "Luồng ký kết không xác định", lotId, lookup, envelope, contractInfo,
						laborId, laborName, laborEmail, laborPhone);
				return this.handleReturn("success", "errorPartiesUndefined", "Parties info undefined");
			}

			List<String> depots = null;
			if (mapBody.get("depot") != null) {
				depots = mapperClass.mapper().readValue(mapperClass.mapper().writeValueAsString(mapBody.get("depot")),
						new TypeReference<List<String>>() {
						});
			}
			
			Boolean isExpired = this.checkTokenExpired(headersEcon);
			if (!isExpired) {
				this.saveHistory(headersEcon, "error", "SAP token hết hạn", lotId, lookup, envelope, contractInfo, laborId, laborName, laborEmail, laborPhone);
				return this.handleReturn("success", "SAPTokenExpired", "SAP Token expired");
			}

			// get config flow and variable
			String mapDocStr = null;
			List<MapVariableDTO> mapDocs = null;
			Map<String, String> sapData = null;
			List<Map<String, Object>> mapData = new ArrayList<Map<String, Object>>();
			List<String> encryptField = null;
			TemplateMappingVariableDTO templateMappingVariable = this.findByDocTypeCode(headersEcon, templateAlias, custId);

			if (templateMappingVariable == null) {
				this.saveHistory(headersEcon, "error", "Thông tin cấu hình loại tài liệu không xác định", lotId, lookup, envelope, contractInfo, laborId, laborName, laborEmail, laborPhone);
				return this.handleReturn("success", "errorMappingVariableUnderfined",
						"Template mapping variable undefined");
			}

			try {
				mapDocs = templateMappingVariable.getMapDoc();
				encryptField = Arrays.asList("H_WT1000", "H_WT1000SAUTV", "H_WT1000SAUTV_TEXT", "H_WT1000_TEXT",
						"H_WT1000_TRC", "H_WT1001", "H_WT1001SAUTV", "H_WT1001_TEXT", "H_WT1001_TRC", "H_WT1002",
						"H_WT1002SAUTV", "H_WT1002_TEXT", "H_WT1002_TRC", "H_WT1003", "H_WT1003SAUTV", "H_WT1003_TEXT",
						"H_WT1004", "H_WT1004SAUTV", "H_WT1004_TEXT", "H_WT1004_TRC", "H_WT1006", "H_WT1006SAUTV",
						"H_WT1006_TEXT", "H_WT1006_TRC", "H_WT1008", "H_WT1008_TRC", "H_WT1097", "H_WT2009", "H_WT2012",
						"H_WT2012_TEXT", "H_WT2014", "H_WT2014_TEXT", "H_WT2036", "H_WT3025", "H_WT3034", "H_WTSI01",
						"H_WTSI01SAUTV", "H_WTSI02", "H_WTVR01", "H_WTVR03", "H_WTVR04", "H_WTVR06", "H_WTVR09",
						"H_WTVR10", "H_WTVR11", "H_WTVR12", "H_WTVR13", "H_WTVR14", "H_WTVR15", "H_WTVR17", "H_WTVR30",
						"H_WTVR35", "H_WT1010");
			} catch (Exception e) {
				this.saveHistory(headersEcon, "error", "Thông tin cấu hình loại tài liệu không xác định", lotId, lookup, envelope, contractInfo, laborId, laborName, laborEmail, laborPhone);
				return this.handleReturn("success", "errorGetDocumentConfig", e.getMessage());
			}

			// get SAP data and decrypt
			ContractInfoResponse contractInfoResponse = null;
			try {
				contractInfoResponse = this.getSapContractInfo(headersEcon, contractInfo, custId + "_" + owner);

				if (contractInfoResponse.getData() != null) {
					sapData = contractInfoResponse.getData().getContract_info();
				}
			} catch (Exception e) {
				this.saveHistory(headersEcon, "error", "Lấy thông tin từ SAP lỗi", lotId, lookup, envelope, contractInfo,
						laborId, laborName, laborEmail, laborPhone);
				return this.handleReturn("success", "errorGetSapData", e.getMessage());
			}

			if (sapData == null) {
				this.saveHistory(headersEcon, "error", "Thông tin từ SAP không xác định", lotId, lookup, envelope, contractInfo,
						laborId, laborName, laborEmail, laborPhone);
				return this.handleReturn("success", "errorSapDataUndefined", "SAP data undefined");
			}

			if (sapData != null) {
				byte[] key = hexStringToByteArray(keyHex);
				// Create key and IV specs
				SecretKeySpec secretKeySpec = new SecretKeySpec(key, "AES");

				for (Map.Entry<String, String> entry : sapData.entrySet()) {
					if (encryptField.contains(entry.getKey())) {
						try {

							String hexString = base64ToHex(entry.getValue());
							// giải mã giá trị
							String ivHex = getFirstHalf(hexString);
							// IV in hex
							String encryptedDataHex = getSecondHalf(hexString);

							byte[] encryptedData = hexStringToByteArray(encryptedDataHex);
							byte[] iv = hexStringToByteArray(ivHex);
							IvParameterSpec ivParameterSpec = new IvParameterSpec(iv);

							// Instantiate the cipher
							Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
							// Cipher cipher = Cipher.getInstance("AES/CBC/NoPadding");
							cipher.init(Cipher.DECRYPT_MODE, secretKeySpec, ivParameterSpec);

							// Perform decryption
							byte[] decryptedBytes = cipher.doFinal(encryptedData);
							String decryptValue = new String(decryptedBytes);

							sapData.replace(entry.getKey(), decryptValue);
						} catch (Exception e) {
							sapData.put(entry.getKey(), entry.getValue());
						}
					} else {
						sapData.put(entry.getKey(), entry.getValue());
					}
				}
			}

			// Map SAP data to document
			if (mapDocs != null && sapData != null) {
				for (MapVariableDTO mapDoc : mapDocs) {
					String value = "";
					List<String> sapVariable = mapDoc.getValue();
					if (sapVariable != null) {
						if (sapVariable.size() == 1) {
							value = sapData.get(sapVariable.get(0));
						} else {
							for (String variable : sapVariable) {
								if (sapData.get(variable) != null) {
									value = sapData.get(variable);
									break;
								}
							}
						}

						// create ewriter
						Map<String, Object> docValue = new HashMap<String, Object>();
						docValue.put("name", mapDoc.getName());
						docValue.put("type", "textField");
						docValue.put("value", value);
						mapData.add(docValue);
					}
				}
			}

			// check refId
			List<EnvelopeDTO> lstRefId = new ArrayList<EnvelopeDTO>();
			try {
				lstRefId = this.getListEnvelopeByTicketId(headersEcon, contractInfo.getContract_number());
			} catch (Exception e) {
				this.saveHistory(headersEcon, "error", "Kiểm tra trạng thái khởi tạo hợp đồng lỗi", lotId, lookup, envelope,
						contractInfo, laborId, laborName, laborEmail, laborPhone);
				return this.handleReturn("success", "errorGetEnvelopeByRefId", e.getMessage());
			}
			List<String> lstRefIdExists = new ArrayList<>();
			if (lstRefId != null && lstRefId.size() > 0) {
				for (EnvelopeDTO e : lstRefId) {
					if ("completed".equals(e.getStatus()) && !e.getDisableDocument()) {
						lstRefIdExists.add(e.getId());
					} else if ("processing".equals(e.getStatus())) {
						lstRefIdExists.add(e.getId());
					}
				}
			}
			if (lstRefIdExists.size() > 0) {
				this.saveHistory(headersEcon, "error", "Hợp đồng đã được khởi tạo", lotId, lookup, envelope, contractInfo,
						laborId, laborName, laborEmail, laborPhone);
				return this.handleReturn("success", "errorRefIdExistsFromEcontract", "Reference ID is exists");
			}

			try {
				envelope = this.createEnvelopeDraft(headersEcon, contractInfo, doctypeCode, sapData, templateMappingVariable.getMapHeaderField(), depots);
			} catch (Exception e) {
				this.saveHistory(headersEcon, "error", "Tạo hợp đồng lỗi", lotId, lookup, envelope, contractInfo, laborId,
						laborName, laborEmail, laborPhone);
				return this.handleReturn("success", "errorCreateDraft", e.getMessage());
			}

			// get dossier from ewriter
			List<DocumentInfo> documentInfos = new ArrayList<DocumentInfo>();
			try {
				DocumentInfo documentInfo = this.getDocumentInfo(headersEcon, templateAlias);
				if (documentInfo == null) {
					throw new RuntimeException("Document undefined");
//					return this.handleReturn("success", "errorDocumentUndefined", "Document undefined");
				}
				if ("2".equals(documentInfo.getType())) {
					if (documentInfo.getAliasDTOS() != null && documentInfo.getAliasDTOS().size() > 0) {
						for (DocumentInfo info : documentInfo.getAliasDTOS()) {
//							if ("1".equals(info.getType())) {
							documentInfos.add(info);
//							}
						}
						if (documentInfos.size() == 0) {
							throw new RuntimeException("Document undefined");
//							return this.handleReturn("success", "errorDocumentUndefined", "Document undefined");
						}
					} else {
						documentInfos.add(documentInfo);
					}
				} else {
					// nothing
				}
			} catch (Exception e) {
				this.saveHistory(headersEcon, "error", "Tập tin hợp đồng không xác định", lotId, lookup, envelope, contractInfo,
						laborId, laborName, laborEmail, laborPhone);
				return this.handleReturn("success", "errorGetDocumentInfo", e.getMessage());
			}

			Object partiesO = mapBody.get("parties");
			List<PayloadParty> partiesInfors = mapperClass.mapper().readValue(
					mapperClass.mapper().writeValueAsString(partiesO), new TypeReference<List<PayloadParty>>() {
					});

			List<String> reviewerRcp = new ArrayList<String>();
			if (partiesInfors != null && partiesInfors.size() > 0) {
				for (PayloadParty partiesInfor : partiesInfors) {
					if (partiesInfor.getRecipients() != null && partiesInfor.getRecipients().size() > 0) {
						for (PayloadRecipient rcp : partiesInfor.getRecipients()) {
							if ("reviewer".equals(rcp.getRole())) {
								reviewerRcp.add(rcp.getRecipientId());
							}
						}
					}
				}
			}

			// Mapping document structure and SAP data
			Map<Integer, List<FieldDescriptor>> mapResult = new HashMap<Integer, List<FieldDescriptor>>();
			String uploadDocumentType = documentInfos.size() > 1 ? "DOSSIER" : "DEFAULT";
			for (DocumentInfo documentInfo : documentInfos) {
				Integer order = documentInfos.indexOf(documentInfo) + 1;
				FileEwriterResponse file = this.getFile(headersEcon, documentInfo.getId(), mapData);

				byte[] pdf = Base64.getDecoder().decode(file.getBase64());
				InputStream targetStream = new ByteArrayInputStream(pdf);
				List<FieldDescriptor> result = new ArrayList<>();
				PDDocument document = null;
				try {
					document = PDDocument.load(targetStream);
					result = PdfUtilEWriter.getFieldByMarker(document);
					if (result != null) {
						mapResult.put(order, result);
					}
				} catch (Exception e) {
					e.printStackTrace();
				} finally {
					if (document != null) {
						try {
							document.close();
						} catch (IOException e) {
							// TODO Auto-generated catch block
							e.printStackTrace();
						}
					}
					targetStream.close();
				}

				List<String> rcpList = new ArrayList<String>();
				for (FieldDescriptor field : result) {
					if (!rcpList.contains(field.getRecipientId())) {
						rcpList.add(field.getRecipientId());
					}
				}

				rcpList.addAll(reviewerRcp);

				try {
					envelope = this.uploadEcontractDocument(token, null, pdf, file.getFileName(), envelope, "" + order,
							rcpList, uploadDocumentType);
				} catch (Exception e) {
					this.saveHistory(headersEcon, "error", "Tải hợp đồng lên lỗi", lotId, lookup, envelope, contractInfo,
							laborId, laborName, laborEmail, laborPhone);
					return this.handleReturn("success", "uploadFileError",
							"Upload document " + documentInfo.getId() + " error: " + e.getMessage());
				}
			}

			// update envelope
			List<PartyDTO> parties = new ArrayList<>();
			if (partiesInfors != null && partiesInfors.size() > 0) {
				for (PayloadParty partiesInfor : partiesInfors) {
					PartyDTO party = new PartyDTO();
					party.setId(partiesInfor.getId());
					party.setIndex(null);
					party.setOrder(partiesInfor.getOrder());
					party.setName(partiesInfor.getOrgName());

					if (partiesInfor.getIsMyOrg()) {
						party.setType("my-organization");
						party.setIsMyOrg(true);

					} else if (partiesInfor.getIsOrg()) {
						party.setType("organization");
						party.setIsMyOrg(false);
					} else {
						party.setType("individual");
						party.setIsMyOrg(false);
					}

					party.setFlowType("predefined");
					party.setSignOrder(true);

					List<PayloadRecipient> recipients = partiesInfor.getRecipients();

					List<RecipientDTO> rcps = new ArrayList<>();

					Map<Integer, Map<String, List<FieldDescriptor>>> mapFieldDescByDoc = new HashMap<>();

					for (Map.Entry<Integer, List<FieldDescriptor>> entry : mapResult.entrySet()) {
						Map<String, List<FieldDescriptor>> mapFieldDesc = new HashMap<>();
						Integer docOrder = entry.getKey();
						List<FieldDescriptor> result = entry.getValue();
						for (FieldDescriptor res : result) {
							if (mapFieldDesc.containsKey(res.getRecipientId())) {
								List<FieldDescriptor> rcpField = mapFieldDesc.get(res.getRecipientId());
								rcpField.add(res);
								mapFieldDesc.put(res.getRecipientId(), rcpField);
							} else {
								List<FieldDescriptor> rcpField = new ArrayList<>();
								rcpField.add(res);
								mapFieldDesc.put(res.getRecipientId(), rcpField);
							}
						}
						mapFieldDescByDoc.put(docOrder, mapFieldDesc);
					}

					for (PayloadRecipient recipientInFor : recipients) {
						RecipientDTO rcp = new RecipientDTO();

						rcp.setRole(recipientInFor.getRole());
						rcp.setId(recipientInFor.getRecipientId());
						rcp.setOrder(new Integer(recipientInFor.getOrder()).floatValue());
						rcp.setIndex(recipients.indexOf(recipientInFor));
						rcp.setPartyId(party.getId());

						List<MapFlowDTO> mapFlow = templateMappingVariable.getMapFlow();
						ContactDTO contact = null;
						if (mapFlow != null) {
							for (MapFlowDTO configRcp : mapFlow) {
								if (rcp.getId().equals(configRcp.getId())) {
									Map<String, String> mapContact = new HashMap<String, String>();
									List<MapVariableDTO> cfg = configRcp.getMapFlow();
									if (cfg != null) {
										for (MapVariableDTO vr : cfg) {
											String value = "";
											if (vr.getValue() != null) {
												for (String sapKey : vr.getValue()) {
													if (sapData.get(sapKey) != null
															&& !"".equals(sapData.get(sapKey))) {
														value = sapData.get(sapKey);
														break;
													}
												}
											}
											mapContact.put(vr.getName(), value);
										}
										contact = new ContactDTO(mapContact.get("id"), mapContact.get("name"),
												mapContact.get("email"), mapContact.get("phone"),
												mapContact.get("personalID"));
										if ("individual".equals(party.getType())) {
											laborId = mapContact.get("id");
											laborName = mapContact.get("name");
											laborEmail = mapContact.get("email");
											laborPhone = mapContact.get("phone");
										}
										if (StringUtils.isEmpty(contact.getEmail())
												&& StringUtils.isEmpty(contact.getPhone())) {
											this.saveHistory(headersEcon, "error", "Thông tin người ký không xác định",
													lotId, lookup, envelope, contractInfo, laborId, laborName, laborEmail,
													laborPhone);
											return this.handleReturn("success", "recipientContactUndefined",
													"Recipient Contact undefined " + rcp.getId());
										}
									}
								}
							}
						}

						if (contact == null) {
							contact = new ContactDTO(recipientInFor.getContactId(), recipientInFor.getPersonalName(),
									recipientInFor.getEmail(), recipientInFor.getTelephoneNumber());
						}
						rcp.setContact(contact);

						if (recipientInFor.getRemindLater() != null && !"".equals(recipientInFor.getRemindLater())) {
							rcp.setRemindLater(recipientInFor.getRemindLater());
						}

						// List<String> notifyType = new ArrayList<String>();
						// notifyType.add("email_econtract");
//						rcp.setNotifyTypes(recipientInFor.getNotifyTypes());
						rcp.setSignTypes(recipientInFor.getSignTypes());

						for (Map.Entry<Integer, Map<String, List<FieldDescriptor>>> entry : mapFieldDescByDoc
								.entrySet()) {
							Map<String, List<FieldDescriptor>> mapFieldDesc = entry.getValue();
							String docId = null;

							List<DocumentDTO> envDocuments = envelope.getDocuments();

							for (DocumentDTO docDTO : envDocuments) {
								if (entry.getKey() == docDTO.getOrder()) {
									docId = docDTO.getId();
								}
							}

							List<FieldDescriptor> fieldDescriptors = mapFieldDesc.get(recipientInFor.getRecipientId());
							if (fieldDescriptors != null && fieldDescriptors.size() > 0) {
								for (FieldDescriptor fieldDescriptor : fieldDescriptors) {
									FieldDTO field = new FieldDTO();
									String uuid = UUID.randomUUID().toString().replace("-", "");
									field.setId(uuid);
									field.setType("signature");
									field.setDocId(docId);

									if (FieldDescriptor.Type.DSIGN.equals(fieldDescriptor.getType())) {
										field.setSubType("2");
									} else if (FieldDescriptor.Type.ISIGN.equals(fieldDescriptor.getType())) {
										field.setSubType("4");
									} else if (FieldDescriptor.Type.STEXT.equals(fieldDescriptor.getType())) {
										field.setName(fieldDescriptor.getId());
										field.setId(fieldDescriptor.getId());
										field.setType("text");

										field.setSubType("0_Left");
										field.setColor("0, 0, 0");
										field.setFont("TIMES_NEW_ROMAN");
										field.setFontSize(14);
									}

									if (field.getValidators() == null || field.getValidators().size() == 0) {
										ValidatorDTO required = new ValidatorDTO();
										required.setType("required");
										required.setExpression("true");

										ValidatorDTO fixed = new ValidatorDTO();
										fixed.setType("fixed");
										fixed.setExpression("true");
										field.setValidators(Arrays.asList(required, fixed));

									}
									field.setPage(fieldDescriptor.getPage());

									FieldBoxDTO fieldBox = new FieldBoxDTO();
									fieldBox.setH(fieldDescriptor.getH());
									Integer w = 100;
//									// fieldBox.setW(w.floatValue());
//									if (fieldDescriptor.getW() != null
//											&& Float.compare(w.floatValue(), fieldDescriptor.getW()) > 0) {
//										fieldBox.setW(w.floatValue());
//									} else {
//										fieldBox.setW(fieldDescriptor.getW());
//									}
									fieldBox.setX(fieldDescriptor.getX());
									fieldBox.setY(fieldDescriptor.getY());

									fieldBox.setH(Float.valueOf(90));
									fieldBox.setW(Float.valueOf(164));
									fieldBox.setX(fieldDescriptor.getX());
									fieldBox.setY(fieldDescriptor.getY());
									field.setFieldBox(fieldBox);
									field.setFieldDesign(new FieldDesign());
									field.setRecipientId(recipientInFor.getRecipientId());

									List<FieldDTO> addedField = new ArrayList<>();
									if (rcp.getFields() != null) {
										addedField.addAll(rcp.getFields());
									}

									addedField.add(field);
									rcp.setFields(addedField);
								}
							}
						}

						if (rcp.getFields() == null) {
							rcp.setFields(new ArrayList<>());
						}

						Boolean isEmailExists = StringUtils.isEmpty(contact.getEmail());
						if (rcp.getSignTypes() != null && rcp.getSignTypes().contains("sign_ekyc")
								&& StringUtils.isBlank(rcp.getUsername()) && isEmailExists) {
							try {
								AgreementDetailFPTCaCloudDTO preAgreement = new AgreementDetailFPTCaCloudDTO();
								preAgreement.setType("FCA_PRE");
								preAgreement.setRecipientId(recipientInFor.getRecipientId());
								preAgreement.setEmail(recipientInFor.getEmail());
								preAgreement.setTelephoneNumber(recipientInFor.getTelephoneNumber());
								preAgreement.setPersonalName(recipientInFor.getPersonalName());
								preAgreement.setResourceType("internal");
								preAgreement.setMessageType("EXPLICIT/OTP-NOSEND");

								preAgreement = this.registryFPTCaCloud(headersEcon, preAgreement);
								rcp.setUsername(preAgreement.getAgreementUUID());
							} catch (Exception e) {
							}
						}

						if (isEmailExists) {
							rcp.setNotifyTypes(Arrays.asList("recipient_start_notify_gsm_econtract_sms"));
						} else {
							rcp.setNotifyTypes(Arrays.asList("email_econtract"));
						}

						rcps.add(rcp);
					}
					party.setRecipients(rcps);
					parties.add(party);
				}
			}
			envelope.setParties(parties);
			envelope.setSignOrder(true);
			envelope.setRefId(Arrays.asList(contractInfo.getContract_number()));

			try {
				envelope = this.updateEnvelope(headersEcon, envelope);
			} catch (Exception e) {
				this.saveHistory(headersEcon, "error", "Tạo hợp đồng lỗi", lotId, lookup, envelope, contractInfo, laborId,
						laborName, laborEmail, laborPhone);
				return this.handleReturn("success", "20", "Envelope update error " + " " + e.getMessage());
			}
			try {
				envelope = this.goToProcessing(headersEcon, envelope.getId());
			} catch (Exception e) {
				this.saveHistory(headersEcon, "error", "Tạo hợp đồng lỗi", lotId, lookup, envelope, contractInfo, laborId,
						laborName, laborEmail, laborPhone);
				return this.handleReturn("success", "21", "Envelope processing error " + e.getMessage());
			}
			
			// share depot
			try {
				this.shareDepot(headersEcon, depots, envelope.getId());
			} catch (Exception e) {
			}

			this.saveHistory(headersEcon, "success", "Tạo hợp đồng thành công", lotId, lookup, envelope, contractInfo, laborId,
					laborName, laborEmail, laborPhone);
			return this.handleReturn("success", "success", envelope.getId());
		} catch (Exception ex) {
			this.saveHistory(headersEcon, "error", "Tạo hợp đồng lỗi", lotId, lookup, envelope, contractInfo, laborId,
					laborName, laborEmail, laborPhone);
			return this.handleReturn("success", "-1", ex.getMessage());
		}
	}
	
	private List<HdrFieldDTO> getDoctype(HttpHeaders headersEcon, String doctypeId) throws Exception {
		String url = urlFPTeContract + "/services/envelope/api/doc-types/" + doctypeId;
		HttpEntity<Object> request = new HttpEntity<>(headersEcon);
		
		try {
			ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
			Map<String, Object> envelope = mapperClass.swap(HashMap.class, response.getBody());
			List<HdrFieldDTO> fields = mapperClass.mapper().readValue(mapperClass.mapper().writeValueAsString(envelope.get("fields")),
					new TypeReference<List<HdrFieldDTO>>() {
					});
			return fields;
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}
	
	private Boolean checkTokenExpired(HttpHeaders headersEcon) {
		String url = urlFPTeContract + "/services/batch/api/customer-authen/isExpired";
		HttpEntity<Object> request = new HttpEntity<>(headersEcon);
		ResponseEntity<Boolean> response = restTemplate.exchange(url, HttpMethod.GET, request, Boolean.class);
		return response.getBody();
	}
	
	private void shareDepot(HttpHeaders headersEcon, List<String> depots, String envelopeId) {
		if (depots != null && depots.size() > 0) {
			Map<String, Object> payload = new HashMap<String, Object>();
			payload.put("depot", depots);
			payload.put("envelopeId", envelopeId);

			Map<String, Object> bodyExcall = new HashMap<String, Object>();
			bodyExcall.put("id", null);
			bodyExcall.put("refId", null);
			bodyExcall.put("selector", "flow_processing_gsm_share_depot");
			bodyExcall.put("lookup", envelopeId);
			bodyExcall.put("attrs", new Object());
			bodyExcall.put("payload", null);
			bodyExcall.put("body", payload);

			HttpEntity<Object> entity = new HttpEntity<>(bodyExcall, headersEcon);
			String url = urlFPTeContract + "/services/excall/api/excall";
			try {
				this.restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
			} catch (HttpStatusCodeException e) {
			}
		}
	}

	private TemplateMappingVariableDTO findByDocTypeCode(HttpHeaders headersEcon, String templateAlias, Long custId) {
		String url = urlFPTeContract + "/services/batch/api/template-mapping-variables/" + templateAlias;
		HttpEntity<Object> entity = new HttpEntity<>(headersEcon);
		try {
			ResponseEntity<TemplateMappingVariableDTO> res = restTemplate.exchange(url, HttpMethod.GET, entity, TemplateMappingVariableDTO.class);
			return res.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	private void saveHistory(HttpHeaders headersEcon, String status, String message, String lotId, String lookup, EnvelopeDTO envelope,
			ContractInfo info, String laborId, String laborName, String laborEmail, String laborPhone) {
		String url = urlFPTeContract + "/services/batch/api/sap-create-histories";

		try {
			String id = null;
			if (envelope != null) {
				id = envelope.getId();
			}
			
			if (info == null) {
				info = new ContractInfo();
			}

			Map<String, Object> body = new HashMap<String, Object>();
			body.put("id", null);
			body.put("lotId", lotId);
			body.put("contractName", lookup);
			body.put("uid", info.getUid());
			body.put("username", info.getUsername());
			body.put("contractNumber", info.getContract_number());
			body.put("contractType", info.getContract_type());
			body.put("signedDate", info.getSigned_date());
			body.put("startDate", info.getStart_date());
			body.put("endDate", info.getEnd_date());
			body.put("laborId", laborId);
			body.put("laborName", laborName);
			body.put("laborEmail", laborEmail);
			body.put("laborPhone", laborPhone);
			body.put("status", status);
			body.put("message", message);
			body.put("envelopeId", id);

			HttpEntity<Object> request = new HttpEntity<>(body, headersEcon);
			restTemplate.postForEntity(url, request, String.class);
			
		} catch (HttpStatusCodeException e) {
//			throw new RuntimeException(e.getResponseBodyAsString());
		}
		internalExcallService.redisDeleteRefId(lookup);
	}

	private AgreementDetailFPTCaCloudDTO registryFPTCaCloud(HttpHeaders headersEcon, AgreementDetailFPTCaCloudDTO dto)
			throws Exception {

		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		try {
			String registryFPTCaCloudUrl = "/services/envelope/api/cacloud/registry/raw";
			HttpEntity<Object> request = new HttpEntity<>(dto, headersEcon);
			ResponseEntity<AgreementDetailFPTCaCloudDTO> requestEcontract = restTemplate.postForEntity(
					urlFPTeContract + registryFPTCaCloudUrl, request, AgreementDetailFPTCaCloudDTO.class);
			return requestEcontract.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	private EnvelopeDTO goToProcessing(HttpHeaders headersEcon, String envelopeId) throws Exception {
		String goToUrl = "/services/envelope/api/envelope/" + envelopeId + "/processing";

		HttpEntity<Object> entityEnvelope = new HttpEntity<>(headersEcon);
		try {
			ResponseEntity<EnvelopeDTO> requestEcontract4 = restTemplate.exchange(urlFPTeContract + goToUrl,
					HttpMethod.PUT, entityEnvelope, EnvelopeDTO.class);

			return requestEcontract4.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	private EnvelopeDTO updateEnvelope(HttpHeaders headersEcon, EnvelopeDTO envelope) throws Exception {
		String createEnvelope = "/services/envelope/api/envelope/" + envelope.getId();

//		envelope.setFlowFinish(Arrays.asList("flow_finish_slvn_econtract_integrate"));
		HttpEntity<Object> entityEnvelope = new HttpEntity<>(envelope, headersEcon);
		try {
			ResponseEntity<EnvelopeDTO> requestEcontract3 = restTemplate.exchange(urlFPTeContract + createEnvelope,
					HttpMethod.PUT, entityEnvelope, EnvelopeDTO.class);
			return requestEcontract3.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	private EnvelopeDTO uploadEcontractDocument(String token, String refId, byte[] valuePdfContract, String fileName,
			EnvelopeDTO envelope, String order, List<String> docRecipient, String type) throws Exception {
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.set("Authorization", token);

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
		fileInfos.put("type", type);
		fileInfos.put("order", order);
		fileInfos.put("docRefId", refId);
		if (docRecipient != null && "DOSSIER".equals(type)) {
			fileInfos.put("recipientList", docRecipient);
		}

		MultiValueMap<String, Object> map = new LinkedMultiValueMap<>();
		map.add("files", fileEntity);
		// fileInfos example: "[{\"type\":\"DOSSIER\",\"order\":" + order +
		// ",\"docRefId\":" + refId + "}]";
		map.add("fileInfos", mapperClass.mapper().writeValueAsString(Arrays.asList(fileInfos)));
		map.add("id", envelope.getId());

		headersEcon.setContentType(MediaType.MULTIPART_FORM_DATA);
		try {
			HttpEntity<MultiValueMap<String, Object>> requestUpload = new HttpEntity<>(map, headersEcon);

			ResponseEntity<EnvelopeDTO> requestEcontract2 = restTemplate.postForEntity(url2, requestUpload,
					EnvelopeDTO.class);
			envelope = requestEcontract2.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
		return envelope;
	}

	public FileEwriterResponse getFile(HttpHeaders headersEcon, String docId, List<Map<String, Object>> bodyEwriter)
			throws Exception {
		String urlGetFile = urlEwriter + "/api/internal/documents/exportFile?filePdf=true&documentId=" + docId;
		HttpEntity<Object> entity = new HttpEntity<>(mapperClass.mapper().writeValueAsString(bodyEwriter), headersEcon);

		try {
			ResponseEntity<FileEwriterResponse> response = restTemplate.exchange(urlGetFile, HttpMethod.POST, entity,
					FileEwriterResponse.class);
			FileEwriterResponse body = response.getBody();
			if (body != null) {
				String name = body.getFileName();
				String[] names = name.split("\\.");
				if (names != null && names.length > 1) {
					names[names.length - 1] = "pdf";
					name = String.join(".", names);
					body.setFileName(name);
				}
			}
			return body;
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

	private EnvelopeDTO createEnvelopeDraft(HttpHeaders headersEcon, ContractInfo contractInfo, String docTypeId, Map<String, String> sapData, List<MapVariableDTO> mapHeaderField, List<String> depot)
			throws Exception {
		List<HdrFieldDTO> fields = new ArrayList<HdrFieldDTO>();
		List<HdrFieldDTO> _fields = this.getDoctype(headersEcon, docTypeId);
		for (HdrFieldDTO field : _fields) {
			if ("envName".equals(field.getId())) {
				field.setValue(contractInfo.getContract_number());
			} else if ("envF09".equals(field.getId())) {
				if (depot != null && depot.size() > 0) {
					field.setValue(depot.get(0));
				}
			} else {
				if (mapHeaderField != null && mapHeaderField.size() > 0) {
					MapVariableDTO config = null;
					for (MapVariableDTO mvd : mapHeaderField) {
						if (field.getId().equals(mvd.getName())) {
							config = mvd;
						}
					}
					if (config != null && config.getValue() != null && config.getValue().size() > 0) {
						String value = null;
						List<String> sapVariable = config.getValue();
						if (sapVariable != null) {
							if (sapVariable.size() == 1) {
								value = sapData.get(sapVariable.get(0));
							} else {
								for (String variable : sapVariable) {
									if (sapData.get(variable) != null) {
										value = sapData.get(variable);
										break;
									}
								}
							}
						}
						field.setValue(value);
					}
				}
			}
			fields.add(field);
		}
		
//		HdrFieldDTO fieldName = new HdrFieldDTO("envName", "Tên hợp đồng", "String", contractInfo.getContract_number(),
//				null, null);
//		HdrFieldDTO fieldEnvNo = new HdrFieldDTO("envNo", "Số hợp đồng", "String", contractInfo.getContract_number(),
//				null, null);
//		HdrFieldDTO fieldEnvDate = new HdrFieldDTO("envDate", "Ngày ký", "Date", null, null, null);
//		List<HdrFieldDTO> fields = Arrays.asList(fieldName, fieldEnvNo, fieldEnvDate);

		Map<String, Object> body = new HashMap<String, Object>();
		body.put("fields", fields);
		body.put("isStep", false);
		body.put("refId", contractInfo.getContract_number());
		body.put("docTypeId", docTypeId);

		EnvelopeDTO envelope;
		try {
			String createEnvelope = "/services/envelope/api/envelope/v2";
			HttpEntity<Object> request = new HttpEntity<>(body, headersEcon);

			ResponseEntity<EnvelopeDTO> requestEcontract1 = restTemplate.postForEntity(urlFPTeContract + createEnvelope,
					request, EnvelopeDTO.class);

			envelope = requestEcontract1.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
		return envelope;
	}

	public List<EnvelopeDTO> getListEnvelopeByTicketId(HttpHeaders headersEcon, String refId) {
		try {
			String urlRefId = "/services/envelope/api/external/v1/envelope/refId";
			Map<String, String> bodyParamsRefId = new HashMap<String, String>();
			bodyParamsRefId.put("refId", refId);

			HttpEntity<Object> entityRefId = new HttpEntity<>(bodyParamsRefId, headersEcon);

			ResponseEntity<List<EnvelopeDTO>> requestEcontractRefId = restTemplate.exchange(urlFPTeContract + urlRefId,
					HttpMethod.POST, entityRefId, new ParameterizedTypeReference<List<EnvelopeDTO>>() {
					});
			return requestEcontractRefId.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	private ContractInfoResponse getSapContractInfo(HttpHeaders headersEcon, ContractInfo info, String email) throws Exception {
		try {
			String token = "Bearer " + this.getSapToken(headersEcon, email);
			HttpHeaders headers = new HttpHeaders();
			headers.setContentType(MediaType.APPLICATION_JSON);
			headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
			headers.set("client_id", client_id);
			headers.set("client_secret", client_secret);
			headers.set("api_key", api_key);
			headers.set("country_code", country_code);
			headers.set("Authorization", token);

			String startDate = info.getStart_date();
			String[] _startDate = startDate.split("-");
			if (_startDate != null && _startDate.length == 3) {
				startDate = _startDate[2] + _startDate[1] + _startDate[0];
			}

			Map<String, Object> bodySap = new HashMap<String, Object>();
			bodySap.put("uid", info.getUid());
			bodySap.put("contract_type", info.getContract_type());
			bodySap.put("start_date", startDate);
			// bodySap.put("uid", "6000065");
			// bodySap.put("contract_type", "V024");
			// bodySap.put("start_date", "20230426");

			HttpEntity<Object> request = new HttpEntity<>(bodySap, headers);
			ResponseEntity<ContractInfoResponse> response = restTemplate.postForEntity(urlSAP, request,
					ContractInfoResponse.class);
			return response.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	private String getSapToken(HttpHeaders headersEcon, String id) throws Exception {
		String token = null;
		String url = urlFPTeContract + "/services/batch/api/customer-authen/" + id;
        HttpEntity<String> entity = new HttpEntity<>(headersEcon);
        ResponseEntity<CustomerAuthenDTO> response = restTemplate.exchange(url, HttpMethod.GET, entity, CustomerAuthenDTO.class);
        String content = response.getBody().getContent();
		if (!StringUtils.isEmpty(content)) {
			Map<String, String> mapContent = mapperClass.swap(Map.class, content);
			if (mapContent.containsKey("id_token")) {
				token = mapContent.get("id_token");
			}
		}
		
		if (StringUtils.isEmpty(token)) {
			throw new RuntimeException("No authentication");
		} else {
			return token;
		}
	}

	public static byte[] hexStringToByteArray(String s) {
		int len = s.length();
		byte[] data = new byte[len / 2];
		for (int i = 0; i < len; i += 2) {
			data[i / 2] = (byte) ((Character.digit(s.charAt(i), 16) << 4) + Character.digit(s.charAt(i + 1), 16));
		}
		return data;
	}

	public static String getSecondHalf(String str) {
		int halfLength = str.length() / 2;
		return str.substring(32, str.length());
	}

	public static String getFirstHalf(String str) {
		int halfLength = str.length() / 2;
		return str.substring(0, 32);
	}

	public static String base64ToHex(String base64String) {
		// Decode Base64 string to byte array
		byte[] decodedBytes = Base64.getDecoder().decode(base64String);

		// Convert byte array to hex string
		StringBuilder hexString = new StringBuilder();
		for (byte b : decodedBytes) {
			// Convert each byte to a 2-digit hex value
			String hex = String.format("%02x", b);
			hexString.append(hex);
		}

		return hexString.toString();
	}

	private String handleReturn(String status, String message, String result) throws Exception {
		Map<String, String> rtn = new HashMap<String, String>();
		rtn.put("status", status);
		rtn.put("message", message);
		rtn.put("result", result);
		return mapperClass.mapper().writeValueAsString(rtn);
	}

	private static class FileEwriterResponse implements Serializable {
		private static final long serialVersionUID = 1L;

		private String fileName;
		private String base64;

		public String getFileName() {
			return fileName;
		}

		public void setFileName(String fileName) {
			this.fileName = fileName;
		}

		public String getBase64() {
			return base64;
		}

		public void setBase64(String base64) {
			this.base64 = base64;
		}
	}

	private static class PayloadParty implements Serializable {
		private static final long serialVersionUID = 1L;

		private String id;
		private Boolean isMyOrg;
		private Boolean isOrg;
		private String orgName;
		private Integer order;
		private List<PayloadRecipient> recipients;

		public String getId() {
			return id;
		}

		public void setId(String id) {
			this.id = id;
		}

		public Boolean getIsMyOrg() {
			return isMyOrg;
		}

		public void setIsMyOrg(Boolean isMyOrg) {
			this.isMyOrg = isMyOrg;
		}

		public Boolean getIsOrg() {
			return isOrg;
		}

		public void setIsOrg(Boolean isOrg) {
			this.isOrg = isOrg;
		}

		public String getOrgName() {
			return orgName;
		}

		public void setOrgName(String orgName) {
			this.orgName = orgName;
		}

		public Integer getOrder() {
			return order;
		}

		public void setOrder(Integer order) {
			this.order = order;
		}

		public List<PayloadRecipient> getRecipients() {
			return recipients;
		}

		public void setRecipients(List<PayloadRecipient> recipients) {
			this.recipients = recipients;
		}
	}

	private static class PayloadRecipient implements Serializable {
		private static final long serialVersionUID = 1L;

		private String recipientId;
		private String email;
		private String personalName;
		private String telephoneNumber;
		private String contactId;
		private String role;
		private Integer order;
		private List<String> notifyTypes;
		private List<String> signTypes;
		private Integer remindLater;

		public String getRecipientId() {
			return recipientId;
		}

		public void setRecipientId(String recipientId) {
			this.recipientId = recipientId;
		}

		public String getEmail() {
			return email;
		}

		public void setEmail(String email) {
			this.email = email;
		}

		public String getPersonalName() {
			return personalName;
		}

		public void setPersonalName(String personalName) {
			this.personalName = personalName;
		}

		public String getTelephoneNumber() {
			return telephoneNumber;
		}

		public void setTelephoneNumber(String telephoneNumber) {
			this.telephoneNumber = telephoneNumber;
		}

		public String getContactId() {
			return contactId;
		}

		public void setContactId(String contactId) {
			this.contactId = contactId;
		}

		public String getRole() {
			return role;
		}

		public void setRole(String role) {
			this.role = role;
		}

		public Integer getOrder() {
			return order;
		}

		public void setOrder(Integer order) {
			this.order = order;
		}

		public List<String> getNotifyTypes() {
			return notifyTypes;
		}

		public void setNotifyTypes(List<String> notifyTypes) {
			this.notifyTypes = notifyTypes;
		}

		public List<String> getSignTypes() {
			return signTypes;
		}

		public void setSignTypes(List<String> signTypes) {
			this.signTypes = signTypes;
		}

		public Integer getRemindLater() {
			return remindLater;
		}

		public void setRemindLater(Integer remindLater) {
			this.remindLater = remindLater;
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

	private static class ContractInfo implements Serializable {
		private static final long serialVersionUID = 1L;

		private String uid;
		private String username;
		private String contract_number;
		private String contract_type;
		private String signed_date;
		private String start_date;
		private String end_date;
		private String sub_pnl_code;
		private String is_labor_contract;

		public String getUid() {
			return uid;
		}

		public void setUid(String uid) {
			this.uid = uid;
		}

		public String getUsername() {
			return username;
		}

		public void setUsername(String username) {
			this.username = username;
		}

		public String getContract_number() {
			return contract_number;
		}

		public void setContract_number(String contract_number) {
			this.contract_number = contract_number;
		}

		public String getContract_type() {
			return contract_type;
		}

		public void setContract_type(String contract_type) {
			this.contract_type = contract_type;
		}

		public String getSigned_date() {
			return signed_date;
		}

		public void setSigned_date(String signed_date) {
			this.signed_date = signed_date;
		}

		public String getStart_date() {
			return start_date;
		}

		public void setStart_date(String start_date) {
			this.start_date = start_date;
		}

		public String getEnd_date() {
			return end_date;
		}

		public void setEnd_date(String end_date) {
			this.end_date = end_date;
		}

		public String getSub_pnl_code() {
			return sub_pnl_code;
		}

		public void setSub_pnl_code(String sub_pnl_code) {
			this.sub_pnl_code = sub_pnl_code;
		}

		public String getIs_labor_contract() {
			return is_labor_contract;
		}

		public void setIs_labor_contract(String is_labor_contract) {
			this.is_labor_contract = is_labor_contract;
		}
	}

	private static class ContractInfoResponse implements Serializable {
		private static final long serialVersionUID = 1L;

		private DataCIR data;
		private ResultCIR result;

		public DataCIR getData() {
			return data;
		}

		public void setData(DataCIR data) {
			this.data = data;
		}

		public ResultCIR getResult() {
			return result;
		}

		public void setResult(ResultCIR result) {
			this.result = result;
		}
	}

	private static class DataCIR implements Serializable {
		private static final long serialVersionUID = 1L;

		private Map<String, String> contract_info;

		public Map<String, String> getContract_info() {
			return contract_info;
		}

		public void setContract_info(Map<String, String> contract_info) {
			this.contract_info = contract_info;
		}
	}

	private static class ResultCIR implements Serializable {
		private static final long serialVersionUID = 1L;

		private String code;
		private String message;
		private String description;

		public String getCode() {
			return code;
		}

		public void setCode(String code) {
			this.code = code;
		}

		public String getMessage() {
			return message;
		}

		public void setMessage(String message) {
			this.message = message;
		}

		public String getDescription() {
			return description;
		}

		public void setDescription(String description) {
			this.description = description;
		}
	}

	private static class TemplateMappingVariableDTO implements Serializable {
		private static final long serialVersionUID = 1L;

		private Long id;
		private String docTypeCode;
		private List<MapVariableDTO> mapDoc;
		private List<MapFlowDTO> mapFlow;
		private List<MapVariableDTO> mapHeaderField;
		private String status;
		private Long custId;
		private String orgIn;
		private ZonedDateTime createdDate;
		private String createdBy;
		public Long getId() {
			return id;
		}
		public void setId(Long id) {
			this.id = id;
		}
		public String getDocTypeCode() {
			return docTypeCode;
		}
		public void setDocTypeCode(String docTypeCode) {
			this.docTypeCode = docTypeCode;
		}
		public List<MapVariableDTO> getMapDoc() {
			return mapDoc;
		}
		public void setMapDoc(List<MapVariableDTO> mapDoc) {
			this.mapDoc = mapDoc;
		}
		public List<MapFlowDTO> getMapFlow() {
			return mapFlow;
		}
		public void setMapFlow(List<MapFlowDTO> mapFlow) {
			this.mapFlow = mapFlow;
		}
		public String getStatus() {
			return status;
		}
		public void setStatus(String status) {
			this.status = status;
		}
		public Long getCustId() {
			return custId;
		}
		public void setCustId(Long custId) {
			this.custId = custId;
		}
		public String getOrgIn() {
			return orgIn;
		}
		public void setOrgIn(String orgIn) {
			this.orgIn = orgIn;
		}
		public ZonedDateTime getCreatedDate() {
			return createdDate;
		}
		public void setCreatedDate(ZonedDateTime createdDate) {
			this.createdDate = createdDate;
		}
		public String getCreatedBy() {
			return createdBy;
		}
		public void setCreatedBy(String createdBy) {
			this.createdBy = createdBy;
		}
		public List<MapVariableDTO> getMapHeaderField() {
			return mapHeaderField;
		}
		public void setMapHeaderField(List<MapVariableDTO> mapHeaderField) {
			this.mapHeaderField = mapHeaderField;
		}
	}
	
	private static class MapVariableDTO implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String name;
		private List<String> value;
		private Boolean decryption;
		public String getName() {
			return name;
		}
		public void setName(String name) {
			this.name = name;
		}
		public List<String> getValue() {
			return value;
		}
		public void setValue(List<String> value) {
			this.value = value;
		}
		public Boolean getDecryption() {
			return decryption;
		}
		public void setDecryption(Boolean decryption) {
			this.decryption = decryption;
		}
	}
	
	private static class MapFlowDTO implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String id;
		private List<MapVariableDTO> mapFlow;
		public String getId() {
			return id;
		}
		public void setId(String id) {
			this.id = id;
		}
		public List<MapVariableDTO> getMapFlow() {
			return mapFlow;
		}
		public void setMapFlow(List<MapVariableDTO> mapFlow) {
			this.mapFlow = mapFlow;
		}
	}
}
