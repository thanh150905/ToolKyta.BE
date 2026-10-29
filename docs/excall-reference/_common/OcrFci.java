// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/OcrFci.java
// Secret đã thay bằng "<REDACTED>" (1 chỗ).
package com.fis.excall.service.test;

import java.net.InetAddress;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;

@Service
public class OcrFci {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;

	@Autowired
	private EnvelopeClient envelopeClients;

	private static final String urlFci = "https://api.fpt.ai/vision/vnm/id-fraudcheck";

	private static final String apiKey = "<REDACTED>";
	
	private long ipToLongInt (InetAddress ipAddress) throws Exception {
	    long resultIP = 0;
	    if (ipAddress != null) {
	    	 byte[] ipAddressOctets = ipAddress.getAddress();

	 	    for (byte octet : ipAddressOctets) {
	 	        resultIP <<= 8;
	 	        resultIP |= octet & 0xFF;
	 	    }
	    }
	    return resultIP;
	}
	
	private static boolean isValidIPv4(String ip) { 
        String[] parts = ip.split("\\."); 
        if (parts.length != 4) { 
            return false; 
        } 
        for (String part : parts) { 
            try { 
                int num = Integer.parseInt(part); 
                if (num < 0 || num > 255) { 
                    return false; 
                } 
            } catch (NumberFormatException e) { 
                return false; 
            } 
        } 
        return true; 
    } 

	public String sendIdCheckServer(String oContent) throws Exception {
		// create headers
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.MULTIPART_FORM_DATA);
		headers.set("api_key", apiKey);

		Map<String, Object> map = mapperClass.mapper().readValue(oContent, new TypeReference<Map<String, Object>>() {
		});

		byte[] front = Base64.getDecoder().decode(map.get("anhMTruoc").toString());
		byte[] back = Base64.getDecoder().decode(map.get("anhMSau").toString());

		final ByteArrayResource frontByteArrayResource = new ByteArrayResource(front) {
			@Override
			public String getFilename() {
				return "front.png";
			}
		};
		HttpEntity<ByteArrayResource> frontEntity = new HttpEntity<>(frontByteArrayResource, headers);

		final ByteArrayResource backByteArrayResource = new ByteArrayResource(back) {
			@Override
			public String getFilename() {
				return "back.png";
			}
		};
		HttpEntity<ByteArrayResource> backEntity = new HttpEntity<>(backByteArrayResource, headers);

		LinkedMultiValueMap<String, Object> requestMap = new LinkedMultiValueMap<>();
		requestMap.add("image_list[]", frontEntity);
		requestMap.add("image_list[]", backEntity);

		// make an request with headers
		HttpEntity<LinkedMultiValueMap<String, Object>> requestUpload = new HttpEntity<>(requestMap, headers);

