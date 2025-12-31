// Script para probar los scopes requeridos por Meta
// Ejecuta: node test-instagram-scopes.js

const https = require('https');

// Tu access token de Instagram (obtenlo de tu integración)
const ACCESS_TOKEN = 'TU_ACCESS_TOKEN_AQUI';

// Tu Instagram Business Account ID
const INSTAGRAM_USER_ID = 'TU_INSTAGRAM_USER_ID_AQUI';

console.log('🧪 Probando scopes requeridos por Meta...\n');

// 1. Probar instagram_business_manage_messages
console.log('1. Probando instagram_business_manage_messages...');
const testMessages = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.instagram.com',
      path: `/v21.0/${INSTAGRAM_USER_ID}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            console.log('✅ instagram_business_manage_messages: OK');
            resolve();
          } else {
            console.log('❌ instagram_business_manage_messages: Error', response.error?.message || data);
            resolve();
          }
        } catch (e) {
          console.log('❌ instagram_business_manage_messages: Error parsing response');
          resolve();
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ instagram_business_manage_messages: Network error', error.message);
      resolve();
    });

    // Enviamos un mensaje de prueba (cambiar recipient ID)
    req.write(JSON.stringify({
      recipient: { id: 'TEST_RECIPIENT_ID' },
      message: { text: 'Test message from scope validation' }
    }));
    req.end();
  });
};

// 2. Probar public_profile
console.log('2. Probando public_profile...');
const testPublicProfile = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.instagram.com',
      path: `/v21.0/${INSTAGRAM_USER_ID}?fields=id,username,name&access_token=${ACCESS_TOKEN}`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200 && response.id) {
            console.log('✅ public_profile: OK - Usuario:', response.username);
            resolve();
          } else {
            console.log('❌ public_profile: Error', response.error?.message || data);
            resolve();
          }
        } catch (e) {
          console.log('❌ public_profile: Error parsing response');
          resolve();
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ public_profile: Network error', error.message);
      resolve();
    });

    req.end();
  });
};

// 3. Probar instagram_manage_comments (si tienes posts con comentarios)
console.log('3. Probando instagram_manage_comments...');
const testComments = () => {
  return new Promise((resolve, reject) => {
    // Primero obtener media del usuario
    const options = {
      hostname: 'graph.instagram.com',
      path: `/v21.0/${INSTAGRAM_USER_ID}/media?fields=id,comments&access_token=${ACCESS_TOKEN}`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            console.log('✅ instagram_manage_comments: OK - Media obtenida');
            // Si hay comentarios, intenta responder a uno
            if (response.data && response.data.length > 0) {
              const media = response.data[0];
              if (media.comments && media.comments.data && media.comments.data.length > 0) {
                console.log('   📝 Intentando responder a comentario...');
                // Aquí podrías probar responder a un comentario
              }
            }
            resolve();
          } else {
            console.log('❌ instagram_manage_comments: Error', response.error?.message || data);
            resolve();
          }
        } catch (e) {
          console.log('❌ instagram_manage_comments: Error parsing response');
          resolve();
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ instagram_manage_comments: Network error', error.message);
      resolve();
    });

    req.end();
  });
};

// Ejecutar pruebas
async function runTests() {
  if (ACCESS_TOKEN === 'TU_ACCESS_TOKEN_AQUI' || INSTAGRAM_USER_ID === 'TU_INSTAGRAM_USER_ID_AQUI') {
    console.log('❌ ERROR: Actualiza ACCESS_TOKEN e INSTAGRAM_USER_ID en el script');
    process.exit(1);
  }

  await testPublicProfile();
  await testMessages();
  await testComments();

  console.log('\n🎯 Ve al Graph API Explorer de Meta y ejecuta estas llamadas manualmente:');
  console.log('   https://developers.facebook.com/tools/explorer/');
  console.log('\n📋 Llamadas a probar:');
  console.log(`   GET /${INSTAGRAM_USER_ID}?fields=id,username,name`);
  console.log(`   GET /${INSTAGRAM_USER_ID}/media?fields=id,comments`);
  console.log(`   POST /${INSTAGRAM_USER_ID}/messages`);
}

runTests();
