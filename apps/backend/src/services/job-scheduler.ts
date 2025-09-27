import { DatabasePreparationJobProcessor } from '../jobs/database-preparation';
import { NotificationReminderJobProcessor } from '../jobs/notification-reminders';
import { PaymentProcessingJobProcessor } from '../jobs/payment-processing';
import { FileCleanupJobProcessor } from '../jobs/file-cleanup';
import { loggingService } from './loggingService';

export interface JobSchedule {
  name: string;
  cron: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  processor: () => Promise<void>;
}

export interface JobResult {
  jobName: string;
  startTime: Date;
  endTime: Date;
  success: boolean;
  result?: any;
  error?: string;
}

class JobSchedulerService {
  private schedules: Map<string, JobSchedule> = new Map();
  private isRunning: boolean = false;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.setupDefaultSchedules();
  }

  private setupDefaultSchedules(): void {
    // Weekly verification cycle preparation - Every Monday at 1:00 AM
    this.addSchedule({
      name: 'database-preparation-weekly',
      cron: '0 1 * * 1',
      enabled: true,
      processor: async () => {
        const processor = DatabasePreparationJobProcessor.getInstance();
        await processor.runWeeklyPreparation();
      }
    });

    // Daily deadline reminders - Every day at 9:00 AM
    this.addSchedule({
      name: 'deadline-reminders-daily',
      cron: '0 9 * * *',
      enabled: true,
      processor: async () => {
        const processor = NotificationReminderJobProcessor.getInstance();
        await processor.runDailyReminderCheck();
      }
    });

    // Payment processing - Every weekday at 2:00 PM
    this.addSchedule({
      name: 'payment-processing-daily',
      cron: '0 14 * * 1-5',
      enabled: true,
      processor: async () => {
        const processor = PaymentProcessingJobProcessor.getInstance();
        await processor.runDailyPaymentProcessing();
      }
    });

    // Weekly payment reminders - Every Friday at 10:00 AM
    this.addSchedule({
      name: 'payment-reminders-weekly',
      cron: '0 10 * * 5',
      enabled: true,
      processor: async () => {
        const processor = NotificationReminderJobProcessor.getInstance();
        await processor.runWeeklyPaymentReminders();
      }
    });

    // Daily file cleanup - Every day at 2:00 AM
    this.addSchedule({
      name: 'file-cleanup-daily',
      cron: '0 2 * * *',
      enabled: true,
      processor: async () => {
        const processor = FileCleanupJobProcessor.getInstance();
        await processor.runDailyCleanup();
      }
    });

    // Weekly file cleanup - Every Sunday at 3:00 AM
    this.addSchedule({
      name: 'file-cleanup-weekly',
      cron: '0 3 * * 0',
      enabled: true,
      processor: async () => {
        const processor = FileCleanupJobProcessor.getInstance();
        await processor.runWeeklyCleanup();
      }
    });
  }

  addSchedule(schedule: JobSchedule): void {
    this.schedules.set(schedule.name, {
      ...schedule,
      nextRun: this.calculateNextRun(schedule.cron)
    });
  }

  removeSchedule(name: string): boolean {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
    return this.schedules.delete(name);
  }

  getSchedule(name: string): JobSchedule | undefined {
    return this.schedules.get(name);
  }

  getAllSchedules(): JobSchedule[] {
    return Array.from(this.schedules.values());
  }

  enableSchedule(name: string): boolean {
    const schedule = this.schedules.get(name);
    if (schedule) {
      schedule.enabled = true;
      if (this.isRunning) {
        this.startSchedule(name, schedule);
      }
      return true;
    }
    return false;
  }

  disableSchedule(name: string): boolean {
    const schedule = this.schedules.get(name);
    if (schedule) {
      schedule.enabled = false;
      const interval = this.intervals.get(name);
      if (interval) {
        clearInterval(interval);
        this.intervals.delete(name);
      }
      return true;
    }
    return false;
  }

  async runJob(name: string): Promise<JobResult> {
    const schedule = this.schedules.get(name);
    if (!schedule) {
      throw new Error(`Job schedule not found: ${name}`);
    }

    const startTime = new Date();
    let result: JobResult;

    try {
      await loggingService.logInfo('Job execution started', {
        jobName: name,
        startTime: startTime.toISOString()
      });

      const jobResult = await schedule.processor();
      const endTime = new Date();

      result = {
        jobName: name,
        startTime,
        endTime,
        success: true,
        result: jobResult
      };

      schedule.lastRun = endTime;
      schedule.nextRun = this.calculateNextRun(schedule.cron);

      await loggingService.logInfo('Job execution completed successfully', {
        jobName: name,
        duration: endTime.getTime() - startTime.getTime(),
        result: jobResult
      });

    } catch (error) {
      const endTime = new Date();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      result = {
        jobName: name,
        startTime,
        endTime,
        success: false,
        error: errorMessage
      };

      await loggingService.logError('Job execution failed', error as Error, {
        jobName: name,
        duration: endTime.getTime() - startTime.getTime()
      });
    }

    return result;
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    for (const [name, schedule] of this.schedules.entries()) {
      if (schedule.enabled) {
        this.startSchedule(name, schedule);
      }
    }

    loggingService.logInfo('Job scheduler started', {
      enabledJobs: this.getAllSchedules().filter(s => s.enabled).length,
      totalJobs: this.schedules.size
    });
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    for (const [name, interval] of this.intervals.entries()) {
      clearInterval(interval);
    }
    this.intervals.clear();

    loggingService.logInfo('Job scheduler stopped');
  }

  private startSchedule(name: string, schedule: JobSchedule): void {
    // Check every minute if it's time to run the job
    const interval = setInterval(async () => {
      const now = new Date();
      if (schedule.nextRun && now >= schedule.nextRun) {
        try {
          await this.runJob(name);
        } catch (error) {
          await loggingService.logError(`Scheduled job failed: ${name}`, error as Error);
        }
      }
    }, 60000); // Check every minute

    this.intervals.set(name, interval);
  }

  private calculateNextRun(cronExpression: string): Date {
    // Simple cron parser for basic expressions
    // Format: "minute hour day month dayOfWeek"
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) {
      throw new Error('Invalid cron expression');
    }

    const [minute, hour, day, month, dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);

    // Set the target time
    if (hour !== '*') {
      next.setHours(parseInt(hour));
    }
    if (minute !== '*') {
      next.setMinutes(parseInt(minute));
    }
    next.setSeconds(0);
    next.setMilliseconds(0);

    // If the time has already passed today, move to next occurrence
    if (next <= now) {
      if (dayOfWeek !== '*') {
        // Handle day of week
        const targetDayOfWeek = parseInt(dayOfWeek);
        const currentDayOfWeek = next.getDay();
        let daysToAdd = targetDayOfWeek - currentDayOfWeek;
        
        if (daysToAdd <= 0) {
          daysToAdd += 7; // Next week
        }
        
        next.setDate(next.getDate() + daysToAdd);
      } else {
        // Daily job - move to next day
        next.setDate(next.getDate() + 1);
      }
    }

    return next;
  }

  getStatus(): {
    isRunning: boolean;
    activeJobs: number;
    totalJobs: number;
    nextJob?: { name: string; nextRun: Date };
  } {
    const enabledSchedules = this.getAllSchedules().filter(s => s.enabled);
    const nextJob = enabledSchedules
      .filter(s => s.nextRun)
      .sort((a, b) => a.nextRun!.getTime() - b.nextRun!.getTime())[0];

    return {
      isRunning: this.isRunning,
      activeJobs: enabledSchedules.length,
      totalJobs: this.schedules.size,
      nextJob: nextJob ? { name: nextJob.name, nextRun: nextJob.nextRun! } : undefined
    };
  }

  // Manual job triggers for admin operations
  async triggerWeeklyPreparation(): Promise<JobResult> {
    return this.runJob('database-preparation-weekly');
  }

  async triggerPaymentProcessing(): Promise<JobResult> {
    return this.runJob('payment-processing-daily');
  }

  async triggerFileCleanup(): Promise<JobResult> {
    return this.runJob('file-cleanup-daily');
  }

  async triggerReminderCheck(): Promise<JobResult> {
    return this.runJob('deadline-reminders-daily');
  }
}

export const jobScheduler = new JobSchedulerService();
export { JobSchedulerService };