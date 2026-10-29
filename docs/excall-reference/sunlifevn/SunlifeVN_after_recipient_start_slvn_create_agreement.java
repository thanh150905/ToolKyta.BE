// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/SunlifeVN_after_recipient_start_slvn_create_agreement.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import java.net.URI;
import java.text.SimpleDateFormat;
import java.time.Instant;
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
import com.fis.excall.service.envelope.dto.AgreementDetailFPTCaCloudDTO;
import com.fis.excall.service.envelope.dto.EkycDetail;
import com.fis.excall.service.envelope.dto.EkycRepositoryDTO;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;
import com.fis.excall.service.envelope.dto.PartyDTO;
import com.fis.excall.service.envelope.dto.PersonalKycDetailProfileDTO;
import com.fis.excall.service.envelope.dto.RecipientDTO;

@Service
public class SunlifeVN_after_recipient_start_slvn_create_agreement {
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

	protected Object creatingEnvelope(Object payload) throws Exception {
		Map<String, Object> _payload = mapperClass.swap(HashMap.class, payload);
		String envelopeId = String.valueOf(_payload.get("envelopeId"));
		String contactId = null;
		if (_payload.get("contactId") != null) {
			contactId = String.valueOf(_payload.get("contactId"));
		}
		EnvelopeDTO envelope = envelopeClients.getEnvelopeById(envelopeId);

		/*
		 * prepare call to econtract
		 */
		OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(envelope.getOwner());
		String token = "Bearer " + accessToken.getValue();
//		HttpHeaders headersEcon = new HttpHeaders();
//		headersEcon.setContentType(MediaType.APPLICATION_JSON);
//		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
//		headersEcon.set("Authorization", token);

		if (!StringUtils.isEmpty(contactId)) {
			RecipientDTO recipientDTO = this.getRecipient(envelope, contactId);
			if (recipientDTO == null) {
				throw new RuntimeException("Recipient contact id is not exists");
			}

			try {
				List<String> signTypes = recipientDTO.getSignTypes();
				String agreementUuid = recipientDTO.getUsername();
				if (!signTypes.contains("sign_ekyc") && signTypes.contains("sign_fca.otp")
						&& StringUtils.isEmpty(agreementUuid)) {
					// create agreement
					PersonalKycDetailProfileDTO poInfo = null;
					try {
						poInfo = this.getPoInfo(token, contactId);
					} catch (Exception e) {
						throw new RuntimeException(e.getMessage());
					}

					if (poInfo == null) {
						throw new RuntimeException("PO ekyc infomation is not exists");
					}
					
					// check personal Id card expired
					Boolean isExpired = this.checkExpired(poInfo);
					
					if (!isExpired) {
						AgreementDetailFPTCaCloudDTO agreementDetailFPTCaCloudDTO = mapperClass
								.swap(AgreementDetailFPTCaCloudDTO.class, poInfo);
						agreementDetailFPTCaCloudDTO.setDocuments(null);
						agreementDetailFPTCaCloudDTO.setRecipientId(recipientDTO.getId());
						agreementDetailFPTCaCloudDTO.setTelephoneNumber(recipientDTO.getContact().getPhone());

						try {
							agreementDetailFPTCaCloudDTO = this.registryFPTCaCloud(token,
									agreementDetailFPTCaCloudDTO);
							recipientDTO.setUsername(agreementDetailFPTCaCloudDTO.getAgreementUUID());
						} catch (Exception e) {
							throw new RuntimeException(e.getMessage());
						}

						// save ekycRepository
						EkycRepositoryDTO ekycRepo = this.saveEkycRepository(token, envelope, recipientDTO,
								agreementDetailFPTCaCloudDTO, poInfo);

						EkycDetail ekycDetail = new EkycDetail();
						ekycDetail.setBillCode(ekycRepo.getBillCode());
						ekycDetail.setEnvelopeId(envelopeId);
						ekycDetail.setRecipientId(ekycRepo.getPersonalId());
						ekycDetail.setId(ekycRepo.getId());
						ekycDetail.setUsername(ekycRepo.getUsername());

						try {
							this.updateEnvelope(token, envelopeId, recipientDTO.getId(), ekycDetail);
						} catch (Exception e) {
							throw new RuntimeException(e.getMessage());
						}
					}
				}
			} catch (Exception e) {
				throw new RuntimeException(e.getMessage());
			}
		}

		// return link ký
		Thread.sleep(1000);
		return this.getSigningLink(token, envelopeId, contactId);
	}
	
	private Boolean checkExpired(PersonalKycDetailProfileDTO pkdpDto) throws Exception {
		Boolean isExpired = false;
		Map<String, Object> ekycContent = pkdpDto.getEkycContent();
		
		if (ekycContent.get("ngayHetHan") != null) {
			String expireDate = String.valueOf(ekycContent.get("ngayHetHan"));
			SimpleDateFormat formatter = new SimpleDateFormat("dd/MM/yyyy");
			Instant date = formatter.parse(expireDate).toInstant();
			if (date.isBefore(Instant.now())) {
				isExpired = true;
			}
		}
		
		return isExpired;
	}

