class HotelChatbot {
    constructor() {
        this.chatContainer = document.getElementById('chat-container');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.datePickerShown = false;

        this.conversationHistory = [];
        this.apiUrl = '/api/chat';

        // Store the current date picker instance
        this.currentDatePicker = null;

        // Add flatpickr for date range
        this.flatpickrInstance = null;

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

        // close the chat
        document.getElementById('close-btn').addEventListener('click', () => {
            this.closeChat();
        });
    }

    closeChat() {
        const container = document.getElementById('chat-container-main');
        const toggleBtn = document.getElementById('chat-toggle-btn');

        // Hide the chat container
        container.classList.remove('open');

        // Reset the toggle button icon
        toggleBtn.innerHTML = '<i class="fa-brands fa-uncharted"></i>';

        // Optional: Show a toast notification
        this.showToast('Chat closed. Click the icon to open again.');
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

                // Check if we should show date picker
                if (data.showDatePicker && !this.hasDatesInMessage(message)) {
                    // Add bot's initial response
                    this.addMessage(data.reply, 'bot');
                    // Then add the date picker
                    this.showInlineDatePicker();
                } else {
                    // Normal response or user already provided dates
                    this.addMessage(data.reply, 'bot');

                    // Remove any existing date picker if dates were provided
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

    hasDatesInMessage(message) {
        // Check for YYYY-MM-DD format
        const datePattern = /\d{4}-\d{2}-\d{2}/g;
        const dates = message.match(datePattern);

        // Also check for date range input format (common in date pickers)
        const dateRangePattern = /\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/g;
        const dateRangeMatch = message.match(dateRangePattern);

        // Check for "from X to Y" pattern
        const fromToPattern = /from \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/gi;
        const fromToMatch = message.match(fromToPattern);

        return (dates && dates.length >= 2) || dateRangeMatch || fromToMatch;
    }

    shouldShowDatePicker(userMessage, botResponse) {
        const userTriggers = [
            'available', 'availability', 'book', 'booking', 'reserve', 'reservation',
            'room', 'price', 'cost', 'check', 'looking for'
        ];

        const botTriggers = [
            'dates', 'check-in', 'check-out', 'select dates', 'when would you like',
            'please provide', 'what dates', 'duration of stay'
        ];

        const userMsg = userMessage.toLowerCase();
        const botMsg = botResponse.toLowerCase();

        // Check if user mentioned booking/availability
        const hasUserTrigger = userTriggers.some(trigger => userMsg.includes(trigger));

        // Check if bot is asking for dates
        const hasBotTrigger = botTriggers.some(trigger => botMsg.includes(trigger));

        return hasUserTrigger || hasBotTrigger;
    }

    showInlineDatePicker() {
        // Remove any existing date picker
        if (this.currentDatePicker) {
            this.currentDatePicker.remove();
        }

        // Clean up previous flatpickr instance
        if (this.flatpickrInstance) {
            this.flatpickrInstance.destroy();
            this.flatpickrInstance = null;
        }

        // Get template
        const template = document.getElementById('date-picker-template');
        const datePicker = template.content.cloneNode(true);

        // Create message div for date picker
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot';
        messageDiv.appendChild(datePicker);

        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();

        // Store reference to current date picker
        this.currentDatePicker = messageDiv;

        // Setup event listeners for this date picker
        this.setupDatePickerEvents(messageDiv);
    }

    setupDatePickerEvents(datePickerElement) {
        const dateRangeInput = datePickerElement.querySelector('.date-range-input');
        const roomBtns = datePickerElement.querySelectorAll('.room-type-btn');
        const checkAvailabilityBtn = datePickerElement.querySelector('.check-availability-btn');

        // Initialize flatpickr for date range
        this.flatpickrInstance = flatpickr(dateRangeInput, {
            mode: "range",
            dateFormat: "Y-m-d",
            minDate: "today",
            onChange: function (selectedDates, dateStr, instance) {
                // This function can be used if you need to update something when dates change
                console.log('Selected dates:', selectedDates);
            }
        });

        // Auto-select first room
        if (roomBtns.length > 0) {
            roomBtns[0].classList.add('active');
        }
        let selectedRoomType = 'executive-view';

        // Room selection
        roomBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                roomBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedRoomType = btn.dataset.type;
            });
        });

        // Check availability button click handler
        checkAvailabilityBtn.addEventListener('click', () => {
            const selectedDates = this.flatpickrInstance.selectedDates;
            const roomType = selectedRoomType;

            if (!selectedDates || selectedDates.length < 2) {
                this.showToast('Please select a date range', 'error');
                return;
            }

            // Format dates
            const checkin = selectedDates[0].toISOString().split('T')[0];
            const checkout = selectedDates[1].toISOString().split('T')[0];

            // Calculate nights
            const nights = Math.ceil((selectedDates[1] - selectedDates[0]) / (1000 * 60 * 60 * 24));

            // Format room type text for display
            const roomTypeText = this.formatRoomType(roomType);

            // Format the query in a way that won't trigger date picker again
            const query = `Check ${roomTypeText} availability from ${checkin} to ${checkout} for ${nights} nights`;

            // Remove date picker BEFORE sending message
            if (this.currentDatePicker) {
                this.currentDatePicker.remove();
                this.currentDatePicker = null;
            }

            // Clean up flatpickr
            if (this.flatpickrInstance) {
                this.flatpickrInstance.destroy();
                this.flatpickrInstance = null;
            }

            // Send the query
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

    addMessage(text, sender) {
        // Only remove welcome message for user messages
        if (sender === 'user') {
            const welcomeMsg = this.chatContainer.querySelector('.welcome-message');
            if (welcomeMsg) {
                welcomeMsg.remove();
            }
        }

        // Skip if this is a date picker message
        if (text.includes('chat-date-picker') || sender === 'date-picker') {
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
            // Clean up flatpickr instance if exists
            if (this.flatpickrInstance) {
                this.flatpickrInstance.destroy();
                this.flatpickrInstance = null;
            }

            // Clear current date picker
            if (this.currentDatePicker) {
                this.currentDatePicker.remove();
                this.currentDatePicker = null;
            }

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
        // Create toast element if it doesn't exist
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

document.addEventListener('DOMContentLoaded', () => {
    new HotelChatbot();
});