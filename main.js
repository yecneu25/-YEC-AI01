const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const messagesWrapper = document.getElementById('messages-wrapper');
const welcomeScreen = document.getElementById('welcome-screen');
const chatHistoryList = document.getElementById('chat-history');
const timerDisplay = document.getElementById('timer');
const newChatBtn = document.getElementById('new-chat-btn');
const shareChatBtn = document.getElementById('share-chat-btn');

// --- NVIDIA NIM API CONFIGURATION (VIA PROXY) ---
const modelSelect = document.getElementById('model-select');
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

// Real AI Response Logic (NVIDIA NIM VIA NETLIFY PROXY)
async function callNvidiaAPI(userText) {
    const selectedModel = modelSelect.value;
    const url = `/.netlify/functions/chat`; // Netlify Serverless endpoint

    
    // Add user message to history
    conversationHistory.push({ role: "user", content: userText });

    const payload = {
        model: selectedModel,
        messages: conversationHistory,
        temperature: 0.5,
        top_p: 1,
        max_tokens: 1024,
        stream: false
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
                // Authorization is handled by server.js Proxy
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.error) {
            console.error("NVIDIA API Error Detail:", data.error);
            throw new Error(data.error.message || "Lỗi không xác định từ NVIDIA API");
        }
        
        if (!data.choices || data.choices.length === 0) {
            throw new Error("AI không trả về kết quả. Có thể nội dung bị chặn hoặc lỗi hệ thống.");
        }
        
        const aiText = data.choices[0].message.content;
        conversationHistory.push({ role: "assistant", content: aiText });
        return aiText;
    } catch (error) {
        console.error("API Error:", error);
        return `⚠️ Có lỗi xảy ra: ${error.message}. <br><br>💡 Gợi ý: Hãy thử đổi sang model khác hoặc kiểm tra lại kết nối.`;
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

    // Call Real API (NVIDIA)
    const response = await callNvidiaAPI(text);
    
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
