// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/CPBank.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.apache.commons.lang.StringUtils;
import org.apache.pdfbox.pdmodel.PDDocument;
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
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fis.envelope.pdfutil.PdfUtil;
import com.fis.envelope.pdfutil.field.FieldDescriptor;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.domain.BASE64DecodedMultipartFile;
import com.fis.excall.domain.UserInFoDetails;
import com.fis.excall.security.SecurityUtils;
import com.fis.excall.service.envelope.dto.ContactDTO;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;
import com.fis.excall.service.envelope.dto.FieldBoxDTO;
import com.fis.excall.service.envelope.dto.FieldDTO;
import com.fis.excall.service.envelope.dto.FieldDesign;
import com.fis.excall.service.envelope.dto.HdrFieldDTO;
import com.fis.excall.service.envelope.dto.PartyDTO;
import com.fis.excall.service.envelope.dto.RecipientDTO;

@Service
public class CPBank {

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

	public Object creatingEnvelope(Object payload) throws Exception {

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

		String envelopeId = null;

		try {
			Map<String, Object> body = mapperClass.swap(HashMap.class, payload);

			String refId = String.valueOf(body.get("refId"));

			String pdf = String.valueOf(body.get("file"));

			String pdfName = String.valueOf(body.get("fileName"));
//			String alias = String.valueOf(body.get("alias"));

			Object header = body.get("headerFields");

			List<HdrFieldDTO> fields = mapperClass.mapper().readValue(mapperClass.mapper().writeValueAsString(header),
					new TypeReference<List<HdrFieldDTO>>() {
					});

			Map<String, String> mapFields = new HashMap<String, String>();

			Boolean isMarker = (Boolean) body.get("isMarker");

			byte[] valuePdfContract = Base64.getDecoder().decode(pdf);
			InputStream targetStream = new ByteArrayInputStream(valuePdfContract);
			List<FieldDescriptor> result = new ArrayList<>();

			if (isMarker) {

				PDDocument document = null;
				try {
					document = PDDocument.load(targetStream);
					result = PdfUtil.getFieldByMarker(document);
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

			}

			Object partiesO = body.get("parties");

			List<PartyInfor> partiesInfors = mapperClass.mapper().readValue(
					mapperClass.mapper().writeValueAsString(partiesO), new TypeReference<List<PartyInfor>>() {
					});

			EnvelopeDTO envelope = this.createEnvelopeDraft(headersEcon, fields, refId, pdf, pdfName);

			envelopeId = envelope.getId();

			List<PartyDTO> parties = new ArrayList<>();

			if (partiesInfors != null && partiesInfors.size() > 0) {
				for (PartyInfor partiesInfor : partiesInfors) {

					PartyDTO party = new PartyDTO();
					party.setId(partiesInfor.getId());
					party.setIndex(partiesInfor.getIndex());
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

					List<RecipientInfor> recipients = partiesInfor.getRecipients();

					List<RecipientDTO> rcps = new ArrayList<>();

					if (isMarker) {

						if (result == null || result.size() == 0) {
							throw new RuntimeException("error.isNotExistsMarkerField");
						}
						if (recipients == null || recipients.size() == 0) {
							throw new RuntimeException("error.isNotExistsRecipientInfo");
						}

						Map<String, List<FieldDescriptor>> mapFieldDesc = new HashMap<>();

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

						for (RecipientInfor recipientInFor : recipients) {

							if (mapFieldDesc.containsKey(recipientInFor.getRecipientId())) {

								RecipientDTO rcp = new RecipientDTO();
								rcp.setRole("signer");
								rcp.setId(recipientInFor.getRecipientId());
								rcp.setOrder(new Integer(recipients.indexOf(recipientInFor)).floatValue());
								rcp.setIndex(recipients.indexOf(recipientInFor));

								ContactDTO contact = new ContactDTO(recipientInFor.getContactId(),
										recipientInFor.getPersonalName(), recipientInFor.getEmail(),
										recipientInFor.getTelephoneNumber());
								rcp.setContact(contact);
								rcp.setRemindLater(0);

								rcp.setNotifyTypes(Arrays.asList("email_econtract"));

								if (party.getIsMyOrg()) {
									List<String> notifyTypes = rcp.getNotifyTypes();
									notifyTypes.add("system_suspend_send_mail");
									rcp.setNotifyTypes(notifyTypes);
								}

								FieldDTO field = new FieldDTO();
								String uuid = UUID.randomUUID().toString().replace("-", "");
								field.setId(uuid);
								field.setType("signature");
								field.setDocId(envelope.getDocuments().get(0).getId());

								List<FieldDescriptor> fieldDescriptors = mapFieldDesc
										.get(recipientInFor.getRecipientId());

								if (fieldDescriptors != null && fieldDescriptors.size() > 0) {
									if (!this.valid(fieldDescriptors)) {
										throw new RuntimeException("error.toManysMarkerDigitalField");
									}

									for (FieldDescriptor fieldDescriptor : fieldDescriptors) {

										if (FieldDescriptor.Type.DSIGN.equals(fieldDescriptor.getType())) {
											field.setSubType("2");
											if (rcp.getSignTypes() != null && rcp.getSignTypes().size() > 0) {
												List<String> signTypes = rcp.getSignTypes();
												signTypes.add("sign_fca.passcode");
												signTypes.add("sign_plugin");
												signTypes.addAll(rcp.getSignTypes());
												rcp.setSignTypes(signTypes);
											} else {
												List<String> signTypes = new ArrayList<>();
												signTypes.add("sign_fca.passcode");
												signTypes.add("sign_plugin");
												rcp.setSignTypes(signTypes);
											}
										} else if (FieldDescriptor.Type.ISIGN.equals(fieldDescriptor.getType())) {
											field.setSubType("1");
											if (recipientInFor.getSignTypes() != null
													&& recipientInFor.getSignTypes().size() > 0) {
												List<String> signTypes = rcp.getSignTypes();
												if (signTypes == null) {
													signTypes = new ArrayList<>();
												}
												if (rcp.getSignTypes() != null && rcp.getSignTypes().size() > 0) {
													signTypes.addAll(rcp.getSignTypes());
												}
												signTypes.addAll(recipientInFor.getSignTypes());

												rcp.setSignTypes(signTypes);
											} else {
												List<String> signTypes = rcp.getSignTypes();
												if (signTypes == null) {
													signTypes = new ArrayList<>();
												}
												signTypes.add("Sign-IMG");
												if (rcp.getSignTypes() != null && rcp.getSignTypes().size() > 0) {
													signTypes.addAll(rcp.getSignTypes());
												}
												rcp.setSignTypes(signTypes);
											}
										}
										field.setValidators(new ArrayList<>());
										field.setPage(fieldDescriptor.getPage());

										FieldBoxDTO fieldBox = new FieldBoxDTO();
										fieldBox.setH(fieldDescriptor.getH());
										fieldBox.setW(fieldDescriptor.getW());
										fieldBox.setX(fieldDescriptor.getX());
										fieldBox.setY(fieldDescriptor.getY());

										field.setFieldBox(fieldBox);
										field.setFieldDesign(new FieldDesign());
										field.setRecipientId(recipientInFor.getRecipientId());
										rcp.setFields(Arrays.asList(field));

										if (rcp.getSignTypes() != null) {
											Set<String> signTypess = new HashSet<String>(rcp.getSignTypes());
											List<String> signTypesss = new ArrayList<>(signTypess);
											rcp.setSignTypes(signTypesss);

										}

										if (rcp.getNotifyTypes() != null) {
											Set<String> notifyTypess = new HashSet<String>(rcp.getNotifyTypes());
											List<String> notifyTypesss = new ArrayList<>(notifyTypess);
											rcp.setNotifyTypes(notifyTypesss);
										}

									}

									rcps.add(rcp);

								} else {
									throw new RuntimeException("error.isNotExistsMarkerField");
								}

							} else {
								throw new RuntimeException("error.isNotExistsMarkerField");
							}

						}

					} else {

						for (RecipientInfor recipientInFor : recipients) {
							RecipientDTO rcp = new RecipientDTO();
							rcp.setRole("signer");
							rcp.setId(recipientInFor.getRecipientId());
							rcp.setOrder(new Integer(recipients.indexOf(recipientInFor)).floatValue());
							rcp.setIndex(recipients.indexOf(recipientInFor));

							ContactDTO contact = new ContactDTO(recipientInFor.getContactId(),
									recipientInFor.getPersonalName(), recipientInFor.getEmail(),
									recipientInFor.getTelephoneNumber());
							rcp.setContact(contact);
							rcp.setRemindLater(0);

							rcp.setSignTypes(Arrays.asList("sign_fca.passcode", "sign_plugin"));
							rcp.setNotifyTypes(Arrays.asList("email_econtract"));
							if (party.getIsMyOrg()) {
								List<String> notifyTypes = rcp.getNotifyTypes();
								notifyTypes.add("system_suspend_send_mail");
								rcp.setNotifyTypes(notifyTypes);
							}

							FieldDTO field = new FieldDTO();
							String uuid = UUID.randomUUID().toString().replace("-", "");
							field.setId(uuid);
							field.setType("signature");
							field.setDocId(envelope.getDocuments().get(0).getId());
							field.setSubType("2");
							field.setValidators(new ArrayList<>());

							if (recipientInFor.getPage() == null) {
								throw new RuntimeException("error.isNotExistsPage");
							}

							field.setPage(recipientInFor.getPage());

							if (recipientInFor.getFieldBox() == null && !this.valid(recipientInFor.getFieldBox())) {
								throw new RuntimeException("error.isNotExistsPositionField");
							}

							FieldBoxDTO fieldBox = new FieldBoxDTO();
							fieldBox.setH(recipientInFor.getFieldBox().getH());
							fieldBox.setW(recipientInFor.getFieldBox().getW());
							fieldBox.setX(recipientInFor.getFieldBox().getX());
							fieldBox.setY(recipientInFor.getFieldBox().getY());

							field.setFieldBox(fieldBox);
							field.setFieldDesign(new FieldDesign());
							field.setRecipientId(recipientInFor.getRecipientId());

							rcp.setFields(Arrays.asList(field));

							rcps.add(rcp);

						}
					}
					party.setRecipients(rcps);
					parties.add(party);
				}

			}

			envelope.setParties(parties);

			EnvelopeDTO envelopeDTO = this.updateEnvelope(headersEcon, envelope);

			envelopeDTO = this.goToProcessing(headersEcon, envelope.getId());

			return mapperClass.mapper().writeValueAsString(envelopeDTO);

		} catch (Exception ex) {

			if (StringUtils.isNotBlank(envelopeId)) {
				String ulrDelateContract = "/services/envelope/api/envelope/" + envelopeId;
				headersEcon.setContentType(MediaType.APPLICATION_JSON);
				try {
					HttpEntity<Object> entityDelete = new HttpEntity<>("delete", headersEcon);

					ResponseEntity<EnvelopeDTO> requestEcontract4 = restTemplate.exchange(
							urlFPTeContract + ulrDelateContract, HttpMethod.DELETE, entityDelete, EnvelopeDTO.class);
				} catch (Exception e2) {
					throw new RuntimeException(e2.getMessage());
				}
			}

			throw new RuntimeException(ex.getMessage());
		}
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

	public Boolean valid(FieldBoxDTO fieldBoxDTO) {

		return (fieldBoxDTO.getH() != null) && (fieldBoxDTO.getW() != null) && (fieldBoxDTO.getX() != null)
				&& (fieldBoxDTO.getY() != null);
	}

	public EnvelopeDTO updateEnvelope(HttpHeaders headersEcon, EnvelopeDTO envelope) {

		String createEnvelope = "services/envelope/api/envelope/" + envelope.getId();

		headersEcon.setContentType(MediaType.APPLICATION_JSON);

		HttpEntity<Object> entityEnvelope = new HttpEntity<>(envelope, headersEcon);

		ResponseEntity<EnvelopeDTO> requestEcontract3 = restTemplate.exchange(urlFPTeContract + createEnvelope,
				HttpMethod.PUT, entityEnvelope, EnvelopeDTO.class);

		return requestEcontract3.getBody();
	}

	public EnvelopeDTO goToProcessing(HttpHeaders headersEcon, String envelopeId) {

		String goToUrl = "services/envelope/api/envelope/" + envelopeId + "/processing";

		HttpEntity<Object> entityEnvelope = new HttpEntity<>(headersEcon);

		ResponseEntity<EnvelopeDTO> requestEcontract4 = restTemplate.exchange(urlFPTeContract + goToUrl, HttpMethod.PUT,
				entityEnvelope, EnvelopeDTO.class);

		return requestEcontract4.getBody();
	}

	public EnvelopeDTO createEnvelopeDraft(HttpHeaders headersEcon, List<HdrFieldDTO> fields, String refId,
			String fileBase64, String fileName) throws Exception {
		Map<String, Object> body = new HashMap<String, Object>();
		body.put("fields", fields);
		body.put("isStep", false);
		body.put("refId", refId);
		body.put("docTypeId", null);

		RestTemplate restTemplate = new RestTemplate();

		String createEnvelope = "services/envelope/api/envelope/v2";
		HttpEntity request = new HttpEntity(mapperClass.mapper().writeValueAsString(body), headersEcon);

		ResponseEntity<EnvelopeDTO> requestEcontract1 = restTemplate.postForEntity(urlFPTeContract + createEnvelope,
				request, EnvelopeDTO.class);

		EnvelopeDTO envelope = requestEcontract1.getBody();

		String uploadUrl = "services/envelope/api/envelope/v2/" + envelope.getId() + "/doc";

		String url2 = urlFPTeContract + uploadUrl;

		byte[] valuePdfContract = Base64.getDecoder().decode(fileBase64);

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

		MultiValueMap<String, Object> map = new LinkedMultiValueMap<>();
		map.add("files", fileEntity);
		String fileInfos = "[{\"type\":\"DEFAULT\",\"order\":1}]";
		map.add("fileInfos", fileInfos);
		map.add("id", envelope.getId());

		headersEcon.setContentType(MediaType.MULTIPART_FORM_DATA);

		HttpEntity<MultiValueMap<String, Object>> requestUpload = new HttpEntity<>(map, headersEcon);

		ResponseEntity<EnvelopeDTO> requestEcontract2 = restTemplate.postForEntity(url2, requestUpload,
				EnvelopeDTO.class);

		return requestEcontract2.getBody();
	}

	public static class PartyInfor implements Serializable {

		private static final long serialVersionUID = -1831690192157107557L;
		public String id;
		public List<RecipientInfor> recipients;
		public Boolean isMyOrg;
		public Boolean isOrg;
		public String orgName;

		public Integer order;

		public Integer index;

		public Boolean getIsOrg() {
			return isOrg;
		}

		public void setIsOrg(Boolean isOrg) {
			this.isOrg = isOrg;
		}

		public Integer getOrder() {
			return order;
		}

		public void setOrder(Integer order) {
			this.order = order;
		}

		public Integer getIndex() {
			return index;
		}

		public void setIndex(Integer index) {
			this.index = index;
		}

		public PartyInfor() {
			super();
			// TODO Auto-generated constructor stub
		}

		public String getId() {
			return id;
		}

		public void setId(String id) {
			this.id = id;
		}

		public List<RecipientInfor> getRecipients() {
			return recipients;
		}

		public void setRecipients(List<RecipientInfor> recipients) {
			this.recipients = recipients;
		}

		public Boolean getIsMyOrg() {
			return isMyOrg;
		}

		public void setIsMyOrg(Boolean isMyOrg) {
			this.isMyOrg = isMyOrg;
		}

		public String getOrgName() {
			return orgName;
		}

		public void setOrgName(String orgName) {
			this.orgName = orgName;
		}

	}

	public static class RecipientInfor implements Serializable {

		private static final long serialVersionUID = 5769882582358556916L;

		/**
		 *  
		 */

		public String recipientId;
		public String email;
		public String personalName;
		public String telephoneNumber;
		public String contactId;

		public FieldBoxDTO fieldBox;

		public Integer page;

		public List<String> signTypes;
		public List<String> notifyTypes;

		public List<String> getSignTypes() {
			return signTypes;
		}

		public void setSignTypes(List<String> signTypes) {
			this.signTypes = signTypes;
		}

		public List<String> getNotifyTypes() {
			return notifyTypes;
		}

		public void setNotifyTypes(List<String> notifyTypes) {
			this.notifyTypes = notifyTypes;
		}

		public Integer getPage() {
			return page;
		}

		public void setPage(Integer page) {
			this.page = page;
		}

		public FieldBoxDTO getFieldBox() {
			return fieldBox;
		}

		public void setFieldBox(FieldBoxDTO fieldBox) {
			this.fieldBox = fieldBox;
		}

		public RecipientInfor() {
			super();
		}

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

	}

}
