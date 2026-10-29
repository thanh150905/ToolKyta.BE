// Bản tham chiếu (nháp Java, KHÔNG dán thẳng lên server được).
// Nguồn: excall/src/main/java/com/fis/excall/service/test/kyta_finish_kyta_task.java
// Secret đã thay bằng "<REDACTED>" (0 chỗ).
package com.fis.excall.service.test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.fis.excall.client.ErequestClient;
import com.fis.excall.config.MapperClass;
import com.fis.excall.service.erequest.dto.InternalResourcePayloadDTO;
import com.fis.excall.service.erequest.dto.TicketDTO;

@Service
public class kyta_finish_kyta_task {
	@Qualifier("trustedSSLRestTemplate")
	@Autowired
	public RestTemplate restTemplate;

	@Autowired
	private MapperClass mapperClass;
	
	@Autowired
	private ErequestClient erequestClient;
	
	protected Object finishKytaTask(Object content) throws Exception {
		InternalResourcePayloadDTO payloadDTO = mapperClass.swap(InternalResourcePayloadDTO.class, content);
		String ticketId = payloadDTO.getTicketId();
		String userTaskId = payloadDTO.getServiceTaskId();
		
		if (ticketId == null || userTaskId == null) {
			throw new RuntimeException("TicketId or UserTaskId is underfind");
		}
		
		TicketDTO ticketDTO = erequestClient.finishTask(payloadDTO);
		
		return ticketDTO.getId();
	}
}
