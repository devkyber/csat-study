/* Validate all hand-authored formulas before publishing the practice reader. */
const fs=require('node:fs');
const path=require('node:path');
const katex=require('katex');
const root=path.resolve(__dirname,'..','content','practice');
let questions=0,formulas=0;
const errors=[];
for(const subject of fs.readdirSync(root)) {
  for(const file of fs.readdirSync(path.join(root,subject)).filter(f=>f.endsWith('.json'))) {
    const paper=JSON.parse(fs.readFileSync(path.join(root,subject,file),'utf8'));
    for(const q of paper.questions) {
      questions++;
      const text=[...q.steps,q.check].join('\n');
      for(const match of text.matchAll(/\$\$([\s\S]*?)\$\$|\$(?!\s)([^$\n]+?)\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g)) {
        const formula=match[1]??match[2]??match[3]??match[4];
        formulas++;
        try {katex.renderToString(formula,{throwOnError:true,strict:'ignore',trust:false,displayMode:match[1]!==undefined||match[3]!==undefined});}
        catch(error){errors.push(`${paper.id} #${q.number}: ${error.message}`);}
      }
    }
  }
}
console.log(JSON.stringify({questions,formulas,errors},null,2));
if(errors.length)process.exitCode=1;
