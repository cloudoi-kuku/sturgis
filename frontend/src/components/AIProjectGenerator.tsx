import { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { generateProject } from '../api/client';
import './AIProjectGenerator.css';

interface AIProjectGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectGenerated: () => void;
}

export function AIProjectGenerator({ isOpen, onClose, onProjectGenerated }: AIProjectGeneratorProps) {
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState('commercial');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Please provide a project description');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateProject(description, projectType);
      
      if (result.success) {
        // Success! Close modal and refresh data
        onProjectGenerated();
        onClose();
        
        // Reset form
        setDescription('');
        setProjectType('commercial');
        
        // Show success message
        alert(`✅ Successfully generated "${result.project_name}" with ${result.task_count} tasks!`);
      } else {
        setError('Failed to generate project. Please try again.');
      }
    } catch (err: any) {
      console.error('Project generation error:', err);
      setError(err.response?.data?.detail || 'Failed to generate project. Please check if Ollama is running.');
    } finally {
      setIsGenerating(false);
    }
  };

  const exampleDescriptions = {
    residential: "3-bedroom single family home, 2,500 sq ft, with attached 2-car garage, full basement, and covered patio",
    commercial: "5,000 sq ft office building renovation with new HVAC, electrical upgrades, and modern finishes",
    industrial: "20,000 sq ft warehouse with loading docks, office space, and climate-controlled storage area",
    renovation: "Kitchen and bathroom remodel in existing 1,800 sq ft home, including new cabinets, countertops, and fixtures"
  };

  const handleUseExample = () => {
    setDescription(exampleDescriptions[projectType as keyof typeof exampleDescriptions]);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ai-generator-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Sparkles size={24} className="sparkle-icon" />
            <h2>AI Project Generator</h2>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p className="generator-description">
            Describe your construction project and AI will generate a complete schedule with tasks, durations, and dependencies.
          </p>

          <div className="form-group">
            <label htmlFor="projectType">Project Type</label>
            <select
              id="projectType"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              disabled={isGenerating}
            >
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="industrial">Industrial</option>
              <option value="renovation">Renovation</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Project Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your project in detail... (e.g., size, features, special requirements)"
              rows={6}
              disabled={isGenerating}
            />
            <button 
              className="use-example-button" 
              onClick={handleUseExample}
              disabled={isGenerating}
            >
              Use Example
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="ai-info">
            <p>
              <strong>What AI will generate:</strong>
            </p>
            <ul>
              <li>30-50 construction tasks organized in phases</li>
              <li>Realistic durations based on industry standards</li>
              <li>Logical dependencies between tasks</li>
              <li>Key milestones (permits, inspections, completion)</li>
              <li>Proper task hierarchy and scheduling</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="button-secondary" onClick={onClose} disabled={isGenerating}>
            Cancel
          </button>
          <button 
            className="button-primary generate-button" 
            onClick={handleGenerate}
            disabled={isGenerating || !description.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="spinner" />
                Generating... (30-60 seconds)
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate Project
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

