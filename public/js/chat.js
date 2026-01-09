class HotelChatbot {
    constructor() {
        this.chatContainer = document.getElementById('chat-container');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.conversationHistory = [];
        this.apiUrl = '/api/chat';        
        this.init();
    }
    init() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        document.getElementById('clear-btn').addEventListener('click', () => this.clearChat());
        document.getElementById('refresh-btn').addEventListener('click', () => this.refreshData());
        document.querySelector('.attach-btn').addEventListener('click', () => this.toggleQuickActions());
        document.querySelectorAll('.quick-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const message = e.currentTarget.getAttribute('data-message');
                this.userInput.value = message;
                this.sendMessage();
                this.toggleQuickActions();
            });
        });
    }

    async sendMessage() {
        const message = this.userInput.value.trim();        
        if (!message) return;
        this.addMessage(message, 'user');
        this.userInput.value = '';
        this.showTyping();
        this.sendBtn.disabled = true;
        
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message,
                    conversationHistory: this.conversationHistory
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.conversationHistory = data.conversationHistory || [];
                this.updateDataBanner(data.dataSource);
                this.addMessage(data.reply, 'bot');
            } else {
                this.addMessage('Sorry, I encountered an error. Please try again.', 'bot');
                this.showToast('Error: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.addMessage('Sorry, I could not connect to the server. Please check your connection.', 'bot');
            this.showToast('Connection error', 'error');
        } finally {
            this.hideTyping();
            this.sendBtn.disabled = false;
        }
    }
    addMessage(text, sender) {
        const welcomeMsg = this.chatContainer.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;        
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });        
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${this.formatMessage(text)}</div>
                <span class="message-time">${timeString}</span>
            </div>
        `;        
        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    formatMessage(text) {
        text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        text = text.replace(/\n/g, '<br>');
        text = text.replace(/(\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g, 
            '<a href="tel:$1">$1</a>');        
        return text;
    }
    showTyping() {
        this.typingIndicator.style.display = 'flex';
        this.scrollToBottom();
    }
    hideTyping() {
        this.typingIndicator.style.display = 'none';
    }
    scrollToBottom() {
        setTimeout(() => {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }, 100);
    }
    clearChat() {
        if (confirm('Are you sure you want to clear the chat?')) {
            this.chatContainer.innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-icon">
                        <i class="fas fa-hotel"></i>
                    </div>
                    <h2>Welcome Back!</h2>
                    <p>Chat cleared. How can I help you today?</p>
                </div>
            `;
            this.conversationHistory = [];
            this.showToast('Chat cleared successfully');
        }
    }
    async refreshData() {
        const refreshBtn = document.getElementById('refresh-btn');
        const icon = refreshBtn.querySelector('i');
        
        icon.classList.add('rotating');        
        try {
            const response = await fetch('/api/refresh-hotel-data', {
                method: 'POST'
            });            
            const data = await response.json();            
            if (response.ok) {
                this.showToast('Hotel data refreshed successfully');
                document.getElementById('data-banner').style.display = 'none';
            } else {
                this.showToast('Failed to refresh data', 'error');
            }
        } catch (error) {
            console.error('Refresh error:', error);
            this.showToast('Connection error', 'error');
        } finally {
            icon.classList.remove('rotating');
        }
    }

    toggleQuickActions() {
        const quickActions = document.getElementById('quick-actions');
        quickActions.style.display = 
            quickActions.style.display === 'none' ? 'grid' : 'none';
    }

    updateDataBanner(dataSource) {
        const banner = document.getElementById('data-banner');
        const bannerText = document.getElementById('banner-text');
        
        if (dataSource === 'fallback') {
            bannerText.textContent = '⚠️ Using cached data. Room availability may not be current. Please call to confirm.';
            banner.style.display = 'flex';
        } else if (dataSource === 'cache') {
            bannerText.textContent = 'ℹ️ Displaying cached data from the last update.';
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');
        const icon = toast.querySelector('i');
        
        toastMessage.textContent = message;
        if (type === 'error') {
            icon.className = 'fas fa-exclamation-circle';
            toast.style.background = '#ef4444';
        } else {
            icon.className = 'fas fa-check-circle';
            toast.style.background = '#10b981';
        }        
        toast.classList.add('show');        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    new HotelChatbot();
});
