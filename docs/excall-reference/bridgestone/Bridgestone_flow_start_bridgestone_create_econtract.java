// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/Bridgestone_flow_start_bridgestone_create_econtract.java
// Secret đã thay bằng "<REDACTED>" (2 chỗ).
package com.fis.excall.service.test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.apache.commons.lang3.StringUtils;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.oauth2.common.OAuth2AccessToken;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fis.envelope.pdfutil.PdfUtilEWriter;
import com.fis.envelope.pdfutil.field.FieldDescriptor;
import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.domain.BASE64DecodedMultipartFile;
import com.fis.excall.service.envelope.dto.DataDTO;
import com.fis.excall.service.envelope.dto.DocumentDTO;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;
import com.fis.excall.service.envelope.dto.FieldBoxDTO;
import com.fis.excall.service.envelope.dto.FieldDTO;
import com.fis.excall.service.envelope.dto.FieldDesign;
import com.fis.excall.service.envelope.dto.LotDataDTO;
import com.fis.excall.service.envelope.dto.PartyDTO;
import com.fis.excall.service.envelope.dto.RecipientDTO;
import com.fis.excall.service.envelope.dto.RequesterDTO;
import com.fis.excall.service.envelope.dto.ValidatorDTO;

import software.amazon.awssdk.services.s3.S3Client;

@Service
public class Bridgestone_flow_start_bridgestone_create_econtract {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;

	@Autowired
	private EnvelopeClient envelopeClients;

//	@Autowired
	private S3Client s3Client;

	private static final String urlFPTeContract = "https://10.14.121.18:30600/app/";

	private static final String urlErequest = "https://10.14.121.10/app/";
//	private static final String urlErequest = "https://demo.econtract.fpt.com/app/";

	private static final String urlEwriter = "https://10.14.121.10/ewriter/services/ewriter";

	private static final String urlAuth = "http://10.14.121.18:31018/";
	// private static final String urlAuth =
	// "https://demo.econtract.fpt.com/app/services/uaa/";
	private static final String clientId = "<REDACTED>";
	private static final String clientSecret = "<REDACTED>";

