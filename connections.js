import { geometryKey } from "./layout.js";
function connectionPoint(item,side){
  const x=item.x,y=item.y,w=item.width||220,h=item.height||190;
  if(side==="top")return{x:x+w/2,y};
  if(side==="bottom")return{x:x+w/2,y:y+h};
  if(side==="left")return{x,y:y+h/2};
  return{x:x+w,y:y+h/2};
}
export function routeConnection(line,d,key=geometryKey(d.elements)){
  const a=d.elements.find(e=>e.id===line.from),b=d.elements.find(e=>e.id===line.to);
  if(!a||!b)return null;
  if (line.route?.key === key && line.route.points?.length > 1) {
    const pts = line.route.points.map(p => ({...p}));
    // Attach the saved orthogonal route to the visible decision diamond.
    for (const item of [a,b]) {
      if (item.shape !== "decision") continue;
      const at=item===a?0:pts.length-1,next=item===a?1:pts.length-2;
      const p=pts[at],q=pts[next],vertical=Math.abs(p.x-q.x)<.5;
      const side=vertical?(p.y<item.y+item.height/2?"top":"bottom"):(p.x<item.x+item.width/2?"left":"right");
      const tip=connectionPoint(item,side);
      pts[at]=tip;
      if(vertical)q.x=tip.x;else q.y=tip.y;
    }
    const midpoint=pts[Math.floor(pts.length/2)];
    return {dPath:pts.map((p,i)=>`${i?"L":"M"} ${p.x} ${p.y}`).join(" "),label:line.route.label||{...midpoint,anchor:"middle"}};
  }
  const center=e=>({x:e.x+(e.width||220)/2,y:e.y+(e.height||190)/2});
  const ca=center(a),cb=center(b),sides=["top","right","bottom","left"];
  const targetSide=node=>{
    const target=center(node),dx=target.x-ca.x,dy=target.y-ca.y;
    if(Math.abs(dy)>(a.height||105)/2+(node.height||105)/2)return dy>0?'bottom':'top';
    return dx>=0?'right':'left';
  };
  let preferredSource=targetSide(b);
  if(a.shape==='decision'){
    const other=d.elements.filter(e=>e.type==='connector'&&e.from===a.id&&e.id!==line.id).map(e=>d.elements.find(n=>n.id===e.to)).filter(Boolean);
    if(!/^(não|nao|no|false)$/i.test(String(line.text||'').trim())&&other.some(n=>targetSide(n)===preferredSource))preferredSource=cb.x>=ca.x?'right':'left';
  }
  const vector={top:{x:0,y:-1},right:{x:1,y:0},bottom:{x:0,y:1},left:{x:-1,y:0}};
  const obstacles=d.elements.filter(e=>e.id!==a.id&&e.id!==b.id&&e.type!=="connector"&&e.type!=="lane");
  const stub=24;
  const compact=points=>{
    const unique=points.filter((p,i)=>i===0||Math.abs(p.x-points[i-1].x)>.5||Math.abs(p.y-points[i-1].y)>.5);
    return unique.filter((p,i,all)=>i===0||i===all.length-1||!((Math.abs(p.x-all[i-1].x)<.5&&Math.abs(p.x-all[i+1].x)<.5)||(Math.abs(p.y-all[i-1].y)<.5&&Math.abs(p.y-all[i+1].y)<.5)));
  };
  const blocked=(p1,p2,o)=>{
    const pad=12,left=o.x-pad,right=o.x+(o.width||220)+pad,top=o.y-pad,bottom=o.y+(o.height||190)+pad;
    if(Math.abs(p1.y-p2.y)<.5)return p1.y>top&&p1.y<bottom&&Math.max(Math.min(p1.x,p2.x),left)<Math.min(Math.max(p1.x,p2.x),right);
    if(Math.abs(p1.x-p2.x)<.5)return p1.x>left&&p1.x<right&&Math.max(Math.min(p1.y,p2.y),top)<Math.min(Math.max(p1.y,p2.y),bottom);
    return true;
  };
  const length=pts=>pts.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-pts[i].x)+Math.abs(p.y-pts[i].y),0);
  let best=null;
  const horizontalChannels=[...new Set(d.elements.filter(e=>e.type==='lane').flatMap(e=>[e.y+42,e.y+e.height-18]).concat([a.y-28,a.y+(a.height||105)+28,b.y-28,b.y+(b.height||105)+28]))];
  const verticalChannels=[...new Set([a.x-32,a.x+(a.width||180)+32,b.x-32,b.x+(b.width||180)+32])];
  const evaluate=(points,directionPenalty)=>{
    const pts=compact(points);let collisions=0;
    for(let i=1;i<pts.length;i++){
      for(const obstacle of obstacles)if(blocked(pts[i-1],pts[i],obstacle))collisions++;
      // Interior segments also avoid doubling back through their own endpoints.
      if(i>1&&blocked(pts[i-1],pts[i],a))collisions++;
      if(i<pts.length-1&&blocked(pts[i-1],pts[i],b))collisions++;
    }
    const score=collisions*100000+directionPenalty*120+length(pts)+Math.max(0,pts.length-2)*16;
    if(!best||score<best.score)best={pts,score};
  };
  for(const fromSide of sides)for(const toSide of sides)for(const horizontalFirst of [true,false]){
    const start=connectionPoint(a,fromSide),end=connectionPoint(b,toSide);
    const p1={x:start.x+vector[fromSide].x*stub,y:start.y+vector[fromSide].y*stub};
    const p4={x:end.x+vector[toSide].x*stub,y:end.y+vector[toSide].y*stub};
    const bend=horizontalFirst?{x:p4.x,y:p1.y}:{x:p1.x,y:p4.y};
    const toward={x:cb.x-ca.x,y:cb.y-ca.y};
    const sourceDot=vector[fromSide].x*toward.x+vector[fromSide].y*toward.y;
    const targetDot=vector[toSide].x*(-toward.x)+vector[toSide].y*(-toward.y);
    const directionPenalty=(sourceDot<0?1:0)+(targetDot<0?1:0)+(a.shape==='decision'&&fromSide!==preferredSource?12:0);
    evaluate([start,p1,bend,p4,end],directionPenalty);
    if(horizontalFirst){
      for(const x of verticalChannels)evaluate([start,p1,{x,y:p1.y},{x,y:p4.y},p4,end],directionPenalty);
      for(const y of horizontalChannels)evaluate([start,p1,{x:p1.x,y},{x:p4.x,y},p4,end],directionPenalty);
    }
  }
  if(!best)return null;
  const dPath=best.pts.map((p,i)=>`${i?"L":"M"} ${p.x} ${p.y}`).join(" ");
  let label=null,maxLength=-1;
  for(let i=1;i<best.pts.length;i++){
    const p1=best.pts[i-1],p2=best.pts[i],segLength=Math.abs(p2.x-p1.x)+Math.abs(p2.y-p1.y);
    if(segLength>maxLength){maxLength=segLength;label={x:(p1.x+p2.x)/2+(Math.abs(p1.x-p2.x)<1?8:0),y:(p1.y+p2.y)/2-(Math.abs(p1.y-p2.y)<1?8:0),anchor:Math.abs(p1.x-p2.x)<1?"start":"middle"};}
  }
  // Branch labels belong beside the decision's outgoing segment, before the
  // first bend, so a shared return rail cannot swap the meaning of Yes and No.
  if(a.shape==='decision'&&line.text&&best.pts.length>1){
    const p=best.pts[0],q=best.pts[1],vertical=Math.abs(p.x-q.x)<.5;
    label={x:vertical?p.x+9:p.x+(q.x>p.x?22:-22),y:vertical?p.y+(q.y>p.y?20:-12):p.y-9,anchor:vertical?'start':'middle'};
  }
  return{dPath,label};
}

