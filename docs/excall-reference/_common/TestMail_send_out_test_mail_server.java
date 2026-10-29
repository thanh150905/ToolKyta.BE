// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/TestMail_send_out_test_mail_server.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import java.util.Map;
import java.util.Properties;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;

@Service
public class TestMail_send_out_test_mail_server {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private UaaClient uaaClient;

	@Autowired
	private EnvelopeClient envelopeClients;
	
	public void sendMail(Map<String, String> body) throws Exception {
		String nameBean = body.get("nameBean");
		String host = body.get("host");
		String protocol = body.get("protocol");
		String auth = body.get("auth");
		String enable = body.get("enable");
		String debug = body.get("debug");
		String port = body.get("port");
		String suspend = body.get("suspend");
		
		String username = body.get("username");
		String password = body.get("password");
		
		String from = body.get("from");
		String to = body.get("to");
		
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        
        mailSender.setHost(host);
		mailSender.setPort(Integer.parseInt(port));

		mailSender.setUsername(username);
		mailSender.setPassword(password);

		Properties props = mailSender.getJavaMailProperties();
		props.put("mail.smtp.ssl.trust", host);
		props.put("mail.transport.protocol", protocol); 
		props.put("mail.smtp.auth", auth); 
		props.put("mail.smtp.starttls.enable", enable);
		props.put("mail.debug", debug);

		SimpleMailMessage message = new SimpleMailMessage();
		
		message.setFrom(from);
		message.setTo(to);
		message.setSubject("Demo send mail");
		message.setText("Have a good day!");
		 
		
		mailSender.send(message);
    }
}