	public String creatingEnvelope(Object body) throws Exception {
        Map<String, Object> mapBody = mapperClass.swap(HashMap.class, body);
        EnvelopeDTO envelope = null;
        String docVariableEwiter = null;
        String owner = null;
        if (mapBody.containsKey("owner") && mapBody.get("owner") != null) {
			owner = String.valueOf(mapBody.get("owner"));
		}

        String envelopeId = null;
        OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(owner);
        String token = "Bearer " + accessToken.getValue();
        HttpHeaders headersEcon = new HttpHeaders();
        headersEcon.setContentType(MediaType.APPLICATION_JSON);
        headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        headersEcon.set("Authorization", token);

        try {
            Object inputData = mapBody.get("lotData");
            LotDataDTO lotData = mapperClass.swap(LotDataDTO.class, inputData);
            try {
                envelope = this.createEnvelopeDraft(headersEcon, lotData);
                envelopeId = envelope.getId();
            } catch (Exception e) {
                throw new RuntimeException(e.getMessage());
            }
            Object docVariableObj = mapBody.get("docVariable");
            List<Map<String, Object>> mapData = new ArrayList<Map<String, Object>>();
            if (docVariableObj instanceof Map) {
                Map<String, String> docVariable = (Map<String, String>) docVariableObj;
                for (Map.Entry<String, String> entry : docVariable.entrySet()) {
                    String cellIndex = entry.getKey();
                    String value = entry.getValue();
                    Map<String, Object> docValue = new HashMap<String, Object>();
                    docValue.put("name", cellIndex);
                    docValue.put("type", "textField");
                    docValue.put("value", value);
                    mapData.add(docValue);
                }
            }
            
            Boolean isDossier = false;
            DocumentInfo documentInfo = null;
            if (mapBody.get("documentInfo") == null) {
            	throw new RuntimeException("No file");
            }
            
            // check document type : DOSSIER or DEFAULT
            List<DocumentInfo> docToUpload = new ArrayList<DocumentInfo>();
            documentInfo = mapperClass.mapper().readValue(mapperClass.mapper().writeValueAsString(mapBody.get("documentInfo")), DocumentInfo.class);
            
            // get all document info from ewriter
        	if ("2".equals(documentInfo.getType())) {
        		isDossier = true;
                if (documentInfo.getAliasDTOS() != null && documentInfo.getAliasDTOS().size() > 0) {
                    for (DocumentInfo info : documentInfo.getAliasDTOS()) {
                    	docToUpload.add(info);
                    }
                    if (docToUpload.size() == 0) {
                        throw new RuntimeException("Document undefined 1");
                    }
                } else {
                	throw new RuntimeException("Document undefined 2");
                }
            } else {
            	docToUpload.add(documentInfo);
            }
            
            // get all recipient id
            List<RecipientDTO> allRecipient = new ArrayList<RecipientDTO>();
            if (envelope.getParties() != null && envelope.getParties().size() > 0) {
            	for (PartyDTO partiesInfor : envelope.getParties()) {
					if (partiesInfor.getRecipients() != null && partiesInfor.getRecipients().size() > 0) {
						for (RecipientDTO rcp : partiesInfor.getRecipients()) {
							allRecipient.add(rcp);
						}
					}
				}
            }
            
            // get file from ewiter
            Map<String, FileEwriterResponse> mapDocToUpload = new HashMap<String, FileEwriterResponse>();
            for (DocumentInfo _docToUpload : docToUpload) {
                Integer order = docToUpload.indexOf(_docToUpload) + 1;
                FileEwriterResponse file = this.getFile(token, _docToUpload.getId(), mapData);
                file.setEwriterId(_docToUpload.getId());
                mapDocToUpload.put(_docToUpload.getId(), file);
            }
            
            // read marker field
            String uploadDocumentType = isDossier ? "DOSSIER" : "DEFAULT";
            for (Map.Entry<String, FileEwriterResponse> entry : mapDocToUpload.entrySet()) {
            	FileEwriterResponse pf = entry.getValue();
            	byte[] valuePdfContract = Base64.getDecoder().decode(pf.getBase64());
				InputStream targetStream = new ByteArrayInputStream(valuePdfContract);
				List<FieldDescriptor> result = new ArrayList<>();
				PDDocument document = null;
				try {
					document = PDDocument.load(targetStream);
					result = PdfUtilEWriter.getFieldByMarker(document);
					if (result != null) {
						pf.setFields(result);
						mapDocToUpload.put(entry.getKey(), pf);
					}
				} catch (Exception e) {
					e.printStackTrace();
				} finally {
					if (document != null) {
						try {
							document.close();
						} catch (IOException e) {
							// TODO Auto-generated catch block
							e.printStackTrace();
						}
					}
					targetStream.close();
				}
				
				List<String> rcpList = new ArrayList<String>();
    			for (FieldDescriptor field : pf.getFields()) {
    				if (!rcpList.contains(field.getRecipientId())) {
    					rcpList.add(field.getRecipientId());
    				}
    			}
    			
    			for (RecipientDTO rcp : allRecipient) {
    				if (!rcpList.contains(rcp.getId()) && !"signer".equals(rcp.getRole()) && !"stamper".equals(rcp.getRole())) {
    					rcpList.add(rcp.getId());
    				}
    			}
    			
    			try {
    				envelope = this.uploadEcontractDocument(token, pf.getEwriterId(), valuePdfContract, pf.getFileName(), envelope, "" + pf.getOrder(), rcpList, uploadDocumentType);
              	} catch (Exception e) {
              		throw new Exception(e.getMessage());
		      	}
			}
            
            for (DocumentDTO document : envelope.getDocuments()) {
            	FileEwriterResponse pf = mapDocToUpload.get(document.getDocRefId());
            	pf.setEcontractId(document.getId());
            	mapDocToUpload.put(document.getDocRefId(), pf);
            }
            
            // update envelope
            if (envelope.getParties() != null) {
				for (PartyDTO party : envelope.getParties()) {
					for (RecipientDTO recipient : party.getRecipients()) {
						if ("cecaStamp".equals(recipient.getRole()) || "cecaSeal".equals(recipient.getRole())) {
							continue;
						}

						Integer signatureCount = 0;
						Boolean multipleDigitalSignInSameDocument = false;
//						List<String> multipleSignInDoc = new ArrayList<String>();
						for (Map.Entry<String, FileEwriterResponse> entry : mapDocToUpload.entrySet()) {
							Integer digitalSignatureCount = 0;
							FileEwriterResponse pf = entry.getValue();
							List<FieldDescriptor> fieldDescriptors = pf.getFields();
							if (fieldDescriptors != null && fieldDescriptors.size() > 0) {
								for (FieldDescriptor fieldDescriptor : fieldDescriptors) {
									if (recipient.getId().equals(fieldDescriptor.getRecipientId())) {
										if (FieldDescriptor.Type.DSIGN.equals(fieldDescriptor.getType())
												|| FieldDescriptor.Type.IMAGEDIGITALSIGN
														.equals(fieldDescriptor.getType())) {
											signatureCount += 1;
											digitalSignatureCount += 1;
										}
										if (FieldDescriptor.Type.ISIGN.equals(fieldDescriptor.getType())) {
											signatureCount += 1;
										}
									}
								}
							}
							if (digitalSignatureCount > 1) {
								multipleDigitalSignInSameDocument = true;
							}
						}

						if ("reviewer".equals(recipient.getRole()) && signatureCount > 0) {
							// reviewer có chân ký
							throw new RuntimeException("_reviewerHasSignature");
						}

						if (!"reviewer".equals(recipient.getRole()) && signatureCount == 0) {
							// ko có chân ký nào
							throw new RuntimeException("_recipientNotHaveSignature");
						}

						if (!"reviewer".equals(recipient.getRole()) && multipleDigitalSignInSameDocument) {
							// có nhiều chân ký số
							throw new RuntimeException("_recipientHasMultiSignature");
						}

						// check recipient signtypes và chân ký

						List<FieldDTO> fields = new ArrayList<FieldDTO>();
						for (Map.Entry<String, FileEwriterResponse> entry : mapDocToUpload.entrySet()) {
							FileEwriterResponse pf = entry.getValue();
							List<FieldDescriptor> fieldDescriptors = pf.getFields();
							if (fieldDescriptors != null && fieldDescriptors.size() > 0) {
								for (FieldDescriptor fieldDescriptor : fieldDescriptors) {
									if (recipient.getId().equals(fieldDescriptor.getRecipientId())) {
										FieldDTO field = new FieldDTO();
										String uuid = UUID.randomUUID().toString().replace("-", "");
										field.setId(uuid);
										field.setType("signature");
										field.setDocId(pf.getEcontractId());
										if (FieldDescriptor.Type.IMAGEDIGITALSIGN.equals(fieldDescriptor.getType())) {
											field.setSubType("3");
										} else if (FieldDescriptor.Type.DSIGN.equals(fieldDescriptor.getType())) {
											field.setSubType("2");
										} else if (FieldDescriptor.Type.ISIGN.equals(fieldDescriptor.getType())) {
											field.setSubType("1");
										} else if (FieldDescriptor.Type.STEXT.equals(fieldDescriptor.getType())) {
											field.setName(fieldDescriptor.getId());
											field.setId(fieldDescriptor.getId());
											field.setType("text");

											FieldDTO fieldRecipientInfor = this.findFieldById(recipient,
													fieldDescriptor.getId());
											if (StringUtils.isNotBlank(fieldRecipientInfor.getSubType())) {
												field.setSubType(fieldRecipientInfor.getSubType());
											} else {
												field.setSubType("0_Left");
											}
											if (StringUtils.isNotBlank(fieldRecipientInfor.getColor())) {
												field.setColor(fieldRecipientInfor.getColor());
											} else {
												field.setColor("0, 0, 0");
											}
											if (StringUtils.isNotBlank(fieldRecipientInfor.getFont())) {
												field.setFont(fieldRecipientInfor.getFont());
											} else {
												field.setFont("TIMES_NEW_ROMAN");
											}

											if (fieldRecipientInfor.getFontSize() != null) {
												field.setFontSize(fieldRecipientInfor.getFontSize());
											} else {
												field.setFontSize(14);
											}

											if (StringUtils.isNotBlank(fieldRecipientInfor.getValue())) {
												field.setValue(fieldRecipientInfor.getValue());
											}

										}

										if (field.getValidators() == null || field.getValidators().size() == 0) {
											ValidatorDTO required = new ValidatorDTO();
											required.setType("required");
											required.setExpression("true");

											ValidatorDTO fixed = new ValidatorDTO();
											fixed.setType("fixed");
											fixed.setExpression("true");
											field.setValidators(Arrays.asList(required, fixed));

										}
										field.setPage(fieldDescriptor.getPage());

										FieldBoxDTO fieldBox = new FieldBoxDTO();
										fieldBox.setH(fieldDescriptor.getH());
										Integer w = 164;
										// fieldBox.setW(w.floatValue());
										if (fieldDescriptor.getW() != null
												&& Float.compare(w.floatValue(), fieldDescriptor.getW()) > 0) {
											fieldBox.setW(w.floatValue());
										} else {
											fieldBox.setW(fieldDescriptor.getW());
										}
										fieldBox.setX(fieldDescriptor.getX());
										fieldBox.setY(fieldDescriptor.getY());

										field.setFieldBox(fieldBox);
										field.setFieldDesign(new FieldDesign());
										field.setRecipientId(recipient.getId());

										fields.add(field);
									}
								}
							}
						}
						if (fields != null && fields.size() > 0) {
							recipient.setFields(fields);
						}
					}
				}
			}
            
            try {
				envelope = this.updateEnvelope(headersEcon, envelope);
			} catch (Exception e) {
				throw new RuntimeException("Update parties error");
			}

            EnvelopeDTO envelopeDTO = new EnvelopeDTO();
            envelopeDTO = this.goToProcessing(headersEcon, envelope.getId());

            Map<String, String> bodyR = new HashMap<String, String>();

            bodyR.put("envelopeId", envelopeDTO.getId());

            return mapperClass.mapper().writeValueAsString(bodyR);
        } catch (Exception e) {
            if (StringUtils.isNotBlank(envelopeId)) {
                String ulrDelateContract = "/services/envelope/api/envelope/" + envelopeId;
                headersEcon.setContentType(MediaType.APPLICATION_JSON);
                try {
                    HttpEntity<Object> entityDelete = new HttpEntity<>("delete", headersEcon);

                    ResponseEntity<EnvelopeDTO> requestEcontract4 = restTemplate.exchange(
                        urlFPTeContract + ulrDelateContract, HttpMethod.DELETE, entityDelete, EnvelopeDTO.class);
                } catch (Exception e2) {
                    throw new RuntimeException("Xóa bản ghi nháp không thành công");
                }
            }

            throw new RuntimeException(e.getMessage());
        }
    }
	
