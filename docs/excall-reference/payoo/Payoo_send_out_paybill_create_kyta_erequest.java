// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/Payoo_send_out_paybill_create_kyta_erequest.java
// Secret đã thay bằng "<REDACTED>" (2 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
import java.nio.charset.StandardCharsets;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
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
import org.springframework.util.Base64Utils;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fis.excall.client.EflowClient;
import com.fis.excall.client.EformClient;
import com.fis.excall.client.ErequestClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.service.dto.PaymentAttrDTO;
import com.fis.excall.service.dto.PaymentDTO;
import com.fis.excall.service.dto.PaymentDetailDTO;
import com.fis.excall.service.erequest.dto.GetFormDataDTO;
import com.fis.excall.service.erequest.dto.TicketFormDataDTO;

@Service
public class Payoo_send_out_paybill_create_kyta_erequest {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	private RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;

	@Autowired
	private ErequestClient erequestClient;

	@Autowired
	private EflowClient eflowClient;

	@Autowired
	private EformClient eformClient;

	private static final String eContractUrl = "https://10.14.121.18:30600/app/";

	private static final String urlAuth = "http://10.14.121.18:31018/";
	// private static final String urlAuth =
	// "https://demo.econtract.fpt.com/app/services/uaa/";
	private static final String clientId = "<REDACTED>";
	private static final String clientSecret = "<REDACTED>";

	private static final String owner = "2nbbinh1195@gmail.com";
	
	public String getFormForm() throws Exception {
		OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(owner);
//		EformFormDTO formDTO = this.getForm(accessToken.getValue(), "000011qOIKNHnLd4NwvkuPR");
		
		TicketFormDataDTO ticketDTO = erequestClient.getFormData(new GetFormDataDTO("00001GyIWltkGeRywB5", null, null));
		return "ok";
	}

