// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/SSI_after_flow_finish_ssi_get_econtract_from_integrate.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
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
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.domain.UserInFoDetails;
import com.fis.excall.security.SecurityUtils;
import com.fis.excall.service.envelope.dto.AclDTO;
import com.fis.excall.service.envelope.dto.DocumentDTO;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;
import com.fis.excall.service.envelope.dto.PartyDTO;
import com.fis.excall.service.envelope.dto.RecipientDTO;
import com.fis.excall.web.rest.errors.ErrorConstants;

@Service
public class SSI_after_flow_finish_ssi_get_econtract_from_integrate {

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

	/*
	 * after_flow_finish_ssi_get_econtract_from_integrate
	 */
	public Object getDetailEnvelope(Object payload, String requestId) throws Exception {
		try {
			Map<String, Object> body = mapperClass.swap(HashMap.class, payload);

			UserInFoDetails userInfo = SecurityUtils.getInfoCurrentUserLogin();
			OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(userInfo.getLogin());

			/**
			 * thông tin điền kèm temaple
			 */

			String envelopeId = String.valueOf(body.get("envelopeId"));

			EnvelopeDTO envelope = envelopeClients.getEnvelopeById(envelopeId);

			if (!userInfo.getCustId().equals(envelope.getCustId())) {
				throw new RuntimeException(ErrorConstants.ERR_PERMISSION_DENIED);
			}

			if ("draft".equals(envelope.getStatus())) {
				throw new RuntimeException("error.wrongStatus");
			}

			BodyToSendSSI bodyToSendSSI = new BodyToSendSSI();
			bodyToSendSSI.setRequestId(requestId);
			bodyToSendSSI.setEnvelopeId(envelopeId);
			bodyToSendSSI.setContractStatus(envelope.getStatus());
			bodyToSendSSI.setContractName(envelope.getName());
			bodyToSendSSI.setInternalUrl(urlFPTeContract + "view-fb/" + envelopeId);
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
				bodyToSendSSI.setFiles(files);
			}
			
			if (!isDossier) {
				String file = this.getFile(headersEcon, envelope);
				bodyToSendSSI.setFile(file);
			}
			
			Map<String, String> params = new HashMap<String, String>();
			params.put("resourceId", envelope.getId());
			params.put("custId", String.valueOf(envelope.getCustId()));
			List<AclDTO> acls = envelopeClients.getAcl(params);

			List<Object> digitalSignatureDetails = envelopeClients.getInternalDigitailSignatureDetails(envelopeId);
			
			List<RecipientSignatureInfo> recipientSignatureInfos = new ArrayList<RecipientSignatureInfo>();
			
			List<PartyDTO> parties = envelope.getParties();
			if (parties != null && parties.size() > 0) {
				for (PartyDTO party : parties) {
					List<RecipientDTO> recipients = party.getRecipients();
					if (recipients != null && recipients.size() > 0) {
						for (RecipientDTO recipient : recipients) {
							WebviewInfo webviewInfo = callWebviewInfo(envelopeId, recipient.getId(), recipient.getContact().getId(), headersEcon);
							RecipientSignatureInfo info = new RecipientSignatureInfo();
							Webview webview = new Webview();
							webview.setUrl(urlFPTeContract + "fi-wv/" + envelopeId + "/" + recipient.getId() + "/act");
							webview.setCookieName(webviewInfo.getCookieName());
							webview.setCookieValue(webviewInfo.getCookieValue());
							webview.setExpireTime(webviewInfo.getExpireTime());
							webview.setUsername(recipient.getContact().getEmail());
							
							String urlWebview = urlFPTeContract + "fi-wv/" + envelopeId + "/" + recipient.getId() + "/act?jwt=" + webviewInfo.getCookieValue();
							webview.setIframeUrl(urlWebview);
							info.setRecipientId(recipient.getId());
							info.setCustomerUrl(urlFPTeContract + "fi/" + envelopeId + "/" + recipient.getId() + "/login");
							info.setSigningStatus(false);
							// signature info
							for (Object digitalSignatureDetail : digitalSignatureDetails) {
								JsonNode rootNode = mapperClass.mapper().readTree(mapperClass.mapper().writeValueAsString(digitalSignatureDetail));
								String recipientId = rootNode.get("recipientId").asText();
								if (recipient.getId() != null && recipient.getId().equals(recipientId)) {
									info.setDigitalSignatureDetail(digitalSignatureDetail);
									info.setSigningStatus(true);
									break;
								}
							}
							// customer password
							for (AclDTO acl : acls) {
								if (recipient.getId() != null && recipient.getId().equals(acl.getRecipientId())) {
									info.setCustomerPwd(acl.getPassword());
									webview.setPassword(acl.getPassword());
									break;
								}
							}
							if (isDossier) {
								info.setCustomerUrl(dossierUrl + envelope.getId() + "/" + recipient.getId() + "/login");
								
								webview.setUrl(dossierUrl + envelope.getId() + "/" + recipient.getId());
								urlWebview = dossierUrl + envelope.getId() + "/" + recipient.getId() + "?jwt=" + webviewInfo.getCookieValue();
								webview.setIframeUrl(urlWebview);
							}
							info.setWebview(webview);
							recipientSignatureInfos.add(info);
						}
					}
				}
			}
			bodyToSendSSI.setRecipientSignatureInfo(recipientSignatureInfos);
//			bodyToSendSSI.setDigitailSignatureDetails(digitailSignatureDetails);
			return mapperClass.mapper().writeValueAsString(bodyToSendSSI);
		} catch (Exception ex) {
			throw new RuntimeException(ex.getMessage());
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
		private Webview webview;
		
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
		public Webview getWebview() {
			return webview;
		}
		public void setWebview(Webview webview) {
			this.webview = webview;
		}
	}
	
