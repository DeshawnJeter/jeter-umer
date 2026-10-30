// Generated games never need credentials in their browser process environment.
export function browserEnvironment(source=process.env){
 return Object.fromEntries(Object.entries(source).filter(([key,value])=>typeof value==='string'&&!/^(ANTHROPIC_|OPENAI_|AWS_|GH_|GITHUB_|CODEX_)/i.test(key)));
}
