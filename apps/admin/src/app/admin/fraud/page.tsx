'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vocilia/ui';
import { 
  Shield, 
  TrendingUp, 
  AlertTriangle, 
  Eye,
  Hash,
  BarChart3
} from 'lucide-react';

// Import our fraud components
import FraudScoreMonitor from '@/components/fraud/FraudScoreMonitor';
import BehavioralPatternDashboard from '@/components/fraud/BehavioralPatternDashboard';
import KeywordManagement from '@/components/fraud/KeywordManagement';

const FraudManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Fraud Detection & Management</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and manage fraud detection across all customer feedback submissions
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center">
            <Shield className="w-4 h-4 mr-1" />
            Security Level: High
          </Badge>
          <Badge variant="secondary" className="flex items-center">
            <TrendingUp className="w-4 h-4 mr-1" />
            Active Monitoring
          </Badge>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="scores" className="flex items-center">
            <TrendingUp className="w-4 h-4 mr-2" />
            Fraud Scores
          </TabsTrigger>
          <TabsTrigger value="patterns" className="flex items-center">
            <Eye className="w-4 h-4 mr-2" />
            Behavioral Patterns
          </TabsTrigger>
          <TabsTrigger value="keywords" className="flex items-center">
            <Hash className="w-4 h-4 mr-2" />
            Keyword Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fraud Detection Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2.3%</div>
                <p className="text-xs text-muted-foreground">
                  +0.1% from last week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blocked Rewards</CardTitle>
                <Shield className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">847</div>
                <p className="text-xs text-muted-foreground">
                  This month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pattern Detections</CardTitle>
                <Eye className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">156</div>
                <p className="text-xs text-muted-foreground">
                  Active patterns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Keyword Matches</CardTitle>
                <Hash className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-muted-foreground">
                  Last 24 hours
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Fraud Detection Overview</CardTitle>
              <CardDescription>
                Real-time monitoring and analysis of fraudulent activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Context Analysis</h4>
                    <p className="text-sm text-muted-foreground">
                      AI-powered legitimacy assessment using store context and GPT-4o-mini analysis.
                    </p>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">40% Weight</Badge>
                      <Badge variant="outline">Real-time</Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Keyword Detection</h4>
                    <p className="text-sm text-muted-foreground">
                      Multi-language detection of profanity, threats, and impossible suggestions.
                    </p>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">20% Weight</Badge>
                      <Badge variant="outline">Pattern-based</Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Behavioral Analysis</h4>
                    <p className="text-sm text-muted-foreground">
                      Pattern recognition for call frequency, timing, and similarity violations.
                    </p>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">30% Weight</Badge>
                      <Badge variant="outline">ML-enhanced</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Fraud Alerts</CardTitle>
                <CardDescription>Latest fraud detection alerts requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">High-risk behavioral pattern detected</p>
                      <p className="text-xs text-muted-foreground">Phone hash: abc123... - 5 violations in 30 minutes</p>
                    </div>
                    <div className="flex-shrink-0 text-xs text-muted-foreground">2m ago</div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Context analysis flagged impossible suggestion</p>
                      <p className="text-xs text-muted-foreground">Store: Café Stockholm - Legitimacy score: 15/100</p>
                    </div>
                    <div className="flex-shrink-0 text-xs text-muted-foreground">5m ago</div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Keyword detection triggered</p>
                      <p className="text-xs text-muted-foreground">Category: Profanity - Severity: 7/10</p>
                    </div>
                    <div className="flex-shrink-0 text-xs text-muted-foreground">8m ago</div>
                  </div>
                </div>
                <div className="mt-4">
                  <Button variant="outline" size="sm" className="w-full">
                    View All Alerts
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Current status of fraud detection systems</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">GPT-4o-mini Context Analysis</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Operational
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Keyword Detection Engine</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Operational
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Behavioral Pattern Analysis</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Operational
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Real-time Scoring</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Operational
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Reward Blocking System</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Operational
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scores" className="space-y-6">
          <FraudScoreMonitor />
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6">
          <BehavioralPatternDashboard />
        </TabsContent>

        <TabsContent value="keywords" className="space-y-6">
          <KeywordManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FraudManagementPage;