// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/GSM_flow_start_gsm_create_batch.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
import java.time.ZonedDateTime;
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
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.domain.UserInFoDetails;
import com.fis.excall.security.SecurityUtils;
import com.fis.excall.service.InternalExcallService;
import com.fis.excall.service.dto.RedisEnvelopeRefIdDTO;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;

@Service
public class GSM_flow_start_gsm_create_batch {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;
	
	@Autowired
	private InternalExcallService internalExcallService;

//	private static final String urlFPTeContract = "https://10.14.121.18:30600/app";
	private static final String urlFPTeContract = "https://demo.econtract.fpt.com/app";

	private String createBatch(Object body) throws Exception {
		Boolean isExpired = this.checkTokenExpired();
		
		if (!isExpired) {
			throw new RuntimeException("SAPTokenExpired");
		}
		
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

		try {
			Map<String, Object> mapBody = mapperClass.swap(Map.class, body);

			if (mapBody.get("templateAlias") == null) {
				throw new RuntimeException("Document type undefined");
			}
			if (mapBody.get("contractInfo") == null) {
				throw new RuntimeException("Employee info undefined");
			}
			if (mapBody.get("parties") == null) {
				throw new RuntimeException("Parties info undefined");
			}

			List<ContractInfo> contractInfos = null;
			if (mapBody.get("contractInfo") != null) {
				contractInfos = mapperClass.mapper().readValue(
						mapperClass.mapper().writeValueAsString(mapBody.get("contractInfo")),
						new TypeReference<List<ContractInfo>>() {
						});
			}

			if (contractInfos != null) {
				SapCreateLotDTO lotDto = null;
				String lotId = null;
				try {
					lotDto = this.saveLot(headersEcon, mapBody, contractInfos.size());
					lotId = lotDto.getId();
				} catch (Exception e) {
					throw new RuntimeException("Save batch history error");
				}
				
				Map<String, Boolean> mapRtn = new HashMap<String, Boolean>();
				for (ContractInfo info : contractInfos) {
					Boolean checkDuplicate = internalExcallService.redisCheckRefIdExists(info.getContract_number());
					if (checkDuplicate) {
						this.saveHistory(headersEcon, "error", "Hợp đồng đang được khởi tạo trong 1 lô khác", lotId, null, info, null, null, null, null);
						continue;
					}
					
					// save to redis
					RedisEnvelopeRefIdDTO rer = new RedisEnvelopeRefIdDTO();
					rer.setId(info.getContract_number());
					
					rer = internalExcallService.redisSaveEnvelopeRefId(rer);
					
					Map<String, Object> payload = new HashMap<String, Object>();
					payload.put("templateAlias", mapBody.get("templateAlias"));
					payload.put("doctypeCode", mapBody.get("doctypeCode"));
					payload.put("contractInfo", info);
					payload.put("depot", mapBody.get("depot"));
					payload.put("owner", userInfo.getLogin());
					payload.put("custId", userInfo.getCustId());
					payload.put("parties", mapBody.get("parties"));
					payload.put("lotId", lotId);
					payload.put("checksum", rer.getCreatedDate());

					Map<String, Object> bodyExcall = new HashMap<String, Object>();
					bodyExcall.put("id", "");
					bodyExcall.put("refId", lotId);
					bodyExcall.put("selector", "flow_start_gsm_create_auto_determine_integrate");
					bodyExcall.put("lookup", info.getContract_number());
					bodyExcall.put("attrs", new Object());
					bodyExcall.put("payload", null);
					bodyExcall.put("body", payload);

					HttpEntity<Object> entity = new HttpEntity<>(bodyExcall, headersEcon);
					String url = urlFPTeContract + "/services/excall/api/excall";
					try {
						this.restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
					} catch (HttpStatusCodeException e) {
						internalExcallService.redisDeleteRefId(rer.getId());
						this.saveHistory(headersEcon, "error", "Khởi tạo không thành công", lotId, null, info, null, null, null, null);
					}
				}
				return "ok";
			} else {
				throw new RuntimeException("Employee info undefined");
			}
		} catch (Exception ex) {
			throw new RuntimeException(ex.getMessage());
		}
	}
	
