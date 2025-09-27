'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  Shield, 
  Eye, 
  Ban, 
  CheckCircle,
  Clock,
  Search,
  Filter,
  Download,
  RefreshCw,
  Play,
  Pause,
  MoreHorizontal
} from 'lucide-react';

// Types for intrusion event data
interface IntrusionEvent {
  id: string;
  event_type: 'brute_force' | 'sql_injection' | 'unusual_access' | 'privilege_escalation' | 'data_exfiltration' | 'rate_limit_violation' | 'authentication_bypass';
  source_ip: string;
  target_resource: string | null;
  attack_pattern: string | null;
  severity_level: number;
  detection_method: string;
  automated_response: any;
  admin_notified: boolean;
  incident_status: 'detected' | 'investigating' | 'contained' | 'resolved' | 'false_positive';
  first_detected_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
}

interface IntrusionStats {
  total_events: number;
  active_incidents: number;
  resolved_incidents: number;
  false_positives: number;
  critical_severity_count: number;
  event_type_distribution: Record<string, number>;
  severity_distribution: Record<string, number>;
  recent_trends: {
    events_last_hour: number;
    trend_direction: 'up' | 'down' | 'stable';
    top_attack_type: string;
    blocked_ips_count: number;
  };
}

interface IntrusionFilters {
  eventType: string;
  severityLevel: string;
  incidentStatus: string;
  dateRange: string;
  search: string;
  sourceIp: string;
}

