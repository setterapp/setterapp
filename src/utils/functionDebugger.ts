/**
 * Function Debugger - Muestra logs detallados de las Edge Functions en la consola del navegador
 */

interface DebugLogEntry {
  step: string
  data?: any
  error?: any
  timestamp?: string
}

export class FunctionDebugger {
  private static isEnabled = true // Cambiar a false para desactivar

  /**
   * Habilita o deshabilita el debugging
   */
  static setEnabled(enabled: boolean) {
    this.isEnabled = enabled
    console.log(`🔧 Function Debugger ${enabled ? 'ENABLED' : 'DISABLED'}`)
  }

  /**
   * Log de llamada a función (INPUT)
   */
  static logFunctionCall(functionName: string, params: any) {
    if (!this.isEnabled) return

    console.group(`📤 CALLING: ${functionName}`)
    console.log('⏰ Time:', new Date().toISOString())
    console.log('📥 INPUT:', params)
    console.groupEnd()
  }

  /**
   * Log de respuesta de función (OUTPUT)
   */
  static logFunctionResponse(functionName: string, response: any, duration?: number) {
    if (!this.isEnabled) return

    const success = response?.success !== false && !response?.error

    console.group(`📥 RESPONSE: ${functionName} ${success ? '✅' : '❌'}`)
    console.log('⏰ Time:', new Date().toISOString())
    if (duration) console.log('⚡ Duration:', `${duration}ms`)
    console.log('📤 OUTPUT:', response)

    // Si hay debug info, mostrarlo en detalle
    if (response?.debug && Array.isArray(response.debug)) {
      console.group('🔍 DEBUG TRACE')
      response.debug.forEach((entry: DebugLogEntry, index: number) => {
        const emoji = entry.error ? '❌' : entry.step.includes('COMPLETE') || entry.step.includes('SUCCESS') ? '✅' : '📍'
        console.log(`${emoji} ${index + 1}. ${entry.step}`, entry.data || entry.error || '')
      })
      console.groupEnd()
    }

    // Mostrar execution time si está disponible
    if (response?.executionTime) {
      console.log('⚡ Server Execution Time:', `${response.executionTime}ms`)
    }

    console.groupEnd()
  }

  /**
   * Log de error
   */
  static logFunctionError(functionName: string, error: any) {
    if (!this.isEnabled) return

    console.group(`❌ ERROR: ${functionName}`)
    console.log('⏰ Time:', new Date().toISOString())
    console.error('Error:', error)
    if (error?.debug) {
      console.log('🔍 Debug Info:', error.debug)
    }
    console.groupEnd()
  }

  /**
   * Wrapper para invocar funciones con logging automático
   */
  static async invokeWithLogging<T = any>(
    supabase: any,
    functionName: string,
    params: any
  ): Promise<{ data: T | null; error: any }> {
    const startTime = performance.now()

    this.logFunctionCall(functionName, params)

    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: params
      })

      const duration = Math.round(performance.now() - startTime)

      if (error) {
        this.logFunctionError(functionName, error)
        return { data: null, error }
      }

      this.logFunctionResponse(functionName, data, duration)
      return { data, error: null }
    } catch (error) {
      this.logFunctionError(functionName, error)
      return { data: null, error }
    }
  }
}

// Export global para usar desde la consola del navegador
if (typeof window !== 'undefined') {
  ;(window as any).FunctionDebugger = FunctionDebugger
  console.log('🔧 FunctionDebugger available globally. Use window.FunctionDebugger.setEnabled(true/false)')
}

export default FunctionDebugger