	public String createPayment(Object body) throws Exception {
		Map<String, Object> bodyParams = mapperClass.swap(Map.class, body);
		OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(owner);
		try {
			String modelerId = "000011JlIKgs4MEqnbD3";
			String workFlowId = "00001qOIKeInadbomM8";

			// get modeler
			// ModelerDTO modelerDTO = eflowClient.getModelerInternal(modelerId);
			String modelerDTO = this.getModeler(accessToken.getValue(), modelerId);
			JsonNode _rootNode = mapperClass.mapper().readTree(modelerDTO);
			// get form config
			// FormDTO formDTO = eformClient.getForm(modelerDTO.getFormVersion());
			// FormDTO formDTO = this.getForm(accessToken.getValue(),
			// modelerDTO.getFormVersion());
			String formDTO = this.getForm(accessToken.getValue(), _rootNode.get("formVersion").asText());
			
			// return formDTO;
			JsonNode rootNode = mapperClass.mapper().readTree(formDTO);

			List<FormDataDTO> formDataDTOs = new ArrayList<FormDataDTO>();
			// if (formDTO.getJsonForm() != null) {
			// formDataDTOs = mapperClass.mapper().readValue(formDTO.getJsonForm(), new
			// TypeReference<List<FormDataDTO>>() {});
			// }
			if (rootNode.get("jsonForm") != null) {
				formDataDTOs = mapperClass.mapper().readValue(rootNode.get("jsonForm").asText(),
						new TypeReference<List<FormDataDTO>>() {
						});
			}

			PaymentDTO paymentDTO = mapperClass.swap(PaymentDTO.class, bodyParams.get("payment"));
			PaymentDetailDTO paymentDetailDTO = mapperClass.swap(PaymentDetailDTO.class,
					bodyParams.get("paymentDetail"));

			List<FormDataDTO> newformDataDTOs = new ArrayList<FormDataDTO>();
			
			String templateAlias = "pay_n_bill";
			if (paymentDTO.getCurrency() != null && paymentDTO.getCurrency() != "" && "usd".equals(paymentDTO.getCurrency())) {
				templateAlias += "_usd";
			}
			Double totalPriceUSD = new Double(0);
			Integer year = paymentDTO.getLastModifiedDate().getYear();
			if (paymentDTO.getAttrs() != null && paymentDTO.getAttrs().size() > 0) {
				for (int i = 0; i < paymentDTO.getAttrs().size(); i++) {
					PaymentAttrDTO paymentAttrDTO = paymentDTO.getAttrs().get(i);
					if ("year".equals(paymentAttrDTO.getUnit())) {
						Integer yearAmount = paymentAttrDTO.getAmount();
						if (yearAmount > 1) {
							year += (yearAmount -1);
						}
					}
					totalPriceUSD += paymentAttrDTO.getTotal();
				}
			}

			// return mapperClass.mapper().writeValueAsString(formDataDTOs);
			for (FormDataDTO _formData : formDataDTOs) {
				switch (_formData.getCode()) {
				case "currency":
					_formData.setValue(paymentDTO.getCurrency());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_attrs":
					// Handle payment attributes
					List<List<String>> attrs = new ArrayList<List<String>>();
					if (paymentDTO.getAttrs() != null && paymentDTO.getAttrs().size() > 0) {
						for (PaymentAttrDTO attr : paymentDTO.getAttrs()) {
							Integer index = paymentDTO.getAttrs().indexOf(attr) + 1;
							attrs.add(
									Arrays.asList("" + index, attr.getDescriptionVi(), this.convertUnit(attr.getUnit()),
											"" + attr.getAmount(), "" + attr.getPrice(), "" + attr.getTotal()));
						}
					}
					_formData.setValue(attrs);
					_formData.setFormId(_formData.getId());
					_formData.setDataType(null);
					_formData.setTypeForm("table");
					newformDataDTOs.add(_formData);
					break;
				case "payment_totalPrice":
					// Handle total price
					_formData.setValue(paymentDTO.getTotalPrice());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_detail_type":
					// Handle detail type
					_formData.setValue(paymentDetailDTO.getType());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_name":
					// Handle payment name
					_formData.setValue(paymentDTO.getName());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_email":
					// Handle payment email
					_formData.setValue(paymentDTO.getEmail());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_phoneNumber":
					// Handle payment phone number
					_formData.setValue(paymentDTO.getPhoneNumber());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_detail_position":
					// Handle detail position
					_formData.setValue(paymentDetailDTO.getPosition());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_detail_taxCode":
					// Handle detail tax code
					_formData.setValue(paymentDetailDTO.getTaxCode());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_detail_personalId":
					// Handle detail personal ID
					_formData.setValue(paymentDetailDTO.getPersonalId());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_detail_name":
					// Handle detail name
					_formData.setValue(paymentDetailDTO.getName());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_detail_country":
					// Handle detail country
					_formData.setValue(paymentDetailDTO.getCountry());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_detail_province":
					// Handle detail province
					_formData.setValue(paymentDetailDTO.getProvince());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_detail_district":
					// Handle detail district
					_formData.setValue(paymentDetailDTO.getDistrict());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_detail_commune":
					// Handle detail commune
					_formData.setValue(paymentDetailDTO.getCommune());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_detail_address":
					// Handle detail address
					_formData.setValue(paymentDetailDTO.getAddress());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_detail_email":
					// Handle detail email
					_formData.setValue(paymentDetailDTO.getEmail());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "template_alias":
					_formData.setValue(templateAlias);
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_refId":
					// Handle reference ID
					_formData.setValue(paymentDTO.getRefId());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_id":
					// Handle payment ID
					_formData.setValue(paymentDTO.getId());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "payment_detail_id":
					// Handle detail ID
					_formData.setValue(paymentDetailDTO.getId());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "envelopeId":
					// Handle envelope ID
					_formData.setValue("");
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "b_name":
					// Handle business name
					_formData.setValue("NGUYỄN TÁ ANH");
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "b_position":
					// Handle business position
					_formData.setValue("Phó Giám đốc Trung tâm MBF eCo");
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "b_address":
					// Handle business address
					_formData.setValue(
							"Số 10 phố Phạm Văn Bạch, Phường Dịch Vọng, Quận Cầu Giấy, Thành phố Hà Nội, Việt Nam");
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "b_phoneNumber":
					// Handle business phone number
					_formData.setValue("+84 4 35626000");
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "b_taxCode":
					// Handle business phone number
					_formData.setValue("0104128565");
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "info_name":
					// Handle business phone number
					_formData.setValue("CÔNG TY TNHH FPT IS");
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "info_year":
					// Handle business phone number
					_formData.setValue(year);
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "info_from":
					// Handle business phone number
					DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy");
					_formData.setValue(paymentDTO.getLastModifiedDate().format(formatter));
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "info_to":
					// Handle business phone number
					_formData.setValue("31/12/" + paymentDTO.getLastModifiedDate().getYear());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "info_total":
					// Handle business phone number
					_formData.setValue(paymentDTO.getTotalPrice());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "info_total_usd":
					// Handle business phone number
					_formData.setValue(totalPriceUSD);
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "info_totalCharacter":
					// Handle business phone number
					_formData.setValue(this.numberToVietnameseWords(Long.valueOf(paymentDTO.getTotalPrice())));
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "info_totalCharacter_usd":
					_formData.setValue(this.numberToEnglishWords(totalPriceUSD));
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "day":
					_formData.setValue("" + ZonedDateTime.now().getDayOfMonth());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "month":
					_formData.setValue("" + ZonedDateTime.now().getMonthValue());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "year":
					_formData.setValue("" + ZonedDateTime.now().getYear());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				case "usd_rate":
					_formData.setValue("" + paymentDTO.getCurrencyRate());
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
//				case "discount":
//					break;
				default:
					_formData.setFormId(_formData.getId());
					_formData.setDataType("String");
					_formData.setTypeForm("textField");
					newformDataDTOs.add(_formData);
					break;
				}
			}

			Map<String, Object> ticketData = new HashMap<>();
			ticketData.put("priority", "low");
			ticketData.put("workFlowId", workFlowId);
			ticketData.put("title", "Hợp đồng cung cấp và bàn giao dịch vụ điện tử " + paymentDetailDTO.getName());
			ticketData.put("jsonXml", _rootNode.get("jsonXml").asText());
			ticketData.put("ticketStatus", "processing");
			ticketData.put("followerId", null);
			ticketData.put("listRelativeTicket", new ArrayList<>());
			ticketData.put("aclTicketDTOS", new ArrayList<>());
			ticketData.put("modelerId", modelerId);

			// Form Data List
			List<Map<String, Object>> formDataList = new ArrayList<>();
			Map<String, Object> formData = new HashMap<>();
			formData.put("formData", newformDataDTOs);
			formData.put("ticketId", null);
			formData.put("userTaskId", null);
			formData.put("version", _rootNode.get("formVersion").asText());
			formData.put("eformId", _rootNode.get("formId").asText());

			formDataList.add(formData);
			ticketData.put("formData", formDataList);
			// return mapperClass.mapper().writeValueAsString(ticketData);
			// String ticket = erequestClient.createTicket(ticketData);

			String ticket = this.createTicket(accessToken.getValue(), ticketData);

			return ticket;
		} catch (HttpStatusCodeException e) {
			return e.getMessage();
		}
	}

