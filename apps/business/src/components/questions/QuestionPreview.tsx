'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vocilia/ui/components/card';
import { Button } from '@vocilia/ui/components/button';
import { Input } from '@vocilia/ui/components/input';
import { Textarea } from '@vocilia/ui/components/textarea';
import { Badge } from '@vocilia/ui/components/badge';
import { Alert, AlertDescription } from '@vocilia/ui/components/alert';
import { Label } from '@vocilia/ui/components/label';
import { CustomQuestion, QuestionCategory } from '@vocilia/types';
import { StarIcon, CheckIcon, XIcon, PhoneIcon, ClockIcon, TagIcon } from 'lucide-react';

export interface QuestionPreviewProps {
  question: Partial<CustomQuestion>;
  category?: QuestionCategory;
  format?: 'interactive' | 'static' | 'phone';
  showMetadata?: boolean;
  onResponse?: (response: any) => void;
  className?: string;
}

interface PreviewResponse {
  text?: string;
  rating?: number;
  choice?: string;
  yesNo?: boolean;
}

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const getPriorityColor = (priority: number): string => {
  if (priority >= 8) return 'bg-red-100 text-red-800 border-red-200';
  if (priority >= 6) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (priority >= 4) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-green-100 text-green-800 border-green-200';
};

const getPriorityLabel = (priority: number): string => {
  if (priority >= 8) return 'High';
  if (priority >= 6) return 'Medium';
  if (priority >= 4) return 'Normal';
  return 'Low';
};