	private String getSigningLink(String token, String envelopeId, String contactId) {
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", token);
		
		String url = "services/envelope/api/external/v1/envelopes/recipient?checkAuthenticate=true";

		Map<String, String> body = new HashMap<String, String>();

		body.put("envelopeId", envelopeId);
		if (!StringUtils.isEmpty(contactId)) {
			body.put("contactId", contactId);
		}

		HttpEntity<Object> entityEnvelope = new HttpEntity<>(body, headersEcon);
		try {
			ResponseEntity<String> res = restTemplate.exchange(urlFPTeContract + url, HttpMethod.POST, entityEnvelope,
					String.class);
			return res.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	private String updateEnvelope(String token, String envelopeId, String recipientId,
			EkycDetail ekycDetail) throws Exception {
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", token);
		
		String createEnvelope = "services/envelope/api/cacloud/replace/" + envelopeId + "/" + recipientId;

		HttpEntity<Object> entityEnvelope = new HttpEntity<>(ekycDetail, headersEcon);
		try {
			ResponseEntity<String> requestEcontract3 = restTemplate.exchange(urlFPTeContract + createEnvelope,
					HttpMethod.POST, entityEnvelope, String.class);
			return requestEcontract3.getBody();
		} catch (HttpStatusCodeException e) {
//			errorCount = errorCount + 1;
//			if (errorCount == retryPoint) {
			throw new RuntimeException(e.getResponseBodyAsString());
//			} else {
//				Thread.sleep(1000);
//				return this.updateEnvelope(errorCount, headersEcon, envelope);
//			}
		}
	}

	private EkycRepositoryDTO saveEkycRepository(String token, EnvelopeDTO envelope, RecipientDTO rcp,
			AgreementDetailFPTCaCloudDTO agreementDetailFPTCaCloudDTO, PersonalKycDetailProfileDTO pkdpDto)
			throws Exception {
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", token);
		
		String oldRepoId = String.valueOf(pkdpDto.getAttrs().get("id"));
		Map<String, Object> body = new HashMap<String, Object>();
		body.put("personalId", rcp.getId());
		body.put("resourceId", envelope.getId());
		body.put("resourceName", envelope.getName());
		body.put("resourceType", "e");
		body.put("username", agreementDetailFPTCaCloudDTO.getAgreementUUID());

		Map<String, Object> attrs = pkdpDto.getAttrs();
		attrs.put("signTypes", rcp.getSignTypes());
		attrs.remove("id"); // id này là ekyc_repository_id - có là do save vào eId

		body.put("attrs", attrs);

		EkycRepositoryDTO ekycRepo = null;
		// create ekyc_repository
		ekycRepo = this.createEkycRepo(headersEcon, body);

		// call clone ekyc_repository_details
		this.cloneEkycRepositoryDetail(headersEcon, oldRepoId, ekycRepo.getId());

		return ekycRepo;
	}

	private EkycRepositoryDTO createEkycRepo(HttpHeaders headersEcon, Map<String, Object> body) throws Exception {
		try {
			String url = urlFPTeContract + "services/common/api/ekyc-repositories";
			HttpEntity<Object> entity = new HttpEntity<>(body, headersEcon);
			ResponseEntity<EkycRepositoryDTO> response = restTemplate.postForEntity(url, entity,
					EkycRepositoryDTO.class);
			return response.getBody();
		} catch (HttpStatusCodeException e) {
//			errorCount = errorCount + 1;
//			if (errorCount == retryPoint) {
			throw new RuntimeException(e.getResponseBodyAsString());
//			} else {
//				Thread.sleep(1000);
//				return this.createEkycRepo(errorCount, headersEcon, body);
//			}
		}
	}

	private void cloneEkycRepositoryDetail(HttpHeaders headersEcon, String oldId, String newId) throws Exception {
		Map<String, Object> body = new HashMap<String, Object>();
		body.put("oldId", oldId);
		body.put("newId", newId);

		try {
			String url = urlFPTeContract + "services/common/api/ekycRepositoryDetails/detailss/clone";
			HttpEntity<Object> entity = new HttpEntity<>(body, headersEcon);
			restTemplate.postForEntity(url, entity, String.class);
		} catch (HttpStatusCodeException e) {
//			errorCount = errorCount + 1;
//			if (errorCount == retryPoint) {
			throw new RuntimeException(e.getResponseBodyAsString());
//			} else {
//				Thread.sleep(1000);
//				this.cloneEkycRepositoryDetail(errorCount, headersEcon, oldId, newId);
//			}
		}
	}

	private AgreementDetailFPTCaCloudDTO registryFPTCaCloud(String token, AgreementDetailFPTCaCloudDTO dto)
			throws Exception {
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", token);
		try {
			String registryFPTCaCloudUrl = "services/envelope/api/cacloud/registry/raw";
			HttpEntity<Object> request = new HttpEntity<>(dto, headersEcon);
			ResponseEntity<AgreementDetailFPTCaCloudDTO> requestEcontract = restTemplate.postForEntity(
					urlFPTeContract + registryFPTCaCloudUrl, request, AgreementDetailFPTCaCloudDTO.class);
			return requestEcontract.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException("Đăng ký FPTCaCloud: " + e.getResponseBodyAsString());
		}
	}

	private PersonalKycDetailProfileDTO getPoInfo(String token, String staffId) {
		String url = urlFPTeContract + "services/uaa/api/personal-kyc-detail-profiles/check-external?staffId=" + staffId;
		URI uri = URI.create(url);

		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", token);

		HttpEntity<Object> entity = new HttpEntity<>(headersEcon);
		try {
			ResponseEntity<PersonalKycDetailProfileDTO> request = restTemplate.exchange(uri, HttpMethod.GET, entity,
					PersonalKycDetailProfileDTO.class);
			return request.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	public RecipientDTO getRecipient(EnvelopeDTO e, String contactId) {
		List<PartyDTO> parties = e.getParties();
		if (parties != null && parties.size() > 0) {
			for (PartyDTO party : parties) {
				List<RecipientDTO> recipients = party.getRecipients();
				if (recipients != null && recipients.size() > 0) {
					for (RecipientDTO rcp : recipients) {
						if (rcp.getContact().getId().equals(contactId)) {
							return rcp;
						}
					}
				}
			}
		}
		return null;
	}
}