	public EnvelopeDTO updateEnvelope(HttpHeaders headersEcon, EnvelopeDTO envelope) {
		List<FieldDTO> rqtFields = new ArrayList<FieldDTO>();
		if (envelope.getParties() != null && envelope.getParties().size() > 0) {
			for (PartyDTO party : envelope.getParties()) {
				for (RecipientDTO recipient : party.getRecipients()) {
					for (FieldDTO field : recipient.getFields()) {
						rqtFields.add(field);
					}
				}
			}
		}

		RequesterDTO requester = envelope.getRequester();
		if (requester != null) {
			requester.setFields(rqtFields);
		}
		envelope.setRequester(requester);
//		envelope.setResourceType("erequest");
		String createEnvelope = "services/envelope/api/envelope/" + envelope.getId();

		headersEcon.setContentType(MediaType.APPLICATION_JSON);
//		envelope.setFlowFinish(Arrays.asList("flow_finish_kyta_econtract_temp_n_determine"));
		HttpEntity<Object> entityEnvelope = new HttpEntity<>(envelope, headersEcon);
		try {
			ResponseEntity<EnvelopeDTO> requestEcontract3 = restTemplate.exchange(urlFPTeContract + createEnvelope,
					HttpMethod.PUT, entityEnvelope, EnvelopeDTO.class);

			return requestEcontract3.getBody();
		} catch (HttpStatusCodeException e) {
			// TODO: handle exception
//			JsonNode rootNode = mapperClass.mapper().readTree(e.getResponseBodyAsString());
			throw new RuntimeException(e.getResponseBodyAsString());
		}
	}
	
