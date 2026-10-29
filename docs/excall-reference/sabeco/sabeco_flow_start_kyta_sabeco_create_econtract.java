// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/sabeco_flow_start_kyta_sabeco_create_econtract.java
// Secret đã thay bằng "<REDACTED>" (4 chỗ).
package com.fis.excall.service.test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.Serializable;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.apache.commons.lang3.StringUtils;
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
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fis.envelope.pdfutil.PdfUtilEWriter;
import com.fis.envelope.pdfutil.field.FieldDescriptor;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.domain.BASE64DecodedMultipartFile;
import com.fis.excall.service.envelope.dto.AgreementDetailFPTCaCloudDTO;
import com.fis.excall.service.envelope.dto.DataDTO;
import com.fis.excall.service.envelope.dto.DocumentDTO;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;
import com.fis.excall.service.envelope.dto.EnvelopeErqDTO;
import com.fis.excall.service.envelope.dto.FieldBoxDTO;
import com.fis.excall.service.envelope.dto.FieldDTO;
import com.fis.excall.service.envelope.dto.FieldDesign;
import com.fis.excall.service.envelope.dto.LotDataDTO;
import com.fis.excall.service.envelope.dto.PartyDTO;
import com.fis.excall.service.envelope.dto.RecipientDTO;
import com.fis.excall.service.envelope.dto.RequesterDTO;
import com.fis.excall.service.envelope.dto.ValidatorDTO;

import software.amazon.awssdk.services.s3.S3Client;

@Service
public class sabeco_flow_start_kyta_sabeco_create_econtract {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	private RestTemplate restTemplate;
	
	@Autowired
	private EnvelopeClient envelopeClients; 
	
	@Autowired
	private MapperClass mapperClass;
	
	@Autowired
	private UaaClient uaaClient;

//	@Autowired
	private S3Client s3Client;
	
	private static final String username = "<REDACTED>";
	private static final String password = "<REDACTED>";
	private static final String client_id = "<REDACTED>";
	private static final String client_secret = "<REDACTED>";
	
	private static final String ownerEcontract = "econcadastest@gmail.com";
	
	// private static final String urlFPTeContract = "https://10.14.121.18:30600/app";
	private static final String urlFPTeContract = "https://demo.econtract.fpt.com/app";
    // private static final String urlFPTeContract = "https://econtract.fpt.com/app";
	
	// private static final String urlErequest = "https://10.14.121.10/app";
	private static final String urlErequest = "https://erequest-uat.sabeco-app.vn";
    // private static final String urlErequest = "https://erequest.kyta.fpt.com";
	
	private static final String urlUaaSabeco = "https://eaccount-uat.sabeco-app.vn";

