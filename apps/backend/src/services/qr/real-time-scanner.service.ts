import { WebSocket, WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types';
import { QRDatabaseUtils } from '../../config/qr-database';
import { config } from '../../config/config';
import { EventEmitter } from 'events';

/**
 * Real-time QR scan tracking service using WebSocket
 * Provides live updates for QR scan events and analytics
 */
export class RealTimeScannerService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private supabase = createClient<Database>(config.supabase.url, config.supabase.serviceKey);
  private activeConnections = new Map<string, WebSocket>();
  private storeSubscriptions = new Map<string, Set<string>>(); // storeId -> Set of connectionIds
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setupSupabaseRealtime();
  }

  /**
   * Initialize WebSocket server
   */
  public initializeWebSocketServer(port: number = 8081): void {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket, request) => {
      const connectionId = this.generateConnectionId();
      this.activeConnections.set(connectionId, ws);

      ws.on('message', (message: string) => {
        this.handleWebSocketMessage(connectionId, message);
      });

      ws.on('close', () => {
        this.handleWebSocketClose(connectionId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for connection ${connectionId}:`, error);
        this.handleWebSocketClose(connectionId);
      });

      // Send initial connection confirmation
      this.sendToConnection(connectionId, {
        type: 'connection_established',
        connectionId,
        timestamp: new Date().toISOString()
      });
    });

    // Setup heartbeat to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // 30 seconds

    console.log(`QR Scanner WebSocket server started on port ${port}`);
  }

  /**
   * Setup Supabase realtime subscriptions for QR scan events
   */
  private setupSupabaseRealtime(): void {
    // Subscribe to QR scan events
    this.supabase
      .channel('qr_scan_events')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'qr_scan_events' },
        (payload) => {
          this.handleNewScanEvent(payload.new as any);
        }
      )
      .subscribe();

    // Subscribe to QR analytics updates
    this.supabase
      .channel('qr_analytics_5min')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'qr_analytics_5min' },
        (payload) => {
          this.handleAnalyticsUpdate(payload.new as any);
        }
      )
      .subscribe();
  }

  /**
   * Handle WebSocket messages from clients
   */
  private handleWebSocketMessage(connectionId: string, message: string): void {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'subscribe_store':
          this.subscribeToStore(connectionId, data.storeId, data.businessId);
          break;
        case 'unsubscribe_store':
          this.unsubscribeFromStore(connectionId, data.storeId);
          break;
        case 'ping':
          this.sendToConnection(connectionId, { type: 'pong', timestamp: new Date().toISOString() });
          break;
        case 'request_analytics':
          this.sendStoreAnalytics(connectionId, data.storeId, data.businessId, data.timeframe);
          break;
        default:
          this.sendToConnection(connectionId, { 
            type: 'error', 
            message: 'Unknown message type',
            originalType: data.type 
          });
      }
    } catch (error) {
      this.sendToConnection(connectionId, { 
        type: 'error', 
        message: 'Invalid JSON message',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle WebSocket connection close
   */
  private handleWebSocketClose(connectionId: string): void {
    // Remove from active connections
    this.activeConnections.delete(connectionId);

    // Remove from all store subscriptions
    for (const [storeId, connections] of this.storeSubscriptions.entries()) {
      connections.delete(connectionId);
      if (connections.size === 0) {
        this.storeSubscriptions.delete(storeId);
      }
    }

    console.log(`WebSocket connection ${connectionId} closed`);
  }

  /**
   * Subscribe a connection to a specific store's scan events
   */
  private async subscribeToStore(connectionId: string, storeId: string, businessId: string): Promise<void> {
    try {
      // Verify store access
      const store = await QRDatabaseUtils.getStoreQR(storeId, businessId);
      if (!store) {
        this.sendToConnection(connectionId, {
          type: 'subscription_error',
          storeId,
          message: 'Store not found or access denied'
        });
        return;
      }

      // Add to store subscriptions
      if (!this.storeSubscriptions.has(storeId)) {
        this.storeSubscriptions.set(storeId, new Set());
      }
      this.storeSubscriptions.get(storeId)!.add(connectionId);

      // Confirm subscription
      this.sendToConnection(connectionId, {
        type: 'subscription_confirmed',
        storeId,
        storeName: store.name,
        timestamp: new Date().toISOString()
      });

      // Send recent scan activity
      await this.sendRecentScanActivity(connectionId, storeId);

    } catch (error) {
      this.sendToConnection(connectionId, {
        type: 'subscription_error',
        storeId,
        message: 'Failed to subscribe to store',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Unsubscribe a connection from a store
   */
  private unsubscribeFromStore(connectionId: string, storeId: string): void {
    const connections = this.storeSubscriptions.get(storeId);
    if (connections) {
      connections.delete(connectionId);
      if (connections.size === 0) {
        this.storeSubscriptions.delete(storeId);
      }
    }

    this.sendToConnection(connectionId, {
      type: 'unsubscription_confirmed',
      storeId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle new QR scan event from Supabase realtime
   */
  private handleNewScanEvent(scanEvent: any): void {
    const storeId = scanEvent.store_id;
    const connections = this.storeSubscriptions.get(storeId);

    if (connections && connections.size > 0) {
      const message = {
        type: 'scan_event',
        storeId,
        event: {
          id: scanEvent.id,
          qr_version: scanEvent.qr_version,
          scanned_at: scanEvent.scanned_at,
          scan_result: scanEvent.scan_result,
          user_agent: scanEvent.user_agent,
          geolocation: scanEvent.geolocation
        },
        timestamp: new Date().toISOString()
      };

      // Send to all subscribed connections
      for (const connectionId of connections) {
        this.sendToConnection(connectionId, message);
      }
    }

    // Emit event for other services
    this.emit('scan_event', scanEvent);
  }

  /**
   * Handle analytics update from Supabase realtime
   */
  private handleAnalyticsUpdate(analytics: any): void {
    const storeId = analytics.store_id;
    const connections = this.storeSubscriptions.get(storeId);

    if (connections && connections.size > 0) {
      const message = {
        type: 'analytics_update',
        storeId,
        analytics: {
          time_bucket: analytics.time_bucket,
          total_scans: analytics.total_scans,
          successful_scans: analytics.successful_scans,
          failed_scans: analytics.failed_scans,
          unique_visitors: analytics.unique_visitors
        },
        timestamp: new Date().toISOString()
      };

      // Send to all subscribed connections
      for (const connectionId of connections) {
        this.sendToConnection(connectionId, message);
      }
    }
  }

  /**
   * Send recent scan activity to a newly subscribed connection
   */
  private async sendRecentScanActivity(connectionId: string, storeId: string): Promise<void> {
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data: recentScans } = await this.supabase
        .from('qr_scan_events')
        .select('*')
        .eq('store_id', storeId)
        .gte('scanned_at', twentyFourHoursAgo.toISOString())
        .order('scanned_at', { ascending: false })
        .limit(50);

      if (recentScans && recentScans.length > 0) {
        this.sendToConnection(connectionId, {
          type: 'recent_activity',
          storeId,
          events: recentScans,
          count: recentScans.length,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to send recent scan activity:', error);
    }
  }

  /**
   * Send store analytics to a connection
   */
  private async sendStoreAnalytics(
    connectionId: string, 
    storeId: string, 
    businessId: string, 
    timeframe: '5min' | 'hourly' | 'daily' = '5min'
  ): Promise<void> {
    try {
      const endDate = new Date().toISOString();
      const startDate = new Date();
      
      // Set start date based on timeframe
      switch (timeframe) {
        case '5min':
          startDate.setHours(startDate.getHours() - 1); // Last hour
          break;
        case 'hourly':
          startDate.setDate(startDate.getDate() - 1); // Last 24 hours
          break;
        case 'daily':
          startDate.setDate(startDate.getDate() - 7); // Last 7 days
          break;
      }

      const analytics = await QRDatabaseUtils.getQRAnalytics(
        storeId,
        businessId,
        timeframe,
        startDate.toISOString(),
        endDate
      );

      this.sendToConnection(connectionId, {
        type: 'analytics_data',
        storeId,
        timeframe,
        data: analytics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.sendToConnection(connectionId, {
        type: 'analytics_error',
        storeId,
        message: 'Failed to fetch analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send message to a specific connection
   */
  private sendToConnection(connectionId: string, message: any): void {
    const ws = this.activeConnections.get(connectionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to connection ${connectionId}:`, error);
        this.handleWebSocketClose(connectionId);
      }
    }
  }

  /**
   * Send heartbeat to all connections
   */
  private sendHeartbeat(): void {
    const heartbeatMessage = {
      type: 'heartbeat',
      timestamp: new Date().toISOString()
    };

    for (const connectionId of this.activeConnections.keys()) {
      this.sendToConnection(connectionId, heartbeatMessage);
    }
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Record scan event and trigger real-time update
   */
  public async recordScanEvent(scanData: {
    store_id: string;
    qr_version: number;
    scanned_at: string;
    user_agent?: string;
    ip_address?: string;
    geolocation?: any;
    scan_result: 'success' | 'error' | 'invalid';
  }): Promise<any> {
    try {
      const result = await QRDatabaseUtils.recordScanEvent(scanData);
      
      // Real-time update will be handled by Supabase realtime subscription
      // But we can also emit a local event for immediate processing
      this.emit('scan_recorded', result);
      
      return result;
    } catch (error) {
      console.error('Failed to record scan event:', error);
      throw error;
    }
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): {
    totalConnections: number;
    storeSubscriptions: number;
    subscriptionDetails: Array<{ storeId: string; connectionCount: number }>;
  } {
    const subscriptionDetails = Array.from(this.storeSubscriptions.entries()).map(
      ([storeId, connections]) => ({
        storeId,
        connectionCount: connections.size
      })
    );

    return {
      totalConnections: this.activeConnections.size,
      storeSubscriptions: this.storeSubscriptions.size,
      subscriptionDetails
    };
  }

  /**
   * Broadcast message to all connections subscribed to a store
   */
  public broadcastToStore(storeId: string, message: any): void {
    const connections = this.storeSubscriptions.get(storeId);
    if (connections) {
      for (const connectionId of connections) {
        this.sendToConnection(connectionId, message);
      }
    }
  }

  /**
   * Shutdown the service
   */
  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all WebSocket connections
    for (const ws of this.activeConnections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    // Clear data structures
    this.activeConnections.clear();
    this.storeSubscriptions.clear();

    console.log('RealTimeScannerService shutdown complete');
  }
}

// Singleton instance
export const realTimeScannerService = new RealTimeScannerService();

export default realTimeScannerService;