export function QuestionPreview({
  question,
  category,
  format = 'interactive',
  showMetadata = false,
  onResponse,
  className = '',
}: QuestionPreviewProps) {
  const [response, setResponse] = useState<PreviewResponse>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Reset response when question changes
  useEffect(() => {
    setResponse({});
    setSubmitted(false);
  }, [question.id, question.content]);

  const handleSubmit = async () => {
    if (!onResponse) return;

    setIsSubmitting(true);
    try {
      await onResponse(response);
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting response:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isResponseValid = (): boolean => {
    switch (question.type) {
      case 'text':
        return !!response.text?.trim();
      case 'rating':
        return typeof response.rating === 'number' && response.rating >= 1;
      case 'multiple_choice':
        return !!response.choice;
      case 'yes_no':
        return typeof response.yesNo === 'boolean';
      default:
        return false;
    }
  };

  const renderQuestionInput = () => {
    if (submitted) {
      return (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckIcon className="w-5 h-5 text-green-600" />
          <span className="text-green-700 font-medium">Response submitted successfully!</span>
        </div>
      );
    }

    switch (question.type) {
      case 'text':
        return (
          <div className="space-y-2">
            <Label htmlFor="preview-text">Your response:</Label>
            <Textarea
              id="preview-text"
              value={response.text || ''}
              onChange={(e) => setResponse(prev => ({ ...prev, text: e.target.value }))}
              placeholder="Type your response here..."
              maxLength={question.maxLength}
              rows={3}
              disabled={format === 'static'}
            />
            {question.maxLength && (
              <p className="text-sm text-gray-500">
                {(response.text || '').length} / {question.maxLength} characters
              </p>
            )}
          </div>
        );

      case 'rating':
        const scale = question.ratingScale || 5;
        return (
          <div className="space-y-3">
            <Label>Rate from 1 to {scale}:</Label>
            <div className="flex items-center gap-2">
              {Array.from({ length: scale }, (_, i) => i + 1).map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => format !== 'static' && setResponse(prev => ({ ...prev, rating }))}
                  disabled={format === 'static'}
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-colors
                    ${response.rating === rating
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                    }
                    ${format === 'static' ? 'cursor-default' : 'cursor-pointer'}
                  `}
                >
                  {format === 'phone' ? (
                    <span className="text-sm font-medium">{rating}</span>
                  ) : (
                    <StarIcon 
                      className={`w-5 h-5 ${response.rating === rating ? 'fill-current' : ''}`} 
                    />
                  )}
                </button>
              ))}
            </div>
            {response.rating && (
              <p className="text-sm text-gray-600">
                You selected: {response.rating} out of {scale}
              </p>
            )}
          </div>
        );

      case 'multiple_choice':
        return (
          <div className="space-y-3">
            <Label>Select an option:</Label>
            <div className="space-y-2">
              {question.options?.map((option, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => format !== 'static' && setResponse(prev => ({ ...prev, choice: option }))}
                  disabled={format === 'static'}
                  className={`
                    w-full p-3 text-left rounded-lg border-2 transition-colors
                    ${response.choice === option
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                    }
                    ${format === 'static' ? 'cursor-default' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className={`
                        w-4 h-4 rounded-full border-2
                        ${response.choice === option
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                        }
                      `}
                    >
                      {response.choice === option && (
                        <div className="w-full h-full rounded-full bg-white scale-50" />
                      )}
                    </div>
                    <span>{option}</span>
                  </div>
                </button>
              )) || <p className="text-gray-500">No options configured</p>}
            </div>
          </div>
        );

      case 'yes_no':
        return (
          <div className="space-y-3">
            <Label>Please choose:</Label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => format !== 'static' && setResponse(prev => ({ ...prev, yesNo: true }))}
                disabled={format === 'static'}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-lg border-2 transition-colors
                  ${response.yesNo === true
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-300 hover:border-green-300 hover:bg-green-50'
                  }
                  ${format === 'static' ? 'cursor-default' : 'cursor-pointer'}
                `}
              >
                <CheckIcon className="w-5 h-5" />
                Yes
              </button>
              <button
                type="button"
                onClick={() => format !== 'static' && setResponse(prev => ({ ...prev, yesNo: false }))}
                disabled={format === 'static'}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-lg border-2 transition-colors
                  ${response.yesNo === false
                    ? 'border-red-500 bg-red-500 text-white'
                    : 'border-gray-300 hover:border-red-300 hover:bg-red-50'
                  }
                  ${format === 'static' ? 'cursor-default' : 'cursor-pointer'}
                `}
              >
                <XIcon className="w-5 h-5" />
                No
              </button>
            </div>
          </div>
        );

      default:
        return (
          <Alert>
            <AlertDescription>
              Question type "{question.type}" not supported in preview
            </AlertDescription>
          </Alert>
        );
    }
  };

  const renderPhoneFormat = () => {
    return (
      <Card className={`border-2 border-blue-200 bg-blue-50 ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-blue-700">
            <PhoneIcon className="w-5 h-5" />
            <CardTitle className="text-lg">Voice Call Preview</CardTitle>
          </div>
          <CardDescription className="text-blue-600">
            How this question would sound during a phone call
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-white rounded-lg border">
            <p className="text-gray-700 italic">
              "Hello! Thank you for visiting our store. {question.content}"
            </p>
          </div>

          {question.type === 'rating' && (
            <div className="p-3 bg-blue-100 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Voice prompt:</strong> "Please say a number from 1 to {question.ratingScale || 5}"
              </p>
            </div>
          )}

          {question.type === 'multiple_choice' && question.options && (
            <div className="p-3 bg-blue-100 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Voice prompt:</strong> "Please say one of the following options: {question.options.join(', ')}"
              </p>
            </div>
          )}

          {question.type === 'yes_no' && (
            <div className="p-3 bg-blue-100 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Voice prompt:</strong> "Please say yes or no"
              </p>
            </div>
          )}

          {question.type === 'text' && (
            <div className="p-3 bg-blue-100 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Voice prompt:</strong> "Please share your thoughts. Take your time."
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (format === 'phone') {
    return renderPhoneFormat();
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">{question.title || 'Untitled Question'}</CardTitle>
            {category && (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-sm text-gray-600">{category.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {question.priority && (
              <Badge className={getPriorityColor(question.priority)}>
                Priority: {getPriorityLabel(question.priority)}
              </Badge>
            )}
            {question.isRequired && (
              <Badge variant="destructive">Required</Badge>
            )}
          </div>
        </div>
        
        {showMetadata && (
          <div className="pt-3 space-y-2">
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <ClockIcon className="w-4 h-4" />
                <span>
                  {question.frequency?.maxPresentations || 1}x per {question.frequency?.window || 'day'}
                </span>
              </div>
              
              {question.frequency?.cooldownMinutes && (
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  <span>Cooldown: {formatDuration(question.frequency.cooldownMinutes)}</span>
                </div>
              )}

              {question.validFrom && (
                <div>
                  <span>From: {new Date(question.validFrom).toLocaleDateString()}</span>
                </div>
              )}

              {question.validUntil && (
                <div>
                  <span>Until: {new Date(question.validUntil).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {question.tags && question.tags.length > 0 && (
              <div className="flex items-center gap-2">
                <TagIcon className="w-4 h-4 text-gray-400" />
                <div className="flex flex-wrap gap-1">
                  {question.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {question.triggers && question.triggers.length > 0 && (
              <div className="text-sm">
                <span className="text-gray-600">Triggers: </span>
                <span className="text-gray-800">
                  {question.triggers.length} configured
                </span>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-base font-medium">Question:</Label>
          <p className="text-gray-700 leading-relaxed">
            {question.content || 'No question content provided'}
          </p>
        </div>

        {format !== 'static' && question.content && (
          <div className="space-y-4">
            {renderQuestionInput()}

            {format === 'interactive' && onResponse && !submitted && (
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={handleSubmit}
                  disabled={!isResponseValid() || isSubmitting}
                  className="min-w-24"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Response'}
                </Button>
              </div>
            )}
          </div>
        )}

        {format === 'static' && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 text-center">
              This is a static preview. Customer interaction is not available.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}