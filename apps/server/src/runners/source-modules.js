import {parse} from 'acorn';
export const MODULE_NAMES=['movement','combat','enemy','level','progression','effect'];
export const MODULE_PATHS=MODULE_NAMES.map(name=>`generated/modules/${name}.js`);
export function sourceModule(source,path){
 const index=MODULE_PATHS.indexOf(path);if(index<0)throw Error('Outside owned game modules');const prefix=MODULE_NAMES[index];
 const tree=parse(source,{ecmaVersion:'latest',sourceType:'module'});
 const nodes=tree.body.filter(node=>node.type==='FunctionDeclaration'&&node.id.name.startsWith(prefix));
 return {source:nodes.map(node=>source.slice(node.start,node.end)).join('\n'),nodes,prefix};
}
export function patchModule(source,path,find,replacement){
 const module=sourceModule(source,path);
 if(typeof find!=='string'||typeof replacement!=='string'||find&&module.source.split(find).length!==2||!find&&module.source)throw Error('Patch must match one exact module location');
 const next=find?module.source.replace(find,()=>replacement):replacement;
 const parsed=parse(next,{ecmaVersion:'latest',sourceType:'module'});if(parsed.body.some(node=>node.type!=='FunctionDeclaration'||!node.id.name.startsWith(module.prefix)))throw Error('Modules contain only named functions starting with '+module.prefix);
 const cut=[...module.nodes].reverse();for(const node of cut)source=source.slice(0,node.start)+source.slice(node.end);
 return next+'\n'+source;
}
