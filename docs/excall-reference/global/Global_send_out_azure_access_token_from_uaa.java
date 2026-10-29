// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/Global_send_out_azure_access_token_from_uaa.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Collections;
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
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;

@Service
public class Global_send_out_azure_access_token_from_uaa {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;
	
	@Autowired
	private UaaClient uaaClient;
	
	@Autowired
	private EnvelopeClient envelopeClients;

	private static final String urlFPTeContract = "https://demo.econtract.fpt.com/app/";

	private Object saveToken(Object payload) throws Exception {
    	Map<String, Object> bodya = mapperClass.swap(HashMap.class, payload);
        String email = String.valueOf(bodya.get("email"));
        String custId = String.valueOf(bodya.get("custId"));
        String tokenVsc = String.valueOf(bodya.get("access_token"));
        
        Map<String, Object> body = mapperClass.swap(HashMap.class, bodya.get("body"));
        
        String expireIn = null;
        if (body.containsKey("expires_in") && body.get("expires_in") != null) {
        	expireIn = String.valueOf(body.get("expires_in"));
        }

        OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(email);
        List<String> cus = Arrays.asList("2223", "2062");
        if (!cus.contains(custId)){
            return "Don't save";
        }
        
        if ("2223".equals(custId)) {
        	return this.saveTokenGSM(accessToken, custId, email, tokenVsc, body, expireIn);
        } else {
        	String token = "Bearer " + accessToken.getValue();
            HttpHeaders headersEcon = new HttpHeaders();
            headersEcon.setContentType(MediaType.APPLICATION_JSON);
            headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            headersEcon.set("Authorization", token);
            String idCustomerAuthen = custId +"_" + email;

    		String urlDownload = urlFPTeContract + "services/excall/api/customer-authen";
            Map<String, Object> body1 = new HashMap<>();
            body1.put("token", tokenVsc);
            body1.put("custId", custId);
            body1.put("id", idCustomerAuthen);
            
            if (!StringUtils.isEmpty(expireIn)) {
            	Instant now = Instant.now();
            	body1.put("expiredTime", now.plus(Long.parseLong(expireIn), ChronoUnit.SECONDS));
            }
            
            body1.put("content", mapperClass.mapper().writeValueAsString(bodya.get("body")));
            String requestBody1 = mapperClass.mapper().writeValueAsString(body1);
            HttpEntity<String> request1 = new HttpEntity<>(requestBody1, headersEcon);
    		
    		try {
    			ResponseEntity<String> response = restTemplate.exchange(urlDownload, HttpMethod.POST, request1, String.class);
                return response.getBody();
    		} catch (HttpStatusCodeException e) {
    			throw new RuntimeException(e.getResponseBodyAsString());
    		}
        }
    }
	
	public String saveTokenGSM(OAuth2AccessToken accessToken, String custId, String email, String tokenVsc, Map<String, Object> body, String expireIn) throws Exception {
		String token = "Bearer " + accessToken.getValue();
        HttpHeaders headersEcon = new HttpHeaders();
        headersEcon.setContentType(MediaType.APPLICATION_JSON);
        headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        headersEcon.set("Authorization", token);
        String idCustomerAuthen = custId +"_" + email;

		String urlDownload = urlFPTeContract + "services/batch/api/customer-authen";
        Map<String, Object> body1 = new HashMap<>();
        body1.put("token", tokenVsc);
        body1.put("custId", custId);
        body1.put("id", idCustomerAuthen);
        
        if (!StringUtils.isEmpty(expireIn)) {
        	Instant now = Instant.now();
        	body1.put("expiredTime", now.plus(Long.parseLong(expireIn), ChronoUnit.SECONDS));
        }
        
        body1.put("content", mapperClass.mapper().writeValueAsString(body));
        String requestBody1 = mapperClass.mapper().writeValueAsString(body1);
        HttpEntity<String> request1 = new HttpEntity<>(requestBody1, headersEcon);
		
		try {
			ResponseEntity<String> response = restTemplate.exchange(urlDownload, HttpMethod.POST, request1, String.class);
            return response.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}
}
