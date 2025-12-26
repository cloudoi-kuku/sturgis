import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Trash2, Loader } from 'lucide-react';
import './AIChat.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIChat: React.FC<AIChatProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your construction project AI assistant. I can help you with task duration estimates, sequencing, dependencies, and answer questions about your project. What would you like to know?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });

      if (!response.ok) throw new Error('Chat request failed');

      const data = await response.json();
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting. Please make sure the backend and Ollama are running.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await fetch('http://localhost:8000/api/ai/chat/clear', { method: 'POST' });
      setMessages([{
        role: 'assistant',
        content: "Chat history cleared. How can I help you?",
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Clear history error:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ai-chat-overlay">
      <div className="ai-chat-container">
        <div className="ai-chat-header">
          <div className="ai-chat-title">
            <span className="ai-chat-icon">🤖</span>
            <h3>AI Project Assistant</h3>
          </div>
          <div className="ai-chat-actions">
            <button
              className="ai-chat-clear-btn"
              onClick={clearHistory}
              title="Clear chat history"
            >
              <Trash2 size={18} />
            </button>
            <button className="ai-chat-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="ai-chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`ai-chat-message ${msg.role}`}>
              <div className="ai-chat-message-avatar">
                {msg.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="ai-chat-message-content">
                <div className="ai-chat-message-text">{msg.content}</div>
                <div className="ai-chat-message-time">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="ai-chat-message assistant">
              <div className="ai-chat-message-avatar">🤖</div>
              <div className="ai-chat-message-content">
                <div className="ai-chat-typing">
                  <Loader className="ai-chat-spinner" size={16} />
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="ai-chat-input-container">
          <textarea
            className="ai-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about task durations, dependencies, or project planning..."
            rows={2}
            disabled={isLoading}
          />
          <button
            className="ai-chat-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

