const https = require('https');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // Get API Key from Environment Variables
  const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

  if (!NVIDIA_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'NVIDIA_API_KEY is not configured on Netlify.' })
    };
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'integrate.api.nvidia.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' // Support CORS
          },
          body: data
        });
      });
    });

    req.on('error', (e) => {
      console.error('Netlify Function Proxy Error:', e.message);
      resolve({
        statusCode: 500,
        body: JSON.stringify({ error: { message: e.message } })
      });
    });

    req.write(event.body);
    req.end();
  });
};
