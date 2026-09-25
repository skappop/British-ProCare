const { launch } = require('./browser')
;(async()=>{const b=await launch();
for (const who of ['owner','dentist','reception']) {const c=await b.newContext();const p=await c.newPage();
await p.goto('http://localhost:3000/login');await p.fill('input[name=email]',who+'@test.local');await p.fill('input[name=password]','Passw0rd!');await p.getByRole('button',{name:'Enter Clinic'}).click();await p.waitForURL(u=>!u.pathname.startsWith('/login'));
const ck=(await c.cookies()).map(x=>x.name+'='+x.value).join('; ');require('fs').writeFileSync(require('path').join(__dirname,'..','.run','cookie-'+who+'.txt'),ck);await c.close()}
await b.close()})()
