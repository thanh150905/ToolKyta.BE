// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/SSI_recipient_finished_ssi_send_status_recipient.java
// Secret đã thay bằng "<REDACTED>" (4 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Base64;
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
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.service.envelope.dto.AclDTO;
import com.fis.excall.service.envelope.dto.DocumentDTO;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;
import com.fis.excall.service.envelope.dto.PartyDTO;
import com.fis.excall.service.envelope.dto.RecipientDTO;

@Service
public class SSI_recipient_finished_ssi_send_status_recipient {

	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;

	@Autowired
	private EnvelopeClient envelopeClients;

	private static final String urlFPTeContract = "https://10.15.68.187:8080/app/";
//	private static final String urlFPTeContract = "https://demo.econtract.fpt.com/app/";
	
	private static final String dossierUrl = "https://demo-econtract.chungthucdientu.vn/signature-process/";
	private static final String urlSsiToken = "https://10.242.0.200:443/inhouse/is/connect/token";
	private static final String urlSsiSigningResult = "https://10.242.0.200:443/inhouse/econtract/partner/synccontract/signing-result";

	private static final String grant_type = "password";
	private static final String username = "<REDACTED>";
	private static final String password = "<REDACTED>";
	private static final String client_id = "<REDACTED>";
	private static final String client_secret = "<REDACTED>";
	private static final String scope = "econtract_gateway_sc";

	/*
	 * recipient_finished_ssi_send_status_recipient
	 */
	public Object sendRecipientFinish(String envelopeId, String recipientId, String password) {
		try {
			EnvelopeDTO envelope = envelopeClients.getEnvelopeById(envelopeId);
			OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(envelope.getOwner());
			String access_token = "Bearer " + this.getAccessToken();
			
			List<String> refIds = envelope.getRefId();
			String refId = null;
			if (refIds != null && refIds.size() > 0) {
				refId = refIds.get(0);
			}
			RecipientFinishResult rfr = new RecipientFinishResult();
			rfr.setRequestId(refId);
			rfr.setEnvelopeId(envelopeId);
			rfr.setContractStatus("processing");
			rfr.setContractName(envelope.getName());
			rfr.setInternalUrl(urlFPTeContract + "view-fb/" + envelopeId);
			/*
			 * prepare call to econtract
			 */
			String token = "Bearer " + accessToken.getValue();
			HttpHeaders headersEcon = new HttpHeaders();
			headersEcon.setContentType(MediaType.APPLICATION_JSON);
			headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
			headersEcon.set("Authorization", token);

			Boolean isDossier = false;
			List<Map<String, Object>> files = new ArrayList<Map<String,Object>>();
			if (envelope.getDocuments() != null && envelope.getDocuments().size() > 0) {
				for (DocumentDTO doc : envelope.getDocuments()) {
					if ("DOSSIER".contentEquals(doc.getType())) {
						isDossier = true;
						Map<String, Object> file = new HashMap<String, Object>();
						file.put("fileName", doc.getName());
						file.put("file",  this.getFile(headersEcon, envelope.getId(), doc.getId()));
						file.put("order", doc.getOrder());
						
						files.add(file);
					}
				}
				rfr.setFiles(files);
			}
			
			if (!isDossier) {
				String file = this.getFile(headersEcon, envelope);
				rfr.setFile(file);
			}
			
			RecipientSignatureInfo rsi = new RecipientSignatureInfo();
			rsi.setRecipientId(recipientId);
			rsi.setCustomerUrl(urlFPTeContract + "fi/" + envelopeId + "/" + recipientId + "/login");
			rsi.setCustomerPwd(password);
			rsi.setSigningStatus(false);
			List<Object> digitalSignatureDetails = envelopeClients.getInternalDigitailSignatureDetails(envelopeId);
			// signature info
			for (Object digitalSignatureDetail : digitalSignatureDetails) {
				JsonNode rootNode = mapperClass.mapper().readTree(mapperClass.mapper().writeValueAsString(digitalSignatureDetail));
				String rId = rootNode.get("recipientId").asText();
				if (recipientId.equals(rId)) {
					rsi.setSigningStatus(true);
					rsi.setDigitalSignatureDetail(digitalSignatureDetail);
					break;
				}
			}
			if (isDossier) {
				rsi.setCustomerUrl(dossierUrl + envelope.getId() + "/" + recipientId + "/login");
			}
			rfr.setCurrentRecipient(rsi);
			
			// next recipient
			NextRecipient nextRecipient = this.getNextRecipient(headersEcon, envelope, recipientId, isDossier);
			rfr.setNextRecipient(nextRecipient);
			
			String url = urlSsiSigningResult;
			HttpHeaders headersSSI = new HttpHeaders();
			headersSSI.setContentType(MediaType.APPLICATION_JSON);
			headersSSI.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
			headersSSI.set("Authorization", access_token);

			HttpEntity<Object> body = new HttpEntity<>(rfr, headersSSI);
			Map<String, Object> bodyxxx = new HashMap<>();
			
			try {
				ResponseEntity<String> request = restTemplate.exchange(url, HttpMethod.POST, body, String.class);
				JsonNode rootNode = mapperClass.mapper().readTree(request.getBody());
				if (rootNode.get("httpStatus").asInt() == 200) {
					bodyxxx.put("callback", mapperClass.mapper().writeValueAsString(rfr));
               		bodyxxx.put("response", request.getBody());
					return bodyxxx;
				} else {
					bodyxxx.put("callback", mapperClass.mapper().writeValueAsString(rfr));
                	bodyxxx.put("response", request.getBody());
					throw new RuntimeException(mapperClass.mapper().writeValueAsString(bodyxxx));
				}
			} catch (HttpStatusCodeException e) {
				bodyxxx.put("callback", mapperClass.mapper().writeValueAsString(rfr));
                bodyxxx.put("response", e.getResponseBodyAsString());
				throw new RuntimeException(mapperClass.mapper().writeValueAsString(bodyxxx));
			}

		} catch (Exception ex) {
			throw new RuntimeException(ex.getMessage());
		}
	}
	
