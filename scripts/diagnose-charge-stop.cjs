// Run the unchanged reproduction and capture DB resource state during the failure.
const fs=require('node:fs'),path=require('node:path');
const {spawn,execFile}=require('node:child_process');
const out=path.join(__dirname,'../outputs/resume-benchmarks/stop-fix-20261102');
fs.mkdirSync(out,{recursive:true});
const label=process.argv[2]||'before';
if(!['before','after'].includes(label))throw new Error('Expected before or after');
const tag=Date.now(),logFile=path.join(out,label+'-'+tag+'.log'),snapshotFile=path.join(out,label+'-db-'+tag+'.jsonl');
const stream=fs.createWriteStream(logFile);
const query="SELECT 'operator_connections',COUNT(*) FROM information_schema.processlist WHERE HOST LIKE '172.18.0.14:%'; SELECT 'transaction',trx_mysql_thread_id,trx_state,trx_rows_locked,trx_rows_modified,IFNULL(LEFT(trx_query,160),'idle') FROM information_schema.innodb_trx; SELECT 'connection',ID,HOST,COMMAND,TIME,STATE,IFNULL(LEFT(INFO,160),'idle') FROM information_schema.processlist WHERE DB='vctgo_platform' AND USER<>'event_scheduler'; SELECT 'waits',COUNT(*) FROM performance_schema.data_lock_waits;";
let busy=false;
const timer=setInterval(()=>{
 if(busy)return;busy=true;
 execFile('docker',['exec','-e','MYSQL_PWD=password','hcp-mysql','mysql','-uroot','--batch','--skip-column-names','vctgo_platform','-e',query],{encoding:'utf8',timeout:5000},(error,stdout)=>{
  fs.appendFileSync(snapshotFile,JSON.stringify({at:new Date().toISOString(),error:error?.message,output:stdout})+'\n');busy=false;
 });
},650);
const child=spawn(process.execPath,[path.join(__dirname,'test-resume-last-three.cjs'),'simulator','20','20'],{windowsHide:true});
child.stdout.on('data',b=>stream.write(b));child.stderr.on('data',b=>stream.write(b));
child.on('exit',code=>{clearInterval(timer);stream.end();console.log(JSON.stringify({code,logFile,snapshotFile}));process.exitCode=code;});