	public String creatingEnvelope(String payload) throws Exception {
		Map<String, Object> body = mapperClass.swap(HashMap.class, payload);
		String owner = String.valueOf(body.get("owner"));
		EnvelopeDTO envelope = null;
		String envelopeId = null;

		OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(ownerEcontract);
		String token = "Bearer " + accessToken.getValue();
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", token);
		
		try {
			String sbcAccessToken = "Bearer " + this.getAccessToken();
			HttpHeaders headersSbc = new HttpHeaders();
			headersSbc.setContentType(MediaType.APPLICATION_JSON);
			headersSbc.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
			headersSbc.set("Authorization", sbcAccessToken);
			
			List<PayloadFile> files = mapperClass.mapper().readValue(
					mapperClass.mapper().writeValueAsString(body.get("files")), new TypeReference<List<PayloadFile>>() {
					});
//			mapperClass.swap(List.class, body.get("files"));
			PayloadRemind remind = mapperClass.swap(PayloadRemind.class, body.get("remind"));
			Boolean isDossier = false;
			Boolean hasFile = false;
			if (body.get("envelopeId") != null) {
				envelopeId = String.valueOf(body.get("envelopeId"));
			}
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
			String templateId = String.valueOf(body.get("templateId"));
			Object customData = body.get("customData");
			Object inputData = body.get("inputData");
			LotDataDTO lotData = new LotDataDTO();

			if (inputData != null) {
				lotData = mapperClass.swap(LotDataDTO.class, inputData);
			}

			lotData.setEnvelopeId(envelopeId);
			lotData.setTemplateId(templateId);
			lotData.setAlias("");
			lotData.setSyncType("sync");

			if (files != null && files.size() > 0) {
				for (PayloadFile file : files) {
					if ("DOSSIER".equals(file.getType()) || "DEFAULT".equals(file.getType())) {
						hasFile = true;
					}
					if ("DOSSIER".equals(file.getType())) {
						isDossier = true;
					}
				}
			}
			
			if (!hasFile) {
				return this.handleReturn("error", "4", "File undefined", headersEcon, envelopeId);
			}

			List<AgreementDetailFPTCaCloudDTO> agrementDetailFPTCAClouds = new ArrayList<>();
			if (customData != null) {
				agrementDetailFPTCAClouds = mapperClass.mapper().readValue(
						mapperClass.mapper().writeValueAsString(customData),
						new TypeReference<List<AgreementDetailFPTCaCloudDTO>>() {
						});
			}

			if (agrementDetailFPTCAClouds != null && agrementDetailFPTCAClouds.size() > 0) {
				if (!"sync".equals(lotData.getSyncType())) {
					return this.handleReturn("error", "1", "requestTypeNotSync", headersEcon, envelopeId);
				}
				for (AgreementDetailFPTCaCloudDTO agrementDetailFPTCACloud : agrementDetailFPTCAClouds) {
					if ("fca".equals(agrementDetailFPTCACloud.getType())) {
						if ((agrementDetailFPTCACloud.getPhotoFrontSideIDCard() == null
								|| !(agrementDetailFPTCACloud.getPhotoFrontSideIDCard().length > 0))
								|| (agrementDetailFPTCACloud.getPhotoBackSideIDCard() == null
										|| !(agrementDetailFPTCACloud.getPhotoBackSideIDCard().length > 0))) {
							return this.handleReturn("error", "2", "emptyImagePersonalEkyc", headersEcon, envelopeId);
						}
					}
					List<DataDTO> dataDTOs = lotData.getDatas().get(0);
					for (DataDTO dataDTO : dataDTOs) {
						if (("fca".equals(dataDTO.getType()) || "fca_pre".equals(dataDTO.getType()))
								&& agrementDetailFPTCACloud.getRecipientId().equals(dataDTO.getId())) {
							String agrementDetailFPTCACloudValue = mapperClass.mapper()
									.writeValueAsString(agrementDetailFPTCACloud);
							dataDTO.setValue(agrementDetailFPTCACloudValue);
						}
					}
				}
			}

			try {
				envelope = this.createEnvelopeDraft(headersEcon, lotData);
				envelopeId = envelope.getId();
			} catch (HttpStatusCodeException e) {
				return this.handleReturn("error", "3", e.getResponseBodyAsString(), headersEcon, envelopeId);
			}

			Map<Integer, PayloadFile> mapEwiterDocumentId = new HashMap<Integer, PayloadFile>();
			if (files != null && files.size() > 0) {
				for (int i = 0; i < files.size(); i++) {
					PayloadFile fi = files.get(i);
					fi.setFileType(this.getFileExtension(fi.getKeyName()));
					try {
						if (!StringUtils.isEmpty(fi.getId())) {
							String uploadFile = this.getFile(headersSbc, ticketId, userTaskId, fi.getId());
							if (uploadFile == null) {
								return this.handleReturn("error", "4", "File pdf is underfined", headersEcon, envelopeId);
							}
							fi.setFile(uploadFile);
							mapEwiterDocumentId.put(fi.getOrder(), fi);
						} else {
							String uploadFile = this.getFileFromBucket(headersSbc, fi.getBucketName(), fi.getKeyName());
							if (uploadFile == null) {
								return this.handleReturn("error", "4", "File pdf is underfined", headersEcon, envelopeId);
							}
							fi.setFile(uploadFile);
							mapEwiterDocumentId.put(fi.getOrder(), fi);
						}
					} catch (Exception e) {
						return this.handleReturn("error", "4" + fi.getFileName() + " ", e.getMessage(), headersEcon, envelopeId);
					}
				}
			}
			
			List<String> allRcps = new ArrayList<String>();
			if (envelope.getParties() != null) {
				for (PartyDTO party : envelope.getParties()) {
					for (RecipientDTO recipient : party.getRecipients()) {
							allRcps.add(recipient.getId());
						}
					}
			}

			Boolean isMarkerResultUndefined = true;
			if (mapEwiterDocumentId != null && mapEwiterDocumentId.size() > 0) {
				for (Map.Entry<Integer, PayloadFile> entry : mapEwiterDocumentId.entrySet()) {
					PayloadFile pf = entry.getValue();
					List<String> types = Arrays.asList("DEFAULT", "DOSSIER");
					if (types.contains(pf.getType()) && "pdf".equals(pf.getFileType())) {
						String pdf = pf.getFile();
						// read marker in document
						byte[] valuePdfContract = Base64.getDecoder().decode(pdf);
//						byte[] valuePdfContract = pf.getFilebyte();
						InputStream targetStream = new ByteArrayInputStream(valuePdfContract);
						List<FieldDescriptor> result = new ArrayList<>();

						PDDocument document = null;
						try {
							document = PDDocument.load(targetStream);
							result = PdfUtilEWriter.getFieldByMarker(document);
							if (result != null) {
								isMarkerResultUndefined = false;

								List<String> recipientList = new ArrayList<String>();

								for (FieldDescriptor fd : result) {
									if (!recipientList.contains(fd.getRecipientId())) {
										recipientList.add(fd.getRecipientId());
									}
								}
								pf.setRecipientList(recipientList);
								pf.setMarkerResult(result);

								mapEwiterDocumentId.put(entry.getKey(), pf);
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
					} else {
						pf.setRecipientList(allRcps);
						mapEwiterDocumentId.put(entry.getKey(), pf);
					}
				}
			}

			// check all result is null
			if (isMarkerResultUndefined) {
				return this.handleReturn("error", "6", "isNotExistsMarkerField", headersEcon, envelopeId);
			}

			// upload envelope document
			for (Map.Entry<Integer, PayloadFile> entry : mapEwiterDocumentId.entrySet()) {
				PayloadFile pf = entry.getValue();
				try {
					envelope = this.uploadDocument(isDossier, headersEcon, envelope, pf);
					List<DocumentDTO> documents = envelope.getDocuments();
					if (documents != null && documents.size() > 0) {
						for (DocumentDTO doc : documents) {
							if (pf.getId().equals(doc.getDocRefId())) {
								pf.setFileUploadId(doc.getId());
							}
						}
					}
					mapEwiterDocumentId.put(entry.getKey(), pf);
				} catch (Exception e) {
					return this.handleReturn("error", "5", e.getMessage(), headersEcon, envelopeId);
				}
			}

			if (envelope.getParties() != null) {
				for (PartyDTO party : envelope.getParties()) {
					for (RecipientDTO recipient : party.getRecipients()) {
						if ("cecaStamp".equals(recipient.getRole()) || "cecaSeal".equals(recipient.getRole())) {
							continue;
						}

						Integer signatureCount = 0;
						Boolean multipleDigitalSignInSameDocument = false;
//						List<String> multipleSignInDoc = new ArrayList<String>();
						for (Map.Entry<Integer, PayloadFile> entry : mapEwiterDocumentId.entrySet()) {
							Integer digitalSignatureCount = 0;
							PayloadFile pf = entry.getValue();
							List<FieldDescriptor> fieldDescriptors = pf.getMarkerResult();
							if (fieldDescriptors != null && fieldDescriptors.size() > 0) {
								for (FieldDescriptor fieldDescriptor : fieldDescriptors) {
									if (recipient.getId().equals(fieldDescriptor.getRecipientId())) {
										if (FieldDescriptor.Type.DSIGN.equals(fieldDescriptor.getType())
												|| FieldDescriptor.Type.IMAGEDIGITALSIGN
														.equals(fieldDescriptor.getType())) {
											signatureCount += 1;
											digitalSignatureCount += 1;
										}
										if (FieldDescriptor.Type.ISIGN.equals(fieldDescriptor.getType())) {
											signatureCount += 1;
										}
									}
								}
							}
							if (digitalSignatureCount > 1) {
								multipleDigitalSignInSameDocument = true;
							}
						}

						if ("reviewer".equals(recipient.getRole()) && signatureCount > 0) {
							// reviewer có chân ký
							return this.handleReturn("error", "8", recipient.getId() + "_reviewerHasSignature",
									headersEcon, envelopeId);
						}

						if (!"reviewer".equals(recipient.getRole()) && signatureCount == 0) {
							// ko có chân ký nào
							return this.handleReturn("error", "14", recipient.getId() + "_recipientNotHaveSignature",
									headersEcon, envelopeId);
						}

						if (!"reviewer".equals(recipient.getRole()) && multipleDigitalSignInSameDocument) {
							// có nhiều chân ký số
							return this.handleReturn("error", "7", recipient.getId() + "_recipientHasMultiSignature",
									headersEcon, envelopeId);
						}

						// check recipient signtypes và chân ký

						List<FieldDTO> fields = new ArrayList<FieldDTO>();
						for (Map.Entry<Integer, PayloadFile> entry : mapEwiterDocumentId.entrySet()) {
							PayloadFile pf = entry.getValue();
							List<FieldDescriptor> fieldDescriptors = pf.getMarkerResult();
							if (fieldDescriptors != null && fieldDescriptors.size() > 0) {
								for (FieldDescriptor fieldDescriptor : fieldDescriptors) {
									if (recipient.getId().equals(fieldDescriptor.getRecipientId())) {
										FieldDTO field = new FieldDTO();
										String uuid = UUID.randomUUID().toString().replace("-", "");
										field.setId(uuid);
										field.setType("signature");
										field.setDocId(pf.getFileUploadId());
										if (FieldDescriptor.Type.IMAGEDIGITALSIGN.equals(fieldDescriptor.getType())) {
											field.setSubType("3");
										} else if (FieldDescriptor.Type.DSIGN.equals(fieldDescriptor.getType())) {
											field.setSubType("2");
										} else if (FieldDescriptor.Type.ISIGN.equals(fieldDescriptor.getType())) {
											field.setSubType("1");
										} else if (FieldDescriptor.Type.STEXT.equals(fieldDescriptor.getType())) {
											field.setName(fieldDescriptor.getId());
											field.setId(fieldDescriptor.getId());
											field.setType("text");

											FieldDTO fieldRecipientInfor = this.findFieldById(recipient,
													fieldDescriptor.getId());
											if (StringUtils.isNotBlank(fieldRecipientInfor.getSubType())) {
												field.setSubType(fieldRecipientInfor.getSubType());
											} else {
												field.setSubType("0_Left");
											}
											if (StringUtils.isNotBlank(fieldRecipientInfor.getColor())) {
												field.setColor(fieldRecipientInfor.getColor());
											} else {
												field.setColor("0, 0, 0");
											}
											if (StringUtils.isNotBlank(fieldRecipientInfor.getFont())) {
												field.setFont(fieldRecipientInfor.getFont());
											} else {
												field.setFont("TIMES_NEW_ROMAN");
											}

											if (fieldRecipientInfor.getFontSize() != null) {
												field.setFontSize(fieldRecipientInfor.getFontSize());
											} else {
												field.setFontSize(14);
											}

											if (StringUtils.isNotBlank(fieldRecipientInfor.getValue())) {
												field.setValue(fieldRecipientInfor.getValue());
											}

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
										// fieldBox.setW(w.floatValue());
										if (fieldDescriptor.getW() != null
												&& Float.compare(w.floatValue(), fieldDescriptor.getW()) > 0) {
											fieldBox.setW(w.floatValue());
										} else {
											fieldBox.setW(fieldDescriptor.getW());
										}
										fieldBox.setX(fieldDescriptor.getX());
										fieldBox.setY(fieldDescriptor.getY());

										field.setFieldBox(fieldBox);
										field.setFieldDesign(new FieldDesign());
										field.setRecipientId(recipient.getId());

										fields.add(field);
									}
								}
							}
						}
						if (fields != null && fields.size() > 0) {
							recipient.setFields(fields);
						}
					}
				}
			}

			// set erequest info
			EnvelopeErqDTO erq = new EnvelopeErqDTO();
			erq.setResourceId(envelope.getId());
			erq.setTicketId(ticketId);
			erq.setUserTaskId(userTaskId);
			erq.setUserTaskVersion(userTaskVersion);
			erq.setRecipientDetailsId(recipientDetailsId);
			envelope.setErq(erq);

			try {
				envelope = this.updateEnvelope(headersEcon, envelope);
			} catch (Exception e) {
				return this.handleReturn("error", "9", e.getMessage(), headersEcon, envelopeId);
			}

			// remind
			if (remind != null) {
				try {
					this.saveRenewalContract(headersEcon, envelope, remind);
				} catch (Exception e) {
					return this.handleReturn("error", "11", e.getMessage(), headersEcon, envelopeId);
				}
			}

			try {
				envelope = this.goToProcessing(headersEcon, envelope.getId());
			} catch (Exception e) {
				return this.handleReturn("error", "10", e.getMessage(), headersEcon, envelopeId);
			}

			return this.handleReturn("success", "0", mapperClass.mapper().writeValueAsString(envelope), headersEcon,
					envelopeId);
		} catch (Exception ex) {
			return this.handleReturn("error", "-1", ex.getMessage(), headersEcon, envelopeId);
		}
	}
	
	public String getFileExtension(String fileName) {
        int lastDotIndex = fileName.lastIndexOf(".");
        if (lastDotIndex > 0) {
            return fileName.substring(lastDotIndex + 1).toLowerCase();
        }
        return null;
    }

	private void deleteContract(HttpHeaders headersEcon, String id) throws Exception {
		if (StringUtils.isNotBlank(id)) {
			String ulrDelateContract = "/services/envelope/api/envelope/" + id;
			;
			try {
				HttpEntity<Object> entityDelete = new HttpEntity<>("delete", headersEcon);
				restTemplate.exchange(urlFPTeContract + ulrDelateContract, HttpMethod.DELETE, entityDelete,
						EnvelopeDTO.class);
			} catch (Exception e2) {
			}
		}
	}

	private void saveRenewalContract(HttpHeaders headersEcon, EnvelopeDTO envelope, PayloadRemind remind)
			throws Exception {
		if (StringUtils.isEmpty(remind.getExpiredTime()) || StringUtils.isEmpty(remind.getRemindBefore())
				|| StringUtils.isEmpty(remind.getRemindEvery())) {
			throw new RuntimeException("Invalid remind infomation");
		}

		String url = "/services/envelope/api/renewal-contracts";

		RenewalContract rc = new RenewalContract();
		rc.setResourceId(envelope.getId());
		rc.setResourceType("e");
		rc.setResourceName(envelope.getName());
		rc.setResourceStatus(envelope.getStatus());
		rc.setOwner(envelope.getOwner());
		rc.setOrgIn(envelope.getOrgIn());
		rc.setCustId("" + envelope.getCustId());

		DateFormat sourceFormat = new SimpleDateFormat("dd/MM/yyyy");
		Date _expDate = sourceFormat.parse(remind.getExpiredTime());
		ZonedDateTime expDate = ZonedDateTime.ofInstant(_expDate.toInstant(), ZoneId.of("UTC"));
		rc.setExpDate(expDate);

		Date _reminderDate = sourceFormat.parse(remind.getRemindBefore());
		ZonedDateTime reminderDate = ZonedDateTime.ofInstant(_reminderDate.toInstant(), ZoneId.of("UTC"));
		rc.setReminderDate(reminderDate);

		rc.setFrequency(remind.getRemindEvery());
		rc.setMessage(remind.getRemindMessage());
		rc.setCreatedBy(envelope.getCreatedBy());

		HttpEntity<Object> createContractByLot = new HttpEntity<>(rc, headersEcon);
		try {
			restTemplate.exchange(urlFPTeContract + url, HttpMethod.POST, createContractByLot, EnvelopeDTO.class);
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	public String handleReturn(String status, String message, String result, HttpHeaders headersEcon, String id)
			throws Exception {
		// if ("error".equals(status)) {
		// this.deleteContract(headersEcon, id);
		// }
		Map<String, String> rtn = new HashMap<String, String>();
		rtn.put("status", status);
		rtn.put("message", message);
		rtn.put("result", result);
		return mapperClass.mapper().writeValueAsString(rtn);
	}

	public String getFileName(String name) throws Exception {
		String[] split = name.split("\\.");
		if (split.length > 1) {
			split[split.length - 1] = "pdf";
		} else {
			return name + ".pdf";
		}
		return String.join(".", split);
	}

	private EnvelopeDTO createEnvelopeDraft(HttpHeaders headersEcon, LotDataDTO lotData) {
		String urlCreateContractByLot = "/services/envelope/api/external/v1/signDraft";

		HttpEntity<Object> createContractByLot = new HttpEntity<>(lotData, headersEcon);
		try {
			ResponseEntity<EnvelopeDTO> requestEcontractRefId = restTemplate.exchange(
					urlFPTeContract + urlCreateContractByLot, HttpMethod.POST, createContractByLot, EnvelopeDTO.class);
			return requestEcontractRefId.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	public String getFile(HttpHeaders headersEcon, String ticketId, String userTaskId, String fileId) {
		String url = urlErequest + "/services/erequest/api/tickets/internal/contract/" + ticketId + "/userTaskId/" + userTaskId + "/content/base64?fileId=" + fileId;
		UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(url);

		HttpEntity<MultiValueMap<String, Object>> entity = new HttpEntity<>(headersEcon);
		try {
			ResponseEntity<String> response = restTemplate.exchange(builder.toUriString(), HttpMethod.GET, entity,
					String.class);
			String pdf = response.getBody();
			return pdf;
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}
	
	public String getFileFromBucket(HttpHeaders headersEcon, String bucketName, String keyName) {
		String url = urlErequest + "/services/erequest/api/tickets/internal/contract/getFileAttach";
		Map<String, Object> body = new HashMap<String, Object>();
		body.put("bucketName", bucketName);
		body.put("keyName", keyName);

		HttpEntity<Object> entity = new HttpEntity<>(body, headersEcon);
		try {
			ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
			String pdf = response.getBody();
			return pdf;
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	public EnvelopeDTO updateEnvelope(HttpHeaders headersEcon, EnvelopeDTO envelope) {

		List<FieldDTO> rqtFields = new ArrayList<FieldDTO>();
		if (envelope.getParties() != null && envelope.getParties().size() > 0) {
			for (PartyDTO party : envelope.getParties()) {
				for (RecipientDTO recipient : party.getRecipients()) {
					for (FieldDTO field : recipient.getFields()) {
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
			// TODO: handle exception
//			JsonNode rootNode = mapperClass.mapper().readTree(e.getResponseBodyAsString());
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	public EnvelopeDTO uploadDocument(Boolean isDossier, HttpHeaders headersEcon, EnvelopeDTO envelope,
			PayloadFile pf) {
		try {
			String uploadUrl = "/services/envelope/api/envelope/v2/" + envelope.getId() + "/doc";

			String url2 = urlFPTeContract + uploadUrl;

			byte[] valuePdfContract = Base64.getDecoder().decode(pf.getFile());

			BASE64DecodedMultipartFile file = new BASE64DecodedMultipartFile(valuePdfContract, this.changeFileExtension(pf.getFileName(), pf.getFileType()));

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
//			if (isDossier) {
//				fileInfos.put("type", "DOSSIER");
//			} else {
//				fileInfos.put("type", "DEFAULT");
//			}
			fileInfos.put("type", pf.getType());
			fileInfos.put("docRefId", pf.getId());
			fileInfos.put("order", pf.getOrder());
			if (pf.getRecipientList() != null && pf.getRecipientList().size() > 0) {
				fileInfos.put("recipientList", pf.getRecipientList());
			}

			MultiValueMap<String, Object> map = new LinkedMultiValueMap<>();
			map.add("files", fileEntity);
//			String fileInfos = "[{\"type\":\"DEFAULT\",\"order\":1}]";
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
		} catch (Exception e) {
			throw new RuntimeException(e.getMessage());
		}
	}
	
	public String changeFileExtension(String fileName, String newExtension) {
        int lastDotIndex = fileName.lastIndexOf(".");
        if (lastDotIndex > 0) {
            return fileName.substring(0, lastDotIndex) + "." + newExtension;
        }
        return fileName + "." + newExtension;
    }

	public EnvelopeDTO uploadAttachFile(HttpHeaders headersEcon, EnvelopeDTO envelope, byte[] valuePdfContract,
			String fileName, String order, String type) {
		try {
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

			MultiValueMap<String, Object> map = new LinkedMultiValueMap<>();
			map.add("files", fileEntity);
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
		} catch (Exception e) {
			throw new RuntimeException(e.getMessage());
		}
	}

	public EnvelopeDTO goToProcessing(HttpHeaders headersEcon, String envelopeId) {
		// throw new RuntimeException(envelopeId);
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

	public FieldDTO findFieldById(RecipientDTO recipient, String fieldId) {
		List<FieldDTO> fields = recipient.getFields();
		if (fields != null) {
			for (FieldDTO field : fields) {
				if (fieldId.equals(field.getId())) {
					return field;
				}
			}
		}
		return null;
	}

	public Boolean valid(List<FieldDescriptor> fieldDescriptors) {
		if (fieldDescriptors != null && fieldDescriptors.size() > 0) {
			int countCheck = 0;
			for (FieldDescriptor fieldDescriptor : fieldDescriptors) {
				if (FieldDescriptor.Type.DSIGN.equals(fieldDescriptor.getType())) {
					countCheck++;
				}
			}
			if (countCheck > 1) {
				return false;
			}
		}
		return true;
	}

	public Boolean valid(List<FieldDescriptor> fieldDescriptors, String role) {
		if (fieldDescriptors != null && fieldDescriptors.size() > 0) {
			int countCheck = 0;
			for (FieldDescriptor fieldDescriptor : fieldDescriptors) {
				if (FieldDescriptor.Type.DSIGN.equals(fieldDescriptor.getType())) {
					countCheck++;
				}
			}
			if ("reviewer".equals(role) && countCheck > 0) {
				return false;
			}
		}
		return true;
	}

	public String getRefIdFromLot(LotDataDTO lotData) {

		List<List<DataDTO>> datas = lotData.getDatas();
		List<DataDTO> data = datas.get(0);
		for (DataDTO dt : data) {
			if ("refId".equals(dt.getId())) {
				return dt.getValue();
			}
		}
		return null;

	}

	public List<EnvelopeDTO> getListEnvelopeByTicketId(HttpHeaders headersEcon, String refId) {
		try {
			String urlRefId = "services/envelope/api/external/v1/envelope/refId";
			Map<String, String> bodyParamsRefId = new HashMap<String, String>();
			bodyParamsRefId.put("refId", refId);

			HttpEntity<Object> entityRefId = new HttpEntity<>(bodyParamsRefId, headersEcon);

			ResponseEntity<List<EnvelopeDTO>> requestEcontractRefId = restTemplate.exchange(urlFPTeContract + urlRefId,
					HttpMethod.POST, entityRefId, new ParameterizedTypeReference<List<EnvelopeDTO>>() {
					});
			return requestEcontractRefId.getBody();
		} catch (Exception e) {
			throw new RuntimeException("Lấy danh sách tài liệu theo refId không thành công.");
		}
	}
	
	public String getAccessToken() throws Exception {
		String urlGetToken = urlUaaSabeco + "/v1/client-auth/login";
		Map<String, Object> bodyToken = new HashMap<String, Object>();
		bodyToken.put("username", username);
		bodyToken.put("password", password);
		bodyToken.put("rememberMe", "false");
		bodyToken.put("clientid", client_id);
		bodyToken.put("clientsecret", client_secret);

		HttpEntity<Object> request = new HttpEntity<Object>(bodyToken);
		try {
			ResponseEntity<String> response = restTemplate.postForEntity(urlGetToken, request, String.class);
			JsonNode rootNode = null;
			rootNode = mapperClass.mapper().readTree(response.getBody());
			return rootNode.path("access_token").asText();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	public class FPTSmartCloudData implements Serializable {
		private static final long serialVersionUID = 1306533973655459919L;

		public String name;

		public byte[] photoFrontSide;

		public byte[] photoBackSide;

		public byte[] getPhotoFrontSide() {
			return photoFrontSide;
		}

		public void setPhotoFrontSide(byte[] photoFrontSide) {
			this.photoFrontSide = photoFrontSide;
		}

		public byte[] getPhotoBackSide() {
			return photoBackSide;
		}

		public void setPhotoBackSide(byte[] photoBackSide) {
			this.photoBackSide = photoBackSide;
		}

		public String getName() {
			return name;
		}

		public void setName(String name) {
			this.name = name;
		}
	}

	private static class PayloadRemind implements Serializable {
		private static final long serialVersionUID = 1L;

		private String expiredTime;
		private String remindBefore;
		private String remindEvery;
		private String remindMessage;

		public String getExpiredTime() {
			return expiredTime;
		}

		public void setExpiredTime(String expiredTime) {
			this.expiredTime = expiredTime;
		}

		public String getRemindBefore() {
			return remindBefore;
		}

		public void setRemindBefore(String remindBefore) {
			this.remindBefore = remindBefore;
		}

		public String getRemindEvery() {
			return remindEvery;
		}

		public void setRemindEvery(String remindEvery) {
			this.remindEvery = remindEvery;
		}

		public String getRemindMessage() {
			return remindMessage;
		}

		public void setRemindMessage(String remindMessage) {
			this.remindMessage = remindMessage;
		}
	}

	private static class PayloadFile implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String id;
		private String fileName;
		private String fileType;
		private Integer order;
		private String keyName;
		private String bucketName;
		private String resource;
		private String type;
		
		private String file;
		private byte[] filebyte;
		private String fileUploadId;
		private List<FieldDescriptor> markerResult;
		private List<String> recipientList;

		public String getId() {
			return id;
		}
		public void setId(String id) {
			this.id = id;
		}
		public String getFileName() {
			return fileName;
		}
		public void setFileName(String fileName) {
			this.fileName = fileName;
		}
		public Integer getOrder() {
			return order;
		}
		public void setOrder(Integer order) {
			this.order = order;
		}
		public String getKeyName() {
			return keyName;
		}
		public void setKeyName(String keyName) {
			this.keyName = keyName;
		}
		public String getBucketName() {
			return bucketName;
		}
		public void setBucketName(String bucketName) {
			this.bucketName = bucketName;
		}
		public String getResource() {
			return resource;
		}
		public void setResource(String resource) {
			this.resource = resource;
		}
		public String getType() {
			return type;
		}
		public void setType(String type) {
			this.type = type;
		}
		public String getFile() {
			return file;
		}
		public void setFile(String file) {
			this.file = file;
		}
		public String getFileUploadId() {
			return fileUploadId;
		}
		public void setFileUploadId(String fileUploadId) {
			this.fileUploadId = fileUploadId;
		}
		public List<FieldDescriptor> getMarkerResult() {
			return markerResult;
		}
		public void setMarkerResult(List<FieldDescriptor> markerResult) {
			this.markerResult = markerResult;
		}
		public List<String> getRecipientList() {
			return recipientList;
		}
		public void setRecipientList(List<String> recipientList) {
			this.recipientList = recipientList;
		}
		public byte[] getFilebyte() {
			return filebyte;
		}
		public void setFilebyte(byte[] filebyte) {
			this.filebyte = filebyte;
		}
		public String getFileType() {
			return fileType;
		}
		public void setFileType(String fileType) {
			this.fileType = fileType;
		}
	}

	private static class RenewalContract implements Serializable {
		private static final long serialVersionUID = 1L;

		private String id;
		private String resourceId;
		private String resourceType;
		private String resourceName;
		private String resourceStatus;
		private String owner;
		private String orgIn;
		private String custId;
		private ZonedDateTime expDate;
		private ZonedDateTime reminderDate;
		private String reminderMonth;
		private String frequency;
		private String message;
		private ZonedDateTime finishDate;
		private ZonedDateTime createdDate;
		private String createdBy;
		private String lastModifiedBy;
		private ZonedDateTime lastModifiedDate;
		private String status;
		private String countCheck;

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

		public String getResourceStatus() {
			return resourceStatus;
		}

		public void setResourceStatus(String resourceStatus) {
			this.resourceStatus = resourceStatus;
		}

		public String getOwner() {
			return owner;
		}

		public void setOwner(String owner) {
			this.owner = owner;
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

		public ZonedDateTime getExpDate() {
			return expDate;
		}

		public void setExpDate(ZonedDateTime expDate) {
			this.expDate = expDate;
		}

		public ZonedDateTime getReminderDate() {
			return reminderDate;
		}

		public void setReminderDate(ZonedDateTime reminderDate) {
			this.reminderDate = reminderDate;
		}

		public String getReminderMonth() {
			return reminderMonth;
		}

		public void setReminderMonth(String reminderMonth) {
			this.reminderMonth = reminderMonth;
		}

		public String getFrequency() {
			return frequency;
		}

		public void setFrequency(String frequency) {
			this.frequency = frequency;
		}

		public String getMessage() {
			return message;
		}

		public void setMessage(String message) {
			this.message = message;
		}

		public ZonedDateTime getFinishDate() {
			return finishDate;
		}

		public void setFinishDate(ZonedDateTime finishDate) {
			this.finishDate = finishDate;
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

		public String getLastModifiedBy() {
			return lastModifiedBy;
		}

		public void setLastModifiedBy(String lastModifiedBy) {
			this.lastModifiedBy = lastModifiedBy;
		}

		public ZonedDateTime getLastModifiedDate() {
			return lastModifiedDate;
		}

		public void setLastModifiedDate(ZonedDateTime lastModifiedDate) {
			this.lastModifiedDate = lastModifiedDate;
		}

		public String getStatus() {
			return status;
		}

		public void setStatus(String status) {
			this.status = status;
		}

		public String getCountCheck() {
			return countCheck;
		}

		public void setCountCheck(String countCheck) {
			this.countCheck = countCheck;
		}
	}

	private static class AttachFilePayload implements Serializable {
		private static final long serialVersionUID = 1L;

		private String fileName;
		private String keyName;
		private String bucketName;

		public String getFileName() {
			return fileName;
		}

		public void setFileName(String fileName) {
			this.fileName = fileName;
		}

		public String getKeyName() {
			return keyName;
		}

		public void setKeyName(String keyName) {
			this.keyName = keyName;
		}

		public String getBucketName() {
			return bucketName;
		}

		public void setBucketName(String bucketName) {
			this.bucketName = bucketName;
		}
	}
}