		// send POST request
		ResponseEntity<String> response = null;
		String responString = null;
		Integer status = null;
		JsonNode rootNode = null;
		try {
			response = restTemplate.postForEntity(urlFci, requestUpload, String.class);
			responString = response.getBody();
			rootNode = mapperClass.mapper().readTree(response.getBody());
			status = Integer.valueOf(rootNode.path("errorCode").asText());
		} catch (HttpStatusCodeException e) {
			//throw new RuntimeException(e.getResponseBodyAsString());
			throw new RuntimeException(
					mapperClass.mapper().writeValueAsString(this.handleError(e.getResponseBodyAsString())));
		}
		if (status == 0) {
			// new valid here
			return this.mapValue(responString);
		} else {
			Map<String, Object> returnMessage = new HashMap<>();
			Map<String, Object> kquaXThuc = new HashMap<>();
			String errorMessage = this.getMessageError(String.valueOf(status));
			kquaXThuc.put("maKQua", "400");
			if (StringUtils.isEmpty(errorMessage)) {
				kquaXThuc.put("maMTa", "404");
				kquaXThuc.put("mta", responString);
			} else {
				kquaXThuc.put("maMTa", status);
				kquaXThuc.put("mta", errorMessage);
			}
			returnMessage.put("kquaXThuc", kquaXThuc);
			throw new RuntimeException(mapperClass.mapper().writeValueAsString(returnMessage));
		}
	}

	public Map<String, Object> handleError(String error) {
		Map<String, Object> returnMessage = new HashMap<>();
		Map<String, Object> kquaXThuc = new HashMap<>();
		try {
			Map<String, Object> err = mapperClass.mapper().readValue(error, new TypeReference<Map<String, Object>>() {
			});
			String errorCode = this.nodeValueToText(err, "errorCode");
			String errorMessage = this.getMessageError(errorCode);
			kquaXThuc.put("maKQua", "400");
			if (StringUtils.isEmpty(errorCode)) {
				kquaXThuc.put("maMTa", "404");
				String message = this.nodeValueToText(err, "message");
				if (!StringUtils.isEmpty(this.nodeValueToText(err, "message"))) {
					kquaXThuc.put("mta", message);
				} else {
					kquaXThuc.put("mta", error);
				}
			} else {
				kquaXThuc.put("maMTa", errorCode);
				kquaXThuc.put("mta", errorMessage);
			}
			returnMessage.put("kquaXThuc", kquaXThuc);
			return returnMessage;
		} catch (Exception e) {
			kquaXThuc.put("maKQua", "500");
			kquaXThuc.put("maMTa", "500");
			kquaXThuc.put("mta", "Lỗi hệ thống");
			returnMessage.put("kquaXThuc", kquaXThuc);
			return returnMessage;
		}
	}

	public void validOcr(List<Map<String, Object>> data) throws Exception {
		Map<String, Object> front = data.get(0);
		Map<String, Object> back = data.get(1);
		Map<String, Object> resultMap = data.get(2);

		this.wrongPosition(front);
		this.photocopiedResult(front, "checking_result;check_photocopied_result", "checking_result;check_photocopied_prob", "C7");
		this.photocopiedResult(back, "checking_result;check_photocopied_result", "checking_result;check_photocopied_prob", "C8");

		Object comparing_qrcode_result = resultMap.get("comparing_qrcode_result");
		Object post_check_result = resultMap.get("post_check_result");
		Map<String, Object> node = null;

		String errorCode = "";
		String errorMessage = "";
		
		// ảnh có qr code
		if (comparing_qrcode_result != null) {
			node = mapperClass.mapper().readValue(mapperClass.mapper().writeValueAsString(comparing_qrcode_result),
					new TypeReference<Map<String, Object>>() {
					});
			String result = String.valueOf(node.get("result"));
			String code = String.valueOf(node.get("code"));
			if ("Failed".equals(result)) {
				errorCode = "QR" + code;
				errorMessage = this.getMessageError(errorCode);
				this.throwError(errorCode, errorMessage);
			}
		}

		if (post_check_result != null) {
			node = mapperClass.mapper().readValue(mapperClass.mapper().writeValueAsString(post_check_result),
					new TypeReference<Map<String, Object>>() {
					});
			String result = String.valueOf(node.get("result"));
			String code = String.valueOf(node.get("code"));

			if ("Failed".equals(result)) {
				errorCode = code;
				errorMessage = this.getMessageError(errorCode);
				if (!"E01".equals(errorCode) && !"QRE01".equals(errorCode)) {
					this.throwError(errorCode, errorMessage);
				}
			}
		}

		// bắt manual lỗi khác
//		this.otherError(front, "checking_result;recaptured_result", "1", "C1");
//		this.otherError(back, "checking_result;recaptured_result", "1", "C2");
		this.recapturedResult(front, "checking_result;recaptured_result", "checking_result;recaptured_prob", "C1");
		this.recapturedResult(back, "checking_result;recaptured_result", "checking_result;recaptured_prob", "C2");
		
//		this.otherError(front, "checking_result;edited_result", "1", "C3");
//		this.otherError(back, "checking_result;edited_result", "1", "C4");
		this.editedResult(front, "checking_result;edited_result", "checking_result;edited_prob", "C3");
		this.editedResult(back, "checking_result;edited_result", "checking_result;edited_prob", "C4");

		this.otherError(front, "checking_result;corner_cut_result", "1", "C5");
		this.otherError(back, "checking_result;corner_cut_result", "1", "C6");

//		this.connerCut(front, "checking_result;corner_cut_result", "C5");
//		this.connerCut(back, "checking_result;corner_cut_result", "C6");

		this.otherError(front, "checking_result;check_emblem_result", "failed", "C9");
		this.otherError(front, "checking_result;check_QRcode_result", "failed", "C13");
//		this.otherError(front, "checking_result;check_embossed_stamp_result", "failed", "C18");
//		this.otherError(back, "checking_result;check_embossed_stamp_result", "failed", "C18");
//		this.otherError(back, "checking_result;check_fingerprint_result", "failed", "C11");
		this.otherError(back, "checking_result;check_stamp_result", "failed", "C12");
		this.otherError(back, "checking_result;check_chip_result", "failed", "C14");
		this.otherError(back, "checking_result;check_mrz_result", "failed", "C15");
		
		this.titleOrHeadlineResult(front, "checking_result;check_headline_result", "checking_result;check_headline_prob");
		this.titleOrHeadlineResult(front, "checking_result;check_title_result", "checking_result;check_title_prob");
//		this.otherError(front, "checking_result;check_headline_result", "failed", "C10");
//		this.otherError(front, "checking_result;check_title_result", "failed", "C10");
		
		
		this.otherError(front, "checking_result;check_border_result", "failed", "C19");
		this.otherError(back, "checking_result;check_border_result", "failed", "C20");
		this.otherError(front, "checking_result;check_covering_result", "failed", "C16");
		this.otherError(back, "checking_result;check_covering_result", "failed", "C17");
	}
	
	public void photocopiedResult(Map<String, Object> node, String name, String prob, String code) throws Exception {
		String check_photocopied_result = this.nodeValueToText(node, name);
		String check_photocopied_prob = this.nodeValueToText(node, prob);
		if ("1".equals(check_photocopied_result) && !StringUtils.isEmpty(check_photocopied_prob) && !"N/A".equals(check_photocopied_prob)) {
			Double score = Double.valueOf(check_photocopied_prob);
			if (score >= 0.6) {
				String errorMessage = this.getMessageError(code);
				this.throwError(code, errorMessage);
			}
		}
	}
	
	public void editedResult(Map<String, Object> node, String name, String prob, String code) throws Exception {
		String edited_result = this.nodeValueToText(node, name);
		String edited_prob = this.nodeValueToText(node, prob);
		String type_new = this.nodeValueToText(node, "type_new");
//		if ("cmnd_09_front".equals(type_new)) {
//			if ("1".equals(edited_result) && !StringUtils.isEmpty(edited_prob) && !"N/A".equals(edited_prob)) {
//				Double score = Double.valueOf(edited_prob);
//				if (score > 0.94) {
//					String errorMessage = this.getMessageError(code);
//					this.throwError(code, errorMessage);
//				}
//			}
//		} else {
			if ("1".equals(edited_result) && !StringUtils.isEmpty(edited_prob) && !"N/A".equals(edited_prob)) {
				Double score = Double.valueOf(edited_prob);
				if (score >= 0.6) {
					String errorMessage = this.getMessageError(code);
					this.throwError(code, errorMessage);
				}
			}
//		}
	}
	
	public void recapturedResult(Map<String, Object> node, String name, String prob, String code) throws Exception {
		String recaptured_result = this.nodeValueToText(node, name);
		String recaptured_prob = this.nodeValueToText(node, prob);
		if ("1".equals(recaptured_result) && !StringUtils.isEmpty(recaptured_prob) && !"N/A".equals(recaptured_prob)) {
			Double score = Double.valueOf(recaptured_prob);
			if (score >= 0.6) {
				String errorMessage = this.getMessageError(code);
				this.throwError(code, errorMessage);
			}
		}
	}
	
	public void titleOrHeadlineResult(Map<String, Object> node, String name, String prob) throws Exception {
		String value = this.nodeValueToText(node, name);
		String score = this.nodeValueToText(node, prob);
		String type_new = this.nodeValueToText(node, "type_new");
		if ("cccd_chip_front".equals(type_new)) {
			if (!StringUtils.isEmpty(score) && !"N/A".equals(score)) {
				Double s = Double.valueOf(score);
				if (s < 0.1) {
					String errorMessage = this.getMessageError("C10");
					this.throwError("C10", errorMessage);
				}
			}
		} else {
			if ("failed".equals(value)) {
				String errorMessage = this.getMessageError("C10");
				this.throwError("C10", errorMessage);
			}
		}
	}
	
	public void wrongPosition(Map<String, Object> node) throws Exception {
		String type = this.nodeValueToText(node, "type_new");
		if (!"cmnd_09_front".equals(type) && !"cmnd_12_front".equals(type) && !"cccd_12_front".equals(type)
				&& !"cccd_chip_front".equals(type) && !"cc_front".equals(type)) {
			String errorMessage = this.getMessageError("C21");
			this.throwError("C21", errorMessage);
		}
	}

	public void connerCut(Map<String, Object> node, String name, String code) throws Exception {
		String value = this.nodeValueToText(node, name);
		String corner_cut_prob = this.nodeValueToText(node, "checking_result;corner_cut_prob");

		if (corner_cut_prob.isEmpty()) {
			if ("1".equals(value)) {
				String errorMessage = this.getMessageError(code);
				this.throwError(code, errorMessage);
			}
		} else {
			if (!"\"N/A\"".equals(corner_cut_prob) && !"N/A".equals(corner_cut_prob)) {
				List<String> scores = mapperClass.mapper().readValue(corner_cut_prob,
						new TypeReference<ArrayList<String>>() {
						});
				if (scores != null) {
					for (String score : scores) {
						if (StringUtils.isNotEmpty(score) && !"N/A".equals(score)) {
							Double s = Double.valueOf(score);
							if (s >= 0.9) {
								String errorMessage = this.getMessageError(code);
								this.throwError(code, errorMessage);
							}
						}
					}
				}
			}
		}
	}
	
