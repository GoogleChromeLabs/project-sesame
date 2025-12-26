/*
 * @license
 * Copyright 2025 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 */

export enum LogSeverity {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  NOTICE = 'NOTICE',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
  ALERT = 'ALERT',
  EMERGENCY = 'EMERGENCY',
}

export class Logger {
  private static readonly REDACTED_KEYS = [
    'password',
    'secret',
    'token',
    'credential',
    'cookie',
    'key',
    'displayName',
    'email',
    'name',
  ];

  private replacer(key: string, value: any): any {
    if (Logger.REDACTED_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      return '[REDACTED]';
    }
    return value;
  }

  private log(severity: LogSeverity, message: string, data?: any) {
    if (process.env.NODE_ENV === 'production' && severity === LogSeverity.DEBUG) {
      return;
    }

    const entry: any = {
      severity,
      message,
    };

    if (data) {
      // Merge data into the entry, but be careful not to overwrite priority fields
      // or we can put it in a 'data' field. Google Cloud Logging likes flat structures for payload.
      // Let's mix it in but prioritize 'message' and 'severity'.
      // If data is an Error, handled specially
      if (data instanceof Error) {
        entry.error = {
          message: data.message,
          stack: data.stack,
          name: data.name,
        };
      } else if (typeof data === 'object') {
        Object.assign(entry, data);
      } else {
        entry.data = data;
      }
    }

    console.log(JSON.stringify(entry, this.replacer));
  }

  debug(message: string, data?: any) {
    this.log(LogSeverity.DEBUG, message, data);
  }

  info(message: string, data?: any) {
    this.log(LogSeverity.INFO, message, data);
  }

  warn(message: string, data?: any) {
    this.log(LogSeverity.WARNING, message, data);
  }

  error(message: string, data?: any) {
    this.log(LogSeverity.ERROR, message, data);
  }
}

export const logger = new Logger();
