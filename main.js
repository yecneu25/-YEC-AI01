const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const messagesWrapper = document.getElementById('messages-wrapper');
const welcomeScreen = document.getElementById('welcome-screen');
const chatHistoryList = document.getElementById('chat-history');
const timerDisplay = document.getElementById('timer');
const newChatBtn = document.getElementById('new-chat-btn');
const shareChatBtn = document.getElementById('share-chat-btn');

// --- N8N WORKFLOW CONFIGURATION ---
const SYSTEM_PROMPT = `Bạn là trợ lý AI chuyên gia của Young Economists Club (YEC). 
Nhiệm vụ của bạn là hỗ trợ các bạn trẻ trong lĩnh vực kinh tế, tài chính và kinh doanh. 
Hãy trả lời một cách chuyên nghiệp, thông thái nhưng vẫn gần gũi, truyền cảm hứng. 
Luôn ưu tiên các phân tích dựa trên dữ liệu và tư duy phản biện.`;

let startTime = Date.now();
let conversationHistory = [{ role: "system", content: SYSTEM_PROMPT }]; // OpenAI format

// Timer function
function updateTimer() {
    const elapsed = Date.now() - startTime;
    const hours = Math.floor(elapsed / 3600000).toString().padStart(2, '0');
    const minutes = Math.floor((elapsed % 3600000) / 60000).toString().padStart(2, '0');
    const seconds = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
    timerDisplay.textContent = `${hours}:${minutes}:${seconds}`;
}

setInterval(updateTimer, 1000);