//	public void editedResult(Map<String, Object> node, String name, String code) throws Exception {
//		String value = this.nodeValueToText(node, name);
//		String type_new = this.nodeValueToText(node, "type_new");
//		if ("cmnd_09_front".equals(type_new)) {
//			String score = this.nodeValueToText(node, "checking_result;edited_prob");
//			if (StringUtils.isNotEmpty(score)) {
//				Double _score = Double.valueOf(score);
//				if (_score > 0.94) {
//					String errorMessage = this.getMessageError(code);
//					this.throwError(code, errorMessage);
//				}
//			}
//		} else {
//			if ("1".equals(value)) {
//				String errorMessage = this.getMessageError(code);
//				this.throwError(code, errorMessage);
//			}
//		}
//	}

	public void otherError(Map<String, Object> node, String name, String valueFailed, String code) throws Exception {
		String value = this.nodeValueToText(node, name);
		if (valueFailed.equals(value)) {
			String errorMessage = this.getMessageError(code);
			this.throwError(code, errorMessage);
		}
	}

	public void throwError(String errorCode, String errorMessage) throws Exception {
		Map<String, Object> returnMessage = new HashMap<>();
		Map<String, Object> kquaXThuc = new HashMap<>();
		kquaXThuc.put("maKQua", "400");
		kquaXThuc.put("maMTa", errorCode);
		kquaXThuc.put("mta", errorMessage);
		returnMessage.put("kquaXThuc", kquaXThuc);
		throw new RuntimeException(mapperClass.mapper().writeValueAsString(returnMessage));
	}

	public String getMessageError(String code) {
		Map<String, String> messageError = new HashMap<String, String>();
		messageError.put("-1", "Lỗi không xác định từ hệ thống");
		messageError.put("1", "Tham số hoặc giá trị không hợp lệ");
		messageError.put("3", "Chất lượng ảnh không đảm bảo (mờ, quá tối hoặc quá sáng)");
		messageError.put("5", "Không tìm thấy đường dẫn ảnh");
		messageError.put("6", "Không mở được ảnh theo đường dẫn vừa gửi");
		messageError.put("7", "Tệp được tải lên không phải là tệp hình ảnh");
		messageError.put("8", "Ảnh tải lên bị hỏng hoặc định dạng không được hỗ trợ");
		messageError.put("9", "Thông tin ảnh base64 không được để trống");
		messageError.put("10", "Thông tin ảnh base64 không hợp lệ");

		messageError.put("QRE01", "Có ít nhất một trường thông tin nào đó không chính xác");
		messageError.put("QRE02", "Có lỗi bất thường xảy ra");
		messageError.put("QRE03", "Không đọc thành công QR Code");

		messageError.put("E01", "Có một trường thông tin nào đó bị trống");
		messageError.put("E02", "Cấu trúc số ID không đúng");
		messageError.put("E03", "Cấu trúc của ngày sinh không đúng");
		messageError.put("E04", "Ngày sinh không thể sau ngày hôm nay");
		messageError.put("E05", "Tuổi hiện tại không thể dưới 14");
		messageError.put("E06", "Quốc tịch không đúng");
		messageError.put("E07", "Năm sinh không khớp với số ID");
		messageError.put("E08", "Mã giới tính không khớp với số ID");
		messageError.put("E09", "Cấu trúc ngày hết hạn không đúng");
		messageError.put("E10", "Giấy tờ hết hạn");
		messageError.put("E11",
				"Trường hợp chỉ gửi mặt trước và người mang giấy tờ dưới 58 tuổi vào thời điểm hiện tại thì ngày hết hạn không thể là \"KHÔNG THỜI HẠN\"");
		messageError.put("E12", "Cấu trúc ngày cấp không đúng");
		messageError.put("E13", "Ngày cấp sau ngày hiện tại");
		messageError.put("E14", "Lỗi chưa defind");
		messageError.put("E15", "Ảnh mặt trước và mặt sau của 2 loại giấy tờ khác nhau");
		messageError.put("E16", "Có 1 trường thông tin trống ở mặt trước");
		messageError.put("E17", "Tuổi trên giấy tờ dưới 14 ở thời điểm cấp");
		messageError.put("E18", "Giấy tờ là Chứng minh nhân dân 12 số, ngày hết hạn là ngày cấp cộng thêm 15 năm");
		messageError.put("E19",
				"Tuổi trên giấy tờ dưới 23 và trên 14 vào ngày cấp, thì ngày hết hạn phải là sinh nhật 25 tuổi");
		messageError.put("E20",
				"Tuổi trên giấy tờ dưới 38 và trên 23 vào ngày cấp, thì ngày hết hạn phải là sinh nhật 40 tuổi");
		messageError.put("E21",
				"Tuổi trên giấy tờ dưới 58 và trên 38 vào ngày cấp, thì ngày hết hạn phải là sinh nhật 60 tuổi");
		messageError.put("E22", "Tuổi trên giấy tờ trên 58 vào ngày cấp, thì ngày hết hạn phải là \"KHÔNG THỜI HẠN\"");
		messageError.put("E29", "Kết quả QRcode đọc được không khớp với kết quả OCR");
		messageError.put("E30", "Thông tin mặt sau không khớp với thông tin của mặt trước");

		messageError.put("C1", "Ảnh mặt trước được chụp lại từ màn hình");
		messageError.put("C2", "Ảnh mặt sau được chụp lại từ màn hình");
		messageError.put("C3", "Ảnh mặt trước bị chỉnh sửa");
		messageError.put("C4", "Ảnh mặt sau bị chỉnh sửa");
		messageError.put("C5", "Ảnh mặt trước bị cắt góc");
		messageError.put("C6", "Ảnh mặt sau bị cắt góc");
		messageError.put("C7", "Ảnh mặt trước đen trắng");
		messageError.put("C8", "Ảnh mặt sau đen trắng");
		messageError.put("C9", "Ảnh bị che hoặc mất quốc huy");
		messageError.put("C10", "Ảnh bị che hoặc mất tiêu đề");
		messageError.put("C11", "Ảnh bị che hoặc mất vân tay");
		messageError.put("C12", "Ảnh bị che hoặc mất con dấu");
		messageError.put("C13", "Ảnh căn cước gắn chíp bị che hoặc mất mã QR");
		messageError.put("C14", "Ảnh bị che hoặc mất chip");
		messageError.put("C15", "Ảnh bị che hoặc mất MRZ");
		messageError.put("C16", "Ảnh mặt trước bị che một số thông tin");
		messageError.put("C17", "Ảnh mặt sau bị che một số thông tin");
		messageError.put("C18", "Ảnh bị che hoặc mất con dấu nổi");
		messageError.put("C19", "Ảnh mặt trước bị che viền");
		messageError.put("C20", "Ảnh mặt sau bị che viền");

		messageError.put("C21", "Ảnh mặt trước không hợp lệ");

		return messageError.get(code);
	}

	public String mapValue(String result) throws Exception {
		Map<String, Object> rootNode = mapperClass.mapper().readValue(result, new TypeReference<Map<String, Object>>() {
		});
		String __data = mapperClass.mapper().writeValueAsString(rootNode.get("data"));
		List<Map<String, Object>> data = mapperClass.mapper().readValue(__data,
				new TypeReference<ArrayList<Map<String, Object>>>() {
				});

		Map<String, Object> front = data.get(0);
		Map<String, Object> back = data.get(1);
		Map<String, Object> postCheck = data.get(2);

		// valid OCR
		this.validOcr(data);

		Map<String, Object> rtn = new HashMap<String, Object>();

		Map<String, Object> kquaXThuc = new HashMap<String, Object>();
		Object maKQua = "";
		if (Integer.valueOf(rootNode.get("errorCode").toString()) == 0) {
			maKQua = 200;
		} else {
			maKQua = rootNode.get("errorCode").toString();
		}
		kquaXThuc.put("maKQua", maKQua);
		rtn.put("kquaXThuc", kquaXThuc);

		Map<String, Object> gtoTThan = new HashMap<String, Object>();

		Integer loaiGToTThan = this.loaiGToTThan(front);
		if (loaiGToTThan != null) {
			gtoTThan.put("loaiGToTThan", loaiGToTThan);
		} else {
			gtoTThan.put("loaiGToTThan", "");
		}
		gtoTThan.put("soGTo", this.nodeValueToText(front, "id"));
		gtoTThan.put("ngayCap", this.ngayCap(back, "issue_date"));
		gtoTThan.put("noiCap", this.nodeValueToText(back, "issue_loc"));
		gtoTThan.put("hoTen", this.nodeValueToText(front, "name"));
		gtoTThan.put("ngaySinh", this.ngayCap(front, "dob"));

		String sex = this.nodeValueToText(front, "sex");
		if ("NAM".equals(sex)) {
			gtoTThan.put("gioiTinh", 0);
		} else if ("NỮ".equals(sex)) {
			gtoTThan.put("gioiTinh", 1);
		} else {
			gtoTThan.put("gioiTinh", "");
		}

		Map<String, Object> diaChi = new HashMap<String, Object>();
		diaChi.put("tinhThanh", this.nodeValueToText(front, "address_entities;province"));
		diaChi.put("quanHuyen", this.nodeValueToText(front, "address_entities;district"));
		diaChi.put("phuongXa", this.nodeValueToText(front, "address_entities;ward"));
		diaChi.put("chiTiet", this.nodeValueToText(front, "address_entities;street"));
		gtoTThan.put("diaChi", diaChi);

		gtoTThan.put("quocTich", this.nodeValueToText(front, "nationality"));
		gtoTThan.put("soCmt", this.nodeValueToText(front, "id"));
		gtoTThan.put("hoVaTen", this.nodeValueToText(front, "name"));
		gtoTThan.put("namSinh", this.nodeValueToText(front, "dob"));
		gtoTThan.put("queQuan", this.nodeValueToText(front, "home"));
		gtoTThan.put("noiTru", this.nodeValueToText(front, "address"));
		gtoTThan.put("dacDiemNhanDang", this.nodeValueToText(back, "features"));
		gtoTThan.put("ngayCap2", this.nodeValueToText(back, "issue_date"));

		gtoTThan.put("loaiCmt", this.nodeValueToText(back, "type_new"));
		gtoTThan.put("loaiCmtMatTruoc", this.nodeValueToText(front, "type_new"));
		gtoTThan.put("loaiCmtKhacMatTruoc", this.nodeValueToText(front, "type_new"));
		gtoTThan.put("ngayHetHan", this.nodeValueToText(front, "doe"));
		gtoTThan.put("gioiTinh2", this.nodeValueToText(front, "sex"));

		Map<String, Object> kiemTraMatTruoc = new HashMap<String, Object>();
		kiemTraMatTruoc.put("chupLaiTuManHinh", this.nodeValueToText(front, "checking_result;recaptured_result"));
		kiemTraMatTruoc.put("chupLaiTuManHinhScore", this.nodeValueToText(front, "checking_result;recaptured_prob"));
		kiemTraMatTruoc.put("denTrang", this.nodeValueToText(front, "checking_result;check_photocopied_result"));
		kiemTraMatTruoc.put("denTrangScore", this.nodeValueToText(front, "checking_result;check_photocopied_prob"));
		kiemTraMatTruoc.put("catGoc", this.nodeValueToText(front, "checking_result;corner_cut_result"));
		kiemTraMatTruoc.put("catGocScore", this.nodeValueToText(front, "checking_result;corner_cut_prob"));
		kiemTraMatTruoc.put("dauNoi", "");
		kiemTraMatTruoc.put("dauQuocHuy", this.nodeValueToText(front, "checking_result;check_emblem_result"));
		kiemTraMatTruoc.put("dauQuocHuyScore", this.nodeValueToText(front, "checking_result;check_emblem_prob"));
		kiemTraMatTruoc.put("anhBiLoa", "");
		kiemTraMatTruoc.put("anhBiLoaScore", "");
		kiemTraMatTruoc.put("kiemTraAnh", this.nodeValueToText(front, "checking_result;check_face_result"));
		kiemTraMatTruoc.put("kiemTraAnhScore", this.nodeValueToText(front, "checking_result;check_face_prob"));
		kiemTraMatTruoc.put("thayTheAnh", this.nodeValueToText(front, "checking_result;check_photocopied_result"));
		kiemTraMatTruoc.put("thayTheAnhScore", this.nodeValueToText(front, "checking_result;check_photocopied_prob"));
		kiemTraMatTruoc.put("khungHinh", "");
		kiemTraMatTruoc.put("khungHinhScore", "");
		kiemTraMatTruoc.put("ngayHetHan", this.ngayHetHan(postCheck));
		kiemTraMatTruoc.put("quyLuatSo", "");
		gtoTThan.put("kiemTraMatTruoc", kiemTraMatTruoc);

		// kiemTraMatSau
		Map<String, Object> kiemTraMatSau = new HashMap<String, Object>();
		kiemTraMatSau.put("denTrang", this.nodeValueToText(back, "checking_result;check_photocopied_result"));
		kiemTraMatSau.put("denTrangScore", this.nodeValueToText(back, "checking_result;check_photocopied_prob"));
		kiemTraMatSau.put("catGoc", this.nodeValueToText(back, "checking_result;corner_cut_result"));
		kiemTraMatSau.put("catGocScore", this.nodeValueToText(back, "checking_result;corner_cut_prob"));
		kiemTraMatSau.put("dauDo", this.nodeValueToText(back, "checking_result;check_stamp_result"));
		kiemTraMatSau.put("dauDoScore", this.nodeValueToText(back, "checking_result;check_stamp_prob"));
		kiemTraMatSau.put("anhBiLoa", "");
		kiemTraMatSau.put("anhBiLoaScore", "");

		Map<String, Object> vanTay = this.vanTay(back);
		kiemTraMatSau.put("vanTayPhai", vanTay.get("right"));
		kiemTraMatSau.put("vanTayPhaiScore", vanTay.get("rightScore"));
		kiemTraMatSau.put("vanTayTrai", vanTay.get("left"));
		kiemTraMatSau.put("vanTayTraiScore", vanTay.get("leftScore"));
		kiemTraMatSau.put("khungHinh", "");
		kiemTraMatSau.put("khungHinhScore", "");
		gtoTThan.put("kiemTraMatSau", kiemTraMatSau);

		gtoTThan.put("soCmtScore", this.nodeValueToText(front, "id_prob"));
		gtoTThan.put("hoVaTenScore", this.nodeValueToText(front, "name_prob"));
		gtoTThan.put("namSinhScore", this.nodeValueToText(front, "dob_prob"));
		gtoTThan.put("ngayHetHanScore", this.nodeValueToText(front, "doe_prob"));
		gtoTThan.put("queQuanScore", this.nodeValueToText(front, "home_prob"));
		gtoTThan.put("noiTruScore", this.nodeValueToText(front, "address_prob"));
		gtoTThan.put("ngayCapScore", this.nodeValueToText(back, "issue_date_prob"));
		gtoTThan.put("noiCapScore", this.nodeValueToText(back, "issue_loc_prob"));
		gtoTThan.put("gioiTinhScore", this.nodeValueToText(front, "sex_prob"));
		gtoTThan.put("quocTichScore", this.nodeValueToText(front, "nationality_prob"));
		Map<String, Object> maHoa = new HashMap<String, Object>();

		String noiDung = "";
		Object mrz = back.get("mrz");
		if (mrz != null) {
			String mrzzz = mapperClass.mapper().writeValueAsString(mrz);
			if (!"\"N/A\"".equals(mrzzz)) {
				List<String> lst = mapperClass.mapper().readValue(mrzzz, new TypeReference<ArrayList<String>>() {
				});
				if (lst != null) {
					for (final String value : lst) {
						if (StringUtils.isEmpty(noiDung)) {
							noiDung = value;
						} else {
							noiDung = noiDung + "\n" + value;
						}
					}
				}
			}
		}

		maHoa.put("noiDung", noiDung);
		maHoa.put("soCmt", this.nodeValueToText(back, "mrz_details;id"));
		maHoa.put("hoVaTen", this.nodeValueToText(back, "mrz_details;name"));
		maHoa.put("namSinh", this.maHoaDate(front, "dob"));
		maHoa.put("ngayHetHan", this.maHoaDate(front, "doe"));
		maHoa.put("gioiTinh", this.nodeValueToText(back, "mrz_details;sex"));
		gtoTThan.put("maHoa", maHoa);

		gtoTThan.put("maTinhQueQuan", "");
		gtoTThan.put("maTinhDiaChi", "");
		gtoTThan.put("maTinhNoiCap", "");

		rtn.put("gtoTThan", gtoTThan);
		rtn.put("mapValue", rootNode);
		return mapperClass.mapper().writeValueAsString(rtn);
	}

	public Map<String, Object> vanTay(Map<String, Object> jsonNode) throws Exception {
		Map<String, Object> rtn = new HashMap<String, Object>();
		rtn.put("leftScore", "");
		rtn.put("left", "");
		rtn.put("rightScore", "");
		rtn.put("right", "");
		String strScore = this.nodeValueToText(jsonNode, "checking_result;check_fingerprint_prob");
        if (StringUtils.isNotEmpty(strScore) && !"\"N/A\"".equals(strScore) && !"N/A".equals(strScore)) {
        	List<String> score = this.nodeValueToList(jsonNode, "checking_result;check_fingerprint_prob");
    		if (score != null && score.size() > 0) {
    			String left = score.get(0);
    			String right = score.get(1);
    			rtn.put("leftScore", left);
    			rtn.put("rightScore", right);
    			if (!StringUtils.isEmpty(left) && Double.parseDouble(left) >= 0.7) {
    				rtn.put("left", "0");
    			} else {
    				rtn.put("left", "1");
    			}
    			if (!StringUtils.isEmpty(right) && Double.parseDouble(right) >= 0.7) {
    				rtn.put("right", "0");
    			} else {
    				rtn.put("right", "1");
    			}
    		}
        }
		return rtn;
	}

	public String ngayHetHan(Map<String, Object> jsonNode) {
		String code = String.valueOf(jsonNode.get("post_check_result"));
		if (StringUtils.isNotEmpty(code)) {
			List<String> err = new ArrayList<String>();
			err.add("E18");
			err.add("E19");
			err.add("E20");
			err.add("E21");
			err.add("E22");
			if (err.indexOf(code) == -1) {
				return "0";
			} else {
				return "1";
			}
		} else {
			return "";
		}
	}

	public String ngayCap(Map<String, Object> jsonNode, String name) {
		String node = String.valueOf(jsonNode.get(name));
		if (StringUtils.isNotEmpty(node)) {
			String[] ngayCap = node.split("/");
			if (ngayCap.length > 2) {
				return ngayCap[2] + "-" + ngayCap[1] + "-" + ngayCap[0];
			} else {
				return "";
			}
		} else {
			return "";
		}
	}

	public Integer loaiGToTThan(Map<String, Object> jsonNode) {
		Object node = jsonNode.get("type_new");
		String type = String.valueOf(node);
		if (!StringUtils.isEmpty(type)) {
			if ("cmnd_09_front".equals(type) || "cmnd_12_front".equals(type)) {
				return 1;
			} else if ("cccd_12_front".equals(type)) {
				return 2;
			} else if ("cccd_chip_front".equals(type)) {
				return 4;
			}
		}
		return null;
	}

	public String maHoaDate(Map<String, Object> jsonNode, String name) throws Exception {
		String date = this.nodeValueToText(jsonNode, name);
		String[] _date = date.split("/");
		if (_date.length > 2) {
			String year = "";
			if (_date[2].length() > 2) {
				year = _date[2].substring(_date[2].length() - 2);
			} else {
				year = _date[2];
			}
			if (year.length() < 2) {
				year = "0" + year;
			}
			return year + _date[1] + _date[0];
		} else {
			return "";
		}
	}

	public String nodeValueToText(Map<String, Object> jsonNode, String nameLst) throws Exception {
		String[] payload = nameLst.split(";");
		if (payload.length > 1) {
			String[] next = Arrays.copyOfRange(payload, 1, payload.length);
			String _nameLst = "";
			for (String name : next) {
				if ("".equals(_nameLst)) {
					_nameLst = name;
				} else {
					_nameLst = ";" + name;
				}
			}
			Object obj = jsonNode.get(payload[0]);
			if (obj != null) {
				Map<String, Object> nextNode = mapperClass.mapper().readValue(
						mapperClass.mapper().writeValueAsString(obj), new TypeReference<Map<String, Object>>() {
						});
				return this.nodeValueToText(nextNode, _nameLst);
			} else {
				return "";
			}
		} else {
			String node = String.valueOf(jsonNode.get(payload[0]));
			if (StringUtils.isEmpty(node) || "null".equals(node)) {
				return "";
			} else {
				return node;
			}
		}
	}
	
	public List nodeValueToList(Map<String, Object> jsonNode, String nameLst) throws Exception {
		String[] payload = nameLst.split(";");
		if (payload.length > 1) {
			String[] next = Arrays.copyOfRange(payload, 1, payload.length);
			String _nameLst = "";
			for (String name : next) {
				if ("".equals(_nameLst)) {
					_nameLst = name;
				} else {
					_nameLst = ";" + name;
				}
			}
			Object obj = jsonNode.get(payload[0]);
			if (obj != null) {
				Map<String, Object> nextNode = mapperClass.mapper().readValue(
						mapperClass.mapper().writeValueAsString(obj), new TypeReference<Map<String, Object>>() {
						});
				return this.nodeValueToList(nextNode, _nameLst);
			} else {
				return new ArrayList<>();
			}
		} else {
			return (List) jsonNode.get(payload[0]);
		}
	}
}
