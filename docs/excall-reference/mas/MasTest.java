// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/MasTest.java
// Secret đã thay bằng "<REDACTED>" (1 chỗ).
package com.fis.excall.service.test;

import java.io.IOException;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.common.OAuth2AccessToken;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.domain.UserInFoDetails;
import com.fis.excall.security.SecurityUtils;
import com.fis.excall.service.envelope.dto.AgreementDetailFPTCaCloudDTO;
import com.fis.excall.service.envelope.dto.DataDTO;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;
import com.fis.excall.service.envelope.dto.LotDataDTO;

@Service
public class MasTest {

	@Autowired
	private EnvelopeClient envelopeClients;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;

	private static final String urlSmartCloud = "https://demo-ekyc.fpt.ai";
	private static final String urlFPTeContract = "http://10.15.68.23:8080/app";

	private static final String authenToken = "<REDACTED>";

	public Object creatingEnvelope(Object payload) throws Exception {
		try {
			Map<String, Object> body = mapperClass.swap(HashMap.class, payload);

			UserInFoDetails userInfo = SecurityUtils.getInfoCurrentUserLogin();
			OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(userInfo.getLogin());

			String token = "Bearer " + accessToken.getValue();
			HttpHeaders headersEcon = new HttpHeaders();
			headersEcon.setContentType(MediaType.APPLICATION_JSON);
			headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
			headersEcon.set("Authorization", token);

			/**
			 * thông tin điền kèm temaple
			 */

			Object inputData = body.get("inputData");
			LotDataDTO lotData = mapperClass.swap(LotDataDTO.class, inputData);

			/**
			 * check danh sach ton tai hd hay chua
			 */

			String refId = this.getRefIdFromLot(lotData);

			if (!StringUtils.isNotBlank(refId)) {
				throw new RuntimeException("Mas.error.requestNotContainsRefId");
			}

			List<EnvelopeDTO> lstRefId = new ArrayList<EnvelopeDTO>();
			lstRefId = this.getListEnvelopeByTicketId(headersEcon, refId);

			List<String> lstProcess = new ArrayList<>();
			List<String> lstCompleted = new ArrayList<>();
			List<String> lstDraft = new ArrayList<>();

			if (lstRefId != null && lstRefId.size() > 0) {
				for (EnvelopeDTO e : lstRefId) {
					if ("completed".equals(e.getStatus())) {
						lstCompleted.add(e.getId());
					} else if ("processing".equals(e.getStatus())) {
						lstProcess.add(e.getId());
					} else if ("draft".equals(e.getStatus())) {
						lstDraft.add(e.getId());
					}
				}
			}
//			if (lstCompleted.size() > 0) {
//				throw new RuntimeException("FPTeContract.warning.isExistsIdFromEcontract");
//			} else 

			if (lstProcess.size() > 0) {
				return lstProcess.get(0);
			}

			/**
			 * thông tin bóc tách data từ smart cloud
			 */

			Object customData = body.get("customData");

			List<AgreementDetailFPTCaCloudDTO> agrementDetailFPTCAClouds = new ArrayList<>();

			if (customData != null) {
				agrementDetailFPTCAClouds = mapperClass.mapper().readValue(
						mapperClass.mapper().writeValueAsString(customData),
						new TypeReference<List<AgreementDetailFPTCaCloudDTO>>() {
						});
			}

			if (agrementDetailFPTCAClouds != null && agrementDetailFPTCAClouds.size() > 0) {

				if (!"sync".equals(lotData.getSyncType())) {
					throw new RuntimeException("FPTeContract.error.requestTypeNotSync");
				}

				for (AgreementDetailFPTCaCloudDTO agrementDetailFPTCACloud : agrementDetailFPTCAClouds) {

					if (!StringUtils.isNotBlank(agrementDetailFPTCACloud.getRefId())) {
						throw new RuntimeException("Mas.error.emtyIdEkycLink");
					}
					FPTSmartCloudData fPTSmartCloudData = this
							.getPhotoFPTSmartCloud(agrementDetailFPTCACloud.getRefId());
					agrementDetailFPTCACloud.setPhotoFrontSideIDCard(fPTSmartCloudData.getPhotoFrontSide());
					agrementDetailFPTCACloud
							.setPhotoFrontSideIDCardContentType("Front" + "_" + fPTSmartCloudData.getName() + ".jpg");

					agrementDetailFPTCACloud.setPhotoBackSideIDCard(fPTSmartCloudData.getPhotoBackSide());
					agrementDetailFPTCACloud
							.setPhotoBackSideIDCardContentType("Back" + "_" + fPTSmartCloudData.getName() + ".jpg");

					List<DataDTO> dataDTOs = lotData.getDatas().get(0);

					for (DataDTO dataDTO : dataDTOs) {
						if ("fca".equals(dataDTO.getType())
								&& agrementDetailFPTCACloud.getRecipientId().equals(dataDTO.getId())) {
							String agrementDetailFPTCACloudValue = mapperClass.mapper()
									.writeValueAsString(agrementDetailFPTCACloud);
							dataDTO.setValue(agrementDetailFPTCACloudValue);
						}
					}

				}

			}

			/*
			 * prepare call to econtract
			 */

			RestTemplate restTemplate = new RestTemplate();
			String urlCreateContractByLot = "/services/envelope/api/external/v1/sign";

			HttpEntity<Object> createContractByLot = new HttpEntity<>(lotData, headersEcon);

			ResponseEntity<String> requestEcontractRefId = restTemplate.exchange(
					urlFPTeContract + urlCreateContractByLot, HttpMethod.POST, createContractByLot, String.class);
			String envelopeId = requestEcontractRefId.getBody();

			Map<String, Object> bodyReturn = new HashMap<String, Object>();
			bodyReturn.put("envelopeId", envelopeId);

			return mapperClass.mapper().writeValueAsString(bodyReturn);

		} catch (Exception ex) {
			throw new RuntimeException(ex.getMessage());
		}
	}

