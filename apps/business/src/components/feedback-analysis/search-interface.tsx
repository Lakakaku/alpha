/**
 * Search Interface Component with Natural Language Support
 * Feature: 008-step-2-6
 * 
 * Provides comprehensive search functionality for feedback analysis including
 * natural language queries, smart filtering, department-specific searches,
 * and AI-powered search suggestions.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vocilia/ui/components/card';
import { Button } from '@vocilia/ui/components/button';
import { Input } from '@vocilia/ui/components/input';
import { Badge } from '@vocilia/ui/components/badge';
import { Checkbox } from '@vocilia/ui/components/checkbox';
import { 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  Sparkles, 
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '@vocilia/auth/context/AuthContext';
import type { SearchRequest, SearchResponse, FeedbackItem } from '@vocilia/types/feedback-analysis';

interface SearchInterfaceProps {
  storeId: string;
  onSearchResults: (results: SearchResponse) => void;
  initialResults?: SearchResponse | null;
  className?: string;
}

interface SearchSuggestion {
  text: string;
  type: 'recent' | 'popular' | 'ai';
}

interface SearchFilters {
  departments: string[];
  sentiment_filter: 'positive' | 'negative' | 'neutral' | 'mixed' | 'all';
  date_range?: {
    start_date: string;
    end_date: string;
  };
}

const DEPARTMENT_OPTIONS = [
  'kassa',
  'kött',
  'bageri',
  'kundservice',
  'parkering',
  'frukt',
  'mejeri',
  'deli',
  'butik',
  'toalett'
];

const SENTIMENT_OPTIONS = [
  { value: 'all', label: 'Alla sentiment', color: 'gray' },
  { value: 'positive', label: 'Positiv', color: 'green' },
  { value: 'negative', label: 'Negativ', color: 'red' },
  { value: 'neutral', label: 'Neutral', color: 'gray' },
  { value: 'mixed', label: 'Blandad', color: 'blue' },
] as const;

export function SearchInterface({ 
  storeId, 
  onSearchResults, 
  initialResults, 
  className = '' 
}: SearchInterfaceProps) {
  const { user } = useAuth();
  
  // State management
  const [queryText, setQueryText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(initialResults);
  const [showFilters, setShowFilters] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<SearchFilters>({
    departments: [],
    sentiment_filter: 'all',
  });

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsTimeoutRef = useRef<NodeJS.Timeout>();

  // Load search history on mount
  useEffect(() => {
    const loadSearchHistory = async () => {
      try {
        const response = await fetch(`/api/feedback-analysis/search/${storeId}/history`, {
          headers: {
            'Authorization': `Bearer ${user?.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const historyItems = data.history.map((item: any) => item.query_text);
          setSearchHistory(historyItems.slice(0, 5)); // Keep last 5 searches
        }
      } catch (err) {
        console.warn('Failed to load search history:', err);
      }
    };

    if (storeId && user?.access_token) {
      loadSearchHistory();
    }
  }, [storeId, user?.access_token]);

  // Handle query text changes with debounced suggestions
  useEffect(() => {
    if (suggestionsTimeoutRef.current) {
      clearTimeout(suggestionsTimeoutRef.current);
    }

    if (queryText.length >= 2) {
      suggestionsTimeoutRef.current = setTimeout(() => {
        loadSuggestions(queryText);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (suggestionsTimeoutRef.current) {
        clearTimeout(suggestionsTimeoutRef.current);
      }
    };
  }, [queryText]);

  // Load AI-powered suggestions
  const loadSuggestions = async (partialQuery: string) => {
    try {
      const response = await fetch(`/api/feedback-analysis/search/${storeId}/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`,
        },
        body: JSON.stringify({
          partial_query: partialQuery,
          limit: 5,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiSuggestions: SearchSuggestion[] = data.suggestions.map((text: string) => ({
          text,
          type: 'ai' as const,
        }));

        // Add recent searches that match
        const recentMatches: SearchSuggestion[] = searchHistory
          .filter(item => item.toLowerCase().includes(partialQuery.toLowerCase()))
          .slice(0, 3)
          .map(text => ({ text, type: 'recent' as const }));

        setSuggestions([...aiSuggestions, ...recentMatches]);
        setShowSuggestions(true);
      }
    } catch (err) {
      console.warn('Failed to load suggestions:', err);
    }
  };

  // Execute search
  const handleSearch = async (searchQuery?: string) => {
    const query = searchQuery || queryText.trim();
    if (!query) return;

    setIsSearching(true);
    setError(null);

    try {
      const searchRequest: SearchRequest = {
        query_text: query,
        limit: 50,
        ...filters,
      };

      const response = await fetch(`/api/feedback-analysis/search/${storeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`,
        },
        body: JSON.stringify(searchRequest),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Sökning misslyckades');
      }

      const results: SearchResponse = await response.json();
      setSearchResults(results);
      onSearchResults(results);

      // Update search history
      if (!searchHistory.includes(query)) {
        setSearchHistory(prev => [query, ...prev.slice(0, 4)]);
      }

      setShowSuggestions(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ett fel uppstod vid sökning';
      setError(errorMessage);
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    setQueryText(suggestion.text);
    setShowSuggestions(false);
    handleSearch(suggestion.text);
  };

  // Handle filter changes
  const handleDepartmentToggle = (department: string) => {
    setFilters(prev => ({
      ...prev,
      departments: prev.departments.includes(department)
        ? prev.departments.filter(d => d !== department)
        : [...prev.departments, department],
    }));
  };

  const handleSentimentChange = (sentiment: SearchFilters['sentiment_filter']) => {
    setFilters(prev => ({ ...prev, sentiment_filter: sentiment }));
  };

  const clearFilters = () => {
    setFilters({
      departments: [],
      sentiment_filter: 'all',
    });
  };

  const activeFilterCount = filters.departments.length + (filters.sentiment_filter !== 'all' ? 1 : 0);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Sök feedback
          </CardTitle>
          <CardDescription>
            Använd naturligt språk eller sök på specifika avdelningar och sentiment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Main Search Input */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  ref={searchInputRef}
                  placeholder="t.ex. 'kött avdelning problem', 'kassa långa köer', 'bra service'"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    } else if (e.key === 'Escape') {
                      setShowSuggestions(false);
                    }
                  }}
                  className="pl-10 pr-4"
                  disabled={isSearching}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>
              <Button 
                onClick={() => handleSearch()}
                disabled={isSearching || !queryText.trim()}
                className="px-6"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Sök'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filter
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeFilterCount}
                  </Badge>
                )}
                {showFilters ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Search Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      {suggestion.type === 'ai' && (
                        <Sparkles className="h-4 w-4 text-blue-500" />
                      )}
                      {suggestion.type === 'recent' && (
                        <Clock className="h-4 w-4 text-gray-400" />
                      )}
                      {suggestion.type === 'popular' && (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <span className="flex-1">{suggestion.text}</span>
                    <Badge variant="outline" className="text-xs">
                      {suggestion.type === 'ai' ? 'AI' : 
                       suggestion.type === 'recent' ? 'Senaste' : 'Populär'}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Search Buttons */}
          {searchHistory.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Senaste sökningar:</p>
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((query, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQueryText(query);
                      handleSearch(query);
                    }}
                    className="text-xs"
                  >
                    {query}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-red-700 text-sm">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="ml-auto"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Avancerade filter</CardTitle>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Rensa filter
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Department Filters */}
            <div>
              <h4 className="font-medium mb-3">Avdelningar</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {DEPARTMENT_OPTIONS.map((dept) => (
                  <div key={dept} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dept-${dept}`}
                      checked={filters.departments.includes(dept)}
                      onCheckedChange={() => handleDepartmentToggle(dept)}
                    />
                    <label
                      htmlFor={`dept-${dept}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                    >
                      {dept}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Sentiment Filter */}
            <div>
              <h4 className="font-medium mb-3">Sentiment</h4>
              <div className="flex flex-wrap gap-2">
                {SENTIMENT_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={filters.sentiment_filter === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSentimentChange(option.value)}
                    className="flex items-center gap-2"
                  >
                    <div className={`w-2 h-2 rounded-full bg-${option.color}-500`}></div>
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <h4 className="font-medium mb-3">Datumintervall</h4>
              <div className="flex gap-3 items-center">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <Input
                    type="date"
                    value={filters.date_range?.start_date || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      date_range: {
                        start_date: e.target.value,
                        end_date: prev.date_range?.end_date || '',
                      }
                    }))}
                    className="w-40"
                  />
                </div>
                <span className="text-gray-500">till</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={filters.date_range?.end_date || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      date_range: {
                        start_date: prev.date_range?.start_date || '',
                        end_date: e.target.value,
                      }
                    }))}
                    className="w-40"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {searchResults && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Sökresultat
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{searchResults.total_count} resultat</span>
                <span>{searchResults.execution_time_ms}ms</span>
                {searchResults.ai_processed && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI-bearbetad
                  </Badge>
                )}
              </div>
            </div>
            {searchResults.summary && (
              <CardDescription className="mt-2">
                <strong>AI-sammanfattning:</strong> {searchResults.summary}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {searchResults.feedback.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Inga resultat hittades för din sökning.</p>
                <p className="text-sm">Prova att använda andra söktermer eller justera filter.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {searchResults.feedback.map((item: FeedbackItem, index) => (
                  <div key={item.id || index} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {item.sentiment && (
                          <Badge 
                            variant="outline"
                            className={`
                              ${item.sentiment === 'positive' ? 'text-green-700 border-green-300' : ''}
                              ${item.sentiment === 'negative' ? 'text-red-700 border-red-300' : ''}
                              ${item.sentiment === 'neutral' ? 'text-gray-700 border-gray-300' : ''}
                              ${item.sentiment === 'mixed' ? 'text-blue-700 border-blue-300' : ''}
                            `}
                          >
                            {item.sentiment}
                          </Badge>
                        )}
                        {item.department_tags && item.department_tags.map((tag, tagIndex) => (
                          <Badge key={tagIndex} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleDateString('sv-SE')}
                      </span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{item.content}</p>
                    {item.ai_summary && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-800">
                        <strong>AI-sammanfattning:</strong> {item.ai_summary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}