	public FieldDTO findFieldById(RecipientDTO recipient, String fieldId) {
		List<FieldDTO> fields = recipient.getFields();
		if (fields != null) {
			for (FieldDTO field : fields) {
				if (fieldId.equals(field.getId())) {
					return field;
				}
			}
		}
		return null;
	}

    public String getRefIdFromLot(LotDataDTO lotData) {
        List<List<DataDTO>> datas = lotData.getDatas();
        List<DataDTO> data = datas.get(0);
        for (DataDTO dt : data) {
            if ("refId".equals(dt.getId())) {
                return dt.getValue();
            }
        }
        return null;

    }

    public EnvelopeDTO createEnvelopeDraft(HttpHeaders headersEcon, LotDataDTO lotData) {
        String urlCreateContractByLot = "/services/envelope/api/external/v1/signDraft";

        HttpEntity<Object> createContractByLot = new HttpEntity<>(lotData, headersEcon);
        try {
            ResponseEntity<EnvelopeDTO> requestEcontractRefId = restTemplate.exchange(
                urlFPTeContract + urlCreateContractByLot, HttpMethod.POST, createContractByLot, EnvelopeDTO.class);
            return requestEcontractRefId.getBody();
        } catch (HttpStatusCodeException e) {
            throw new RuntimeException(e.getResponseBodyAsString());
        }
    }

