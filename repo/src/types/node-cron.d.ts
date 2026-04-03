declare module 'node-cron' {
  interface ScheduledTask {
    start(): void;
    stop(): void;
  }
  function schedule(expression: string, func: () => void | Promise<void>): ScheduledTask;
  function validate(expression: string): boolean;
}
