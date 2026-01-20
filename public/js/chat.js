class HotelChatbot {
    constructor() {
        this.chatContainer = document.getElementById('chat-container');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.typingIndicator = document.getElementById('typing-indicator');

        this.conversationHistory = [];
        this.apiUrl = '/api/chat';

        // Voice recognition
        this.isListening = false;
        this.speechRecognition = null;
        this.voiceStatusElement = null;
        this.voiceAnimation = null;

        // Date picker
        this.currentDatePicker = null;
        this.flatpickrInstance = null;

        this.init();
    }

    init() {
        // Initialize voice recognition
        this.initVoiceRecognition();

        // Event listeners
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            micBtn.addEventListener('click', () => this.toggleVoiceRecognition());
        }

        this.sendBtn.addEventListener('click', () => this.sendMessage());

        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Other event listeners
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

        document.getElementById('chat-toggle-btn').addEventListener('click', () => {
            const container = document.getElementById('chat-container-main');
            const toggleBtn = document.getElementById('chat-toggle-btn');

            if (container.classList.contains('open')) {
                container.classList.remove('open');
                toggleBtn.innerHTML = '<i class="fa-brands fa-uncharted"></i>';
            } else {
                container.classList.add('open');
                toggleBtn.innerHTML = '<i class="fas fa-times"></i>';
            }
        });

        document.getElementById('close-btn').addEventListener('click', () => {
            this.closeChat();
        });

        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    // ============ VOICE RECOGNITION METHODS ============

    initVoiceRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            document.getElementById('mic-btn').style.display = 'none';
            console.warn('Voice recognition not supported');
            return;
        }

        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.lang = 'en-US';
        this.speechRecognition.maxAlternatives = 1;

        // Add a timer to auto-send after silence
        this.silenceTimer = null;
        this.silenceTimeout = 1500; // 1.5 seconds of silence

        this.speechRecognition.onstart = () => {
            this.isListening = true;
            this.updateMicButton(true);
            this.showVoiceStatus('listening', '🎤 Listening... Speak now');
            this.startVoiceAnimation();
        };

        this.speechRecognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // Update input field with what's being said
            if (interimTranscript) {
                this.userInput.value = interimTranscript;
                this.updateVoiceTranscript(interimTranscript);

                // Reset silence timer
                this.resetSilenceTimer();
            }

            // When final transcript is ready
            if (finalTranscript) {
                this.userInput.value = finalTranscript;
                this.updateVoiceTranscript(`"${finalTranscript}"`);

                // Stop voice recognition immediately
                this.stopVoiceRecognition();

                // Show sending status briefly, then send
                this.showVoiceStatus('ready', '✅ Sending...');
                setTimeout(() => {
                    this.sendMessage();
                    this.removeVoiceStatus();
                }, 500);
            }
        };

        this.speechRecognition.onerror = (event) => {
            console.error('Voice recognition error:', event.error);
            this.stopVoiceRecognition();

            let errorMsg = 'Voice input failed';
            if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                errorMsg = 'Microphone access denied';
            } else if (event.error === 'no-speech') {
                errorMsg = 'No speech detected';
            }

            this.showVoiceStatus('error', `❌ ${errorMsg}`);
            setTimeout(() => this.removeVoiceStatus(), 3000);
        };

        this.speechRecognition.onend = () => {
            if (this.isListening) {
                try {
                    this.speechRecognition.start();
                } catch (e) {
                    this.stopVoiceRecognition();
                }
            }
        };
    }

    toggleVoiceRecognition() {
        if (!this.speechRecognition) {
            this.showToast('Voice recognition not supported', 'error');
            return;
        }

        if (this.isListening) {
            // User manually stops - only send if there's text
            this.stopVoiceRecognition();
            if (this.userInput.value.trim()) {
                this.showVoiceStatus('ready', '✅ Sending...');
                setTimeout(() => {
                    this.sendMessage();
                    this.removeVoiceStatus();
                }, 500);
            } else {
                this.removeVoiceStatus();
            }
        } else {
            // Start listening
            this.userInput.value = '';
            this.startVoiceRecognition();
        }
    }

    resetSilenceTimer() {
        // Clear existing timer
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
        }

        // Set new timer
        this.silenceTimer = setTimeout(() => {
            if (this.isListening && this.userInput.value.trim()) {
                // Auto-send after silence
                this.stopVoiceRecognition();
                this.showVoiceStatus('ready', '✅ Auto-sending...');
                setTimeout(() => {
                    this.sendMessage();
                    this.removeVoiceStatus();
                }, 500);
            }
        }, this.silenceTimeout);
    }

    startVoiceRecognition() {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => {
                try {
                    this.speechRecognition.start();
                } catch (error) {
                    this.showToast('Failed to start voice input', 'error');
                }
            })
            .catch(error => {
                this.showToast('Please allow microphone access', 'error');
            });
    }

    stopVoiceRecognition() {
        if (this.speechRecognition && this.isListening) {
            // Clear silence timer
            if (this.silenceTimer) {
                clearTimeout(this.silenceTimer);
                this.silenceTimer = null;
            }

            try {
                this.speechRecognition.stop();
            } catch (error) {
                console.error('Error stopping recognition:', error);
            }
            this.isListening = false;
            this.updateMicButton(false);
            this.stopVoiceAnimation();
        }
    }

    updateMicButton(listening) {
        const micBtn = document.getElementById('mic-btn');
        const micIcon = micBtn.querySelector('i');

        if (listening) {
            micBtn.classList.add('listening');
            micIcon.className = 'fas fa-microphone-slash';
            micBtn.title = 'Click to stop listening';
        } else {
            micBtn.classList.remove('listening');
            micIcon.className = 'fa-solid fa-microphone';
            micBtn.title = 'Click to start voice input';
        }
    }

    // ============ VOICE ANIMATIONS WITH ANIME.JS ============

    showVoiceStatus(status = 'listening', text = '') {
        this.removeVoiceStatus();

        const template = document.getElementById('voice-status-template');
        const voiceStatus = template.content.cloneNode(true);

        const messageDiv = document.createElement('div');
        messageDiv.className = `message bot voice-status`;
        messageDiv.appendChild(voiceStatus);

        const voiceStatusMsg = messageDiv.querySelector('.voice-status-message');
        voiceStatusMsg.classList.add(status);

        const statusText = messageDiv.querySelector('#voice-status-text');
        if (statusText) {
            statusText.textContent = text;
        }

        this.chatContainer.appendChild(messageDiv);
        this.voiceStatusElement = messageDiv;
        this.scrollToBottom();
    }

    updateVoiceStatus(status = 'listening', text = '') {
        if (!this.voiceStatusElement) return;

        const voiceStatusMsg = this.voiceStatusElement.querySelector('.voice-status-message');
        voiceStatusMsg.className = 'voice-status-message ' + status;

        const statusText = this.voiceStatusElement.querySelector('#voice-status-text');
        if (statusText) {
            statusText.textContent = text;
        }
    }

    updateVoiceTranscript(text) {
        if (!this.voiceStatusElement) return;

        const transcriptEl = this.voiceStatusElement.querySelector('#voice-transcript');
        if (transcriptEl) {
            transcriptEl.textContent = text;
        }
    }

    removeVoiceStatus() {
        if (this.voiceStatusElement) {
            this.voiceStatusElement.remove();
            this.voiceStatusElement = null;
        }
        this.stopVoiceAnimation();
    }

    startVoiceAnimation() {
        if (!window.anime || !this.voiceStatusElement) return;

        const bars = this.voiceStatusElement.querySelectorAll('.voice-bar');

        // Stop existing animation
        if (this.voiceAnimation) {
            this.voiceAnimation.pause();
        }

        // Create smooth wave animation
        this.voiceAnimation = anime({
            targets: bars,
            height: [
                { value: '15px', duration: 300, easing: 'easeInOutSine' },
                { value: '30px', duration: 300, easing: 'easeInOutSine' },
                { value: '15px', duration: 300, easing: 'easeInOutSine' }
            ],
            opacity: [
                { value: 0.6, duration: 300 },
                { value: 1, duration: 300 },
                { value: 0.6, duration: 300 }
            ],
            delay: anime.stagger(80, { start: 100 }),
            loop: true,
            easing: 'easeInOutSine'
        });
    }

    stopVoiceAnimation() {
        if (this.voiceAnimation) {
            this.voiceAnimation.pause();
            this.voiceAnimation = null;
        }

        // Reset bars to default height
        if (this.voiceStatusElement) {
            const bars = this.voiceStatusElement.querySelectorAll('.voice-bar');
            bars.forEach(bar => {
                anime({
                    targets: bar,
                    height: '10px',
                    opacity: 0.5,
                    duration: 200,
                    easing: 'easeOutSine'
                });
            });
        }
    }

    // ============ CHAT MESSAGING ============

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        // Stop voice if active
        if (this.isListening) {
            // Clear silence timer
            if (this.silenceTimer) {
                clearTimeout(this.silenceTimer);
                this.silenceTimer = null;
            }
            this.stopVoiceRecognition();
            this.removeVoiceStatus();
        }

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

                if (data.showDatePicker && !this.hasDatesInMessage(message)) {
                    this.addMessage(data.reply, 'bot');
                    this.showInlineDatePicker();
                } else {
                    this.addMessage(data.reply, 'bot');
                    if (this.hasDatesInMessage(message) && this.currentDatePicker) {
                        this.currentDatePicker.remove();
                        this.currentDatePicker = null;
                    }
                }
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
        // Remove welcome message for user messages
        if (sender === 'user') {
            const welcomeMsg = this.chatContainer.querySelector('.welcome-message');
            if (welcomeMsg) {
                welcomeMsg.remove();
            }
        }

        // Skip if this is a voice status message
        if (text.includes('voice-status') || sender === 'voice-status') {
            return;
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

    // ============ DATE PICKER ============

    showInlineDatePicker() {
        if (this.currentDatePicker) {
            this.currentDatePicker.remove();
        }

        if (this.flatpickrInstance) {
            this.flatpickrInstance.destroy();
            this.flatpickrInstance = null;
        }

        const template = document.getElementById('date-picker-template');
        const datePicker = template.content.cloneNode(true);

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot';
        messageDiv.appendChild(datePicker);

        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
        this.currentDatePicker = messageDiv;

        this.setupDatePickerEvents(messageDiv);
    }

    setupDatePickerEvents(datePickerElement) {
        const dateRangeInput = datePickerElement.querySelector('.date-range-input');
        const roomBtns = datePickerElement.querySelectorAll('.room-type-btn');
        const checkAvailabilityBtn = datePickerElement.querySelector('.check-availability-btn');

        // Initialize flatpickr
        this.flatpickrInstance = flatpickr(dateRangeInput, {
            mode: "range",
            dateFormat: "Y-m-d",
            minDate: "today",
        });

        // Auto-select first room
        if (roomBtns.length > 0) {
            roomBtns[0].classList.add('active');
        }
        let selectedRoomType = 'executive-view';

        roomBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                roomBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedRoomType = btn.dataset.type;
            });
        });

        checkAvailabilityBtn.addEventListener('click', () => {
            const selectedDates = this.flatpickrInstance.selectedDates;
            const roomType = selectedRoomType;

            if (!selectedDates || selectedDates.length < 2) {
                this.showToast('Please select a date range', 'error');
                return;
            }

            const checkin = selectedDates[0].toISOString().split('T')[0];
            const checkout = selectedDates[1].toISOString().split('T')[0];
            const nights = Math.ceil((selectedDates[1] - selectedDates[0]) / (1000 * 60 * 60 * 24));

            const query = `Check ${this.formatRoomType(roomType)} availability from ${checkin} to ${checkout} for ${nights} nights`;

            if (this.currentDatePicker) {
                this.currentDatePicker.remove();
                this.currentDatePicker = null;
            }

            if (this.flatpickrInstance) {
                this.flatpickrInstance.destroy();
                this.flatpickrInstance = null;
            }

            this.userInput.value = query;
            this.sendMessage();
        });
    }

    formatRoomType(roomType) {
        const roomTypes = {
            'executive-view': 'Executive Suite View',
            'executive-non-view': 'Executive Suite Non-View',
            'family-view': 'Family Suite View',
            'family-non-view': 'Family Suite Non-View',
            'junior-view': 'Junior Suite View',
            'junior-non-view': 'Junior Suite Non-View'
        };
        return roomTypes[roomType] || roomType;
    }

    hasDatesInMessage(message) {
        const datePattern = /\d{4}-\d{2}-\d{2}/g;
        const dates = message.match(datePattern);
        const dateRangePattern = /\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/g;
        const dateRangeMatch = message.match(dateRangePattern);
        const fromToPattern = /from \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/gi;
        const fromToMatch = message.match(fromToPattern);

        return (dates && dates.length >= 2) || dateRangeMatch || fromToMatch;
    }

    // ============ UTILITY METHODS ============

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Space or Alt+V to toggle voice
            if ((e.ctrlKey && e.code === 'Space') || (e.altKey && e.code === 'KeyV')) {
                e.preventDefault();
                this.toggleVoiceRecognition();
            }

            // Escape to stop voice
            if (e.code === 'Escape' && this.isListening) {
                this.stopVoiceRecognition();
            }

            // Enter to send message
            if (e.code === 'Enter' && !e.shiftKey && this.userInput.value.trim()) {
                if (this.isListening) {
                    this.stopVoiceRecognition();
                }
                setTimeout(() => {
                    this.sendMessage();
                }, 100);
                e.preventDefault();
            }
        });
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
            if (this.flatpickrInstance) {
                this.flatpickrInstance.destroy();
                this.flatpickrInstance = null;
            }

            if (this.currentDatePicker) {
                this.currentDatePicker.remove();
                this.currentDatePicker = null;
            }

            if (this.isListening) {
                // Clear silence timer
                if (this.silenceTimer) {
                    clearTimeout(this.silenceTimer);
                    this.silenceTimer = null;
                }
                this.stopVoiceRecognition();
            }

            this.removeVoiceStatus();

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

    toggleQuickActions() {
        const quickActions = document.getElementById('quick-actions');
        quickActions.style.display =
            quickActions.style.display === 'none' ? 'grid' : 'none';
    }

    closeChat() {
        const container = document.getElementById('chat-container-main');
        const toggleBtn = document.getElementById('chat-toggle-btn');

        container.classList.remove('open');
        toggleBtn.innerHTML = '<i class="fa-brands fa-uncharted"></i>';
        this.showToast('Chat closed. Click the icon to open again.');
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
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            toast.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <span id="toast-message"></span>
            `;
            document.body.appendChild(toast);
        }

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

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HotelChatbot();
});