    public FileEwriterResponse getFile(String token, String docId, List<Map<String, Object>> bodyEwriter)
        throws Exception {

        String urlGetFile = urlEwriter + "/api/internal/documents/exportFile?filePdf=true&documentId=" + docId;

        HttpHeaders headersEcon1 = new HttpHeaders();
        headersEcon1.setContentType(MediaType.APPLICATION_JSON);
        headersEcon1.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        headersEcon1.set("Authorization", token);

        HttpEntity<Object> entity = new HttpEntity<>(bodyEwriter, headersEcon1);
        try {
            ResponseEntity<FileEwriterResponse> response = restTemplate.exchange(urlGetFile, HttpMethod.POST, entity,
                FileEwriterResponse.class);

            FileEwriterResponse body = response.getBody();
            if (body != null) {
                String name = body.getFileName();
                String[] names = name.split("\\.");
                if (names != null && names.length > 1) {
                    names[names.length - 1] = "pdf";
                    name = String.join(".", names);
                    body.setFileName(name);
                }
            }
            return body;
        } catch (HttpStatusCodeException e) {
            throw new RuntimeException(e.getResponseBodyAsString());
        }
    }

    private EnvelopeDTO uploadEcontractDocument(String token, String refId, byte[] valuePdfContract, String fileName,
                                                EnvelopeDTO envelope, String order, List<String> rcpList, String type) throws Exception {
        HttpHeaders headersEcon = new HttpHeaders();
        headersEcon.set("Authorization", token);

        String uploadUrl = "/services/envelope/api/envelope/v2/" + envelope.getId() + "/doc";
        String url2 = urlFPTeContract + uploadUrl;

        BASE64DecodedMultipartFile file = new BASE64DecodedMultipartFile(valuePdfContract, fileName);
        ObjectMapper mapper = new ObjectMapper();
        mapper.configure(SerializationFeature.FAIL_ON_EMPTY_BEANS, false);
        MappingJackson2HttpMessageConverter converter = new MappingJackson2HttpMessageConverter(mapper);
        converter.setSupportedMediaTypes(Arrays.asList(MediaType.APPLICATION_OCTET_STREAM));
        restTemplate.getMessageConverters().add(converter);
        MultiValueMap<String, String> fileMap = new LinkedMultiValueMap<>();
        ContentDisposition contentDisposition = ContentDisposition.builder("form-data").name("files")
            .filename(file.getFileName()).build();
        fileMap.add(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString());
        HttpEntity<byte[]> fileEntity = new HttpEntity<>(file.getBytes(), fileMap);

        Map<String, Object> fileInfos = new HashMap<String, Object>();
        fileInfos.put("type", type);
        fileInfos.put("order", order);
        fileInfos.put("docRefId", refId);
        if (rcpList != null && "DOSSIER".equals(type)) {
            fileInfos.put("recipientList", rcpList);
        }
        MultiValueMap<String, Object> map = new LinkedMultiValueMap<>();
        map.add("files", fileEntity);
        // fileInfos example: "[{\"type\":\"DOSSIER\",\"order\":" + order +
        // ",\"docRefId\":" + refId + "}]";
        map.add("fileInfos", mapperClass.mapper().writeValueAsString(Arrays.asList(fileInfos)));
        map.add("id", envelope.getId());

        headersEcon.setContentType(MediaType.MULTIPART_FORM_DATA);
        try {
            HttpEntity<MultiValueMap<String, Object>> requestUpload = new HttpEntity<>(map, headersEcon);
            ResponseEntity<EnvelopeDTO> requestEcontract2 = restTemplate.postForEntity(url2, requestUpload,
                EnvelopeDTO.class);
            envelope = requestEcontract2.getBody();
        } catch (HttpStatusCodeException e) {
            throw new RuntimeException(e.getResponseBodyAsString());
        }
        return envelope;
    }

