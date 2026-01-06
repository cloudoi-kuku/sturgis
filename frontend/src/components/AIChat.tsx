import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Trash2, Loader, Upload, FileText, XCircle } from 'lucide-react';
import './AIChat.css';
import '../ui-overrides.css';
import { apiClient } from '../api/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  commandExecuted?: boolean;
  changes?: any[];
  xmlFileName?: string;
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
      content: `Hi! I'm your construction project AI assistant${projectId ? ' for this project' : ''}. I can help you:\n\n🏗️ **Generate projects:**\n• 'Create a 3-bedroom residential home with garage'\n• 'Generate a 10,000 sq ft office renovation'\n\n📄 **Import & Modify XML:**\n• Click the upload button to import an MS Project XML\n• Then ask me to modify it: 'Remove the project summary task' or 'Change all durations by 20%'\n\n✏️ **Edit project structure:**\n• 'Move task 1.2 after 1.3' or 'Move task 1.2 under 2'\n• 'Insert task \"Site Prep\" after 1.1'\n• 'Delete task 1.4'\n\n⏱️ **Modify durations & dates:**\n• 'Change task 1.2 duration to 10 days'\n• 'Set lag for task 2.3 to 5 days'\n• 'Set project start date to 2024-01-15'\n\n📋 **Get suggestions:**\n• 'Suggest improvements'\n• 'What tasks are out of sequence?'\n\nWhat would you like to do?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedXml, setUploadedXml] = useState<{ name: string; content: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      const errorMessage: Message = {
        role: 'assistant',
        content: "Please upload an MS Project XML file (.xml extension).",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    try {
      const content = await file.text();
      setUploadedXml({ name: file.name, content });

      const uploadMessage: Message = {
        role: 'user',
        content: `Uploaded XML file: ${file.name}`,
        timestamp: new Date(),
        xmlFileName: file.name
      };
      setMessages(prev => [...prev, uploadMessage]);

      const assistantMessage: Message = {
        role: 'assistant',
        content: `I've received the XML file "${file.name}". What would you like me to do with it?\n\nYou can ask me to:\n• **Create a project** from this XML\n• **Analyze** the schedule structure\n• **Modify** tasks, durations, or dependencies\n• **Remove the project summary** and renumber tasks\n• Any other modifications before importing`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error reading file:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: "Error reading the XML file. Please make sure it's a valid file.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearUploadedXml = () => {
    setUploadedXml(null);
    const message: Message = {
      role: 'assistant',
      content: "XML file cleared. You can upload a new file or continue chatting.",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

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
      // If we have an uploaded XML, send it along with the message
      const requestData: any = {
        message: input,
        project_id: projectId
      };

      if (uploadedXml) {
        requestData.xml_content = uploadedXml.content;
        requestData.xml_filename = uploadedXml.name;
      }

      const response = await apiClient.post('/ai/chat', requestData);

      const data = response.data;

      // Check if the response is a project generation request or XML import
      let responseContent = data.response;
      let isProjectGeneration = false;

      try {
        const parsedResponse = JSON.parse(data.response);

        // Handle XML import with project creation
        if (parsedResponse.type === 'xml_project_created') {
          isProjectGeneration = true;
          responseContent = parsedResponse.message;

          // Clear the uploaded XML since project was created
          setUploadedXml(null);

          // Refresh the page to show the new project
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
        // Handle regular project generation
        else if (parsedResponse.type === 'project_generation') {
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

        {/* Uploaded XML indicator */}
        {uploadedXml && (
          <div className="ai-chat-xml-indicator">
            <FileText size={16} />
            <span>{uploadedXml.name}</span>
            <button onClick={clearUploadedXml} title="Remove XML">
              <XCircle size={16} />
            </button>
          </div>
        )}

        <div className="ai-chat-input-container">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          {/* Upload button */}
          <button
            className="ai-chat-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Upload MS Project XML"
          >
            <Upload size={18} />
          </button>

          <textarea
            className="ai-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={uploadedXml ? "What would you like to do with this XML?" : "Ask about tasks, or upload an XML file..."}
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

