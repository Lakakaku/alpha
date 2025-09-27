import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';
import { 
  CommunicationPreference, 
  RecipientType,
  CommunicationChannel,
  NotificationType
} from '@vocilia/types/communication';

export class CommunicationPreferenceModel {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabaseClient: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabaseClient;
  }

  /**
   * Create communication preferences for a user
   */
  async create(preference: Omit<CommunicationPreference, 'id' | 'created_at' | 'updated_at'>): Promise<CommunicationPreference> {
    const { data, error } = await this.supabase
      .from('communication_preferences')
      .insert(preference)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create communication preference: ${error.message}`);
    }

    return data;
  }

  /**
   * Get preferences for a user
   */
  async findByUser(userId: string, userType: RecipientType): Promise<CommunicationPreference | null> {
    const { data, error } = await this.supabase
      .from('communication_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('user_type', userType)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error
      throw new Error(`Failed to fetch communication preferences: ${error.message}`);
    }

    return data || null;
  }

  /**
   * Get or create default preferences for a user
   */
  async getOrCreateDefault(userId: string, userType: RecipientType): Promise<CommunicationPreference> {
    let preferences = await this.findByUser(userId, userType);
    
    if (!preferences) {
      // Create default preferences
      const defaultPreferences = {
        user_id: userId,
        user_type: userType,
        language: 'sv',
        timezone: 'Europe/Stockholm',
        notifications_enabled: true,
        channels_enabled: {
          sms: true,
          email: true,
          push: false
        },
        notification_types: {
          reward_earned: true,
          payment_confirmation: true,
          verification_request: true,
          verification_reminder: true,
          payment_overdue_reminder: true,
          support_ticket_created: true,
          support_ticket_response: true,
          weekly_summary: true
        },
        quiet_hours: {
          enabled: true,
          start_time: '22:00',
          end_time: '08:00'
        },
        frequency_settings: {
          weekly_summary: 'weekly',
          payment_reminders: 'standard',
          verification_reminders: 'standard'
        }
      };

      preferences = await this.create(defaultPreferences);
    }

    return preferences;
  }

  /**
   * Update communication preferences
   */
  async update(
    userId: string, 
    userType: RecipientType,
    updates: Partial<Omit<CommunicationPreference, 'id' | 'user_id' | 'user_type' | 'created_at' | 'updated_at'>>
  ): Promise<CommunicationPreference> {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('communication_preferences')
      .update(updateData)
      .eq('user_id', userId)
      .eq('user_type', userType)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update communication preferences: ${error.message}`);
    }

    return data;
  }

  /**
   * Update specific notification type preference
   */
  async updateNotificationType(
    userId: string,
    userType: RecipientType,
    notificationType: NotificationType,
    enabled: boolean
  ): Promise<CommunicationPreference> {
    const preferences = await this.getOrCreateDefault(userId, userType);
    
    const updatedNotificationTypes = {
      ...preferences.notification_types,
      [notificationType]: enabled
    };

    return await this.update(userId, userType, {
      notification_types: updatedNotificationTypes
    });
  }

  /**
   * Update channel preference
   */
  async updateChannel(
    userId: string,
    userType: RecipientType,
    channel: CommunicationChannel,
    enabled: boolean
  ): Promise<CommunicationPreference> {
    const preferences = await this.getOrCreateDefault(userId, userType);
    
    const updatedChannels = {
      ...preferences.channels_enabled,
      [channel]: enabled
    };

    return await this.update(userId, userType, {
      channels_enabled: updatedChannels
    });
  }

  /**
   * Check if user can receive notification
   */
  async canReceiveNotification(
    userId: string,
    userType: RecipientType,
    notificationType: NotificationType,
    channel: CommunicationChannel,
    scheduledTime?: Date
  ): Promise<{
    can_receive: boolean;
    reason?: string;
    suggested_time?: string;
  }> {
    const preferences = await this.getOrCreateDefault(userId, userType);

    // Check if notifications are globally enabled
    if (!preferences.notifications_enabled) {
      return { can_receive: false, reason: 'Notifications disabled' };
    }

    // Check if channel is enabled
    if (!preferences.channels_enabled[channel]) {
      return { can_receive: false, reason: `${channel} notifications disabled` };
    }

    // Check if notification type is enabled
    if (!preferences.notification_types[notificationType]) {
      return { can_receive: false, reason: `${notificationType} notifications disabled` };
    }

    // Check quiet hours
    if (preferences.quiet_hours?.enabled && scheduledTime) {
      const result = this.isInQuietHours(scheduledTime, preferences.quiet_hours, preferences.timezone);
      if (result.is_quiet_hours) {
        return { 
          can_receive: false, 
          reason: 'Quiet hours', 
          suggested_time: result.next_available_time 
        };
      }
    }

    return { can_receive: true };
  }

  /**
   * Check if time is within quiet hours
   */
  private isInQuietHours(
    time: Date, 
    quietHours: { start_time: string; end_time: string }, 
    timezone: string
  ): { is_quiet_hours: boolean; next_available_time?: string } {
    // Convert time to user's timezone
    const userTime = new Date(time.toLocaleString('en-US', { timeZone: timezone }));
    const hours = userTime.getHours();
    const minutes = userTime.getMinutes();
    const currentTime = hours * 60 + minutes; // Convert to minutes

    // Parse quiet hours
    const [startHour, startMin] = quietHours.start_time.split(':').map(Number);
    const [endHour, endMin] = quietHours.end_time.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    let isQuietHours = false;
    let nextAvailableTime: Date;

    if (startTime <= endTime) {
      // Same day quiet hours (e.g., 22:00 - 08:00 next day is not this case)
      isQuietHours = currentTime >= startTime && currentTime < endTime;
      nextAvailableTime = new Date(userTime);
      nextAvailableTime.setHours(endHour, endMin, 0, 0);
    } else {
      // Overnight quiet hours (e.g., 22:00 - 08:00)
      isQuietHours = currentTime >= startTime || currentTime < endTime;
      nextAvailableTime = new Date(userTime);
      
      if (currentTime >= startTime) {
        // After start time, next available is tomorrow at end time
        nextAvailableTime.setDate(nextAvailableTime.getDate() + 1);
        nextAvailableTime.setHours(endHour, endMin, 0, 0);
      } else {
        // Before end time, next available is today at end time
        nextAvailableTime.setHours(endHour, endMin, 0, 0);
      }
    }

    return {
      is_quiet_hours: isQuietHours,
      next_available_time: isQuietHours ? nextAvailableTime.toISOString() : undefined
    };
  }

  /**
   * Get users who can receive a specific notification type
   */
  async findEligibleUsers(
    notificationType: NotificationType,
    channel: CommunicationChannel,
    userType?: RecipientType
  ): Promise<CommunicationPreference[]> {
    let query = this.supabase
      .from('communication_preferences')
      .select('*')
      .eq('notifications_enabled', true);

    if (userType) {
      query = query.eq('user_type', userType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch eligible users: ${error.message}`);
    }

    // Filter by notification type and channel preferences
    return (data || []).filter(pref => 
      pref.channels_enabled[channel] && 
      pref.notification_types[notificationType]
    );
  }

  /**
   * Update language preference
   */
  async updateLanguage(
    userId: string,
    userType: RecipientType,
    language: string
  ): Promise<CommunicationPreference> {
    return await this.update(userId, userType, { language });
  }

  /**
   * Update timezone preference
   */
  async updateTimezone(
    userId: string,
    userType: RecipientType,
    timezone: string
  ): Promise<CommunicationPreference> {
    return await this.update(userId, userType, { timezone });
  }

  /**
   * Update quiet hours settings
   */
  async updateQuietHours(
    userId: string,
    userType: RecipientType,
    quietHours: {
      enabled: boolean;
      start_time: string;
      end_time: string;
    }
  ): Promise<CommunicationPreference> {
    return await this.update(userId, userType, { quiet_hours: quietHours });
  }

  /**
   * Bulk disable notifications for a user (e.g., on unsubscribe)
   */
  async disableAllNotifications(
    userId: string,
    userType: RecipientType
  ): Promise<CommunicationPreference> {
    return await this.update(userId, userType, {
      notifications_enabled: false
    });
  }

  /**
   * Bulk enable notifications for a user
   */
  async enableAllNotifications(
    userId: string,
    userType: RecipientType
  ): Promise<CommunicationPreference> {
    return await this.update(userId, userType, {
      notifications_enabled: true
    });
  }

  /**
   * Get notification frequency setting
   */
  async getFrequencySetting(
    userId: string,
    userType: RecipientType,
    settingType: 'weekly_summary' | 'payment_reminders' | 'verification_reminders'
  ): Promise<string> {
    const preferences = await this.getOrCreateDefault(userId, userType);
    return preferences.frequency_settings?.[settingType] || 'standard';
  }

  /**
   * Update notification frequency setting
   */
  async updateFrequencySetting(
    userId: string,
    userType: RecipientType,
    settingType: 'weekly_summary' | 'payment_reminders' | 'verification_reminders',
    frequency: string
  ): Promise<CommunicationPreference> {
    const preferences = await this.getOrCreateDefault(userId, userType);
    
    const updatedFrequencySettings = {
      ...preferences.frequency_settings,
      [settingType]: frequency
    };

    return await this.update(userId, userType, {
      frequency_settings: updatedFrequencySettings
    });
  }

  /**
   * Get communication preferences statistics
   */
  async getPreferenceStats(): Promise<{
    total_users: number;
    notifications_enabled: number;
    by_language: Record<string, number>;
    by_channel: Record<CommunicationChannel, number>;
    by_notification_type: Record<NotificationType, number>;
  }> {
    const { data, error } = await this.supabase
      .from('communication_preferences')
      .select('language, notifications_enabled, channels_enabled, notification_types');

    if (error) {
      throw new Error(`Failed to fetch preference stats: ${error.message}`);
    }

    const stats = {
      total_users: data?.length || 0,
      notifications_enabled: 0,
      by_language: {} as Record<string, number>,
      by_channel: {} as Record<CommunicationChannel, number>,
      by_notification_type: {} as Record<NotificationType, number>
    };

    data?.forEach(pref => {
      if (pref.notifications_enabled) stats.notifications_enabled++;
      
      stats.by_language[pref.language] = (stats.by_language[pref.language] || 0) + 1;
      
      Object.entries(pref.channels_enabled).forEach(([channel, enabled]) => {
        if (enabled) {
          stats.by_channel[channel as CommunicationChannel] = 
            (stats.by_channel[channel as CommunicationChannel] || 0) + 1;
        }
      });

      Object.entries(pref.notification_types).forEach(([type, enabled]) => {
        if (enabled) {
          stats.by_notification_type[type as NotificationType] = 
            (stats.by_notification_type[type as NotificationType] || 0) + 1;
        }
      });
    });

    return stats;
  }
}