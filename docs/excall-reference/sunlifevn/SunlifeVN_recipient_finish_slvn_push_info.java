// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/SunlifeVN_recipient_finish_slvn_push_info.java
// Secret đã thay bằng "<REDACTED>" (2 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.common.OAuth2AccessToken;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.service.envelope.dto.ContactDTO;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;
import com.fis.excall.service.envelope.dto.EnvelopeHdrDTO;
import com.fis.excall.service.envelope.dto.HdrFieldDTO;
import com.fis.excall.service.envelope.dto.PartyDTO;
import com.fis.excall.service.envelope.dto.RecipientDTO;
import com.fis.excall.service.envelope.dto.RecipientHistoryDTO;

@Service
public class SunlifeVN_recipient_finish_slvn_push_info {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;

	@Autowired
	private EnvelopeClient envelopeClients;
	
	private static final String urlFPTeContract = "https://10.14.121.18:30600/app/";
//	private static final String urlFPTeContract = "https://demo.econtract.fpt.com/app/";
	private static final String urlExcall = "https://10.14.121.18:30600/app/services/excall/api/excall";
	// private static final String urlExcall = "https://demo.econtract.fpt.com/app/services/excall/api/excall";
	
	private static final String url_sunlife_login = "https://sunlifeasiaapi.oktapreview.com/oauth2/aus1753khl1IiUOJI1d7/v1/token";
	private static final String url_sunlife_documents = "https://sandbox.sunlife.com.vn/api/sit/partner-facade/econtract/document";
	private static final String url_sunlife_ekyc = "https://sandbox.sunlife.com.vn/api/sit/partner-facade/econtract/ekyc";
	private static final String url_sunlife_update_recipient_status = "https://sandbox.sunlife.com.vn/api/sit/partner-facade/econtract/update";
	
	private static final String grant_type = "client_credentials";
	private static final String client_id = "<REDACTED>";
	private static final String client_secret = "<REDACTED>";
	private static final String scope = "apiplatform.asia.vn.facade.pos.lead.uad";
	
	private static final String systemSavant = "SAVANT";
	
