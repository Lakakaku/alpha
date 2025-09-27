'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Progress } from '@vocilia/ui';
import { Clock, Phone, MessageSquare, DollarSign, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export interface CallSession {
  id: string;
  status: 'initiated' | 'connecting' | 'in_progress' | 'completed' | 'failed' | 'timeout';
  customerPhone: string;
  startedAt: string;
  duration?: number;
  actualCost?: number;
  estimatedCost: number;
  providerId?: string;
  questionsAnswered: number;
  totalQuestions: number;
  error?: string;
}

interface CallSessionCardProps {
  session: CallSession;
  onViewDetails?: (sessionId: string) => void;
  onRetryCall?: (sessionId: string) => void;
  className?: string;
}

export const CallSessionCard: React.FC<CallSessionCardProps> = ({
  session,
  onViewDetails,
  onRetryCall,
  className = ''
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'initiated':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'failed':
      case 'timeout':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'in_progress':
        return <Phone className="h-4 w-4 animate-pulse" />;
      case 'connecting':
        return <Phone className="h-4 w-4" />;
      case 'initiated':
        return <Clock className="h-4 w-4" />;
      case 'failed':
      case 'timeout':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatCost = (cost?: number) => {
    if (!cost) return 'N/A';
    return `$${cost.toFixed(3)}`;
  };

  const formatPhone = (phone: string) => {
    // Format Swedish phone number: +46761234567 -> +46 76 123 45 67
    if (phone.startsWith('+46')) {
      const number = phone.slice(3);
      return `+46 ${number.slice(0, 2)} ${number.slice(2, 5)} ${number.slice(5, 7)} ${number.slice(7)}`;
    }
    return phone;
  };

  const getProgressPercentage = () => {
    if (session.totalQuestions === 0) return 0;
    return (session.questionsAnswered / session.totalQuestions) * 100;
  };

  const isActive = ['initiated', 'connecting', 'in_progress'].includes(session.status);
  const isCompleted = session.status === 'completed';
  const isFailed = ['failed', 'timeout'].includes(session.status);

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge className={`px-2 py-1 text-xs font-medium border ${getStatusColor(session.status)}`}>
              <span className="flex items-center space-x-1">
                {getStatusIcon(session.status)}
                <span className="capitalize">{session.status.replace('_', ' ')}</span>
              </span>
            </Badge>
            {session.providerId && (
              <Badge variant="outline" className="text-xs">
                {session.providerId === 'fortyelks' ? '46elks' : 'Twilio'}
              </Badge>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {new Date(session.startedAt).toLocaleString('sv-SE')}
          </div>
        </div>
        <CardTitle className="text-lg font-semibold text-gray-900">
          {formatPhone(session.customerPhone)}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center space-x-1">
              <MessageSquare className="h-4 w-4 text-gray-600" />
              <span>Frågor besvarade</span>
            </span>
            <span className="font-medium">
              {session.questionsAnswered} / {session.totalQuestions}
            </span>
          </div>
          <Progress 
            value={getProgressPercentage()} 
            className="h-2"
          />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-gray-600" />
            <div>
              <div className="text-gray-600">Varaktighet</div>
              <div className="font-medium">{formatDuration(session.duration)}</div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-gray-600" />
            <div>
              <div className="text-gray-600">Kostnad</div>
              <div className="font-medium">
                {session.actualCost ? formatCost(session.actualCost) : formatCost(session.estimatedCost)}
                {!session.actualCost && <span className="text-xs text-gray-500"> (uppskattad)</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {isFailed && session.error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <div className="font-medium">Samtalet misslyckades</div>
                <div className="text-red-600">{session.error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(session.id)}
              className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
            >
              Visa detaljer
            </button>
          )}
          
          {isFailed && onRetryCall && (
            <button
              onClick={() => onRetryCall(session.id)}
              className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
            >
              Försök igen
            </button>
          )}
        </div>

        {/* Live Indicator */}
        {isActive && (
          <div className="flex items-center justify-center space-x-2 py-2 bg-blue-50 rounded-md">
            <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-blue-800">
              {session.status === 'initiated' && 'Initierar samtal...'}
              {session.status === 'connecting' && 'Kopplar upp...'}
              {session.status === 'in_progress' && 'Samtal pågår'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};