	private Boolean checkTokenExpired() {
		UserInFoDetails userInfo = SecurityUtils.getInfoCurrentUserLogin();
		OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(userInfo.getLogin());
		
		String token = "Bearer " + accessToken.getValue();
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", token);
		
		String url = urlFPTeContract + "/services/batch/api/customer-authen/isExpired";
		HttpEntity<Object> request = new HttpEntity<>(headersEcon);
		ResponseEntity<Boolean> response = restTemplate.exchange(url, HttpMethod.GET, request, Boolean.class);
		return response.getBody();
	}

	public SapCreateLotDTO saveLot(HttpHeaders headersEcon, Map<String, Object> mapBody, Integer total) {		
		String url = urlFPTeContract + "/services/batch/api/sap-create-lots";
		try {
			Map<String, Object> body = new HashMap<String, Object>();
			body.put("id", null);
			body.put("template", mapBody.get("templateAlias"));
			body.put("docTypeCode", mapBody.get("doctypeCode"));
			body.put("total", total);
			body.put("startDate", mapBody.get("startDate"));
			body.put("endDate", mapBody.get("endDate"));
			body.put("depot", mapBody.get("depot"));

			HttpEntity<Object> request = new HttpEntity<>(body, headersEcon);
			ResponseEntity<SapCreateLotDTO> response = restTemplate.postForEntity(url, request, SapCreateLotDTO.class);
			return response.getBody();
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}
	
	private void saveHistory(HttpHeaders headersEcon, String status, String message, String lotId, EnvelopeDTO envelope,
			ContractInfo info, String laborId, String laborName, String laborEmail, String laborPhone) {
		String url = urlFPTeContract + "/services/batch/api/sap-create-histories";

		try {
			String name = null;
			String id = null;
			if (envelope != null) {
				name = envelope.getName();
				id = envelope.getId();
			}

			Map<String, Object> body = new HashMap<String, Object>();
			body.put("id", null);
			body.put("lotId", lotId);
			body.put("contractName", info.getContract_number());
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

	private static class SapCreateLotDTO implements Serializable {
		private static final long serialVersionUID = 1L;

		private String id;
		private String template;
		private String docTypeCode;
		private ZonedDateTime startDate;
		private ZonedDateTime endDate;
		private List<String> depot;
		private Long custId;
		private String orgIn;
		private ZonedDateTime createdDate;
		private String createdBy;
		private ZonedDateTime lastModifiedDate;
		private String lastModifiedBy;

		public String getId() {
			return id;
		}

		public void setId(String id) {
			this.id = id;
		}

		public String getTemplate() {
			return template;
		}

		public void setTemplate(String template) {
			this.template = template;
		}

		public String getDocTypeCode() {
			return docTypeCode;
		}

		public void setDocTypeCode(String docTypeCode) {
			this.docTypeCode = docTypeCode;
		}

		public ZonedDateTime getStartDate() {
			return startDate;
		}

		public void setStartDate(ZonedDateTime startDate) {
			this.startDate = startDate;
		}

		public ZonedDateTime getEndDate() {
			return endDate;
		}

		public void setEndDate(ZonedDateTime endDate) {
			this.endDate = endDate;
		}

		public List<String> getDepot() {
			return depot;
		}

		public void setDepot(List<String> depot) {
			this.depot = depot;
		}
		
		protected Long getCustId() {
			return custId;
		}

		protected void setCustId(Long custId) {
			this.custId = custId;
		}

		protected String getOrgIn() {
			return orgIn;
		}

		protected void setOrgIn(String orgIn) {
			this.orgIn = orgIn;
		}

		protected ZonedDateTime getCreatedDate() {
			return createdDate;
		}

		protected void setCreatedDate(ZonedDateTime createdDate) {
			this.createdDate = createdDate;
		}

		protected String getCreatedBy() {
			return createdBy;
		}

		protected void setCreatedBy(String createdBy) {
			this.createdBy = createdBy;
		}

		protected ZonedDateTime getLastModifiedDate() {
			return lastModifiedDate;
		}

		protected void setLastModifiedDate(ZonedDateTime lastModifiedDate) {
			this.lastModifiedDate = lastModifiedDate;
		}

		protected String getLastModifiedBy() {
			return lastModifiedBy;
		}

		protected void setLastModifiedBy(String lastModifiedBy) {
			this.lastModifiedBy = lastModifiedBy;
		}
	}
}
