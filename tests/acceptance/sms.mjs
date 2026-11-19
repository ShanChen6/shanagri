// Local-only disposable SMS inbox for the acceptance stack, never mount on the app.
import http from 'node:http';
const inbox=new Map();
http.createServer(async(req,res)=>{
 if(req.headers.authorization!=='Bearer '+process.env.SMS_WEBHOOK_TOKEN){res.writeHead(401).end();return;}
 if(req.method==='POST'){
   let text='';for await(const part of req)text+=part;
   const {to,message}=JSON.parse(text);inbox.set(to,message.match(/\d{6}/)[0]);res.writeHead(204).end();return;
 }
 res.end(inbox.get(decodeURIComponent(req.url.slice(1)))??'');
}).listen(4599,'127.0.0.1');
