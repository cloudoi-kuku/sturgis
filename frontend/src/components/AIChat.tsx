import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Trash2, Loader } from 'lucide-react';
import './AIChat.css';
import '../ui-overrides.css';
import { apiClient } from '../api/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  commandExecuted?: boolean;
  changes?: any[];
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string | null;  // The specific project this chat is for
}

export const AIChat: React.FC<AIChatProps> = ({ isOpen, onClose, projectId }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi! I'm your construction project AI assistant${projectId ? ' for this project' : ''}. I can help you:\n\n🏗️ **Generate entire projects from scratch:**\nJust describe what you want to build! For example:\n• 'Create a 3-bedroom residential home with 2-car garage and full basement'\n• 'Generate a 10,000 sq ft office building renovation with new HVAC'\n• 'Build a 20,000 sq ft warehouse with loading docks and office space'\n\nI'll create a complete project with 30-50 tasks, realistic durations, dependencies, and milestones!\n\n✨ **Modify existing projects:**\n• 'Change task 1.2 duration to 10 days'\n• 'Set lag for task 2.3 to 5 days'\n• 'Set project start date to 2024-01-15'\n• 'Add 10% buffer to all tasks'\n• 'Set task 1.4 constraint to Must Start On 2024-02-15'\n• 'Change task 2.1 to Start No Earlier Than 2024-03-01'\n\n📅 **Task Constraints (NEW!):**\nNow supporting full MS Project-compatible task constraints:\n• As Soon/Late As Possible (ASAP/ALAP)\n• Must Start/Finish On specific dates\n• Start/Finish No Earlier/Later Than dates\n• Helps enforce project milestones and external dependencies\n\n💡 **Answer questions:**\n• 'What's the critical path?'\n• 'How long will this project take?'\n• 'What tasks depend on task 1.5?'\n• 'Which tasks have constraints?'\n\nWhat would you like to do?`,
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
      const response = await apiClient.post('/ai/chat', {
        message: input,
        project_id: projectId  // Send the specific project ID
      });

      const data = response.data;

      // Check if the response is a project generation request
      let responseContent = data.response;
      let isProjectGeneration = false;

      try {
        const parsedResponse = JSON.parse(data.response);
        if (parsedResponse.type === 'project_generation') {
          isProjectGeneration = true;
          responseContent = parsedResponse.message;

          // Trigger project generation via the API
          const genResponse = await apiClient.post('/ai/generate-project', {
            description: input,
            project_type: 'commercial', // Will be detected by backend
            project_id: projectId  // Populate this specific project if it's empty
          });

          if (genResponse.status === 200) {
            const genData = genResponse.data;
            responseContent = `✅ Successfully generated project "${genData.project_name}" with ${genData.task_count} tasks!\n\n${parsedResponse.message}`;

            // Refresh the page to show the new project
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } else {
            responseContent = "I tried to generate the project but encountered an error. Please try again or provide more details.";
          }
        }
      } catch (e) {
        // Not JSON, treat as regular response
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        commandExecuted: data.command_executed || isProjectGeneration,
        changes: data.changes
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If a command was executed, trigger a page refresh to show updated data
      if (data.command_executed && data.changes && data.changes.length > 0) {
        // Dispatch custom event to notify parent component
        window.dispatchEvent(new CustomEvent('projectUpdated'));
      }
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
      await apiClient.post('/ai/chat/clear');
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
            <h3>SturgisAI Assistant</h3>
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
            <div key={idx} className={`ai-chat-message ${msg.role} ${msg.commandExecuted ? 'command-executed' : ''}`}>
              <div className="ai-chat-message-avatar">
                {msg.role === 'user' ? '👤' : msg.commandExecuted ? '⚡' : '🤖'}
              </div>
              <div className="ai-chat-message-content">
                <div className="ai-chat-message-text">{msg.content}</div>
                {msg.commandExecuted && msg.changes && msg.changes.length > 0 && (
                  <div className="ai-chat-command-badge">
                    ✨ Modified {msg.changes.length} item{msg.changes.length > 1 ? 's' : ''}
                  </div>
                )}
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