	private NextRecipient getNextRecipient(HttpHeaders headersEcon, EnvelopeDTO envelope, String recipientId, Boolean isDossier) throws Exception {
		Map<String, String> params = new HashMap<String, String>();
		params.put("resourceId", envelope.getId());
		params.put("custId", String.valueOf(envelope.getCustId()));
		List<AclDTO> acls = envelopeClients.getAcl(params);
		
		// build the request
		boolean isNextRecipient = false;
		int p = 0;
		for (PartyDTO party : envelope.getParties()) {
			int r = 0;
			for (RecipientDTO recipient : party.getRecipients()) {
				if (isNextRecipient) {
					NextRecipient nextRcp = new NextRecipient();
					nextRcp.setRecipientId(recipient.getId());
					nextRcp.setCustomerUrl(urlFPTeContract + "fi/" + envelope.getId() + "/" + recipient.getId() + "/login");
					nextRcp.setCoversWholeDocument(false);
					if (p + 1 == envelope.getParties().size() && r + 1 == party.getRecipients().size()) {
						nextRcp.setCoversWholeDocument(true);
					}
					if (isDossier) {
						nextRcp.setCustomerUrl(dossierUrl + envelope.getId() + "/" + recipient.getId() + "/login");
					}
					// customer password
					for (AclDTO acl : acls) {
						if (recipient.getId() != null && recipient.getId().equals(acl.getRecipientId())) {
							nextRcp.setCustomerPwd(acl.getPassword());
							break;
						}
					}
					return nextRcp;
				} else {
					if (recipientId.equals(recipient.getId())) {
						isNextRecipient = true;
					}
				}
				r++;
			}
			p++;
		}
		return null;
	}
	
