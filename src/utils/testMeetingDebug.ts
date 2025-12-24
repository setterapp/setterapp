/**
 * Script de prueba para debugging de reuniones
 *
 * Cómo usar:
 * 1. Importa este archivo en tu componente o página
 * 2. Llama a testCheckAvailability() o testCreateMeeting() desde el F12
 * 3. Los logs detallados aparecerán en la consola
 *
 * También puedes pegar este código directamente en la consola del navegador (F12)
 */

import { supabase } from '../lib/supabase'
import { FunctionDebugger } from './functionDebugger'

/**
 * Test: Verificar disponibilidad de horarios
 */
export async function testCheckAvailability(conversationId: string, agentId?: string) {
  console.clear()
  console.log('🧪 TEST: Check Availability')
  console.log('═══════════════════════════════════════════════════════════\n')

  const params = {
    conversationId,
    agentId,
    checkAvailabilityOnly: true,
    leadName: 'Test Lead'
  }

  const result = await FunctionDebugger.invokeWithLogging(
    supabase,
    'create-meeting',
    params
  )

  console.log('\n📊 RESULT:')
  if (result.data?.slots) {
    console.table(result.data.slots.map((slot: any, i: number) => ({
      '#': i + 1,
      start: new Date(slot.start).toLocaleString('es-AR'),
      end: new Date(slot.end).toLocaleString('es-AR')
    })))
  }

  return result
}

/**
 * Test: Crear una reunión
 */
export async function testCreateMeeting(
  conversationId: string,
  leadName: string,
  leadEmail: string,
  customDate?: string,
  agentId?: string
) {
  console.clear()
  console.log('🧪 TEST: Create Meeting')
  console.log('═══════════════════════════════════════════════════════════\n')

  const params = {
    conversationId,
    leadName,
    leadEmail,
    agentId,
    customDate,
    checkAvailabilityOnly: false
  }

  const result = await FunctionDebugger.invokeWithLogging(
    supabase,
    'create-meeting',
    params
  )

  console.log('\n📊 RESULT:')
  if (result.data?.meeting) {
    console.table({
      'Meeting ID': result.data.meeting.id,
      'Date': new Date(result.data.meeting.date).toLocaleString('es-AR'),
      'Duration': `${result.data.meeting.duration} min`,
      'Link': result.data.meeting.link,
      'Title': result.data.meeting.title
    })
  }

  return result
}

/**
 * Monitor en tiempo real de las funciones
 */
export function enableRealtimeDebug() {
  FunctionDebugger.setEnabled(true)
  console.log('✅ Realtime debug enabled!')
  console.log('Todos las llamadas a funciones mostrarán logs detallados.')
}

export function disableRealtimeDebug() {
  FunctionDebugger.setEnabled(false)
  console.log('❌ Realtime debug disabled!')
}

// Exponer funciones globalmente para usar desde la consola
if (typeof window !== 'undefined') {
  ;(window as any).testCheckAvailability = testCheckAvailability
  ;(window as any).testCreateMeeting = testCreateMeeting
  ;(window as any).enableRealtimeDebug = enableRealtimeDebug
  ;(window as any).disableRealtimeDebug = disableRealtimeDebug

  console.log(`
🔧 Meeting Debug Tools cargadas!

Funciones disponibles en la consola (F12):

1. testCheckAvailability(conversationId, agentId?)
   - Verifica horarios disponibles
   - Ejemplo: testCheckAvailability('conv-123', 'agent-456')

2. testCreateMeeting(conversationId, leadName, leadEmail, customDate?, agentId?)
   - Crea una reunión de prueba
   - Ejemplo: testCreateMeeting('conv-123', 'Juan Perez', 'juan@example.com')

3. enableRealtimeDebug()
   - Habilita logging automático de TODAS las llamadas a funciones

4. disableRealtimeDebug()
   - Deshabilita el logging automático

💡 Tip: Presiona F12 para abrir la consola y usar estas funciones
`)
}