// Auto-expand textarea
chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Real AI Response Logic (n8n Webhook)
// Real AI Response Logic (n8n Webhook)
async function callN8nWebhook(userText) {
    const DIRECT_N8N_URL = 'https://n8n.yecneu.com/webhook/56fadfb7-5418-4bc3-b3d1-51d0f9f7324d';
    
    // Tự động xác định URL proxy dự phòng nếu cuộc gọi trực tiếp bị lỗi CORS:
    let proxyWebhookUrl;
    const isLocalFile = window.location.protocol === 'file:';
    const isLocalAddress = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (!isLocalFile && !isLocalAddress) {
        // Netlify hoặc host production khác
        proxyWebhookUrl = '/.netlify/functions/n8n';
    } else if (isLocalFile || (isLocalAddress && window.location.port !== '3000')) {
        // file:// hoặc cổng khác (Live Server 5500...)
        proxyWebhookUrl = 'http://localhost:3000/api/n8n';
    } else {
        // localhost:3000 - server local đang chạy
        proxyWebhookUrl = '/api/n8n';
    }
    
    // Add user message to history
    conversationHistory.push({ role: "user", content: userText });

    // Payload gửi lên n8n
    const payload = {
        sessionId: "yec-chat-session", // ID phiên chat (có thể tạo động nếu cần)
        message: userText,
        history: conversationHistory
    };

    let response;
    let usedProxy = false;

    try {
        console.log("⚡ Đang thử kết nối TRỰC TIẾP đến n8n để tối ưu tốc độ và tránh timeout...");
        // Thử gọi trực tiếp trước
        response = await fetch(DIRECT_N8N_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP_${response.status}`);
        }
    } catch (directError) {
        console.warn("⚠️ Gọi trực tiếp thất bại (có thể do chưa bật CORS hoặc mất mạng). Đang thử qua Server Proxy dự phòng...", directError);
        
        try {
            usedProxy = true;
            response = await fetch(proxyWebhookUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP_${response.status}`);
            }
        } catch (proxyError) {
            console.error("🔴 Cả kết nối trực tiếp và proxy đều thất bại:", proxyError);
            
            // Xóa tin nhắn cuối khỏi lịch sử nếu lỗi
            const lastMsg = conversationHistory[conversationHistory.length - 1];
            if (lastMsg && lastMsg.role === 'user' && lastMsg.content === userText) {
                conversationHistory.pop();
            }

            let errorMsg = proxyError.message;
            let suggestion = "Hãy kiểm tra URL webhook hoặc trạng thái workflow n8n.";

            // Nhận diện lỗi HTTP
            if (proxyError.message.startsWith("HTTP_")) {
                const statusCode = proxyError.message.split("_")[1];
                errorMsg = `Mã lỗi HTTP ${statusCode}`;
                
                if (statusCode === "524") {
                    errorMsg = "Quá thời gian phản hồi (Cloudflare Timeout 524)";
                    suggestion = "Workflow n8n xử lý mất hơn 100 giây nên Cloudflare đã tự động ngắt kết nối.<br><br>" +
                        "👉 <strong>Cách khắc phục triệt để:</strong><br>" +
                        "1. Đăng nhập vào tài khoản <strong>Cloudflare</strong> của bạn.<br>" +
                        "2. Tìm đến cấu hình DNS của domain <code>yecneu.com</code>.<br>" +
                        "3. Tìm bản ghi subdomain <code>n8n</code> và chuyển trạng thái Proxy (đám mây màu cam) sang <strong>DNS Only</strong> (đám mây màu xám).<br>" +
                        "4. Việc này giúp trình duyệt kết nối trực tiếp tới n8n của bạn mà không bị Cloudflare giới hạn 100s.";
                } else if (statusCode === "504" || statusCode === "502") {
                    errorMsg = "Lỗi cổng kết nối (Gateway Timeout - Giới hạn 10s Netlify)";
                    suggestion = "Do câu trả lời AI mất nhiều thời gian, Serverless Function của Netlify (giới hạn 10-26 giây) đã tự động ngắt kết nối trước khi n8n xử lý xong.<br><br>" +
                        "👉 <strong>Cách khắc phục triệt để:</strong> Bạn cần bật CORS trên n8n để trình duyệt gọi trực tiếp n8n mà không cần đi qua Netlify:<br>" +
                        "1. Mở giao diện thiết kế workflow trong <strong>n8n</strong>.<br>" +
                        "2. Nhấp đúp vào Node <strong>Webhook</strong> đầu tiên.<br>" +
                        "3. Tại cột cài đặt bên phải, cuộn xuống phần <strong>Settings / Options</strong> -> bấm <strong>Add Option</strong> -> chọn <strong>CORS</strong>.<br>" +
                        "4. Bật công tắc CORS sang màu xanh (cho phép mọi nguồn kết nối) -> Bấm <strong>Save</strong> workflow.<br>" +
                        "5. Sau khi bật, giao diện chat sẽ tự động kết nối trực tiếp đến n8n của bạn, loại bỏ hoàn toàn giới hạn 10s của Netlify!";
                }
            } else if (proxyError.message === "Failed to fetch" || proxyError.name === "TypeError") {
                errorMsg = "Không kết nối được tới máy chủ";
                if (isLocalFile) {
                    suggestion = "Bạn đang mở trực tiếp file HTML (giao thức <strong>file://</strong>). Trình duyệt chặn các yêu cầu mạng vì lý do bảo mật.<br>👉 <strong>Cách khắc phục:</strong> Hãy mở Terminal tại thư mục dự án, chạy lệnh <code>npm start</code> rồi truy cập địa chỉ <strong>http://localhost:3000</strong>.";
                } else {
                    suggestion = "Server proxy local (cổng 3000) chưa được khởi động.<br>👉 <strong>Cách khắc phục:</strong> Hãy mở Terminal tại thư mục dự án và chạy lệnh <code>npm start</code> để bắt đầu server.";
                }
            }

            return `⚠️ Có lỗi xảy ra khi kết nối n8n: ${errorMsg}. <br><br>💡 Gợi ý: ${suggestion}`;
        }
    }

    try {
        // Đọc dữ liệu dạng text trước để tránh lỗi "Unexpected end of JSON input" nếu n8n trả về rỗng
        const textResponse = await response.text();
        
        let data = {};
        if (textResponse) {
            try {
                // Thử parse xem có phải JSON không
                data = JSON.parse(textResponse);
                
                // Nếu n8n trả về dạng mảng [ { output: "..." } ], ta lấy phần tử đầu tiên
                if (Array.isArray(data) && data.length > 0) {
                    data = data[0];
                }
            } catch (e) {
                // Nếu không phải JSON (n8n trả về text thuần), ta tự gói lại thành JSON
                data = { output: textResponse };
            }
        }
        
        // Tuỳ thuộc vào node "Webhook Response" trong n8n của bạn trả về cấu trúc nào.
        const aiText = data.output || data.text || data.response || data.message || (typeof data === 'string' ? data : JSON.stringify(data));
        
        if (!aiText) {
            conversationHistory.pop();
            throw new Error("Không nhận được dữ liệu phản hồi hợp lệ từ n8n.");
        }
        
        conversationHistory.push({ role: "assistant", content: aiText });
        return aiText;
    } catch (error) {
        console.error("Error parsing response:", error);
        const lastMsg = conversationHistory[conversationHistory.length - 1];
        if (lastMsg && lastMsg.role === 'user' && lastMsg.content === userText) {
            conversationHistory.pop();
        }
        return `⚠️ Lỗi xử lý phản hồi từ n8n: ${error.message}`;
    }
}

