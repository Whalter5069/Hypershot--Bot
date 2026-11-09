const axios = require('axios');
const c = require('./config.json');
axios.get(`http://${c.serverStatus.serverIP}:${c.serverStatus.serverPort}/arena-status/status`)
  .then(r => console.log(JSON.stringify(r.data, null, 2)))
  .catch(e => console.error(e.message));
