// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/ExpoTest.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.fis.excall.client.EnvelopeClient;
import com.fis.excall.client.NotificationClient;
import com.fis.excall.client.UaaClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.service.notify.dto.DashboardTransferNotify;

@Service
public class ExpoTest {

	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;

	@Autowired
	private EnvelopeClient envelopeClients;

	@Autowired
	private UaaClient uaaClient;

	@Autowired
	private NotificationClient notificationClient;

	private static final String urlFPTeContract = "http://10.15.68.187:8080/app/";

//	private static final String urlFPTeContract = "https://demo.econtract.fpt.com.vn/app/";

	private static final String urlExpoHost = "https://exp.host/--/api/v2/push/send";

	private static final String vi = "vi";
	private static final String en = "en";

	private static final String TITLE = "FPT.eContract";

	public String sendNotify(Object payload) {

		try {
			ExpoPayload body = mapperClass.swap(ExpoPayload.class, payload);

			List<String> toList = body.getTo();
			Map<String, String> language = body.getLanguage();

			if (toList != null && toList.size() > 0) {

				Map<String, String> params = new HashMap<String, String>();

				params.put("owner", body.getOwner());

				DashboardTransferNotify dashboardTransferNotify = notificationClient.transferDashboard(params);

				List<ExpoPayload> expoPayloadSend = new ArrayList<>();

				for (String to : toList) {
					String lg = language.get(to);
					ExpoPayload expoPayload = new ExpoPayload();

					String resourceName = body.getAttrs().get("resourceName");
					String recipientRole = body.getAttrs().get("recipientRole");
					String recipientStatus = body.getAttrs().get("recipientStatus");

					String waiting= dashboardTransferNotify.getWaiting() ;
					Integer badge = Integer.parseInt(waiting);
					
					badge = badge <0 ? 0 :badge;
					
					if (!en.equals(lg)) {
						expoPayload.setTo(Arrays.asList(to));
						expoPayload.setBody(this.buildMessVi(body.getNotifyEvent(), resourceName, recipientRole,recipientStatus));
						expoPayload.setBadge(badge);
						expoPayload.setTitle(TITLE);
						expoPayload.setData(new HashMap<>());
					} else {
						expoPayload.setTo(Arrays.asList(to));
						expoPayload.setBody(this.buildMessEn(body.getNotifyEvent(), resourceName, recipientRole,recipientStatus));
						expoPayload.setBadge(badge);
						expoPayload.setTitle(TITLE);
						expoPayload.setData(new HashMap<>());
					}
					expoPayloadSend.add(expoPayload);

				}
				this.sendToExpoServer(body.getOwner(), expoPayloadSend);
			}

		} catch (Exception e) {
			throw new RuntimeException(e.getMessage());
		}
		return "ok";
	}

	public String buildMessVi(String eventType, String nameResource, String recipientRole, String recipientStatus) {

		String actionByRole = null;

		String decisionByRole = null;

		if ("reviewer".equals(recipientRole)) {
			actionByRole = "xem xét";
		} else if ("stamper".equals(recipientRole)) {
			actionByRole = "đóng dấu";
		} else if ("coordinator".equals(recipientRole)) {
			actionByRole = "điều phối";
		} else {
			actionByRole = "ký kết";
		}

		if ("accepted".equals(recipientStatus)) {
			decisionByRole = "thành công";
		} else {
			decisionByRole = "thất bại";
		}

		String mess = null;
		if ("recipient_start".equals(eventType)) {
			mess = "Bạn có tài liệu: " + nameResource + " cần " + actionByRole;
		} else if ("recipient_finish".equals(eventType)) {
			mess = "Tài liệu: " + nameResource + " đã " + actionByRole +" "+ decisionByRole;
		} else if ("recipient_forward_old".equals(eventType)) {
			mess = "Tài liệu: " + nameResource + " chuyển tiếp thành công.";
		} else if ("recipient_forward_new".equals(eventType)) {
			mess = "Bạn đã nhận được chuyển tiếp " + actionByRole + " tài liệu " + nameResource;
		} else if ("recipient_delegate_old".equals(eventType)) {
			mess = "Tài liệu: " + nameResource + " ủy quyền thành công.";
		} else if ("recipient_delegate_new".equals(eventType)) {
			mess = "Bạn đã nhận được ủy quyền " + actionByRole + " tài liệu " + nameResource;
		} else if ("recipient_replace_old".equals(eventType)) {
			mess = "Tài liệu: " + nameResource + " đã được thay thế " + actionByRole + "bởi người tạo thành công";
		} else if ("recipient_replace_new".equals(eventType)) {
			mess = "Bạn có tài liệu: " + nameResource + " cần " + actionByRole;
		} else if ("flow_finish_not_complete".equals(eventType)) {
			mess = "Tài liệu: " + nameResource + " cần bạn ký kết đã không hoàn thành. ";
		} else if ("flow_finish_complete".equals(eventType)) {
			mess = "Tài liệu: " + nameResource + " cần bạn ký kết đã hoàn thành. ";
		}
		return mess;
	}