    public DocumentInfo getDocumentInfo(HttpHeaders headersEcon, String alias) throws Exception {
        try {
            String url = "/api/internal/documents/structure/" + alias;
            HttpEntity<Object> request = new HttpEntity<>(headersEcon);
            ResponseEntity<DocumentInfo> response = restTemplate.exchange(urlEwriter + url, HttpMethod.POST, request,
                DocumentInfo.class);
            return response.getBody();
        } catch (HttpStatusCodeException e) {
            throw new RuntimeException(e.getResponseBodyAsString());
        }
    }

    private EnvelopeDTO goToProcessing(HttpHeaders headersEcon, String envelopeId) throws Exception {
        String goToUrl = "/services/envelope/api/envelope/" + envelopeId + "/processing";

        HttpEntity<Object> entityEnvelope = new HttpEntity<>(headersEcon);
        try {
            ResponseEntity<EnvelopeDTO> requestEcontract4 = restTemplate.exchange(urlFPTeContract + goToUrl,
                HttpMethod.PUT, entityEnvelope, EnvelopeDTO.class);

            return requestEcontract4.getBody();
        } catch (HttpStatusCodeException e) {
            throw new RuntimeException(e.getResponseBodyAsString());
        }
    }


    private static class FileEwriterResponse implements Serializable {
        private static final long serialVersionUID = 1L;
        
        private Integer order;
		private String fileName;
        private String base64;
		private String ewriterId;
        private String econtractId;
        private List<String> rcpList;

		private List<FieldDescriptor> fields;

		 public Integer getOrder() {
			return order;
		}

		public void setOrder(Integer order) {
			this.order = order;
		}
			
		public String getFileName() {
            return fileName;
        }

        public void setFileName(String fileName) {
            this.fileName = fileName;
        }

        public String getBase64() {
            return base64;
        }

        public void setBase64(String base64) {
            this.base64 = base64;
        }
        
        public String getEwriterId() {
			return ewriterId;
		}

		public void setEwriterId(String ewriterId) {
			this.ewriterId = ewriterId;
		}

		public String getEcontractId() {
			return econtractId;
		}

		public void setEcontractId(String econtractId) {
			this.econtractId = econtractId;
		}
		
		public List<String> getRcpList() {
			return rcpList;
		}

		public void setRcpList(List<String> rcpList) {
			this.rcpList = rcpList;
		}
		
		 public List<FieldDescriptor> getFields() {
			return fields;
		}

		public void setFields(List<FieldDescriptor> fields) {
			this.fields = fields;
		}
    }

    private static class DocumentInfo implements Serializable {
        private static final long serialVersionUID = 1L;

        private String id;
        private String name;
        private String size;
        private String userId;
        private String status;
        private String custId;
        private String orgIn;
        private String type;
        private String templateEcontractId;
        private String alias;
        private String createdBy;
        private String createdDate;
        private List<String> structure;
        private List<DocumentInfo> aliasDTOS;
		
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

        public String getSize() {
            return size;
        }

        public void setSize(String size) {
            this.size = size;
        }

        public String getUserId() {
            return userId;
        }

        public void setUserId(String userId) {
            this.userId = userId;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public String getCustId() {
            return custId;
        }

        public void setCustId(String custId) {
            this.custId = custId;
        }

        public String getOrgIn() {
            return orgIn;
        }

        public void setOrgIn(String orgIn) {
            this.orgIn = orgIn;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getTemplateEcontractId() {
            return templateEcontractId;
        }

        public void setTemplateEcontractId(String templateEcontractId) {
            this.templateEcontractId = templateEcontractId;
        }

        public String getAlias() {
            return alias;
        }

        public void setAlias(String alias) {
            this.alias = alias;
        }

        public String getCreatedBy() {
            return createdBy;
        }

        public void setCreatedBy(String createdBy) {
            this.createdBy = createdBy;
        }

        public String getCreatedDate() {
            return createdDate;
        }

        public void setCreatedDate(String createdDate) {
            this.createdDate = createdDate;
        }

        public List<String> getStructure() {
            return structure;
        }

        public void setStructure(List<String> structure) {
            this.structure = structure;
        }

        public List<DocumentInfo> getAliasDTOS() {
            return aliasDTOS;
        }

        public void setAliasDTOS(List<DocumentInfo> aliasDTOS) {
            this.aliasDTOS = aliasDTOS;
        }
    }
}
