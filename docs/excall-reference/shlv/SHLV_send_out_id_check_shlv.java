// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/SHLV_send_out_id_check_shlv.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;

@Service
public class SHLV_send_out_id_check_shlv {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;

	@Autowired
	private EnvelopeClient envelopeClients;

	private static final String urlOcr = "https://ekyc-uat.shinhanlifevn.com.vn/shlapi/eid-api/ocr";

	private String getAccessToken() {
		String accessToken = "";
		return accessToken;
	}

	public String sendIdCheckServer(String oContent) throws Exception {
		Map<String, Object> map = mapperClass.mapper().readValue(oContent, new TypeReference<Map<String, Object>>() {});
		
		String front = null;
		String back = null;
		
		if (map.containsKey("anhMTruoc") && map.get("anhMTruoc") != null) {
			front = map.get("anhMTruoc").toString();
		}
		if (map.containsKey("anhMSau") && map.get("anhMSau") != null) {
			front = map.get("anhMSau").toString();
		}
		
		if (front == null || back == null) {
			
		}
		
		String token = this.getAccessToken();
		// create headers
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headers.set("Authorization", "Bearer " + token);
		
		Map<String, Object> body = new HashMap<String, Object>();
		body.put("frontSideCaptured", front);
		body.put("backSideCaptured", back);

		HttpEntity<Object> entity = new HttpEntity<>(body, headers);

		// send POST request
		ResponseEntity<String> response = null;
		String responString = null;
		Integer status = null;
		JsonNode rootNode = null;
		try {
			response = restTemplate.postForEntity(urlOcr, entity, String.class);
			responString = response.getBody();
			rootNode = mapperClass.mapper().readTree(response.getBody());
			status = Integer.valueOf(rootNode.path("status").asText());
		} catch (HttpStatusCodeException e) {
			Map<String, Object> returnMessage = new HashMap<>();
			Map<String, Object> kquaXThuc = new HashMap<>();
			String errorMessage = this.getMessageError(String.valueOf(e.getStatusCode()));
			kquaXThuc.put("maKQua", e.getStatusCode());
			kquaXThuc.put("maMTa", e.getStatusCode());
			kquaXThuc.put("mta", errorMessage == null ? e.getResponseBodyAsString() : errorMessage);
			returnMessage.put("kquaXThuc", kquaXThuc);
			throw new RuntimeException(mapperClass.mapper().writeValueAsString(returnMessage));
		}
		if (status == 200) {
			// new valid here
			Integer exitCode = Integer.valueOf(rootNode.path("status").asText());
			if (exitCode == 0) {
				return this.mapValue(responString);
			} else {
				Map<String, Object> returnMessage = new HashMap<>();
				Map<String, Object> kquaXThuc = new HashMap<>();
				String errorMessage = this.getMessageError(String.valueOf(exitCode));
				kquaXThuc.put("maKQua", status);
				kquaXThuc.put("maMTa", exitCode);
				kquaXThuc.put("mta", errorMessage);
				returnMessage.put("kquaXThuc", kquaXThuc);
				throw new RuntimeException(mapperClass.mapper().writeValueAsString(returnMessage));
			}
		} else {
			Map<String, Object> returnMessage = new HashMap<>();
			Map<String, Object> kquaXThuc = new HashMap<>();
			String errorMessage = this.getMessageError(String.valueOf(status));
			kquaXThuc.put("maKQua", status);
			kquaXThuc.put("maMTa", status);
			kquaXThuc.put("mta", errorMessage);
			returnMessage.put("kquaXThuc", kquaXThuc);
			throw new RuntimeException(mapperClass.mapper().writeValueAsString(returnMessage));
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
		messageError.put("210", "Giấy tờ bị cắt góc");
		messageError.put("211", "Không tìm thấy dấu quốc huy");
		messageError.put("212", "Ảnh chụp giấy tờ bị loá");
		messageError.put("213", "Không tìm thấy ảnh chân dung");
		messageError.put("214", "Ảnh chân dung có dấu hiệu bị thay thế");
		messageError.put("215", "Ảnh chụp giấy tờ là bản photo");
		messageError.put("216", "Có trường thông tin bị chỉnh sửa");
		messageError.put("217", "Ảnh chụp giấy tờ không phải bản gốc");
		messageError.put("218", "Ảnh chụp giấy tờ nằm ngoài khung hình");
		messageError.put("226", "Loại giấy tờ mặt trước không khớp với mặt sau");
		messageError.put("228", "Lỗi nhận diện giấy tờ");
		messageError.put("500", "Lỗi hệ thống");
		messageError.put("403", "Không có quyền truy cập API");
		messageError.put("408", "Timeout");
		messageError.put("400", "Thiếu param");
		
		messageError.put("404", "");
		
		return messageError.get(code);
	}

	public String mapValue(String result) throws Exception {
		DataResult dataResult = mapperClass.swap(DataResult.class, result);

		// valid OCR
//		this.validOcr(data);

		Map<String, Object> rtn = new HashMap<String, Object>();

		Map<String, Object> kquaXThuc = new HashMap<String, Object>();
		kquaXThuc.put("maKQua", 200);
		rtn.put("kquaXThuc", kquaXThuc);

		Map<String, Object> gtoTThan = new HashMap<String, Object>();

		Integer loaiGToTThan = this.loaiGToTThan(dataResult.getFrontSideOfId());
		if (loaiGToTThan != null) {
			gtoTThan.put("loaiGToTThan", loaiGToTThan);
		} else {
			gtoTThan.put("loaiGToTThan", "");
		}
		gtoTThan.put("soGTo", dataResult.getIdNumber());
		gtoTThan.put("ngayCap", this.ngayCap(dataResult.getIssuedDate()));
		gtoTThan.put("noiCap", dataResult.getIssuedPlace());
		gtoTThan.put("hoTen", dataResult.getFullName());
		gtoTThan.put("ngaySinh", this.ngayCap(dataResult.getDateOfBirth()));

		String sex = dataResult.getGender();
		if ("NAM".equals(sex)) {
			gtoTThan.put("gioiTinh", 0);
		} else if ("NỮ".equals(sex)) {
			gtoTThan.put("gioiTinh", 1);
		} else {
			gtoTThan.put("gioiTinh", "");
		}
		
		// diaChi
		this.addAddress(dataResult, gtoTThan);

		gtoTThan.put("quocTich", dataResult.getNationality());
		gtoTThan.put("soCmt", dataResult.getIdNumber());
		gtoTThan.put("hoVaTen", dataResult.getFullName());
		gtoTThan.put("namSinh", dataResult.getDateOfBirth());
		gtoTThan.put("queQuan", dataResult.getHomeTown());
		gtoTThan.put("noiTru", dataResult.getAddress());
		gtoTThan.put("dacDiemNhanDang", dataResult.getRecognitionFeature());
		gtoTThan.put("ngayCap2", dataResult.getIssuedDate());

		gtoTThan.put("loaiCmt", dataResult.getBackSideOfId());
		gtoTThan.put("loaiCmtMatTruoc", dataResult.getFrontSideOfId());
		gtoTThan.put("loaiCmtKhacMatTruoc", dataResult.getFrontSideOfId());
		gtoTThan.put("ngayHetHan", dataResult.getExpiredDate());
		gtoTThan.put("gioiTinh2", dataResult.getGender());
		
		// kiemTraMatTruoc
		this.addFrontInfo(dataResult, gtoTThan);

		// kiemTraMatSau
		this.addBackInfo(dataResult, gtoTThan);

		gtoTThan.put("soCmtScore", dataResult.getIdCardScore());
		gtoTThan.put("hoVaTenScore", dataResult.getFullNameScore());
		gtoTThan.put("namSinhScore", dataResult.getDateOfBirthScore());
		gtoTThan.put("ngayHetHanScore", dataResult.getExpiredDateScore());
		gtoTThan.put("queQuanScore", dataResult.getHomeTownScore());
		gtoTThan.put("noiTruScore", dataResult.getAddressScore());
		gtoTThan.put("ngayCapScore", dataResult.getIssuedDateScore());
		gtoTThan.put("noiCapScore", dataResult.getIssuedPlaceScore());
		gtoTThan.put("gioiTinhScore", dataResult.getGenderScore());
		gtoTThan.put("quocTichScore", dataResult.getNationalityScore());
		
		// mrz
		this.addMrz(dataResult, gtoTThan);

		gtoTThan.put("maTinhQueQuan", dataResult.getCodeCityHomeTown());
		gtoTThan.put("maTinhDiaChi", dataResult.getCodeCityAddress());
		gtoTThan.put("maTinhNoiCap", dataResult.getCodeCityIssuedPlace());

		rtn.put("gtoTThan", gtoTThan);
		rtn.put("mapValue", dataResult);
		return mapperClass.mapper().writeValueAsString(rtn);
	}
	
	public void addFrontInfo(DataResult result, Map<String, Object> gtoTThan) {
		Map<String, Object> kiemTraMatTruoc = new HashMap<String, Object>();
		String chupLaiTuManHinh = "";
		String chupLaiTuManHinhScore = "";
		String denTrang = "";
		String denTrangScore = "";
		String catGoc = "";
		List<String> catGocScore = new ArrayList<>();
		String dauNoi = "";
		String dauQuocHuy = "";
		String dauQuocHuyScore = "";
		String anhBiLoa = "";
		String anhBiLoaScore = "";
		String kiemTraAnh = "";
		String kiemTraAnhScore = "";
		String thayTheAnh = "";
		String thayTheAnhScore = "";
		String khungHinh = "";
		String khungHinhScore = "";
		String ngayHetHan = "";
		String quyLuatSo = "";
		String lawofNumber = "";
		String checkAvatarResult = "";
		
		if (result.getCheckFrontSide() != null) {
			CheckFrontSide checkFrontSide = result.getCheckFrontSide();
			chupLaiTuManHinh = checkFrontSide.getRecapturedResult();
			denTrang = checkFrontSide.getCheckPhotocopiedResult();
			denTrangScore = checkFrontSide.getCheckPhotocopiedProb();
			catGoc = checkFrontSide.getCornerCutResult();
			catGocScore = checkFrontSide.getCornerCutProb();
			dauNoi = checkFrontSide.getCheckEmbossedStampResult();
			dauQuocHuy = checkFrontSide.getCheckNationalEmblemResult();
			dauQuocHuyScore = checkFrontSide.getCheckNationalEmblemProb();
			anhBiLoa = checkFrontSide.getCheckGlareResult();
			anhBiLoaScore = checkFrontSide.getCheckGlareProb();
			kiemTraAnh = checkFrontSide.getKiemTraAnh();
			kiemTraAnhScore = "";
			thayTheAnh = checkFrontSide.getCheckReplacementAvatarResult();
			thayTheAnhScore = checkFrontSide.getCheckReplacementAvatarProb();
			khungHinh = checkFrontSide.getOnFrameResult();
			khungHinhScore = checkFrontSide.getOnFrameProb();
			ngayHetHan = checkFrontSide.getExpiredDate();
		}
		
		kiemTraMatTruoc.put("chupLaiTuManHinh", chupLaiTuManHinh);
		kiemTraMatTruoc.put("chupLaiTuManHinhScore", chupLaiTuManHinhScore);
		kiemTraMatTruoc.put("denTrang", denTrang);
		kiemTraMatTruoc.put("denTrangScore", denTrangScore);
		kiemTraMatTruoc.put("catGoc", catGoc);
		kiemTraMatTruoc.put("catGocScore", catGocScore);
		kiemTraMatTruoc.put("dauNoi", dauNoi);
		kiemTraMatTruoc.put("dauQuocHuy", dauQuocHuy);
		kiemTraMatTruoc.put("dauQuocHuyScore", dauQuocHuyScore);
		kiemTraMatTruoc.put("anhBiLoa", anhBiLoa);
		kiemTraMatTruoc.put("anhBiLoaScore", anhBiLoaScore);
		kiemTraMatTruoc.put("kiemTraAnh", kiemTraAnh);
		kiemTraMatTruoc.put("kiemTraAnhScore", kiemTraAnhScore);
		kiemTraMatTruoc.put("thayTheAnh", thayTheAnh);
		kiemTraMatTruoc.put("thayTheAnhScore", thayTheAnhScore);
		kiemTraMatTruoc.put("khungHinh", khungHinh);
		kiemTraMatTruoc.put("khungHinhScore", khungHinhScore);
		kiemTraMatTruoc.put("ngayHetHan", ngayHetHan);
		kiemTraMatTruoc.put("quyLuatSo", quyLuatSo);
		gtoTThan.put("kiemTraMatTruoc", kiemTraMatTruoc);
	}
	
	public void addBackInfo(DataResult result, Map<String, Object> gtoTThan) {
		Map<String, Object> kiemTraMatSau = new HashMap<String, Object>();
		String denTrang = "";
		String denTrangScore = "";
		String catGoc = "";
		List<String> catGocScore = new ArrayList<>();
		String dauDo = "";
		String dauDoScore = "";
		String anhBiLoa = "";
		String anhBiLoaScore = "";
		String vanTayPhai = "";
		String vanTayPhaiScore = "";
		String vanTayTrai = "";
		String vanTayTraiScore = "";
		String khungHinh = "";
		String khungHinhScore = "";
		
		if (result.getCheckBackSide() != null) {
			CheckBackSide checkBackSide = result.getCheckBackSide();
			denTrang = checkBackSide.getCheckPhotocopiedResult();
			denTrangScore = checkBackSide.getCheckPhotocopiedProb();
//			catGoc = "";
//			catGocScore = "";
			dauDo = checkBackSide.getCheckRedStampResult();
			dauDoScore = checkBackSide.getCheckRedStampProb();
			anhBiLoa = checkBackSide.getCheckGlareResult();
			anhBiLoaScore = checkBackSide.getCheckGlareProb();
			vanTayPhai = checkBackSide.getCheckRfpResult();
			vanTayPhaiScore = checkBackSide.getCheckRfpProb();
			vanTayTrai = checkBackSide.getCheckLfpResult();
			vanTayTraiScore = checkBackSide.getCheckLfpProb();
			khungHinh = checkBackSide.getOnFrameResult();
			khungHinhScore = checkBackSide.getOnFrameProb();
		}
		
		kiemTraMatSau.put("denTrang", denTrang);
		kiemTraMatSau.put("denTrangScore", denTrangScore);
		kiemTraMatSau.put("catGoc", catGoc);
		kiemTraMatSau.put("catGocScore", catGocScore);
		kiemTraMatSau.put("dauDo", dauDo);
		kiemTraMatSau.put("dauDoScore", dauDoScore);
		kiemTraMatSau.put("anhBiLoa", anhBiLoa);
		kiemTraMatSau.put("anhBiLoaScore", anhBiLoaScore);

		kiemTraMatSau.put("vanTayPhai", vanTayPhai);
		kiemTraMatSau.put("vanTayPhaiScore", vanTayPhaiScore);
		kiemTraMatSau.put("vanTayTrai", vanTayTrai);
		kiemTraMatSau.put("vanTayTraiScore", vanTayTraiScore);
		kiemTraMatSau.put("khungHinh", khungHinh);
		kiemTraMatSau.put("khungHinhScore", khungHinhScore);
		gtoTThan.put("kiemTraMatSau", kiemTraMatSau);
	}
	
	public void addMrz(DataResult result, Map<String, Object> gtoTThan) {
		Map<String, Object> maHoa = new HashMap<String, Object>();
		String noiDung = "";
		String soCmt = "";
		String hoVaTen = "";
		String namSinh = "";
		String ngayHetHan = "";
		String gioiTinh = "";
		
		if (result.getMrz() != null) {
			Mrz mrz = result.getMrz();
			noiDung = mrz.getRaw();
			soCmt = mrz.getIdCard();
			hoVaTen = mrz.getFullName();
			namSinh = mrz.getDateOfBirth();
			ngayHetHan = mrz.getExpiredDate();
			gioiTinh = mrz.getGender();
		}
		
		maHoa.put("noiDung", noiDung);
		maHoa.put("soCmt", soCmt);
		maHoa.put("hoVaTen", hoVaTen);
		maHoa.put("namSinh", namSinh);
		maHoa.put("ngayHetHan", ngayHetHan);
		maHoa.put("gioiTinh", gioiTinh);
		gtoTThan.put("maHoa", maHoa);
	}
	
	public void addAddress(DataResult result, Map<String, Object> gtoTThan) {
		Map<String, Object> diaChi = new HashMap<String, Object>();
		String tinhThanh = "";
		String quanHuyen = "";
		String phuongXa = "";
		String chiTiet = "";
		if (result.getAddressDetails() != null) {
			tinhThanh = result.getAddressDetails().getProvince();
			quanHuyen = "";
			phuongXa = "";
			chiTiet = "";
		}
		diaChi.put("tinhThanh", tinhThanh);
		diaChi.put("quanHuyen", quanHuyen);
		diaChi.put("phuongXa", phuongXa);
		diaChi.put("chiTiet", chiTiet);
		gtoTThan.put("diaChi", diaChi);
	}

	public String ngayCap(String node) {
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

	public Integer loaiGToTThan(String type) {
		if (!StringUtils.isEmpty(type)) {
			if ("cmt_9_mt".equals(type) || "cmt_12_mt".equals(type)) {
				return 1;
			} else if ("cccd_12_mt".equals(type)) {
				return 2;
			} else if ("cccd_chip_mt".equals(type) || "cc_2024_mt".equals(type)) {
				return 4;
			}
		}
		return null;
	}
	
	private static class DataResult implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String idNumber;
		private String fullName;
		private String dateOfBirth;
		private String homeTown;
		private String address;
		private String recognitionFeature;
		private String issuedDate;
		private String issuedPlace;
		private String frontSideOfId;
		private String backSideOfId;
		private String nationality;
		private String expiredDate;
		private String gender;
		
		private AddressDetails addressDetails;
		private CheckFrontSide checkFrontSide;
		private CheckBackSide checkBackSide;
		
		private String idCardScore;
		private String fullNameScore;
		private String dateOfBirthScore;
		private String expiredDateScore;
		private String homeTownScore;
		private String addressScore;
		private String issuedDateScore;
		private String issuedPlaceScore;
		private String genderScore;
		private String nationalityScore;
		
		private Mrz mrz;
		
		private String codeCityHomeTown;
		private String codeCityAddress;
		private String codeCityIssuedPlace;
		
		public String getIdNumber() {
			return idNumber;
		}
		public void setIdNumber(String idNumber) {
			this.idNumber = idNumber;
		}
		public String getFullName() {
			return fullName;
		}
		public void setFullName(String fullName) {
			this.fullName = fullName;
		}
		public String getDateOfBirth() {
			return dateOfBirth;
		}
		public void setDateOfBirth(String dateOfBirth) {
			this.dateOfBirth = dateOfBirth;
		}
		public String getHomeTown() {
			return homeTown;
		}
		public void setHomeTown(String homeTown) {
			this.homeTown = homeTown;
		}
		public String getAddress() {
			return address;
		}
		public void setAddress(String address) {
			this.address = address;
		}
		public String getRecognitionFeature() {
			return recognitionFeature;
		}
		public void setRecognitionFeature(String recognitionFeature) {
			this.recognitionFeature = recognitionFeature;
		}
		public String getIssuedDate() {
			return issuedDate;
		}
		public void setIssuedDate(String issuedDate) {
			this.issuedDate = issuedDate;
		}
		public String getIssuedPlace() {
			return issuedPlace;
		}
		public void setIssuedPlace(String issuedPlace) {
			this.issuedPlace = issuedPlace;
		}
		public String getFrontSideOfId() {
			return frontSideOfId;
		}
		public void setFrontSideOfId(String frontSideOfId) {
			this.frontSideOfId = frontSideOfId;
		}
		public String getBackSideOfId() {
			return backSideOfId;
		}
		public void setBackSideOfId(String backSideOfId) {
			this.backSideOfId = backSideOfId;
		}
		public String getNationality() {
			return nationality;
		}
		public void setNationality(String nationality) {
			this.nationality = nationality;
		}
		public String getExpiredDate() {
			return expiredDate;
		}
		public void setExpiredDate(String expiredDate) {
			this.expiredDate = expiredDate;
		}
		public String getGender() {
			return gender;
		}
		public void setGender(String gender) {
			this.gender = gender;
		}
		public AddressDetails getAddressDetails() {
			return addressDetails;
		}
		public void setAddressDetails(AddressDetails addressDetails) {
			this.addressDetails = addressDetails;
		}
		public CheckFrontSide getCheckFrontSide() {
			return checkFrontSide;
		}
		public void setCheckFrontSide(CheckFrontSide checkFrontSide) {
			this.checkFrontSide = checkFrontSide;
		}
		public CheckBackSide getCheckBackSide() {
			return checkBackSide;
		}
		public void setCheckBackSide(CheckBackSide checkBackSide) {
			this.checkBackSide = checkBackSide;
		}
		public String getIdCardScore() {
			return idCardScore;
		}
		public void setIdCardScore(String idCardScore) {
			this.idCardScore = idCardScore;
		}
		public String getFullNameScore() {
			return fullNameScore;
		}
		public void setFullNameScore(String fullNameScore) {
			this.fullNameScore = fullNameScore;
		}
		public String getDateOfBirthScore() {
			return dateOfBirthScore;
		}
		public void setDateOfBirthScore(String dateOfBirthScore) {
			this.dateOfBirthScore = dateOfBirthScore;
		}
		public String getExpiredDateScore() {
			return expiredDateScore;
		}
		public void setExpiredDateScore(String expiredDateScore) {
			this.expiredDateScore = expiredDateScore;
		}
		public String getHomeTownScore() {
			return homeTownScore;
		}
		public void setHomeTownScore(String homeTownScore) {
			this.homeTownScore = homeTownScore;
		}
		public String getAddressScore() {
			return addressScore;
		}
		public void setAddressScore(String addressScore) {
			this.addressScore = addressScore;
		}
		public String getIssuedDateScore() {
			return issuedDateScore;
		}
		public void setIssuedDateScore(String issuedDateScore) {
			this.issuedDateScore = issuedDateScore;
		}
		public String getIssuedPlaceScore() {
			return issuedPlaceScore;
		}
		public void setIssuedPlaceScore(String issuedPlaceScore) {
			this.issuedPlaceScore = issuedPlaceScore;
		}
		public String getGenderScore() {
			return genderScore;
		}
		public void setGenderScore(String genderScore) {
			this.genderScore = genderScore;
		}
		public String getNationalityScore() {
			return nationalityScore;
		}
		public void setNationalityScore(String nationalityScore) {
			this.nationalityScore = nationalityScore;
		}
		public Mrz getMrz() {
			return mrz;
		}
		public void setMrz(Mrz mrz) {
			this.mrz = mrz;
		}
		public String getCodeCityHomeTown() {
			return codeCityHomeTown;
		}
		public void setCodeCityHomeTown(String codeCityHomeTown) {
			this.codeCityHomeTown = codeCityHomeTown;
		}
		public String getCodeCityAddress() {
			return codeCityAddress;
		}
		public void setCodeCityAddress(String codeCityAddress) {
			this.codeCityAddress = codeCityAddress;
		}
		public String getCodeCityIssuedPlace() {
			return codeCityIssuedPlace;
		}
		public void setCodeCityIssuedPlace(String codeCityIssuedPlace) {
			this.codeCityIssuedPlace = codeCityIssuedPlace;
		}
	}
	
	private static class AddressDetails implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String province;
		private String district;
		private String ward;
		private String street;
		private String country;
		
		public String getProvince() {
			return province;
		}
		public void setProvince(String province) {
			this.province = province;
		}
		public String getDistrict() {
			return district;
		}
		public void setDistrict(String district) {
			this.district = district;
		}
		public String getWard() {
			return ward;
		}
		public void setWard(String ward) {
			this.ward = ward;
		}
		public String getStreet() {
			return street;
		}
		public void setStreet(String street) {
			this.street = street;
		}
		public String getCountry() {
			return country;
		}
		public void setCountry(String country) {
			this.country = country;
		}
	}
	
