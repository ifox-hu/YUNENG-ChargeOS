const fs = require('node:fs');
const {sql} = require('./lib/device-alarm-testkit.cjs');
const duplicate = sql('SELECT COUNT(*) FROM (SELECT user_name FROM sys_user GROUP BY user_name HAVING COUNT(*)>1) d');
if (duplicate !== '0') throw new Error('Legacy duplicate usernames exist; migration stopped without altering accounts');
const before = sql('SELECT COUNT(*) FROM sys_user');
sql(fs.readFileSync(require('node:path').join(__dirname,'../yuneng-cloud/sql/operator-onboarding-20261107.sql'),'utf8'));
if (sql("SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='sys_user' AND index_name='uk_user_name_global'") === '0') {
  sql('ALTER TABLE sys_user ADD UNIQUE KEY uk_user_name_global(user_name)');
}
if (sql('SELECT COUNT(*) FROM sys_user') !== before) throw new Error('Account count unexpectedly changed');
console.log(JSON.stringify({migration:'operator-onboarding',usersPreserved:Number(before),ruleRows:Number(sql('SELECT COUNT(*) FROM c_operator_charge_rule'))}));
