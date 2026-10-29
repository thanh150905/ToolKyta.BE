// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/PrudentialTest.java
// Secret đã thay bằng "<REDACTED>" (2 chỗ).
package com.fis.excall.service.test;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.List;

import org.apache.commons.io.FileUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.common.OAuth2AccessToken;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.service.envelope.dto.DocumentDTO;
import com.fis.excall.service.envelope.dto.EnvelopeDTO;
import com.fis.excall.util.FolderUtil;

import net.schmizz.sshj.SSHClient;
import net.schmizz.sshj.sftp.SFTPEngine;
import net.schmizz.sshj.sftp.SFTPFileTransfer;
import net.schmizz.sshj.transport.verification.PromiscuousVerifier;

@Service
public class PrudentialTest {

	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private EnvelopeClient envelopeClients;

	@Autowired
	private UaaClient uaaClient;

	private static final String urlFPTeContract = "http://10.15.68.187:8080/app/";
	
//	private static final String urlFPTeContract = "https://demo.econtract.fpt.com.vn/app/";
	
//	private static final String urlFPTeContract = "https://econtract.fpt.com.vn/app/";



	public static final String remoteHost = "securefiletransfer.intranet.asia";
	private static final String remoteDir = "PVA_PROJECT/Digital Signature/";
	private static final String username = "<REDACTED>";
	private static final String password = "<REDACTED>";

	// private static final String remoteHost = "PVA_PROJECT/Digital Signature/";

	public void sendFileToSFTP(String envelopeId, String status) {

		if(! "completed".equals(status)) {
			return;
		}
		
		EnvelopeDTO envelope = envelopeClients.getEnvelopeById(envelopeId);

		OAuth2AccessToken accessToken = uaaClient.getOAuth2AccessToken(envelope.getOwner());
		String token = "Bearer " + accessToken.getValue();
		HttpHeaders headersEcon = new HttpHeaders();
		headersEcon.setContentType(MediaType.APPLICATION_JSON);
		headersEcon.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
		headersEcon.set("Authorization", token);
		List<DocumentDTO> documentDTO = envelope.getDocuments();
		byte[] file = this.getFileFromEnvelopeId(headersEcon, envelopeId, documentDTO.get(0).getId());
		String tmpFileWriter = FolderUtil.tempLink(envelope.getId(), "pdf");
		try {
			FileUtils.writeByteArrayToFile(new File(tmpFileWriter), file);
			this.uploadFile(tmpFileWriter, envelope.getName() + ".pdf");
		} catch (Exception e) {
			e.printStackTrace();
			throw new RuntimeException(e.getMessage());
		} finally {
			try {
				Files.deleteIfExists(Paths.get(tmpFileWriter));
			} catch (IOException e) {
			}
		}
	}

	private byte[] getFileFromEnvelopeId(HttpHeaders headersEcon, String envelopeId, String docId) {
		String urlDownload = "services/envelope/api/envelope/{envelopeId}/doc/{docId}/content";
		// build the request
		HttpEntity<Object> request = new HttpEntity<>(headersEcon);
		ResponseEntity<byte[]> response = this.restTemplate.exchange(urlFPTeContract + urlDownload, HttpMethod.GET,
				request, byte[].class, envelopeId, docId);

		byte[] fileContent = response.getBody();

		return fileContent;
	}

	private SSHClient setupSshj() throws IOException {
		SSHClient client = new SSHClient();
		client.addHostKeyVerifier(new PromiscuousVerifier());
		client.connect(remoteHost);
		client.authPassword(username, password);
		return client;
	}

	public void uploadFile(String localFile, String fileName) throws IOException {
		SSHClient sshClient = setupSshj();
//		SFTPClient sftpClient = sshClient.newSFTPClient();
		SFTPEngine engine = new SFTPEngine(sshClient).init();
		SFTPFileTransfer xfer = new SFTPFileTransfer(engine);
		xfer.setPreserveAttributes(false);
		try {
			xfer.upload(localFile, remoteDir + fileName);
		} catch (Exception e) {
			throw new RuntimeException(e.getMessage());
		} finally {
			engine.close();
			sshClient.disconnect();
		}

	}

}
