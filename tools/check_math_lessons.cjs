const fs=require('fs');const katex=require('katex');
const articles=JSON.parse(fs.readFileSync('content/math.json','utf8'));
const examples=JSON.parse(fs.readFileSync('content/math-examples.json','utf8')).examples;
const errors=[];let formulas=0,labs=0;
for(const [id,types] of [['math-cubic',['inflection','cubic-tangent']],['math-quartic',['quartic-tangent']]]) {
  const article=articles.find(a=>a.id===id);
  for(const type of types) if(!(article?.mathLabs||[]).some(l=>l.type===type)) errors.push(id+': missing '+type+' diagram');
}
for(const a of articles) {
  const headings=[...a.body.matchAll(/^#{2,3}\s+(.+)$/gm)].map(m=>m[1]);
  for(const lab of a.mathLabs||[]) {
    labs++;
    if(!['inflection','cubic-tangent','quartic-tangent'].includes(lab.type)||!headings.includes(lab.afterHeading)) errors.push(a.id+': invalid diagram attachment');
    if(lab.afterText && !a.body.includes(lab.afterText)) errors.push(a.id+': missing diagram paragraph');
  }
}
for(const [id,text] of [...articles.map(a=>[a.id,a.body]),...examples.map(e=>[e.id,e.explanation])]) {
  const re=/\$\$([\s\S]*?)\$\$|\$(?!\s)([^$\n]+?)\$|\\\[([\s\S]*?)\\\]|\\\(([^]*?)\\\)/g;
  for(const m of text.matchAll(re)) {formulas++;try{katex.renderToString(m[1]??m[2]??m[3]??m[4],{throwOnError:true,strict:'ignore',trust:false});}catch(e){errors.push(id+': '+e.message);}}
}
console.log(JSON.stringify({articles:articles.length,formulas,labs,errors},null,2));process.exitCode=errors.length?1:0;
