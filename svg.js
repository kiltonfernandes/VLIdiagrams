// Portable SVG primitives shared by the native sequence view and file export.
export const xml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const color = (value, fallback='#5273a8') => /^(#[\da-f]{3,8}|[a-z]{1,24}|rgba?\([\d.,%\s]+\))$/i.test(String(value)) ? xml(value) : fallback;
export function wrapText(value, width, size=13) {
  const max=Math.max(1,Math.floor(width/(size*.57))), lines=[];
  for(const paragraph of String(value??'').split(/\n|<br\s*\/?\s*>/i)){
    let line='';
    for(const word of paragraph.split(/\s+/)){
      if(!word)continue;
      if(line && Array.from(line+' '+word).length>max){lines.push(line);line='';}
      const chars=Array.from(word);
      while(chars.length>max){if(line){lines.push(line);line='';}lines.push(chars.splice(0,max).join(''));}
      line+=(line?' ':'')+chars.join('');
    }
    lines.push(line);
  }
  return lines.length?lines:[''];
}
export function textBlock(value,x,y,width,{size=13,fill='#253247',anchor='middle',weight=500}={}){
  const lines=wrapText(value,width,size), step=size*1.45;
  return `<text x="${x}" y="${y}" font-family="Noto Sans, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color(fill)}" text-anchor="${anchor}">${lines.map((line,i)=>`<tspan x="${x}" dy="${i?step:0}">${xml(line)}</tspan>`).join('')}</text>`;
}
export function svgDocument(body,width,height,{transparent=false,background='#fff',title='Diagrama'}={}){
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${xml(title)}</title>${transparent?'':`<rect width="100%" height="100%" fill="${color(background,'#fff')}"/>`}${body}</svg>`;
}
