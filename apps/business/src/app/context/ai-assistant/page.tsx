'use client';

import { useState, useEffect } from 'react';
import { ChatInterface } from '@/components/ai-assistant/chat-interface';
import { ContextSidebar } from '@/components/ai-assistant/context-sidebar';
import { SuggestionsPanel } from '@/components/ai-assistant/suggestions-panel';
import { ValidationScore } from '@/components/ai-assistant/validation-score';
import { useConversationSync } from '@/hooks/useConversationSync';
import { useAutoSave } from '@/hooks/useAutoSave';
import { Button } from '@vocilia/ui';
import { MessageSquare, BarChart3, Lightbulb, PanelLeft, PanelRight } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    tokens?: number;
    model?: string;
  };
}

interface ContextEntry {
  id: string;
  category: string;
  type: string;
  content: string;
  confidence: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface AISuggestion {
  id: string;
  type: 'context_addition' | 'context_improvement' | 'question_suggestion' | 'process_optimization';
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  impact: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface ValidationResult {
  overallScore: number;
  categoryScores: Record<string, {
    score: number;
    maxScore: number;
    percentage: number;
  }>;
  missingFields: Array<{
    category: string;
    field: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  recommendations: string[];
  completionLevel: 'incomplete' | 'basic' | 'good' | 'excellent';
  lastUpdated: string;
}

export default function AIAssistantPage() {
  const [activeView, setActiveView] = useState<'chat' | 'validation' | 'suggestions'>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  
  // Mock store ID - in real app, get from context/params
  const storeId = 'store_123';
  
  // State for conversation
  const [conversationId, setConversationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // State for context
  const [contextEntries, setContextEntries] = useState<ContextEntry[]>([]);
  
  // State for suggestions
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  
  // State for validation
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    overallScore: 0,
    categoryScores: {},
    missingFields: [],
    recommendations: [],
    completionLevel: 'incomplete',
    lastUpdated: new Date().toISOString()
  });

  // Custom hooks for real-time sync and auto-save
  const { isConnected } = useConversationSync(conversationId, {
    onMessageUpdate: setMessages,
    onContextUpdate: setContextEntries,
    onValidationUpdate: setValidationResult
  });
  
  const { saveStatus } = useAutoSave({
    data: { contextEntries, validationResult },
    interval: 500,
    onSave: async (data) => {
      // Auto-save implementation
      console.log('Auto-saving data:', data);
    }
  });

  // Initialize conversation on mount
  useEffect(() => {
    initializeConversation();
    loadContextData();
    loadSuggestions();
  }, [storeId]);

  const initializeConversation = async () => {
    try {
      // Check for existing conversation
      const response = await fetch(`/api/ai-assistant/conversations?store_id=${storeId}`);
      const data = await response.json();
      
      if (data.conversations?.length > 0) {
        const latestConversation = data.conversations[0];
        setConversationId(latestConversation.id);
        
        // Load messages for this conversation
        const messagesResponse = await fetch(`/api/ai-assistant/conversations/${latestConversation.id}/messages`);
        const messagesData = await messagesResponse.json();
        setMessages(messagesData.messages || []);
      } else {
        // Create new conversation
        const createResponse = await fetch('/api/ai-assistant/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_id: storeId })
        });
        const newConversation = await createResponse.json();
        setConversationId(newConversation.conversation.id);
      }
    } catch (error) {
      console.error('Failed to initialize conversation:', error);
    }
  };

  const loadContextData = async () => {
    try {
      const [contextResponse, validationResponse] = await Promise.all([
        fetch(`/api/ai-assistant/context/entries?store_id=${storeId}`),
        fetch(`/api/ai-assistant/validation/score?store_id=${storeId}`)
      ]);

      const contextData = await contextResponse.json();
      const validationData = await validationResponse.json();

      setContextEntries(contextData.entries || []);
      if (validationData.validation) {
        setValidationResult({
          overallScore: validationData.validation.overall_score,
          categoryScores: validationData.validation.category_scores,
          missingFields: validationData.validation.missing_fields,
          recommendations: validationData.validation.recommendations,
          completionLevel: validationData.validation.completion_level,
          lastUpdated: validationData.validation.created_at
        });
      }
    } catch (error) {
      console.error('Failed to load context data:', error);
    }
  };

  const loadSuggestions = async () => {
    try {
      const response = await fetch(`/api/ai-assistant/suggestions?store_id=${storeId}&status=pending`);
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const handleSendMessage = async (message: string, stream = false) => {
    if (!conversationId) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/ai-assistant/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message, stream })
      });

      if (stream) {
        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) return;

        let assistantMessage = '';
        const userMessage: Message = {
          id: `msg_${Date.now()}_user`,
          role: 'user',
          content: message,
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);

