// Instrucciones corregidas para probar scopes con API v21.0
// Los campos 'username' están deprecated

console.log('🔧 Campos corregidos para Instagram Graph API v21.0:');

// Para Instagram Business Account, usa estos campos en su lugar:
const CORRECTED_FIELDS = {
  // ❌ No uses: username
  // ✅ Usa: id, name (para cuentas de negocio)
  profile: 'id,name',

  // Para media/comments
  media: 'id,comments',

  // Para mensajes - no necesitas campos adicionales
  messages: 'POST sin campos específicos'
};

console.log('Campos correctos:');
console.log('- Perfil:', CORRECTED_FIELDS.profile);
console.log('- Media:', CORRECTED_FIELDS.media);
console.log('- Mensajes:', CORRECTED_FIELDS.messages);