	private String getAccessToken() {
		String url = urlSsiToken;
		// create headers
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
		// add parameters
		MultiValueMap<String, String> body = new LinkedMultiValueMap<String, String>();
		body.add("grant_type", grant_type);
		body.add("username", username);
		body.add("password", password);
		body.add("client_id", client_id);
		body.add("client_secret",client_secret);
		body.add("scope", scope);
		// make an request with headers
		HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<MultiValueMap<String, String>>(
				body, headers);
		try {
			ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, request,
					String.class);
			JsonNode rootNode = null;
			rootNode = mapperClass.mapper().readTree(response.getBody());
			return rootNode.path("access_token").asText();
		} catch (Exception e) {
			throw new RuntimeException(e.getMessage());
		}
	}
	
	public String getFile(HttpHeaders headersEcon, EnvelopeDTO envelope) {
		List<DocumentDTO> documentDTO = envelope.getDocuments();
		String urlDownload = "services/envelope/api/envelope/{envelopeId}/doc/{docId}/content";
		// build the request
		HttpEntity<Object> request = new HttpEntity<>(headersEcon);
		ResponseEntity<byte[]> response = this.restTemplate.exchange(urlFPTeContract + urlDownload, HttpMethod.GET,
				request, byte[].class, envelope.getId(), documentDTO.get(0).getId());
		byte[] fileContent = response.getBody();
		return Base64.getEncoder().encodeToString(fileContent);
	}
	
	public String getFile(HttpHeaders headersEcon, String envelopeId, String docId) {
		String urlDownload = "services/envelope/api/envelope/{envelopeId}/doc/{docId}/content";
		// build the request
		HttpEntity<Object> request = new HttpEntity<>(headersEcon);
		ResponseEntity<byte[]> response = this.restTemplate.exchange(urlFPTeContract + urlDownload, HttpMethod.GET,
				request, byte[].class, envelopeId, docId);
		byte[] fileContent = response.getBody();
		return Base64.getEncoder().encodeToString(fileContent);
	}

	public class RecipientSignatureInfo implements Serializable {
		/**
		 * 
		 */
		private static final long serialVersionUID = 1L;
		
		private String recipientId;
		private String ssiSignature;
		private String customerUrl;
		private String customerPwd;
		private boolean signingStatus;
		private Object digitalSignatureDetail;
		
		public String getRecipientId() {
			return recipientId;
		}
		public void setRecipientId(String recipientId) {
			this.recipientId = recipientId;
		}
		public String getSsiSignature() {
			return ssiSignature;
		}
		public void setSsiSignature(String ssiSignature) {
			this.ssiSignature = ssiSignature;
		}
		public String getCustomerUrl() {
			return customerUrl;
		}
		public void setCustomerUrl(String customerUrl) {
			this.customerUrl = customerUrl;
		}
		public String getCustomerPwd() {
			return customerPwd;
		}
		public void setCustomerPwd(String customerPwd) {
			this.customerPwd = customerPwd;
		}
		public boolean getSigningStatus() {
			return signingStatus;
		}
		public void setSigningStatus(boolean signingStatus) {
			this.signingStatus = signingStatus;
		}
		public Object getDigitalSignatureDetail() {
			return digitalSignatureDetail;
		}
		public void setDigitalSignatureDetail(Object digitalSignatureDetail) {
			this.digitalSignatureDetail = digitalSignatureDetail;
		}
	}
	
	public class RecipientFinishResult implements Serializable {
		/**
		 * 
		 */
		private static final long serialVersionUID = 1L;
		
		private String requestId;
		private String envelopeId;
		private String contractStatus;
		private String contractName;
		private String internalUrl;
		private String file;
		private RecipientSignatureInfo currentRecipient;
		private NextRecipient nextRecipient;
		private List<Map<String, Object>> files;
		
		public String getRequestId() {
			return requestId;
		}
		public void setRequestId(String requestId) {
			this.requestId = requestId;
		}
		public String getEnvelopeId() {
			return envelopeId;
		}
		public void setEnvelopeId(String envelopeId) {
			this.envelopeId = envelopeId;
		}
		public String getContractStatus() {
			return contractStatus;
		}
		public void setContractStatus(String contractStatus) {
			this.contractStatus = contractStatus;
		}
		public String getContractName() {
			return contractName;
		}
		public void setContractName(String contractName) {
			this.contractName = contractName;
		}
		public String getInternalUrl() {
			return internalUrl;
		}
		public void setInternalUrl(String internalUrl) {
			this.internalUrl = internalUrl;
		}
		public String getFile() {
			return file;
		}
		public void setFile(String file) {
			this.file = file;
		}
		public RecipientSignatureInfo getCurrentRecipient() {
			return currentRecipient;
		}
		public void setCurrentRecipient(RecipientSignatureInfo currentRecipient) {
			this.currentRecipient = currentRecipient;
		}
		public NextRecipient getNextRecipient() {
			return nextRecipient;
		}
		public void setNextRecipient(NextRecipient nextRecipient) {
			this.nextRecipient = nextRecipient;
		}
		public List<Map<String, Object>> getFiles() {
			return files;
		}
		public void setFiles(List<Map<String, Object>> files) {
			this.files = files;
		}
	}
	
	public class NextRecipient implements Serializable {
		/**
		 * 
		 */
		private static final long serialVersionUID = 1L;
		
		private String recipientId;
		private boolean ssiSignature;
		private String customerUrl;
		private String customerPwd;
		private boolean coversWholeDocument;
		
		public String getRecipientId() {
			return recipientId;
		}
		public void setRecipientId(String recipientId) {
			this.recipientId = recipientId;
		}
		public boolean isSsiSignature() {
			return ssiSignature;
		}
		public void setSsiSignature(boolean ssiSignature) {
			this.ssiSignature = ssiSignature;
		}
		public String getCustomerUrl() {
			return customerUrl;
		}
		public void setCustomerUrl(String customerUrl) {
			this.customerUrl = customerUrl;
		}
		public String getCustomerPwd() {
			return customerPwd;
		}
		public void setCustomerPwd(String customerPwd) {
			this.customerPwd = customerPwd;
		}
		public boolean isCoversWholeDocument() {
			return coversWholeDocument;
		}
		public void setCoversWholeDocument(boolean coversWholeDocument) {
			this.coversWholeDocument = coversWholeDocument;
		}
	}

	public class BodyToSendSSI implements Serializable {
		/**
		 * 
		 */
		private static final long serialVersionUID = -4498456588201860707L;
		
		private String requestId;
		private String envelopeId;
		private String contractStatus;
		private String contractName;
		private String internalUrl;
		private String file;
		private List<RecipientSignatureInfo> recipientSignatureInfo;
		
		public String getRequestId() {
			return requestId;
		}
		public void setRequestId(String requestId) {
			this.requestId = requestId;
		}
		public String getEnvelopeId() {
			return envelopeId;
		}
		public void setEnvelopeId(String envelopeId) {
			this.envelopeId = envelopeId;
		}
		public String getContractStatus() {
			return contractStatus;
		}
		public void setContractStatus(String contractStatus) {
			this.contractStatus = contractStatus;
		}
		public String getContractName() {
			return contractName;
		}
		public void setContractName(String contractName) {
			this.contractName = contractName;
		}
		public String getInternalUrl() {
			return internalUrl;
		}
		public void setInternalUrl(String internalUrl) {
			this.internalUrl = internalUrl;
		}
		public String getFile() {
			return file;
		}
		public void setFile(String file) {
			this.file = file;
		}
		public List<RecipientSignatureInfo> getRecipientSignatureInfo() {
			return recipientSignatureInfo;
		}
		public void setRecipientSignatureInfo(List<RecipientSignatureInfo> recipientSignatureInfo) {
			this.recipientSignatureInfo = recipientSignatureInfo;
		}
	}

}
