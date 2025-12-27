// Simple test file to verify exports
import type { Task, TaskCreate, TaskUpdate, ProjectMetadata } from './api/client';

console.log('✅ All imports successful!');
console.log('Task type:', typeof ({} as Task));
console.log('TaskCreate type:', typeof ({} as TaskCreate));
console.log('TaskUpdate type:', typeof ({} as TaskUpdate));
console.log('ProjectMetadata type:', typeof ({} as ProjectMetadata));