	private static class CheckFrontSide implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String recapturedResult;
		private String checkPhotocopiedResult;
		private String checkPhotocopiedProb;
		private String cornerCutResult;
		private List<String> cornerCutProb;
		private String editedResult;
		private String checkEmbossedStampResult;
		private String checkNationalEmblemResult;
		private String checkNationalEmblemProb;
		private String checkGlareResult;
		private String checkGlareProb;
		private String checkAvatarResult;
		private String checkAvatarProb;
		private String checkReplacementAvatarResult;
		private String checkReplacementAvatarProb;
		private String onFrameResult;
		private String onFrameProb;
		private String expiredDate;
		private String lawOfNumbers;
		private String kiemTraAnh;
		
		public String getRecapturedResult() {
			return recapturedResult;
		}
		public void setRecapturedResult(String recapturedResult) {
			this.recapturedResult = recapturedResult;
		}
		public String getCheckPhotocopiedResult() {
			return checkPhotocopiedResult;
		}
		public void setCheckPhotocopiedResult(String checkPhotocopiedResult) {
			this.checkPhotocopiedResult = checkPhotocopiedResult;
		}
		public String getCheckPhotocopiedProb() {
			return checkPhotocopiedProb;
		}
		public void setCheckPhotocopiedProb(String checkPhotocopiedProb) {
			this.checkPhotocopiedProb = checkPhotocopiedProb;
		}
		public String getCornerCutResult() {
			return cornerCutResult;
		}
		public void setCornerCutResult(String cornerCutResult) {
			this.cornerCutResult = cornerCutResult;
		}
		public List<String> getCornerCutProb() {
			return cornerCutProb;
		}
		public void setCornerCutProb(List<String> cornerCutProb) {
			this.cornerCutProb = cornerCutProb;
		}
		public String getEditedResult() {
			return editedResult;
		}
		public void setEditedResult(String editedResult) {
			this.editedResult = editedResult;
		}
		public String getCheckEmbossedStampResult() {
			return checkEmbossedStampResult;
		}
		public void setCheckEmbossedStampResult(String checkEmbossedStampResult) {
			this.checkEmbossedStampResult = checkEmbossedStampResult;
		}
		public String getCheckNationalEmblemResult() {
			return checkNationalEmblemResult;
		}
		public void setCheckNationalEmblemResult(String checkNationalEmblemResult) {
			this.checkNationalEmblemResult = checkNationalEmblemResult;
		}
		public String getCheckNationalEmblemProb() {
			return checkNationalEmblemProb;
		}
		public void setCheckNationalEmblemProb(String checkNationalEmblemProb) {
			this.checkNationalEmblemProb = checkNationalEmblemProb;
		}
		public String getCheckGlareResult() {
			return checkGlareResult;
		}
		public void setCheckGlareResult(String checkGlareResult) {
			this.checkGlareResult = checkGlareResult;
		}
		public String getCheckGlareProb() {
			return checkGlareProb;
		}
		public void setCheckGlareProb(String checkGlareProb) {
			this.checkGlareProb = checkGlareProb;
		}
		public String getCheckAvatarResult() {
			return checkAvatarResult;
		}
		public void setCheckAvatarResult(String checkAvatarResult) {
			this.checkAvatarResult = checkAvatarResult;
		}
		public String getCheckAvatarProb() {
			return checkAvatarProb;
		}
		public void setCheckAvatarProb(String checkAvatarProb) {
			this.checkAvatarProb = checkAvatarProb;
		}
		public String getCheckReplacementAvatarResult() {
			return checkReplacementAvatarResult;
		}
		public void setCheckReplacementAvatarResult(String checkReplacementAvatarResult) {
			this.checkReplacementAvatarResult = checkReplacementAvatarResult;
		}
		public String getCheckReplacementAvatarProb() {
			return checkReplacementAvatarProb;
		}
		public void setCheckReplacementAvatarProb(String checkReplacementAvatarProb) {
			this.checkReplacementAvatarProb = checkReplacementAvatarProb;
		}
		public String getOnFrameResult() {
			return onFrameResult;
		}
		public void setOnFrameResult(String onFrameResult) {
			this.onFrameResult = onFrameResult;
		}
		public String getOnFrameProb() {
			return onFrameProb;
		}
		public void setOnFrameProb(String onFrameProb) {
			this.onFrameProb = onFrameProb;
		}
		public String getExpiredDate() {
			return expiredDate;
		}
		public void setExpiredDate(String expiredDate) {
			this.expiredDate = expiredDate;
		}
		public String getLawOfNumbers() {
			return lawOfNumbers;
		}
		public void setLawOfNumbers(String lawOfNumbers) {
			this.lawOfNumbers = lawOfNumbers;
		}
		public String getKiemTraAnh() {
			return kiemTraAnh;
		}
		public void setKiemTraAnh(String kiemTraAnh) {
			this.kiemTraAnh = kiemTraAnh;
		}
	}
	
	private static class CheckBackSide implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String recapturedResult;
		private String checkPhotocopiedResult;
		private String checkPhotocopiedProb;
		private String editedResult;
		private String checkRedStampResult;
		private String checkRedStampProb;
		private String checkGlareResult;
		private String checkGlareProb;
		private String checkRfpResult;
		private String checkRfpProb;
		private String checkLfpResult;
		private String checkLfpProb;
		private String onFrameResult;
		private String onFrameProb;
		
		public String getRecapturedResult() {
			return recapturedResult;
		}
		public void setRecapturedResult(String recapturedResult) {
			this.recapturedResult = recapturedResult;
		}
		public String getCheckPhotocopiedResult() {
			return checkPhotocopiedResult;
		}
		public void setCheckPhotocopiedResult(String checkPhotocopiedResult) {
			this.checkPhotocopiedResult = checkPhotocopiedResult;
		}
		public String getCheckPhotocopiedProb() {
			return checkPhotocopiedProb;
		}
		public void setCheckPhotocopiedProb(String checkPhotocopiedProb) {
			this.checkPhotocopiedProb = checkPhotocopiedProb;
		}
		public String getEditedResult() {
			return editedResult;
		}
		public void setEditedResult(String editedResult) {
			this.editedResult = editedResult;
		}
		public String getCheckRedStampResult() {
			return checkRedStampResult;
		}
		public void setCheckRedStampResult(String checkRedStampResult) {
			this.checkRedStampResult = checkRedStampResult;
		}
		public String getCheckRedStampProb() {
			return checkRedStampProb;
		}
		public void setCheckRedStampProb(String checkRedStampProb) {
			this.checkRedStampProb = checkRedStampProb;
		}
		public String getCheckGlareResult() {
			return checkGlareResult;
		}
		public void setCheckGlareResult(String checkGlareResult) {
			this.checkGlareResult = checkGlareResult;
		}
		public String getCheckGlareProb() {
			return checkGlareProb;
		}
		public void setCheckGlareProb(String checkGlareProb) {
			this.checkGlareProb = checkGlareProb;
		}
		public String getCheckRfpResult() {
			return checkRfpResult;
		}
		public void setCheckRfpResult(String checkRfpResult) {
			this.checkRfpResult = checkRfpResult;
		}
		public String getCheckRfpProb() {
			return checkRfpProb;
		}
		public void setCheckRfpProb(String checkRfpProb) {
			this.checkRfpProb = checkRfpProb;
		}
		public String getCheckLfpResult() {
			return checkLfpResult;
		}
		public void setCheckLfpResult(String checkLfpResult) {
			this.checkLfpResult = checkLfpResult;
		}
		public String getCheckLfpProb() {
			return checkLfpProb;
		}
		public void setCheckLfpProb(String checkLfpProb) {
			this.checkLfpProb = checkLfpProb;
		}
		public String getOnFrameResult() {
			return onFrameResult;
		}
		public void setOnFrameResult(String onFrameResult) {
			this.onFrameResult = onFrameResult;
		}
		public String getOnFrameProb() {
			return onFrameProb;
		}
		public void setOnFrameProb(String onFrameProb) {
			this.onFrameProb = onFrameProb;
		}
	}
	
	private static class Mrz implements Serializable {
		private static final long serialVersionUID = 1L;
		
		private String raw;
		private String idCard;
		private String fullName;
		private String dateOfBirth;
		private String expiredDate;
		private String gender;
		
		public String getRaw() {
			return raw;
		}
		public void setRaw(String raw) {
			this.raw = raw;
		}
		public String getIdCard() {
			return idCard;
		}
		public void setIdCard(String idCard) {
			this.idCard = idCard;
		}
		public String getFullName() {
			return fullName;
		}
		public void setFullName(String fullName) {
			this.fullName = fullName;
		}
		public String getDateOfBirth() {
			return dateOfBirth;
		}
		public void setDateOfBirth(String dateOfBirth) {
			this.dateOfBirth = dateOfBirth;
		}
		public String getExpiredDate() {
			return expiredDate;
		}
		public void setExpiredDate(String expiredDate) {
			this.expiredDate = expiredDate;
		}
		public String getGender() {
			return gender;
		}
		public void setGender(String gender) {
			this.gender = gender;
		}
	}
}