	public Object recipientFinish(String envelopeId, String recipientId, String status) throws Exception {
		try {
			EnvelopeDTO envelope = envelopeClients.getEnvelopeById(envelopeId);
			RecipientDTO recipient = this.getRecipient(envelope, recipientId);
			ContactDTO contact = recipient.getContact();
			
			List<RecipientHistoryDTO> recipientHistorys  = recipient.getRecipientsHistory();
			if (recipientHistorys != null && recipientHistorys.size() > 0) {
				for (RecipientHistoryDTO recipientHistory : recipientHistorys) {
					ContactDTO recipientContact = recipientHistory.getContact();
					if (recipientContact.getEmail().equals(contact.getEmail())){
						if (recipientContact.getId() != null && StringUtils.isEmpty(contact.getId())){
							contact.setId(recipientContact.getId());
							break;
						}
					}
				}
			}
			
			OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(envelope.getOwner());
			String token = "Bearer " + accessToken.getValue();
			HttpHeaders headersEcon = new HttpHeaders();
			headersEcon.setContentType(MediaType.APPLICATION_JSON);
			headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
			headersEcon.set("Authorization", token);
			
			String repositoryId = null;
			EkycResponse ekycResponse = null;
			if (recipient.getEkycDetail() != null) {
				repositoryId = recipient.getEkycDetail().getId();
				if (repositoryId != null) {
					try {
						ekycResponse = this.getEkycContent(headersEcon, repositoryId);
					} catch (Exception e) {
						return this.handleReturn("success", "2", e.getMessage());
					}
				}
			}
			
			// get sunlife token
			String sunlifeToken;
			try {
				sunlifeToken = this.getAccessToken();
			} catch (Exception e) {
				// 1 - get access token sunlife không thành công
				return this.handleReturn("success", "1", e.getMessage());
			}
			
			ResponseMessage body = new ResponseMessage();
			body.setStatus(status);
			body.setEnvelopeId(envelopeId);
			body.setPersonId(recipient.getContact().getId());
			
			String appName = this.convertHeader(envelope.getHeader());
			body.setAppName(appName);
			
			SignerInfo signerInfo = new SignerInfo();
			signerInfo.setName(contact.getName());
			signerInfo.setRoleName(recipient.getRole());
			signerInfo.setStatus(status);
			signerInfo.setSignedTime(recipient.getSignDate());
			signerInfo.setPersonId(contact.getId());
			
			if (ekycResponse != null) {
				EkycRepositoryAttrs attrs = ekycResponse.getEkycRepository().getAttrs();
				EkycInfo ekycInfo = new EkycInfo();
				ekycInfo.setWard(attrs.getCommune());
				ekycInfo.setFullName(attrs.getPersonalName());
				ekycInfo.setNation(attrs.getCountry());
				ekycInfo.setDob(attrs.getDob());
				ekycInfo.setCity(attrs.getStateOrProvince());
				ekycInfo.setDistrict(attrs.getLocation());
				ekycInfo.setIdNumber(attrs.getPersonalID());
				ekycInfo.setAddress(attrs.getAddress());
				ekycInfo.setIssuedDate(attrs.getProvideDate());
				ekycInfo.setIssuedPlace(attrs.getProvideAddress());
				ekycInfo.setDocumentType(this.getDocumentType(attrs.getPersonalDocumentType()));
				
				String gender = null;
				Map<String, Object> ekycContent = ekycResponse.getEkycRepository().getEkycContent();
				if (ekycContent != null) {
					if (ekycContent.containsKey("gioiTinh") && "0".equals(String.valueOf(ekycContent.get("gioiTinh")))) {
						gender = "M";
					}
					if (ekycContent.containsKey("gioiTinh") && "1".equals(String.valueOf(ekycContent.get("gioiTinh")))) {
						gender = "F";
					}
				}
				ekycInfo.setGender(gender);
				
				List<String> notifyTypes = recipient.getNotifyTypes();
				if (notifyTypes.contains("recipient_finish_slvn_advisor")) {
					ekycInfo.setEkycBy("FIS");
				} else {
					ekycInfo.setEkycBy("SAVANT");
				}
				
				ResourceInfo selfiles = new ResourceInfo();
				selfiles.setPresignedUrl(ekycResponse.getPositionPdfUrl());
				ekycInfo.setSelfies(Arrays.asList(selfiles));
				
				ResourceInfo documentFront = new ResourceInfo();
				documentFront.setPresignedUrl(ekycResponse.getIdCardPdfUrl());
				ekycInfo.setDocumentFront(documentFront);
				ekycInfo.setDocumentBack(documentFront);
				
				CaFile caFile = new CaFile();
				caFile.setType("CA");
				caFile.setPresignedUrl(ekycResponse.getFptCaFormUrl());
				ekycInfo.setCaFile(caFile);
				
				signerInfo.setEkycInfo(ekycInfo);
			}
			
			body.setSignerInfo(signerInfo);
			
			String slvnToken = "Bearer " + sunlifeToken;
			HttpHeaders headers = new HttpHeaders();
			headers.setContentType(MediaType.APPLICATION_JSON);
			headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
			headers.set("Authorization", slvnToken);
			headers.set("X-Slv-Sec-Akamai", "5F3AA0A83A09F564C8D86F2F43D000EF9B0A3951E687E82894656531B6EFCD75");

			HttpEntity<ResponseMessage> entity = new HttpEntity<>(body, headers);

			Map<String, Object> rtn = new HashMap<String, Object>();
			rtn.put("requestBody", body);
			try {
				ResponseEntity<String> request = restTemplate.exchange(url_sunlife_update_recipient_status, HttpMethod.POST, entity, String.class);
				
				rtn.put("requestResponse", request.getBody());
				return this.handleReturn("success", "0", mapperClass.mapper().writeValueAsString(rtn));
			} catch (HttpStatusCodeException e) {
//				return e.getResponseBodyAsString();
				rtn.put("requestResponse", e.getResponseBodyAsString());
				throw new RuntimeException(mapperClass.mapper().writeValueAsString(rtn));
			}
		} catch (Exception e) {
			return this.handleReturn("success", "-1", e.getMessage());
		}
	}
	
	public String convertHeader(EnvelopeHdrDTO header) {
		List<HdrFieldDTO> fields = header.getFields();
		Map<String, String> mapFields = new HashMap<String, String>();

		if (fields != null && fields.size() > 0) {
			for (HdrFieldDTO field : fields) {
				mapFields.put(field.getId(), field.getValue());
			}
		}
		
		String appName = mapFields.containsKey("envF10") ? mapFields.get("envF10") : null;
		
		if (appName == null) {
			return "SAVANT-SIT";
		} else {
			return appName;
		}
	}
	
	public String getDocumentType(String value) {
		if (StringUtils.isEmpty(value)) {
			return null;
		} else {
			if ("1".equals(value)) {
				return "CMND";
			} else if ("2".equals(value)) {
				return "CCCD";
			} else if ("3".equals(value)) {
				return "HC";
			} else if ("4".equals(value)) {
				return "CCCDCHIP";
			} else {
				return value;
			}
		}
	}
	
