const axios = require('axios');
const config = require('./config.json');

async function testJson() {
    try {
        const url = `http://${config.serverStatus.serverIP}:${config.serverStatus.txAdminPort}/status`;
        const res = await axios.get(url, { headers: { 'Accept': 'application/json' }, timeout: 2000 });
        console.log("status JSON:", typeof res.data, res.data);
    } catch (e) {
        console.log("status JSON Error:", e.message);
    }
}
testJson();
