const fs = require('fs');
const path = require('path');
const http = require('http');
const yaml = require('../../huizhi-admin/node_modules/js-yaml');

const base = new URL(process.env.NACOS_URL || 'http://127.0.0.1:8848/nacos/');
const backup = path.join(__dirname, '.local', 'nacos-backup', new Date().toISOString().replace(/[:.]/g, '-'));
const mysqlUrl = 'jdbc:mysql://hcp-mysql:3306/vctgo_platform?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull&useSSL=true&requireSSL=true&serverTimezone=GMT%2B8';

function request(method, resource, params) {
  return new Promise((resolve, reject) => {
    const url = new URL(resource, base);
    const body = new URLSearchParams(params).toString();
    if (method === 'GET') url.search = body;
    const req = http.request(url, { method, headers: method === 'POST' ? {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body)
    } : {} }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const content = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return reject(new Error(`Nacos HTTP ${res.statusCode}`));
        resolve(content);
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('Nacos request timed out')));
    req.on('error', reject);
    req.end(method === 'POST' ? body : undefined);
  });
}

function configureDatasource(value) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.url === 'string' && value.url.startsWith('jdbc:mysql:')) {
    value.url = mysqlUrl;
    value.username = 'root';
    value.password = process.env.LOCAL_MYSQL_PASSWORD || 'password';
  }
  for (const item of Object.values(value)) configureDatasource(item);
}

async function main() {
  const listing = JSON.parse(await request('GET', 'v1/cs/configs', {
    search: 'accurate', dataId: '', group: '', tenant: 'hcp', pageNo: 1, pageSize: 100
  }));
  fs.mkdirSync(backup, { recursive: true });
  for (const item of listing.pageItems) {
    if (!/^(application|hcp-.+)-dev\.yml$/.test(item.dataId)) continue;
    const original = await request('GET', 'v1/cs/configs', {
      dataId: item.dataId, group: item.group, tenant: 'hcp'
    });
    const config = yaml.safeLoad(original);
    fs.writeFileSync(path.join(backup, item.dataId), original);
    if (config.spring && config.spring.redis) {
      config.spring.redis.host = 'hcp-redis';
      config.spring.redis.password = '';
      config.spring.redis.database = 5;
    }
    if (config.spring) {
      configureDatasource(config.spring.datasource);
      const pool = config.spring.datasource && config.spring.datasource.dynamic && config.spring.datasource.dynamic.druid;
      if (pool) {
        pool['initial-size'] = 2;
        pool['min-idle'] = 2;
        pool.maxActive = 10;
      }
      if (config.spring.mail) {
        config.spring.mail.host = 'localhost';
        config.spring.mail.username = '';
        config.spring.mail.password = '';
      }
    }
    if (config.file) {
      config.file.domain = 'http://127.0.0.1:8001/prod-api/file';
      config.file.path = '/home/hcp/uploadPath';
    }
    if (config.chargeServer) config.chargeServer.address = 'http://localhost:9250';
    if (config.xxl && config.xxl.job && config.xxl.job.admin) {
      config.xxl.job.admin.addresses = 'http://hcp-job:39204';
    }
    const content = yaml.safeDump(config, { lineWidth: 120, noRefs: true });
    const result = await request('POST', 'v1/cs/configs', {
      dataId: item.dataId, group: item.group, tenant: 'hcp', type: 'yaml', content
    });
    if (result !== 'true') throw new Error(`Publish failed: ${item.dataId}`);
    let verified = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const saved = await request('GET', 'v1/cs/configs', {
        dataId: item.dataId, group: item.group, tenant: 'hcp'
      });
      if (saved.trim() === content.trim()) { verified = true; break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!verified) throw new Error(`Readback failed: ${item.dataId}`);
    console.log(`Configured ${item.dataId}`);
  }
  console.log(`Original configurations backed up to ${backup}`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