	public EkycResponse getEkycContent(HttpHeaders headers, String id) {
		String url = urlFPTeContract + "services/common/api/ekycRepositoryDetails/detailss/idCard?ekycRepositoryId=" + id + "&type=pdf";
		HttpEntity<ResponseMessage> entity = new HttpEntity<>(headers);
		try {
			ResponseEntity<EkycResponse> request = restTemplate.exchange(url, HttpMethod.GET, entity, EkycResponse.class);
			return request.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getMessage());
		}
	}
	
	public String handleReturn(String status, String message, String result) throws Exception {
		Map<String, String> rtn = new HashMap<String, String>();
		rtn.put("status", status);
		rtn.put("message", message);
		rtn.put("result", result);
		return mapperClass.mapper().writeValueAsString(rtn);
	}
	
	public String getAccessToken() throws Exception {
		HttpHeaders reqHeaders = new HttpHeaders();
		reqHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
		MultiValueMap<String, String> formParams = new LinkedMultiValueMap<>();
		formParams.set("grant_type", grant_type);
		formParams.set("client_id", client_id);
		formParams.set("client_secret", client_secret);
		formParams.set("scope", scope);
		
		HttpEntity<MultiValueMap<String, String>> entity = new HttpEntity<>(formParams, reqHeaders);
		
		try {
			ResponseEntity<String> response = restTemplate.postForEntity(url_sunlife_login, entity, String.class);
			JsonNode rootNode = null;
			rootNode = mapperClass.mapper().readTree(response.getBody());
			return rootNode.path("access_token").asText();
		} catch (HttpStatusCodeException e) {
			// TODO: handle exception
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}
	
	public RecipientDTO getRecipient(EnvelopeDTO e, String recipientId) {
		List<PartyDTO> parties = e.getParties();
		if (parties != null && parties.size() > 0) {
			for (PartyDTO party : parties) {
				List<RecipientDTO> recipients = party.getRecipients();
				if (recipients != null && recipients.size() > 0) {
					for (RecipientDTO rcp : recipients) {
						if (rcp.getId().equals(recipientId)) {
							return rcp;
						}
					}
				}
			}
		}
		return null;
	}
	
	public static class ResponseMessage implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private SignerInfo signerInfo;
		private String status;
		private String envelopeId;
		private String personId;
		private String appName;
		
		public SignerInfo getSignerInfo() {
			return signerInfo;
		}
		public void setSignerInfo(SignerInfo signerInfo) {
			this.signerInfo = signerInfo;
		}
		public String getStatus() {
			return status;
		}
		public void setStatus(String status) {
			this.status = status;
		}
		public String getEnvelopeId() {
			return envelopeId;
		}
		public void setEnvelopeId(String envelopeId) {
			this.envelopeId = envelopeId;
		}
		public String getPersonId() {
			return personId;
		}
		public void setPersonId(String personId) {
			this.personId = personId;
		}
		public String getAppName() {
			return appName;
		}
		public void setAppName(String appName) {
			this.appName = appName;
		}
	}
	
	public static class DocumentInfo implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String newDocumentId;
		private String oldDocumentId;
		private String presignedUrl;
		private String fileName;
		private String fileType;
		private String signedTime;
		private String status;
		
		public String getNewDocumentId() {
			return newDocumentId;
		}
		public void setNewDocumentId(String newDocumentId) {
			this.newDocumentId = newDocumentId;
		}
		public String getOldDocumentId() {
			return oldDocumentId;
		}
		public void setOldDocumentId(String oldDocumentId) {
			this.oldDocumentId = oldDocumentId;
		}
		public String getPresignedUrl() {
			return presignedUrl;
		}
		public void setPresignedUrl(String presignedUrl) {
			this.presignedUrl = presignedUrl;
		}
		public String getFileName() {
			return fileName;
		}
		public void setFileName(String fileName) {
			this.fileName = fileName;
		}
		public String getFileType() {
			return fileType;
		}
		public void setFileType(String fileType) {
			this.fileType = fileType;
		}
		public String getSignedTime() {
			return signedTime;
		}
		public void setSignedTime(String signedTime) {
			this.signedTime = signedTime;
		}
		public String getStatus() {
			return status;
		}
		public void setStatus(String status) {
			this.status = status;
		}
	}
	
	public static class SignerInfo implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String name;
		private String roleName;
		private String status;
		private String personId;
		private Date signedTime;
		private EkycInfo ekycInfo;
		
		public String getName() {
			return name;
		}
		public void setName(String name) {
			this.name = name;
		}
		public String getRoleName() {
			return roleName;
		}
		public void setRoleName(String roleName) {
			this.roleName = roleName;
		}
		public String getStatus() {
			return status;
		}
		public void setStatus(String status) {
			this.status = status;
		}
		public String getPersonId() {
			return personId;
		}
		public void setPersonId(String personId) {
			this.personId = personId;
		}
		public Date getSignedTime() {
			return signedTime;
		}
		public void setSignedTime(Date signedTime) {
			this.signedTime = signedTime;
		}
		public EkycInfo getEkycInfo() {
			return ekycInfo;
		}
		public void setEkycInfo(EkycInfo ekycInfo) {
			this.ekycInfo = ekycInfo;
		}
	}
	
	public static class EkycInfo implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String personId;
		private String fullName;
		private String nation;
		private String dob;
		private String city;
		private String district;
		private String ward;
		private String idNumber;
		private String address;
		private String issuedDate;
		private String issuedPlace;
		private String gender;
		private List<ResourceInfo> selfies;
		private ResourceInfo documentFront;
		private ResourceInfo documentBack;
		private String documentType;
		private CaFile caFile;
		private String ekycBy;
		
		public String getPersonId() {
			return personId;
		}
		public void setPersonId(String personId) {
			this.personId = personId;
		}
		public String getFullName() {
			return fullName;
		}
		public void setFullName(String fullName) {
			this.fullName = fullName;
		}
		public String getNation() {
			return nation;
		}
		public void setNation(String nation) {
			this.nation = nation;
		}
		public String getCity() {
			return city;
		}
		public void setCity(String city) {
			this.city = city;
		}
		public String getDistrict() {
			return district;
		}
		public void setDistrict(String district) {
			this.district = district;
		}
		public String getWard() {
			return ward;
		}
		public void setWard(String ward) {
			this.ward = ward;
		}
		public String getIdNumber() {
			return idNumber;
		}
		public void setIdNumber(String idNumber) {
			this.idNumber = idNumber;
		}
		public String getAddress() {
			return address;
		}
		public void setAddress(String address) {
			this.address = address;
		}
		public String getIssuedDate() {
			return issuedDate;
		}
		public void setIssuedDate(String issuedDate) {
			this.issuedDate = issuedDate;
		}
		public String getIssuedPlace() {
			return issuedPlace;
		}
		public void setIssuedPlace(String issuedPlace) {
			this.issuedPlace = issuedPlace;
		}
		public String getGender() {
			return gender;
		}
		public void setGender(String gender) {
			this.gender = gender;
		}
		public List<ResourceInfo> getSelfies() {
			return selfies;
		}
		public void setSelfies(List<ResourceInfo> selfies) {
			this.selfies = selfies;
		}
		public ResourceInfo getDocumentFront() {
			return documentFront;
		}
		public void setDocumentFront(ResourceInfo documentFront) {
			this.documentFront = documentFront;
		}
		public ResourceInfo getDocumentBack() {
			return documentBack;
		}
		public void setDocumentBack(ResourceInfo documentBack) {
			this.documentBack = documentBack;
		}
		public String getDocumentType() {
			return documentType;
		}
		public void setDocumentType(String documentType) {
			this.documentType = documentType;
		}
		public String getDob() {
			return dob;
		}
		public void setDob(String dob) {
			this.dob = dob;
		}
		public String getEkycBy() {
			return ekycBy;
		}
		public void setEkycBy(String ekycBy) {
			this.ekycBy = ekycBy;
		}
		public CaFile getCaFile() {
			return caFile;
		}
		public void setCaFile(CaFile caFile) {
			this.caFile = caFile;
		}
	}
	
	public static class CaFile implements Serializable {
		private static final long serialVersionUID = 1L;

		private String documentId;
		private String type;
		private String presignedUrl;

		public String getDocumentId() {
			return documentId;
		}

		public void setDocumentId(String documentId) {
			this.documentId = documentId;
		}
		
		public String getType() {
			return type;
		}

		public void setType(String type) {
			this.type = type;
		}

		public String getPresignedUrl() {
			return presignedUrl;
		}

		public void setPresignedUrl(String presignedUrl) {
			this.presignedUrl = presignedUrl;
		}
	}
	
	public static class ResourceInfo implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String documentId;
		private String presignedUrl;
		
		public String getDocumentId() {
			return documentId;
		}
		public void setDocumentId(String documentId) {
			this.documentId = documentId;
		}
		public String getPresignedUrl() {
			return presignedUrl;
		}
		public void setPresignedUrl(String presignedUrl) {
			this.presignedUrl = presignedUrl;
		}
	}
	
	public static class EkycResponse implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private EkycRepository ekycRepository;
		private String front;
		private String back;
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
		public String getFront() {
			return front;
		}
		public void setFront(String front) {
			this.front = front;
		}
		public String getBack() {
			return back;
		}
		public void setBack(String back) {
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
	
	public static class EkycRepository implements Serializable {
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
	
	public static class EkycRepositoryAttrs implements Serializable {
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
