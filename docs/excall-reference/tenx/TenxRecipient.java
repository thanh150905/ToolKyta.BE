// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/TenxRecipient.java
// Secret đã thay bằng "<REDACTED>" (4 chỗ).
package com.fis.excall.service.test;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.codec.digest.HmacAlgorithms;
import org.apache.commons.codec.digest.HmacUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.script.engine.ScriptObject;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;
import com.fis.excall.service.envelope.dto.PartyDTO;
import com.fis.excall.service.envelope.dto.RecipientDTO;

/**
 * @Author : FPT.Hieult35
 */
@Service
public class TenxRecipient extends ScriptObject {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;
	
	@Autowired
	private EnvelopeClient envelopeClients;
	
	private static final String urlTenx = "https://gw-dev.saladin.vn/api/v1/contract-center/vendor/contracts/notify";
	
	/*
	 * flow_finish_tenx_econtract_integrate
	 */
	public String sendFlowFinish(String envId) throws Exception {
		String clientId = "<REDACTED>";
		EnvelopeDTO envelope = envelopeClients.getEnvelopeById(envId);
		RecipientDTO recipient = this.findLastSigned(envelope);
		List<String> refIds = envelope.getRefId();
		String refId = null;
		if (refIds != null && refIds.size() > 0) {
			refId = refIds.get(0);
		}
		
		Map<String, Object> body = new HashMap<String, Object>();

		String envStatus = envelope.getStatus();
		String recipientContactId = recipient.getContact().getId();
		String recipientStatus = recipient.getStatus();
//		ZonedDateTime zonedDateTime = envelope.getCreatedDate();
		long timestamp = Math.round(new Date().getTime() / 1000);
//		Instant timestamp = zonedDateTime.toInstant();
		HmacUtils hm256 = new HmacUtils(HmacAlgorithms.HMAC_SHA_256, "<REDACTED>");
		String message ="[" + Long.toString(timestamp)+ "]" + "&" + "[" + clientId + "]" + "&" + "[" + refId + "]" + "&" + "[" +envelope.getId() + "]" +
		"&" + "[" + envStatus + "]" + "&" + "[" + recipientStatus + "]" + "&" + "[" + recipientContactId + "]";
		body.put("client_id", clientId);
		body.put("ref_id", refId);
		body.put("envelope_id", envelope.getId());
		body.put("status", envStatus);
		body.put("recipient_status", recipientStatus);
		body.put("recipient_contact_id", recipientContactId);
		body.put("timestamp", timestamp);
		body.put("signature", hm256.hmacHex(message));
		
		String url = urlTenx;
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		String bodyString = mapperClass.mapper().writeValueAsString(body);
		// build the request
		HttpEntity<String> entity = new HttpEntity<>(bodyString, headers);
		// send POST request
		try {
			ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
			String responString = mapperClass.mapper().writeValueAsString(response.getBody());
			JsonNode rootNode = mapperClass.mapper().readTree(responString);
			String success = String.valueOf(rootNode.path("code").asInt());
			if (success.equals("0")) {
				return responString;
			} else {
				throw new RuntimeException(responString);
			}
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	/*
	 * recipient_finished_tenx_send_status_recipient
	 */
	public String sendRecipientFinish(String envId, String recipientId) throws Exception {
		String clientId = "<REDACTED>";
		EnvelopeDTO envelope = envelopeClients.getEnvelopeById(envId);
		RecipientDTO recipient = this.findRecipent(recipientId, envelope.getParties());
		List<String> refIds = envelope.getRefId();
		String refId = null;
		if (refIds == null || refIds.size() == 0) {
			refId = envelope.getRefId().get(0);
		}
		
		Map<String, Object> body = new HashMap<String, Object>();

		String envStatus = envelope.getStatus();
		String recipientContactId = recipient.getContact().getId();
		String recipientStatus = recipient.getStatus();
//		ZonedDateTime zonedDateTime = envelope.getCreatedDate();
		long timestamp = Math.round(new Date().getTime() / 1000);
//		Instant timestamp = zonedDateTime.toInstant();
		HmacUtils hm256 = new HmacUtils(HmacAlgorithms.HMAC_SHA_256, "<REDACTED>");
		String message ="[" + Long.toString(timestamp)+ "]" + "&" + "[" + clientId + "]" + "&" + "[" + refId + "]" + "&" + "[" +envelope.getId() + "]" +
		"&" + "[" + envStatus + "]" + "&" + "[" + recipientStatus + "]" + "&" + "[" + recipientContactId + "]";
		body.put("client_id", clientId);
		body.put("ref_id", refId);
		body.put("envelope_id", envelope.getId());
		body.put("status", envStatus);
		body.put("recipient_status", recipientStatus);
		body.put("recipient_contact_id", recipientContactId);
		body.put("timestamp", timestamp);
		body.put("signature", hm256.hmacHex(message));
		
		String url = urlTenx;
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		String bodyString = mapperClass.mapper().writeValueAsString(body);
		// build the request
		HttpEntity<String> entity = new HttpEntity<>(bodyString, headers);
		// send POST request
		try {
			ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
			String responString = mapperClass.mapper().writeValueAsString(response.getBody());
			JsonNode rootNode = mapperClass.mapper().readTree(responString);
			String success = String.valueOf(rootNode.path("code").asInt());
			if (success.equals("0")) {
				return responString;
			} else {
				throw new RuntimeException(responString);
			}
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}
	
	public RecipientDTO findLastSigned(EnvelopeDTO envelope) {
		RecipientDTO currentRecipient = null;
		for (PartyDTO party : envelope.getParties()) {
			for (RecipientDTO recipient : party.getRecipients()) {
				if (currentRecipient == null) {
					currentRecipient = recipient;
				} else {
					Date currentDate = currentRecipient.getSignDate();
					if (currentDate.compareTo(recipient.getSignDate()) > 0) {
						currentRecipient = recipient;
					}
				}
			}
		}
		return currentRecipient;
	}

    	
    	
	public RecipientDTO findRecipent(String id, List<PartyDTO> parties) {

		if (parties != null && parties.size() > 0) {

			for (PartyDTO party : parties) {
				List<RecipientDTO> rcps = party.getRecipients();

				if (rcps != null && rcps.size() > 0) {

					for (RecipientDTO rcp : rcps) {

						if (id.equals(rcp.getId())) {
							return rcp;
						}
					}

				}

			}

		}

		return null;

	}

}