// Korean ranges use a single tilde. Only an explicit ~~pair~~ is deletion.
export function createMarkdown(Marked, sanitize, escape) {
  const parser=new Marked({breaks:false,gfm:true,tokenizer:{
    del(source) {return source.startsWith('~~') ? false : undefined;}
  }});
  return source=>{
    const math=[];
    source=source.replace(/\$\$[\s\S]*?\$\$|\$(?!\s)[^$\n]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g,m=>`MATHSLOT${math.push(m)-1}END`);
    source=source.replace(/<([가-힣][^<>\n]{0,30})>/g,(_,s)=>'&lt;'+s+'&gt;');
    return sanitize(parser.parse(source).replace(/MATHSLOT(\d+)END/g,(_,i)=>escape(math[+i])));
  };
}