const IntrusionEventDashboard: React.FC = () => {
  const [events, setEvents] = useState<IntrusionEvent[]>([]);
  const [stats, setStats] = useState<IntrusionStats | null>(null);
  const [filters, setFilters] = useState<IntrusionFilters>({
    eventType: 'all',
    severityLevel: 'all',
    incidentStatus: 'all',
    dateRange: '24h',
    search: '',
    sourceIp: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<IntrusionEvent | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Fetch intrusion events and statistics
  const fetchIntrusionData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.eventType !== 'all') params.set('event_type', filters.eventType);
      if (filters.severityLevel !== 'all') params.set('severity_level', filters.severityLevel);
      if (filters.incidentStatus !== 'all') params.set('incident_status', filters.incidentStatus);
      if (filters.dateRange !== 'all') params.set('period', filters.dateRange);
      if (filters.search) params.set('search', filters.search);
      if (filters.sourceIp) params.set('source_ip', filters.sourceIp);

      // Fetch intrusion events
      const eventsResponse = await fetch(`/api/security/intrusion-events?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!eventsResponse.ok) {
        throw new Error(`Failed to fetch intrusion events: ${eventsResponse.status}`);
      }

      const eventsData = await eventsResponse.json();

      // Fetch intrusion statistics
      const statsResponse = await fetch(`/api/security/intrusion-events/stats?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch intrusion statistics: ${statsResponse.status}`);
      }

      const statsData = await statsResponse.json();

      setEvents(eventsData.data || []);
      setStats(statsData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch intrusion data');
      console.error('Error fetching intrusion data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntrusionData();
  }, [filters]);

  // Auto-refresh functionality
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchIntrusionData, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, filters]);

  // Get event type info
  const getEventTypeInfo = (type: string) => {
    switch (type) {
      case 'brute_force':
        return { label: 'Brute Force', icon: '🔨', color: 'destructive' };
      case 'sql_injection':
        return { label: 'SQL Injection', icon: '💉', color: 'destructive' };
      case 'unusual_access':
        return { label: 'Unusual Access', icon: '👁️', color: 'warning' };
      case 'privilege_escalation':
        return { label: 'Privilege Escalation', icon: '⬆️', color: 'destructive' };
      case 'data_exfiltration':
        return { label: 'Data Exfiltration', icon: '📤', color: 'destructive' };
      case 'rate_limit_violation':
        return { label: 'Rate Limit Violation', icon: '🚦', color: 'secondary' };
      case 'authentication_bypass':
        return { label: 'Auth Bypass', icon: '🔓', color: 'destructive' };
      default:
        return { label: 'Unknown', icon: '❓', color: 'outline' };
    }
  };

  // Get severity info
  const getSeverityInfo = (level: number) => {
    if (level >= 8) return { label: 'Critical', color: 'destructive', textColor: 'text-red-600' };
    if (level >= 6) return { label: 'High', color: 'destructive', textColor: 'text-orange-600' };
    if (level >= 4) return { label: 'Medium', color: 'secondary', textColor: 'text-yellow-600' };
    return { label: 'Low', color: 'outline', textColor: 'text-blue-600' };
  };

  // Get status info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'detected':
        return { label: 'Detected', icon: <Eye className="w-4 h-4" />, color: 'secondary' };
      case 'investigating':
        return { label: 'Investigating', icon: <Search className="w-4 h-4" />, color: 'default' };
      case 'contained':
        return { label: 'Contained', icon: <Ban className="w-4 h-4" />, color: 'default' };
      case 'resolved':
        return { label: 'Resolved', icon: <CheckCircle className="w-4 h-4" />, color: 'default' };
      case 'false_positive':
        return { label: 'False Positive', icon: <CheckCircle className="w-4 h-4" />, color: 'outline' };
      default:
        return { label: 'Unknown', icon: <MoreHorizontal className="w-4 h-4" />, color: 'outline' };
    }
  };

  // Update incident status
  const updateIncidentStatus = async (eventId: string, newStatus: string, notes?: string) => {
    try {
      const response = await fetch(`/api/security/intrusion-events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          incident_status: newStatus,
          resolution_notes: notes || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update incident: ${response.status}`);
      }

      await fetchIntrusionData();
      setSelectedEvent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update incident');
    }
  };

  // Export intrusion events data
  const exportData = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      const params = new URLSearchParams(filters as any);
      params.set('export_format', format);
      
      const response = await fetch(`/api/security/intrusion-events/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `intrusion-events-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading intrusion events...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button variant="outline" size="sm" className="ml-2" onClick={fetchIntrusionData}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Intrusion Event Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor and respond to security threats and intrusion attempts
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {autoRefresh ? 'Stop Auto' : 'Auto Refresh'}
          </Button>
          <Button variant="outline" onClick={fetchIntrusionData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Select onValueChange={(value) => exportData(value as any)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_events.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Last hour: {stats.recent_trends.events_last_hour}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.active_incidents}</div>
              <p className="text-xs text-muted-foreground">
                Critical: {stats.critical_severity_count}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.resolved_incidents}</div>
              <p className="text-xs text-muted-foreground">
                False positives: {stats.false_positives}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocked IPs</CardTitle>
              <Ban className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.recent_trends.blocked_ips_count}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.recent_trends.trend_direction === 'up' ? '↗' : 
                 stats.recent_trends.trend_direction === 'down' ? '↘' : '→'} 
                {' '}Trend
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attack Type Distribution */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Attack Type Distribution</CardTitle>
            <CardDescription>Breakdown of intrusion events by attack type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats.event_type_distribution).map(([type, count]) => {
                const typeInfo = getEventTypeInfo(type);
                return (
                  <div key={type} className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <span className="text-lg mr-2">{typeInfo.icon}</span>
                      <span className="font-medium">{typeInfo.label}</span>
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-muted-foreground">
                      {((count / stats.total_events) * 100).toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium">Event Type</label>
              <Select 
                value={filters.eventType} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, eventType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="brute_force">Brute Force</SelectItem>
                  <SelectItem value="sql_injection">SQL Injection</SelectItem>
                  <SelectItem value="unusual_access">Unusual Access</SelectItem>
                  <SelectItem value="privilege_escalation">Privilege Escalation</SelectItem>
                  <SelectItem value="data_exfiltration">Data Exfiltration</SelectItem>
                  <SelectItem value="rate_limit_violation">Rate Limit Violation</SelectItem>
                  <SelectItem value="authentication_bypass">Authentication Bypass</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Severity Level</label>
              <Select 
                value={filters.severityLevel} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, severityLevel: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="critical">Critical (8-10)</SelectItem>
                  <SelectItem value="high">High (6-7)</SelectItem>
                  <SelectItem value="medium">Medium (4-5)</SelectItem>
                  <SelectItem value="low">Low (1-3)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Incident Status</label>
              <Select 
                value={filters.incidentStatus} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, incidentStatus: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="detected">Detected</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="contained">Contained</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="false_positive">False Positive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Date Range</label>
              <Select 
                value={filters.dateRange} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last hour</SelectItem>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Search Pattern</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search attack patterns..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Source IP</label>
              <Input
                placeholder="Filter by IP address..."
                value={filters.sourceIp}
                onChange={(e) => setFilters(prev => ({ ...prev, sourceIp: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intrusion Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Intrusion Events</CardTitle>
          <CardDescription>
            Real-time monitoring of security threats and intrusion attempts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No intrusion events found with current filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const eventInfo = getEventTypeInfo(event.event_type);
                const severityInfo = getSeverityInfo(event.severity_level);
                const statusInfo = getStatusInfo(event.incident_status);
                return (
                  <div
                    key={event.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-2">
                        <Badge variant={eventInfo.color as any}>
                          {eventInfo.icon} {eventInfo.label}
                        </Badge>
                        <Badge variant={severityInfo.color as any}>
                          Severity {event.severity_level}
                        </Badge>
                        <Badge variant={statusInfo.color as any} className="flex items-center">
                          {statusInfo.icon}
                          <span className="ml-1">{statusInfo.label}</span>
                        </Badge>
                        {event.admin_notified && (
                          <Badge variant="outline">Admin Notified</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(event.first_detected_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                      <div>
                        <div className="text-sm text-muted-foreground">Source IP</div>
                        <div className="font-medium">{event.source_ip}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Target Resource</div>
                        <div className="font-medium">{event.target_resource || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Detection Method</div>
                        <div className="font-medium">{event.detection_method}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Duration</div>
                        <div className="font-medium">
                          {event.resolved_at ? 
                            `${Math.round((new Date(event.resolved_at).getTime() - new Date(event.first_detected_at).getTime()) / 60000)}m` : 
                            'Ongoing'
                          }
                        </div>
                      </div>
                    </div>

                    {event.attack_pattern && (
                      <div className="mt-2">
                        <div className="text-sm text-muted-foreground">Attack Pattern:</div>
                        <div className="text-sm bg-muted p-2 rounded font-mono">
                          {event.attack_pattern}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Details Modal/Panel */}
      {selectedEvent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Intrusion Event Details
              <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="response">Automated Response</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Event Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Event Type</span>
                        <Badge variant={getEventTypeInfo(selectedEvent.event_type).color as any}>
                          {getEventTypeInfo(selectedEvent.event_type).label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Severity Level</span>
                        <span className={`font-medium ${getSeverityInfo(selectedEvent.severity_level).textColor}`}>
                          {selectedEvent.severity_level}/10
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status</span>
                        <Badge variant={getStatusInfo(selectedEvent.incident_status).color as any}>
                          {getStatusInfo(selectedEvent.incident_status).label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Admin Notified</span>
                        <span className="font-medium">
                          {selectedEvent.admin_notified ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Technical Details</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Source IP</span>
                        <span className="font-medium">{selectedEvent.source_ip}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Target Resource</span>
                        <span className="font-medium">{selectedEvent.target_resource || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Detection Method</span>
                        <span className="font-medium">{selectedEvent.detection_method}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>First Detected</span>
                        <span className="font-medium text-xs">
                          {new Date(selectedEvent.first_detected_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedEvent.attack_pattern && (
                  <div>
                    <h4 className="font-semibold mb-2">Attack Pattern</h4>
                    <div className="bg-muted p-4 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {selectedEvent.attack_pattern}
                      </pre>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="response" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Automated Response</h4>
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap">
                      {selectedEvent.automated_response ? 
                        JSON.stringify(selectedEvent.automated_response, null, 2) : 
                        'No automated response recorded'
                      }
                    </pre>
                  </div>
                </div>

                {selectedEvent.resolution_notes && (
                  <div>
                    <h4 className="font-semibold mb-2">Resolution Notes</h4>
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-sm">{selectedEvent.resolution_notes}</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="actions" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-4">Update Incident Status</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => updateIncidentStatus(selectedEvent.id, 'investigating')}
                      disabled={selectedEvent.incident_status === 'investigating'}
                    >
                      Mark Investigating
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => updateIncidentStatus(selectedEvent.id, 'contained')}
                      disabled={selectedEvent.incident_status === 'contained'}
                    >
                      Mark Contained
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => updateIncidentStatus(selectedEvent.id, 'resolved', 'Incident resolved by admin')}
                      disabled={selectedEvent.incident_status === 'resolved'}
                    >
                      Mark Resolved
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => updateIncidentStatus(selectedEvent.id, 'false_positive', 'Determined to be false positive')}
                      disabled={selectedEvent.incident_status === 'false_positive'}
                    >
                      False Positive
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IntrusionEventDashboard;