        const tempAssistantMessage: Message = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, tempAssistantMessage]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                setIsLoading(false);
                loadContextData(); // Refresh context after message
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'chunk' && parsed.content) {
                  assistantMessage += parsed.content;
                  setMessages(prev => prev.map(msg => 
                    msg.id === tempAssistantMessage.id 
                      ? { ...msg, content: assistantMessage }
                      : msg
                  ));
                }
              } catch (e) {
                // Ignore parsing errors for chunks
              }
            }
          }
        }
      } else {
        // Handle regular response
        const data = await response.json();
        setMessages(prev => [...prev, data.userMessage, data.assistantMessage]);
        loadContextData(); // Refresh context after message
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    setIsGeneratingSuggestions(true);
    try {
      const response = await fetch('/api/ai-assistant/suggestions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId })
      });
      const data = await response.json();
      setSuggestions(prev => [...data.suggestions, ...prev]);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleAcceptSuggestion = async (suggestionId: string, notes?: string) => {
    try {
      await fetch(`/api/ai-assistant/suggestions/${suggestionId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ implementation_notes: notes })
      });
      setSuggestions(prev => prev.map(s => 
        s.id === suggestionId ? { ...s, status: 'accepted' as const } : s
      ));
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
    }
  };

  const handleRejectSuggestion = async (suggestionId: string, reason?: string) => {
    try {
      await fetch(`/api/ai-assistant/suggestions/${suggestionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: reason })
      });
      setSuggestions(prev => prev.map(s => 
        s.id === suggestionId ? { ...s, status: 'rejected' as const } : s
      ));
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
    }
  };

  const handleRecalculateScore = async () => {
    try {
      const response = await fetch(`/api/ai-assistant/validation/score?store_id=${storeId}&recalculate=true`);
      const data = await response.json();
      if (data.validation) {
        setValidationResult({
          overallScore: data.validation.overall_score,
          categoryScores: data.validation.category_scores,
          missingFields: data.validation.missing_fields,
          recommendations: data.validation.recommendations,
          completionLevel: data.validation.completion_level,
          lastUpdated: data.validation.created_at
        });
      }
    } catch (error) {
      console.error('Failed to recalculate score:', error);
    }
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Sidebar - Context */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'w-0' : 'w-80'} border-r border-gray-200`}>
        {!sidebarCollapsed && (
          <ContextSidebar
            entries={contextEntries}
            categoryScores={validationResult.categoryScores}
            overallScore={validationResult.overallScore}
            completionLevel={validationResult.completionLevel}
            className="h-full"
          />
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                <PanelLeft className="w-4 h-4" />
              </Button>
              
              <h1 className="text-xl font-semibold text-gray-900">AI Context Assistant</h1>
              
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                {saveStatus && (
                  <span className="text-blue-600">• {saveStatus}</span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant={activeView === 'chat' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('chat')}
                className="flex items-center space-x-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </Button>
              
              <Button
                variant={activeView === 'validation' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('validation')}
                className="flex items-center space-x-2"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Validation</span>
              </Button>
              
              <Button
                variant={activeView === 'suggestions' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('suggestions')}
                className="flex items-center space-x-2"
              >
                <Lightbulb className="w-4 h-4" />
                <span>Suggestions</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
              >
                <PanelRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex">
          <div className="flex-1 p-6">
            {activeView === 'chat' && (
              <ChatInterface
                conversationId={conversationId}
                messages={messages}
                isLoading={isLoading}
                onSendMessage={handleSendMessage}
                className="h-full"
              />
            )}

            {activeView === 'validation' && (
              <ValidationScore
                overallScore={validationResult.overallScore}
                categoryScores={validationResult.categoryScores}
                missingFields={validationResult.missingFields}
                recommendations={validationResult.recommendations}
                completionLevel={validationResult.completionLevel}
                lastUpdated={validationResult.lastUpdated}
                onRecalculate={handleRecalculateScore}
                className="h-full"
              />
            )}

            {activeView === 'suggestions' && (
              <SuggestionsPanel
                suggestions={suggestions}
                isGenerating={isGeneratingSuggestions}
                onAcceptSuggestion={handleAcceptSuggestion}
                onRejectSuggestion={handleRejectSuggestion}
                onGenerateMore={handleGenerateSuggestions}
                className="h-full"
              />
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Quick Actions / Validation Summary */}
      {!rightPanelCollapsed && (
        <div className="w-80 border-l border-gray-200 bg-white p-4">
          <ValidationScore
            overallScore={validationResult.overallScore}
            categoryScores={validationResult.categoryScores}
            missingFields={validationResult.missingFields}
            recommendations={validationResult.recommendations}
            completionLevel={validationResult.completionLevel}
            lastUpdated={validationResult.lastUpdated}
            onRecalculate={handleRecalculateScore}
            showDetails={false}
          />
        </div>
      )}
    </div>
  );
}