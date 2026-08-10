/* DWG Sketch V0.22.5.3 - Vietnamese legacy encoding normalizer.
 * Dependency-free; AUTO conversion is deliberately conservative.
 */
(()=>{
'use strict';
const TCVN3_SOURCE='µ¸¶·¹¨»¾¼½Æ©ÇÊÈÉË®ÌÐÎÏÑªÒÕÓÔÖ×ÝØÜÞßãáâä«åèæçé¬êíëìîïóñòô­õøö÷ùúýûüþ¡¢§£¤¥¦';
const TCVN3_UNICODE='àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵĂÂĐÊÔƠƯ';
const TCVN3_MAP=new Map([...TCVN3_SOURCE].map((ch,i)=>[ch,[...TCVN3_UNICODE][i]]));
const VNI={
'AØ':'À','AÙ':'Á','AÂ':'Â','AÕ':'Ã','AÏ':'Ạ','AÛ':'Ả','AÊ':'Ă','AÁ':'Ấ','AÀ':'Ầ','AÅ':'Ẩ','AÃ':'Ẫ','AÄ':'Ậ','AÉ':'Ắ','AÈ':'Ằ','AÚ':'Ẳ','AÜ':'Ẵ','AË':'Ặ',
'EØ':'È','EÙ':'É','EÂ':'Ê','EÏ':'Ẹ','EÛ':'Ẻ','EÕ':'Ẽ','EÁ':'Ế','EÀ':'Ề','EÅ':'Ể','EÃ':'Ễ','EÄ':'Ệ',
'OØ':'Ò','OÙ':'Ó','OÂ':'Ô','OÕ':'Õ','OÏ':'Ọ','OÛ':'Ỏ','OÁ':'Ố','OÀ':'Ồ','OÅ':'Ổ','OÃ':'Ỗ','OÄ':'Ộ',
'UØ':'Ù','UÙ':'Ú','UÕ':'Ũ','UÏ':'Ụ','UÛ':'Ủ','YØ':'Ỳ','YÙ':'Ý','YÕ':'Ỹ','YÛ':'Ỷ',
'ÔÙ':'Ớ','ÔØ':'Ờ','ÔÛ':'Ở','ÔÕ':'Ỡ','ÔÏ':'Ợ','ÖÙ':'Ứ','ÖØ':'Ừ','ÖÛ':'Ử','ÖÕ':'Ữ','ÖÏ':'Ự',
'aø':'à','aù':'á','aâ':'â','aõ':'ã','aï':'ạ','aû':'ả','aê':'ă','aá':'ấ','aà':'ầ','aå':'ẩ','aã':'ẫ','aä':'ậ','aé':'ắ','aè':'ằ','aú':'ẳ','aü':'ẵ','aë':'ặ',
'eø':'è','eù':'é','eâ':'ê','eï':'ẹ','eû':'ẻ','eõ':'ẽ','eá':'ế','eà':'ề','eå':'ể','eã':'ễ','eä':'ệ',
'oø':'ò','où':'ó','oâ':'ô','oõ':'õ','oï':'ọ','oû':'ỏ','oá':'ố','oà':'ồ','oå':'ổ','oã':'ỗ','oä':'ộ',
'uø':'ù','uù':'ú','uõ':'ũ','uï':'ụ','uû':'ủ','yø':'ỳ','yù':'ý','yõ':'ỹ','yû':'ỷ',
'ôù':'ớ','ôø':'ờ','ôû':'ở','ôõ':'ỡ','ôï':'ợ','öù':'ứ','öø':'ừ','öû':'ử','öõ':'ữ','öï':'ự',
'Ñ':'Đ','ñ':'đ','Ô':'Ơ','ô':'ơ','Ö':'Ư','ö':'ư','Ì':'Ì','Í':'Í','Ó':'Ĩ','Æ':'Ỉ','Ò':'Ị','Î':'Ỵ','ì':'ì','í':'í','ó':'ĩ','æ':'ỉ','ò':'ị','î':'ỵ'};
const VIET='ÀÁÂÃĂĐÈÉÊÌÍÒÓÔÕÙÚÝàáâãăđèéêìíòóôõùúýẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹĨĩŨũƠơƯư';
const viqrToken=ch=>{if(ch==='đ')return'dd';if(ch==='Đ')return'DD';const d=ch.normalize('NFD');if(!d)return'';let shape='',tone='';for(const m of d.slice(1)){if(m==='\u0306')shape='(';else if(m==='\u0302')shape='^';else if(m==='\u031b')shape='+';else if(m==='\u0300')tone='`';else if(m==='\u0301')tone="'";else if(m==='\u0309')tone='?';else if(m==='\u0303')tone='~';else if(m==='\u0323')tone='.'}return d[0]+shape+tone};
const VIQR={};for(const ch of new Set([...VIET])){const t=viqrToken(ch);if(t&&t!==ch)VIQR[t]=ch}
const VNI_KEYS=Object.keys(VNI).sort((a,b)=>b.length-a.length),VIQR_KEYS=Object.keys(VIQR).sort((a,b)=>b.length-a.length);
const VNI_STRONG=VNI_KEYS.filter(x=>x.length>1||['Ñ','ñ','Æ','æ','Î','î'].includes(x));
const TCVN_STRONG=new Set([...('µ¸¶·¹¨»¾¼½Æ©ÇÊÈÉË®ÌÐÎÏÑªÒÕÓÔÖ×ÝØÜÞß«åæç¬îïñ÷þ¡¢§£¤¥¦­')]);
const looksTcvnFont=(style,font)=>{const k=`${style||''} ${font||''}`.toUpperCase();return !k.includes('VNI')&&/(^|[ ._\\/-])\.?VN[A-Z0-9]|VNTIME|VNARIAL|VH[A-Z0-9]+|VNSWISS/.test(k)};
const looksVniFont=(style,font)=>/(^|[ ._\\/-])VNI[-_. ]|\bVNI[A-Z0-9]/.test(`${style||''} ${font||''}`.toUpperCase());
const countTokens=(text,keys)=>{let n=0;for(const k of keys){let at=0;while(at<=text.length-k.length){const i=text.indexOf(k,at);if(i<0)break;n++;at=i+Math.max(1,k.length);if(n>=12)return n}}return n};
function countViqr(text){let n=0;for(const k of VIQR_KEYS){if(k.length<2||/^[AEIOUYaeiouy]\?$/.test(k))continue;let at=0;while(at<=text.length-k.length){const i=text.indexOf(k,at);if(i<0)break;n++;at=i+k.length;if(n>=12)return n}}return n}
function detect(text,styleName='',fontFile=''){text=String(text??'');if(!text)return{encoding:'Unicode',confidence:1,evidence:'empty'};if(looksVniFont(styleName,fontFile))return{encoding:'VNI',confidence:.995,evidence:'font'};if(looksTcvnFont(styleName,fontFile))return{encoding:'TCVN3',confidence:.995,evidence:'font'};const t=[...text].filter(ch=>TCVN_STRONG.has(ch)).length,tu=[...text].filter(ch=>TCVN_STRONG.has(ch)&&!VIET.includes(ch)).length,v=countTokens(text,VNI_STRONG),q=countViqr(text),u=[...text].filter(ch=>VIET.includes(ch)).length;if(v>=2)return{encoding:'VNI',confidence:Math.min(.97,.78+v*.05),evidence:`vni:${v}`};if(tu>=2||(tu===1&&!u))return{encoding:'TCVN3',confidence:Math.min(.97,.78+tu*.06),evidence:`tcvn-unambiguous:${tu}`};if(u)return{encoding:'Unicode',confidence:.995,evidence:'unicode-valid'};if(q>=2)return{encoding:'VIQR',confidence:Math.min(.95,.72+q*.05),evidence:`viqr:${q}`};if(t>=2)return{encoding:'TCVN3',confidence:Math.min(.90,.72+t*.04),evidence:`tcvn-ambiguous:${t}`};return{encoding:'Unicode',confidence:.86,evidence:'plain'}}
function upperLegacy(style,font,source){const k=`${style||''} ${font||''}`.toUpperCase();if(!/\.VN[A-Z0-9]*H(?:\s|$)|VHTIME|VHARIAL|VHMEMO|VH[A-Z]+/.test(k))return false;const l=[...source].filter(ch=>/[A-Za-z]/.test(ch)),up=l.filter(ch=>/[A-Z]/.test(ch)).length,lo=l.filter(ch=>/[a-z]/.test(ch)).length;return l.length>=3&&up>=3&&up>=Math.max(1,lo*2)}
function decodeTcvn(text,style,font){let changed=false,out='';for(const ch of String(text??'')){if(TCVN3_MAP.has(ch)){out+=TCVN3_MAP.get(ch);changed=true}else out+=ch}if(changed&&upperLegacy(style,font,text))out=out.toLocaleUpperCase('vi-VN');return out.normalize('NFC')}
function replaceTokens(text,map,keys,isViqr=false){text=String(text??'');let out='',i=0;while(i<text.length){if(isViqr&&text[i]==='\\'&&i+1<text.length){out+=text[i+1];i+=2;continue}let hit='';for(const k of keys){if(text.startsWith(k,i)){hit=k;break}}if(hit){out+=map[hit];i+=hit.length}else out+=text[i++]}return out.normalize('NFC')}
function toUnicode(text,opt={}){const source=String(text??''),mode=String(opt.mode||'AUTO').toUpperCase(),det=mode==='AUTO'?detect(source,opt.styleName,opt.fontFile):{encoding:mode,confidence:1,evidence:'forced'},threshold=Number.isFinite(+opt.threshold)?+opt.threshold:.8;let enc=mode==='AUTO'?det.encoding:mode;if(mode==='AUTO'&&det.confidence<threshold)enc='Unicode';let value=source;if(enc==='TCVN3')value=decodeTcvn(source,opt.styleName,opt.fontFile);else if(enc==='VNI')value=replaceTokens(source,VNI,VNI_KEYS);else if(enc==='VIQR')value=replaceTokens(source,VIQR,VIQR_KEYS,true);else value=source.normalize('NFC');return{value,changed:value!==source,encoding:det.encoding,confidence:det.confidence,evidence:det.evidence}}
function recommendFont(style,font,current){const k=`${style||''} ${font||''} ${current||''}`.toUpperCase();if(/TIME|ROMAN|MEMO|SERIF/.test(k))return'"Times New Roman", "Liberation Serif", serif';if(/ARIAL|HELV|SWISS/.test(k))return'Arial, "Segoe UI", sans-serif';return'Arial, "Segoe UI", sans-serif'}
globalThis.DwgVietnameseNormalizerV02253=Object.freeze({version:'0.22.5.3',detect,toUnicode,recommendFont,looksTcvnFont,looksVniFont});
})();