	public String getRefIdFromLot(LotDataDTO lotData) {

		List<List<DataDTO>> datas = lotData.getDatas();
		List<DataDTO> data = datas.get(0);
		for (DataDTO dt : data) {
			if ("envNo".equals(dt.getId())) {
				return dt.getValue();
			}
		}
		return null;

	}

	public List<EnvelopeDTO> getListEnvelopeByTicketId(HttpHeaders headersEcon, String refId) {
		try {
			RestTemplate restTemplate = new RestTemplate();
			String urlRefId = "/services/envelope/api/external/v1/envelope/refId";
			Map<String, String> bodyParamsRefId = new HashMap<String, String>();
			bodyParamsRefId.put("refId", refId);

			HttpEntity<Object> entityRefId = new HttpEntity<>(bodyParamsRefId, headersEcon);

			ResponseEntity<List<EnvelopeDTO>> requestEcontractRefId = restTemplate.exchange(urlFPTeContract + urlRefId,
					HttpMethod.POST, entityRefId, new ParameterizedTypeReference<List<EnvelopeDTO>>() {
					});
			return requestEcontractRefId.getBody();
		} catch (Exception e) {
			throw new RuntimeException("Lấy danh sách tài liệu theo refId không thành công.");
		}
	}

	public FPTSmartCloudData getPhotoFPTSmartCloud(String refId) {

		/*
		 * lấy thông tin meta data ekyc
		 */

		String ekycUrl = urlSmartCloud + "/public/api/profileManagement/" + refId;

		RestTemplate restTemplate = new RestTemplate();

		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("id_token", authenToken);

		HttpEntity request = new HttpEntity(headersEcon);

		ResponseEntity<String> response = restTemplate.exchange(ekycUrl, HttpMethod.GET, request, String.class);

		JsonNode rootNode = null;
		try {
			rootNode = mapperClass.mapper().readTree(response.getBody());
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
			throw new RuntimeException("FPT.smartCloud.getEkycInfoError");
		}
		String image_path_id_front = rootNode.path("image_path_id_front").asText();
		String image_path_id_back = rootNode.path("image_path_id_back").asText();

		String name = rootNode.path("name").asText();

		/*
		 * dựa vào url get ảnh
		 */

		ResponseEntity<byte[]> photoFrontSide = restTemplate.exchange(image_path_id_front, HttpMethod.GET, request,
				byte[].class);

		ResponseEntity<byte[]> photoBackSide = restTemplate.exchange(image_path_id_back, HttpMethod.GET, request,
				byte[].class);

		FPTSmartCloudData fPTSmartCloudData = new FPTSmartCloudData();

		fPTSmartCloudData.setPhotoFrontSide(photoFrontSide.getBody());
		fPTSmartCloudData.setPhotoBackSide(photoBackSide.getBody());
		fPTSmartCloudData.setName(name);
		return fPTSmartCloudData;
	}

	public class FPTSmartCloudData implements Serializable {
		private static final long serialVersionUID = 1306533973655459919L;

		public String name;

		public byte[] photoFrontSide;

		public byte[] photoBackSide;

		public byte[] getPhotoFrontSide() {
			return photoFrontSide;
		}

		public void setPhotoFrontSide(byte[] photoFrontSide) {
			this.photoFrontSide = photoFrontSide;
		}

		public byte[] getPhotoBackSide() {
			return photoBackSide;
		}

		public void setPhotoBackSide(byte[] photoBackSide) {
			this.photoBackSide = photoBackSide;
		}

		public String getName() {
			return name;
		}

		public void setName(String name) {
			this.name = name;
		}

	}
}
