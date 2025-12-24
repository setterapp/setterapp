/**
 * Logger utility for Supabase Edge Functions
 * Logs to console AND optionally to database for debugging
 */

interface LogMetadata {
  [key: string]: any
}

export class FunctionLogger {
  private functionName: string
  private executionId: string
  private userId?: string
  private conversationId?: string
  private agentId?: string
  private startTime: number

  constructor(
    functionName: string,
    context: {
      userId?: string
      conversationId?: string
      agentId?: string
    } = {}
  ) {
    this.functionName = functionName
    this.executionId = crypto.randomUUID()
    this.userId = context.userId
    this.conversationId = context.conversationId
    this.agentId = context.agentId
    this.startTime = Date.now()
  }

  private formatMessage(level: string, message: string, metadata?: LogMetadata): string {
    const emoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      success: '✅'
    }[level] || 'ℹ️'

    const parts = [
      emoji,
      `[${this.functionName}]`,
      `[${this.executionId.slice(0, 8)}]`,
      message
    ]

    if (metadata && Object.keys(metadata).length > 0) {
      parts.push('\n  Metadata:', JSON.stringify(metadata, null, 2))
    }

    return parts.join(' ')
  }

  debug(message: string, metadata?: LogMetadata) {
    console.log(this.formatMessage('debug', message, metadata))
  }

  info(message: string, metadata?: LogMetadata) {
    console.log(this.formatMessage('info', message, metadata))
  }

  warn(message: string, metadata?: LogMetadata) {
    console.warn(this.formatMessage('warn', message, metadata))
  }

  error(message: string, metadata?: LogMetadata, error?: Error) {
    const fullMetadata = { ...metadata }
    if (error) {
      fullMetadata.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    }
    console.error(this.formatMessage('error', message, fullMetadata))
  }

  success(message: string, metadata?: LogMetadata) {
    console.log(this.formatMessage('success', message, metadata))
  }

  /**
   * Log a specific step in the execution flow
   */
  step(stepNumber: number, description: string, metadata?: LogMetadata) {
    this.info(`Step ${stepNumber}: ${description}`, metadata)
  }

  /**
   * Get execution duration in milliseconds
   */
  getDuration(): number {
    return Date.now() - this.startTime
  }

  /**
   * Log execution summary
   */
  summary(success: boolean, metadata?: LogMetadata) {
    const duration = this.getDuration()
    const level = success ? 'success' : 'error'
    const message = `Execution ${success ? 'completed' : 'failed'} in ${duration}ms`

    if (success) {
      this.success(message, { ...metadata, duration_ms: duration })
    } else {
      this.error(message, { ...metadata, duration_ms: duration })
    }
  }

  /**
   * Get logger context for passing to other functions
   */
  getContext() {
    return {
      functionName: this.functionName,
      executionId: this.executionId,
      userId: this.userId,
      conversationId: this.conversationId,
      agentId: this.agentId
    }
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(
  functionName: string,
  context?: {
    userId?: string
    conversationId?: string
    agentId?: string
  }
): FunctionLogger {
  return new FunctionLogger(functionName, context)
}
