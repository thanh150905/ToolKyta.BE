// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/ERequest_flow_processing_kyta_erequest_view_contract.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
import java.util.Collections;
import java.util.HashMap;
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

import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.domain.UserInFoDetails;
import com.fis.excall.security.SecurityUtils;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;

@Service
public class ERequest_flow_processing_kyta_erequest_view_contract {
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
	
	public String getEnvelopeWebView(String payload) throws Exception {
		UserInFoDetails userInfo = SecurityUtils.getInfoCurrentUserLogin();
		OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(userInfo.getLogin());
		
		Map<String, Object> body = mapperClass.swap(HashMap.class, payload);
		String envelopeId = String.valueOf(body.get("envelopeId"));
		
		EnvelopeDTO envelope = envelopeClients.getEnvelopeById(envelopeId);
		
		String token = "Bearer " + accessToken.getValue();
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", token);
		
		ExternalWebViewInfo webviewInfo = this.callWebviewInfo(envelopeId, userInfo.getLogin(), headersEcon);
		
		Map<String, Object> response = new HashMap<String, Object>();
		response.put("webviewInfo", webviewInfo);
		response.put("envelope", envelope);
		return mapperClass.mapper().writeValueAsString(response);
	}
	
	private ExternalWebViewInfo callWebviewInfo(String envId, String email, HttpHeaders headersEcon) {
		String urlRefId = "/services/envelope/api/external/v1/envelope/webview/eprocess?envId=" + envId + "&email=" + email;
		HttpEntity<ExternalWebViewInfo> entityRefId = new HttpEntity<>(headersEcon);
		ResponseEntity<ExternalWebViewInfo> request = restTemplate.exchange(urlFPTeContract + urlRefId, HttpMethod.GET,
				entityRefId, ExternalWebViewInfo.class);
		return request.getBody();
	}
	
	public static class ExternalWebViewInfo implements Serializable {

		/**
		 * 
		 */
		private static final long serialVersionUID = 1L;
		public ExternalWebViewInfo() {
			super();
			// TODO Auto-generated constructor stub
		}

		private String url;

		private String cookieName;

		private String cookieValue;

		private Integer expireTime;

		
		private String username ;
		
		private String password;
		
		
		private String iframeUrl;
		
		public String getIframeUrl() {
			return iframeUrl;
		}

		public void setIframeUrl(String iframeUrl) {
			this.iframeUrl = iframeUrl;
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