// Send message logic
async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Hide welcome screen if first message
    if (welcomeScreen.style.display !== 'none') {
        welcomeScreen.style.display = 'none';
        messagesWrapper.style.display = 'block';
    }

    // Add User Message
    addMessage(text, 'user');

    // Clear and Reset Input
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Show Typing Indicator
    const typingID = showTypingIndicator();

    // Call Real API (n8n Webhook)
    const response = await callN8nWebhook(text);
    
    // Remove Typing Indicator
    removeTypingIndicator(typingID);
    
    // Add AI Response
    addMessage(response, 'ai');
}

function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'message ai-message typing-container';
    div.innerHTML = `
        <img src="assets/yec-logo.png" alt="YEC" class="message-avatar">
        <div class="message-content">
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    messagesWrapper.appendChild(div);
    scrollToBottom();
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const avatarImg = sender === 'user' ? 
        '<div class="message-avatar"><i class="fa-solid fa-user"></i></div>' : 
        `<img src="assets/yec-logo.png" alt="YEC" class="message-avatar">`;

    // Format text: Convert **bold** to <strong> and handle line breaks
    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

    messageDiv.innerHTML = `
        ${avatarImg}
        <div class="message-content">
            ${formattedText}
        </div>
    `;

    messagesWrapper.appendChild(messageDiv);
    scrollToBottom();
}

function scrollToBottom() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Event Listeners
sendBtn.addEventListener('click', sendMessage);

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// New Chat button
newChatBtn.addEventListener('click', () => {
    messagesWrapper.innerHTML = '';
    welcomeScreen.style.display = 'block';
    messagesWrapper.style.display = 'none';
    startTime = Date.now();
    conversationHistory = [{ role: "system", content: SYSTEM_PROMPT }]; // Reset context
});

// Click suggestions
document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
        chatInput.value = card.querySelector('span').textContent;
        sendMessage();
    });
});

// Share Chat functionality
shareChatBtn.addEventListener('click', () => {
    const sessionID = document.querySelector('.current-chat-info p').textContent.split(': ')[1];
    const dummyLink = `https://yec-ai.chat/session/${sessionID}`;
    
    navigator.clipboard.writeText(dummyLink).then(() => {
        const originalHTML = shareChatBtn.innerHTML;
        shareChatBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        shareChatBtn.style.color = '#00ff00';
        shareChatBtn.style.borderColor = '#00ff00';
        
        setTimeout(() => {
            shareChatBtn.innerHTML = originalHTML;
            shareChatBtn.style.color = '';
            shareChatBtn.style.borderColor = '';
        }, 2000);
        
        alert(`Đã sao chép link phiên chat: ${dummyLink}`);
    });
});

// ===== SETTINGS PANEL & THEME TOGGLE =====
const settingsBtn = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const btnDarkTheme = document.getElementById('btn-dark-theme');
const btnLightTheme = document.getElementById('btn-light-theme');

function openSettings() {
    settingsOverlay.classList.add('open');
}

function closeSettings() {
    settingsOverlay.classList.remove('open');
}

settingsBtn.addEventListener('click', openSettings);
settingsCloseBtn.addEventListener('click', closeSettings);

// Close when clicking outside the panel
settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) closeSettings();
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettings();
});

function setTheme(theme) {
    document.body.classList.remove('dark-theme', 'light-theme');
    document.body.classList.add(theme + '-theme');
    localStorage.setItem('yec-theme', theme);

    if (theme === 'dark') {
        btnDarkTheme.classList.add('active');
        btnLightTheme.classList.remove('active');
    } else {
        btnLightTheme.classList.add('active');
        btnDarkTheme.classList.remove('active');
    }
}

btnDarkTheme.addEventListener('click', () => setTheme('dark'));
btnLightTheme.addEventListener('click', () => setTheme('light'));

// Load saved theme on startup
const savedTheme = localStorage.getItem('yec-theme') || 'dark';
setTheme(savedTheme);