	public String buildMessEn(String eventType, String nameResource, String recipientRole, String recipientStatus) {
		String actionByRole = null;
		String decisionByRole = null;

		if ("reviewer".equals(recipientRole)) {
			actionByRole = "review";
		} else if ("stamper".equals(recipientRole)) {
			actionByRole = "stamp";
		} else if ("coordinator".equals(recipientRole)) {
			actionByRole = "coordinate";
		} else {
			actionByRole = "sign";
		}
		if ("accepted".equals(recipientStatus)) {
			decisionByRole = "successfully";
		} else {
			decisionByRole = "rejected";
		}

		String mess = null;
		if ("recipient_start".equals(eventType)) {
			mess = "You have a document: " + nameResource + " need to " + actionByRole;
		} else if ("recipient_finish".equals(eventType)) {
			mess = "Document:" + nameResource +" " + actionByRole +" "+ decisionByRole;
		} else if ("recipient_forward_old".equals(eventType)) {
			mess = "Document:" + nameResource + " forwarded successfully.";
		} else if ("recipient_forward_new".equals(eventType)) {
			mess = "You are forwarded to " + actionByRole + " a document: " + nameResource;
		} else if ("recipient_delegate_old".equals(eventType)) {
			mess = "Document:" + nameResource + " delegated successfully.";
		} else if ("recipient_delegate_new".equals(eventType)) {
			mess = "You are delegated to " + actionByRole + " a document: " + nameResource;
		} else if ("recipient_replace_old".equals(eventType)) {
			mess = "Document:" + nameResource + " was replaced " + actionByRole;
		} else if ("recipient_replace_new".equals(eventType)) {
			mess = "You have a document: " + nameResource + " need to " + actionByRole;
		} else if ("flow_finish_not_complete".equals(eventType)) {
			mess = "Document:" + nameResource + " is not complete. ";
		} else if ("flow_finish_complete".equals(eventType)) {
			mess = "Document:" + nameResource + " completed. ";
		}
		return mess;
	}

	public void sendToExpoServer(String owner, List<ExpoPayload> payloadToSend) {
		HttpEntity request = new HttpEntity(payloadToSend);
		try {

			ResponseEntity<ResponseExpo> responeFromExpoServer = restTemplate.exchange(urlExpoHost, HttpMethod.POST,
					request, ResponseExpo.class);

			if (responeFromExpoServer.getStatusCodeValue() == 200) {
				ResponseExpo responseExpo = responeFromExpoServer.getBody();

				List<ResponseExpoDetails> datas = responseExpo.getData();

				if (datas != null && datas.size() > 0) {
					for (ResponseExpoDetails data : datas) {
						try {
							if ("error".equals(data.getStatus())) {
								Map<String, String> body = new HashMap<>();
								body.put("login", owner);
								int index = datas.indexOf(data);
								body.put("key", payloadToSend.get(index).getTo().get(0));
								notificationClient.unSubscribeNotifyExpoRepository(body);
							}
						} catch (Exception e) {
						}
					}
				}
			} else {
				throw new RuntimeException("error.callExpoServer");
			}
		} catch (HttpStatusCodeException e) {
			throw new RuntimeException(e.getResponseBodyAsString());
		} catch (Exception e) {
			throw new RuntimeException(e.getMessage());
		}

	}

	public static class ResponseExpo implements Serializable {
		/**
		 * 
		 */
		private static final long serialVersionUID = -816461655495057243L;

		public ResponseExpo() {
			super();
			// TODO Auto-generated constructor stub
		}

		public List<ResponseExpoDetails> data;

		public List<ResponseExpoDetails> getData() {
			return data;
		}

		public void setData(List<ResponseExpoDetails> data) {
			this.data = data;
		}

	}

	public static class ResponseExpoDetails implements Serializable {

		public ResponseExpoDetails() {
			super();
			// TODO Auto-generated constructor stub
		}

		/**
		 * 
		 */
		private static final long serialVersionUID = -7319683705563311244L;

		public String status;
		public String id;

		public String message;

		public Map<String, Object> details;

		public String getStatus() {
			return status;
		}

		public void setStatus(String status) {
			this.status = status;
		}

		public String getId() {
			return id;
		}

		public void setId(String id) {
			this.id = id;
		}

		public String getMessage() {
			return message;
		}

		public void setMessage(String message) {
			this.message = message;
		}

		public Map<String, Object> getDetails() {
			return details;
		}

		public void setDetails(Map<String, Object> details) {
			this.details = details;
		}

	}

	public static class ExpoPayload implements Serializable {

		public ExpoPayload() {
			super();
			// TODO Auto-generated constructor stub
		}

		/**
		 * 
		 */
		private static final long serialVersionUID = 8621610482117555429L;
		private List<String> to;
		private String title;

		private String body;

		private int badge;

		private Map<String, Object> data;

		private Map<String, String> language;

		private String owner;

		private String notifyEvent;

		private Map<String, String> attrs;

		public Map<String, String> getAttrs() {
			return attrs;
		}

		public void setAttrs(Map<String, String> attrs) {
			this.attrs = attrs;
		}

		public String getNotifyEvent() {
			return notifyEvent;
		}

		public void setNotifyEvent(String notifyEvent) {
			this.notifyEvent = notifyEvent;
		}

		public String getOwner() {
			return owner;
		}

		public void setOwner(String owner) {
			this.owner = owner;
		}

		public Map<String, String> getLanguage() {
			return language;
		}

		public void setLanguage(Map<String, String> language) {
			this.language = language;
		}

		public List<String> getTo() {
			return to;
		}

		public void setTo(List<String> to) {
			this.to = to;
		}

		public String getTitle() {
			return title;
		}

		public void setTitle(String title) {
			this.title = title;
		}

		public String getBody() {
			return body;
		}

		public void setBody(String body) {
			this.body = body;
		}

		public int getBadge() {
			return badge;
		}

		public void setBadge(int badge) {
			this.badge = badge;
		}

		public Map<String, Object> getData() {
			return data;
		}

		public void setData(Map<String, Object> data) {
			this.data = data;
		}

	}

}
