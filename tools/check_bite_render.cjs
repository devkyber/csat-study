const fs=require('node:fs'),path=require('node:path'),katex=require('katex');
const root=path.resolve(__dirname,'..','content','bites');
let cards=0,formulas=0;const errors=[];
for(const name of fs.readdirSync(root).filter(f=>f.endsWith('.json'))) for(const c of JSON.parse(fs.readFileSync(path.join(root,name),'utf8'))) {
  cards++;
  const text=[c.prompt,...(c.choices||[]),c.answerText||'',...c.explanation,c.takeaway].join('\n');
  for(const m of text.matchAll(/\$\$([\s\S]*?)\$\$|\$(?!\s)([^$\n]+?)\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g)) {
    formulas++;try{katex.renderToString(m[1]??m[2]??m[3]??m[4],{throwOnError:true,strict:'ignore',trust:false});}
    catch(e){errors.push(`${c.id}: ${e.message}`);}
  }
}
console.log(JSON.stringify({cards,formulas,errors},null,2));if(errors.length)process.exitCode=1;