	public class Webview implements Serializable {
		/**
		 * 
		 */
		private static final long serialVersionUID = 1L;
		
		private String url;
		private String cookieName;
		private String cookieValue;
		private Integer expireTime;
		private String username;
		private String password;
		private String iframeUrl;
		
		public String getUrl() {
			return url;
		}
		public void setUrl(String url) {
			this.url = url;
		}
		public String getCookieName() {
			return cookieName;
		}
		public void setCookieName(String cookieName) {
			this.cookieName = cookieName;
		}
		public String getCookieValue() {
			return cookieValue;
		}
		public void setCookieValue(String cookieValue) {
			this.cookieValue = cookieValue;
		}
		public Integer getExpireTime() {
			return expireTime;
		}
		public void setExpireTime(Integer expireTime) {
			this.expireTime = expireTime;
		}
		public String getUsername() {
			return username;
		}
		public void setUsername(String username) {
			this.username = username;
		}
		public String getPassword() {
			return password;
		}
		public void setPassword(String password) {
			this.password = password;
		}
		public String getIframeUrl() {
			return iframeUrl;
		}
		public void setIframeUrl(String iframeUrl) {
			this.iframeUrl = iframeUrl;
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
		public List<RecipientSignatureInfo> getRecipientSignatureInfo() {
			return recipientSignatureInfo;
		}
		public void setRecipientSignatureInfo(List<RecipientSignatureInfo> recipientSignatureInfo) {
			this.recipientSignatureInfo = recipientSignatureInfo;
		}
		public List<Map<String, Object>> getFiles() {
			return files;
		}
		public void setFiles(List<Map<String, Object>> files) {
			this.files = files;
		}
	}
	
	private WebviewInfo callWebviewInfo(String envId, String rcpId, String contactId, HttpHeaders headersEcon) {
        String urlRefId = "services/envelope/api/external/v1/envelope/webview?envId=" + envId + "&recipientId=" + rcpId;
        HttpEntity<WebviewInfo> entityRefId = new HttpEntity<>(headersEcon);
        ResponseEntity<WebviewInfo> request = restTemplate.exchange(urlFPTeContract + urlRefId, HttpMethod.GET,
            entityRefId, WebviewInfo.class);
        return request.getBody();
    }
	
	public static class WebviewInfo implements Serializable {

        /**
         *
         */
        private static final long serialVersionUID = -128203078170152462L;

        public WebviewInfo() {
            super();
            // TODO Auto-generated constructor stub
        }

        private String url;

        private String cookieName;

        private String cookieValue;

        private Integer expireTime;

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }

        public String getCookieName() {
            return cookieName;
        }

        public void setCookieName(String cookieName) {
            this.cookieName = cookieName;
        }

        public String getCookieValue() {
            return cookieValue;
        }

        public void setCookieValue(String cookieValue) {
            this.cookieValue = cookieValue;
        }

        public Integer getExpireTime() {
            return expireTime;
        }

        public void setExpireTime(Integer expireTime) {
            this.expireTime = expireTime;
        }
    }
}