	private String createTicket(String token, Map<String, Object> ticketData) throws Exception {
		String url = eContractUrl + "services/erequest/api/tickets";

		String access_token = "Bearer " + token;
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headers.set("Authorization", access_token);

		HttpEntity<Object> entity = new HttpEntity<>(ticketData, headers);
		try {
			ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
			return response.getBody();

		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	private String getModeler(String token, String modelerId) throws Exception {
		String url = eContractUrl + "services/idaas-eflow/api/modelers/" + modelerId;

		String access_token = "Bearer " + token;
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headers.set("Authorization", access_token);

		HttpEntity<Object> entity = new HttpEntity<>(headers);
		try {
			ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
			return response.getBody();

		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	private String getForm(String token, String versionId) throws Exception {
		String url = eContractUrl + "services/eform/api/common/form?versionId=" + versionId;

		String access_token = "Bearer " + token;
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headers.set("Authorization", access_token);

		HttpEntity<Object> entity = new HttpEntity<>(headers);
		try {
			ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
			System.out.println(response.getBody());
			return response.getBody();

		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}

	private String getAccessToken() {
		String url = urlAuth + "oauth/token";
		String authorization = clientId + ":" + clientSecret;

		HttpHeaders reqHeaders = new HttpHeaders();
		reqHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
		MultiValueMap<String, String> formParams = new LinkedMultiValueMap<>();
		formParams.set("grant_type", "client_credentials");
		reqHeaders.add("Authorization",
				"Basic " + Base64Utils.encodeToString(authorization.getBytes(StandardCharsets.UTF_8)));

		HttpEntity<MultiValueMap<String, String>> entity = new HttpEntity<>(formParams, reqHeaders);
		try {
			ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
			JsonNode rootNode = null;
			rootNode = mapperClass.mapper().readTree(response.getBody());
			return rootNode.path("access_token").asText();
		} catch (Exception e) {
			e.printStackTrace();
			throw new RuntimeException(e.getMessage());
		}
	}

	public static String convertUnit(String unit) {
		if (!StringUtils.isEmpty(unit)) {
			if ("doc".equals(unit)) {
				return "Tài liệu";
			} else if ("year".equals(unit)) {
				return "Năm";
			}
		}
		return "";
	}
	
	public String numberToVietnameseWords(long n) {
		try {
		    if (n == 0) return "không đồng";
		    StringBuilder s = new StringBuilder();
		    int i = 0;
		    while (n > 0) {
		        int so = (int)(n % 1000);
		        if (so != 0) {
		            StringBuilder block = new StringBuilder();
		            int tram = so / 100;
		            int chuc = (so % 100) / 10;
		            int donvi = so % 10;
		            if (tram > 0) {
		                block.append(getDv(tram)).append(" trăm");
		                if (chuc == 0 && donvi > 0) block.append(" linh");
		            }
		            if (chuc > 1) {
		                block.append(" ").append(getDv(chuc)).append(" mươi");
		                if (donvi == 1) block.append(" mốt");
		                else if (donvi == 5) block.append(" lăm");
		                else if (donvi > 0) block.append(" ").append(getDv(donvi));
		            } else if (chuc == 1) {
		                block.append(" mười");
		                if (donvi == 1) block.append(" một");
		                else if (donvi == 5) block.append(" lăm");
		                else if (donvi > 0) block.append(" ").append(getDv(donvi));
		            } else if (chuc == 0 && donvi > 0) {
		                block.append(" ").append(getDv(donvi));
		            }
		            s.insert(0, block.toString().trim() + " " + getHang(i) + " ");
		        }
		        n /= 1000;
		        i++;
		    }
		    String result = s.toString().replaceAll("\\s+", " ").trim();
		    if (!result.endsWith("đồng")) result += " đồng";
		    return Character.toUpperCase(result.charAt(0)) + result.substring(1);
		} catch (Exception e) {
			return "";
		}
	}

	private String getDv(int num) {
	    switch (num) {
	        case 1: return "một";
	        case 2: return "hai";
	        case 3: return "ba";
	        case 4: return "bốn";
	        case 5: return "năm";
	        case 6: return "sáu";
	        case 7: return "bảy";
	        case 8: return "tám";
	        case 9: return "chín";
	        default: return "";
	    }
	}

	private String getHang(int idx) {
	    switch (idx) {
	        case 1: return "nghìn";
	        case 2: return "triệu";
	        case 3: return "tỷ";
	        default: return "";
	    }
	}
	
	public String numberToEnglishWords(double amount) {
		try {
			long dollars = (long) amount;
			int cents = (int) Math.round((amount - dollars) * 100);

			String result = numberToWordsCase(dollars) + " dollar" + (dollars != 1 ? "s" : "");
			if (cents > 0) {
				result += " and " + numberToWordsCase(cents) + " cent" + (cents != 1 ? "s" : "");
			}
			return capitalizeFirstLetter(result);
		} catch (Exception e) {
			return "";
		}
	}

	private String numberToWordsCase(long n) {
	    if (n == 0) return "zero";
	    if (n < 20) return getBelowTwenty((int) n);
	    if (n < 100) {
	        int tens = (int) n / 10;
	        int ones = (int) n % 10;
	        return getTens(tens) + (ones > 0 ? " " + getBelowTwenty(ones) : "");
	    }
	    if (n < 1000) {
	        int hundreds = (int) n / 100;
	        int rest = (int) n % 100;
	        return getBelowTwenty(hundreds) + " hundred" + (rest > 0 ? " " + numberToWordsCase(rest) : "");
	    }
	    if (n < 1_000_000) {
	        long thousands = n / 1000;
	        long rest = n % 1000;
	        return numberToWordsCase(thousands) + " thousand" + (rest > 0 ? " " + numberToWordsCase(rest) : "");
	    }
	    if (n < 1_000_000_000) {
	        long millions = n / 1_000_000;
	        long rest = n % 1_000_000;
	        return numberToWordsCase(millions) + " million" + (rest > 0 ? " " + numberToWordsCase(rest) : "");
	    }
	    long billions = n / 1_000_000_000;
	    long rest = n % 1_000_000_000;
	    return numberToWordsCase(billions) + " billion" + (rest > 0 ? " " + numberToWordsCase(rest) : "");
	}

	private String getBelowTwenty(int n) {
	    switch (n) {
	        case 0: return "zero";
	        case 1: return "one";
	        case 2: return "two";
	        case 3: return "three";
	        case 4: return "four";
	        case 5: return "five";
	        case 6: return "six";
	        case 7: return "seven";
	        case 8: return "eight";
	        case 9: return "nine";
	        case 10: return "ten";
	        case 11: return "eleven";
	        case 12: return "twelve";
	        case 13: return "thirteen";
	        case 14: return "fourteen";
	        case 15: return "fifteen";
	        case 16: return "sixteen";
	        case 17: return "seventeen";
	        case 18: return "eighteen";
	        case 19: return "nineteen";
	        default: return "";
	    }
	}

	private String getTens(int n) {
	    switch (n) {
	        case 2: return "twenty";
	        case 3: return "thirty";
	        case 4: return "forty";
	        case 5: return "fifty";
	        case 6: return "sixty";
	        case 7: return "seventy";
	        case 8: return "eighty";
	        case 9: return "ninety";
	        default: return "";
	    }
	}

	private String capitalizeFirstLetter(String str) {
	    if (str == null || str.isEmpty()) return str;
	    return str.substring(0, 1).toUpperCase() + str.substring(1);
	}
	
	private static class FormDataDTO implements Serializable {
		private static final long serialVersionUID = 1L;

		private String id;
		private String label;
		private String type;
		private Object value;
		private String formId;
		private String hashid;
		private String code;
		private Boolean display;
		private Map<String, Object> validate;
		private Boolean metaSearchOnRequest;
		private String dataType;
		private String typeForm;

		public String getLabel() {
			return label;
		}

		public void setLabel(String label) {
			this.label = label;
		}

		public String getType() {
			return type;
		}

		public void setType(String type) {
			this.type = type;
		}

		public Object getValue() {
			return value;
		}

		public void setValue(Object value) {
			this.value = value;
		}

		public String getFormId() {
			return formId;
		}

		public void setFormId(String formId) {
			this.formId = formId;
		}

		public String getHashid() {
			return hashid;
		}

		public void setHashid(String hashid) {
			this.hashid = hashid;
		}

		public String getCode() {
			return code;
		}

		public void setCode(String code) {
			this.code = code;
		}

		public Boolean getDisplay() {
			return display;
		}

		public void setDisplay(Boolean display) {
			this.display = display;
		}

		public Map<String, Object> getValidate() {
			return validate;
		}

		public void setValidate(Map<String, Object> validate) {
			this.validate = validate;
		}

		public Boolean getMetaSearchOnRequest() {
			return metaSearchOnRequest;
		}

		public void setMetaSearchOnRequest(Boolean metaSearchOnRequest) {
			this.metaSearchOnRequest = metaSearchOnRequest;
		}

		public String getDataType() {
			return dataType;
		}

		public void setDataType(String dataType) {
			this.dataType = dataType;
		}

		public String getTypeForm() {
			return typeForm;
		}

		public void setTypeForm(String typeForm) {
			this.typeForm = typeForm;
		}

		public String getId() {
			return id;
		}

		public void setId(String id) {
			this.id = id;
		}
	}
}
