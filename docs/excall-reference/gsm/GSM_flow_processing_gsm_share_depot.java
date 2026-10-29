// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/GSM_flow_processing_gsm_share_depot.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.ArrayList;
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
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;

@Service
public class GSM_flow_processing_gsm_share_depot {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;
	
	@Autowired
	private EnvelopeClient envelopeClients;

//	private static final String urlFPTeContract = "https://10.14.121.18:30600/app";
	private static final String urlFPTeContract = "https://demo.econtract.fpt.com/app";

	private String doShareDepot(Object body) throws Exception {
		Map<String, Object> mapBody = mapperClass.swap(Map.class, body);
		List<String> depots = null;
		if (mapBody.get("depot") != null) {
			depots = mapperClass.mapper().readValue(mapperClass.mapper().writeValueAsString(mapBody.get("depot")),
					new TypeReference<List<String>>() {
					});
		}
		String envelopeId = String.valueOf(mapBody.get("envelopeId"));
		
		EnvelopeDTO envelope = envelopeClients.getEnvelopeById(envelopeId);
		OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(envelope.getOwner());

		/*
		 * prepare call to econtract
		 */
		String token = "Bearer " + accessToken.getValue();
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", token);
		
		if (depots != null && depots.size() > 0) {
			try {
				List<ShareDTO> shareDTOs = new ArrayList<ShareDTO>();
				for (String groupId : depots) {
					GroupDTO groupDTO = this.getGroup(headersEcon, groupId);
					
					ShareDTO dto = new ShareDTO();
					dto.setResourceId(envelopeId);
					dto.setResourceName(envelope.getName());
					dto.setResourceType("e");
					dto.setSharedType("g");
					dto.setPersonal(groupDTO.getName());
					dto.setGroup(groupDTO.getId());
					dto.setPerm("v_d");
					dto.setFromDate(Instant.from(ZonedDateTime.now()).toString());
					dto.setCustId(groupDTO.getCustId());
					dto.setOrgIn(groupDTO.getOrgIn());
					dto.setActivityLogName(groupDTO.getName());
					
					shareDTOs.add(dto);
				}
				
				Map<String, Object> shareBody = new HashMap<String, Object>();
				shareBody.put("listOld", new ArrayList<ShareDTO>());
				shareBody.put("listNew", shareDTOs);

				String url = "/services/envelope/api/acl/aclinternalnew";
				HttpEntity<Object> entity = new HttpEntity<>(shareBody, headersEcon);
				
				try {
					this.restTemplate.exchange(urlFPTeContract + url, HttpMethod.POST, entity, String.class);
				} catch (HttpStatusCodeException e) {
					throw new RuntimeException(e.getMessage());
				}
				
				return "ok";
			} catch (Exception ex) {
				throw new RuntimeException(ex.getMessage());
			}
		} else {
			throw new RuntimeException("List depot undefined");
		}
	}
	
	private GroupDTO getGroup(HttpHeaders headersEcon, String id) {
		try {
			String url = "/services/uaa/api/groups/find/" + id;
			HttpEntity<Object> entity = new HttpEntity<>(headersEcon);
			ResponseEntity<GroupDTO> response = restTemplate.exchange(urlFPTeContract + url, HttpMethod.GET, entity, GroupDTO.class);
			return response.getBody();
		} catch (Exception e) {
			throw new RuntimeException(e.getMessage());
		}
	}
	
	private static class ShareDTO implements Serializable {
		private static final long serialVersionUID = 1L;
	
		private String id;
		private String resourceId;
		private String resourceName;
		private String resourceType;
		private String sharedType;
		private String personal;
		private String group;
		private String password;
		private String perm;
		private String fromDate;
		private String toDate;
		private Long custId;
		private String orgIn;
		private String activityLogName;
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
		public String getResourceName() {
			return resourceName;
		}
		public void setResourceName(String resourceName) {
			this.resourceName = resourceName;
		}
		public String getResourceType() {
			return resourceType;
		}
		public void setResourceType(String resourceType) {
			this.resourceType = resourceType;
		}
		public String getSharedType() {
			return sharedType;
		}
		public void setSharedType(String sharedType) {
			this.sharedType = sharedType;
		}
		public String getPersonal() {
			return personal;
		}
		public void setPersonal(String personal) {
			this.personal = personal;
		}
		public String getGroup() {
			return group;
		}
		public void setGroup(String group) {
			this.group = group;
		}
		public String getPassword() {
			return password;
		}
		public void setPassword(String password) {
			this.password = password;
		}
		public String getPerm() {
			return perm;
		}
		public void setPerm(String perm) {
			this.perm = perm;
		}
		public String getFromDate() {
			return fromDate;
		}
		public void setFromDate(String fromDate) {
			this.fromDate = fromDate;
		}
		public String getToDate() {
			return toDate;
		}
		public void setToDate(String toDate) {
			this.toDate = toDate;
		}
		public Long getCustId() {
			return custId;
		}
		public void setCustId(Long custId) {
			this.custId = custId;
		}
		public String getOrgIn() {
			return orgIn;
		}
		public void setOrgIn(String orgIn) {
			this.orgIn = orgIn;
		}
		public String getActivityLogName() {
			return activityLogName;
		}
		public void setActivityLogName(String activityLogName) {
			this.activityLogName = activityLogName;
		}
	}
	
	
	private static class GroupDTO implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String id;
		private String name;
		private Long custId;
		private String orgIn;
		private String active;
		
		public String getId() {
			return id;
		}
		public void setId(String id) {
			this.id = id;
		}
		public String getName() {
			return name;
		}
		public void setName(String name) {
			this.name = name;
		}
		public Long getCustId() {
			return custId;
		}
		public void setCustId(Long custId) {
			this.custId = custId;
		}
		public String getOrgIn() {
			return orgIn;
		}
		public void setOrgIn(String orgIn) {
			this.orgIn = orgIn;
		}
		public String getActive() {
			return active;
		}
		public void setActive(String active) {
			this.active = active;
		}
	}
}
